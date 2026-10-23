const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Card = require('../models/Card');
const Location = require('../models/Location');
const InventoryAudit = require('../models/InventoryAudit');
const CardLoan = require('../models/CardLoan');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');

let mongod;
let app;

beforeAll(async () => {
  process.env.MULTI_USER_ENABLED = 'false';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Card.init(), Location.init(), InventoryAudit.init(), CardLoan.init(), CardPriceSnapshot.init()]);

  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.get('x-test-user')) {
      req.user = { _id: new mongoose.Types.ObjectId(req.get('x-test-user')), role: 'admin' };
    }
    next();
  });
  app.use('/api/inventory-audits', require('../routes/inventoryAudits'));
  app.use('/api/card-loans', require('../routes/cardLoans'));
  app.use('/api/price-movers', require('../routes/priceMovers'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Card.deleteMany({}),
    Location.deleteMany({}),
    InventoryAudit.deleteMany({}),
    CardLoan.deleteMany({}),
    CardPriceSnapshot.deleteMany({})
  ]);
});

describe('location inventory audits', () => {
  test('requires counts, saves discrepancies, and completes without mutating collection quantities', async () => {
    const location = await Location.create({ name: 'Trade Binder' });
    const card = await Card.create({ name: 'Lightning Bolt', set: 'Alpha', quantity: 3, condition: 'NM', price: 1, location: location.name });

    const created = await request(app).post('/api/inventory-audits').send({ locationId: location._id });
    expect(created.status).toBe(201);
    expect(created.body.items).toHaveLength(1);

    const incomplete = await request(app).post(`/api/inventory-audits/${created.body._id}/complete`);
    expect(incomplete.status).toBe(400);

    const saved = await request(app).put(`/api/inventory-audits/${created.body._id}/counts`).send({
      items: [{ cardId: card._id.toString(), countedQuantity: 2 }]
    });
    expect(saved.status).toBe(200);
    expect(saved.body.items[0].countedQuantity).toBe(2);

    const completed = await request(app).post(`/api/inventory-audits/${created.body._id}/complete`);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
    expect((await Card.findById(card._id)).quantity).toBe(3);
  });

  test('prevents two active audits for one location', async () => {
    const location = await Location.create({ name: 'Deck Box' });
    const first = await request(app).post('/api/inventory-audits').send({ locationId: location._id });
    const second = await request(app).post('/api/inventory-audits').send({ locationId: location._id });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });
});

describe('card lending', () => {
  test('limits open loans to owned quantity and restores availability when returned', async () => {
    const card = await Card.create({ name: 'Sol Ring', quantity: 2, condition: 'NM', price: 1 });
    const lent = await request(app).post('/api/card-loans').send({
      cardId: card._id.toString(),
      borrower: 'Alex',
      quantity: 2
    });
    expect(lent.status).toBe(201);

    const overLend = await request(app).post('/api/card-loans').send({
      cardId: card._id.toString(),
      borrower: 'Sam',
      quantity: 1
    });
    expect(overLend.status).toBe(400);
    expect(overLend.body.available).toBe(0);

    const returned = await request(app).put(`/api/card-loans/${lent.body._id}/return`);
    expect(returned.status).toBe(200);
    expect(returned.body.status).toBe('returned');

    const nextLoan = await request(app).post('/api/card-loans').send({
      cardId: card._id.toString(),
      borrower: 'Sam',
      quantity: 1
    });
    expect(nextLoan.status).toBe(201);
  });

  test('keeps loans and audits private to their owner in multi-user mode', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();
    const location = await Location.create({ userId: ownerId, name: 'Owner Binder' });
    const card = await Card.create({
      userId: ownerId,
      name: 'Arcane Signet',
      set: 'Commander',
      location: location.name,
      quantity: 1,
      condition: 'NM',
      price: 1
    });

    process.env.MULTI_USER_ENABLED = 'true';
    try {
      const foreignAudit = await request(app)
        .post('/api/inventory-audits')
        .set('x-test-user', otherId.toString())
        .send({ locationId: location._id.toString() });
      expect(foreignAudit.status).toBe(404);

      const audit = await request(app)
        .post('/api/inventory-audits')
        .set('x-test-user', ownerId.toString())
        .send({ locationId: location._id.toString() });
      expect(audit.status).toBe(201);

      const foreignAudits = await request(app)
        .get('/api/inventory-audits')
        .set('x-test-user', otherId.toString());
      expect(foreignAudits.body).toHaveLength(0);

      const foreignLoan = await request(app)
        .post('/api/card-loans')
        .set('x-test-user', otherId.toString())
        .send({ cardId: card._id.toString(), borrower: 'Nobody' });
      expect(foreignLoan.status).toBe(404);

      const loan = await request(app)
        .post('/api/card-loans')
        .set('x-test-user', ownerId.toString())
        .send({ cardId: card._id.toString(), borrower: 'Friend' });
      expect(loan.status).toBe(201);
    } finally {
      process.env.MULTI_USER_ENABLED = 'false';
    }
  });
});

describe('collection price movers', () => {
  test('returns biggest percentage movers for the selected time period', async () => {
    const userId = new mongoose.Types.ObjectId();
    const gain = await Card.create({ userId, name: 'Gaining Card', quantity: 2, condition: 'NM', price: 15 });
    const loss = await Card.create({ userId, name: 'Losing Card', quantity: 1, condition: 'NM', price: 6 });
    const oldDate = new Date(Date.now() - 6 * 86400000);
    const now = new Date();
    await CardPriceSnapshot.create([
      { userId, cardId: gain._id, price: 10, createdAt: oldDate },
      { userId, cardId: gain._id, price: 12, createdAt: now },
      { userId, cardId: loss._id, price: 10, createdAt: oldDate },
      { userId, cardId: loss._id, price: 8, createdAt: now }
    ]);

    const response = await request(app).get('/api/price-movers?days=7');
    expect(response.status).toBe(200);
    expect(response.body.gainers[0]).toMatchObject({ name: 'Gaining Card', changePct: 50, collectionChange: 10 });
    expect(response.body.decliners[0]).toMatchObject({ name: 'Losing Card', changePct: -40, collectionChange: -4 });
  });

  test('rejects unsupported history ranges', async () => {
    const response = await request(app).get('/api/price-movers?days=14');
    expect(response.status).toBe(400);
  });
});

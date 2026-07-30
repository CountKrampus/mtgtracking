process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  price: { type: Number, default: 0 },
  lastPrice: { type: Number, default: 0 },
  isFoil: { type: Boolean, default: false }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

const User = require('../models/User');
const PriceFlag = require('../models/PriceFlag');
const ModerationHistory = require('../models/ModerationHistory');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Card.deleteMany({});
  await User.deleteMany({});
  await PriceFlag.deleteMany({});
  await ModerationHistory.deleteMany({});
  jest.clearAllMocks();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

function makeToken(userId, role = 'editor') {
  return jwt.sign({ userId: userId.toString(), role }, 'test-secret');
}

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`, username: `user_${suffix}`,
    passwordHash: 'x', role: 'editor', isActive: true, ...overrides,
  });
}

describe('GET /api/admin/price-flags', () => {
  it('defaults to pending flags, populated with card and flagger info', async () => {
    const admin = await createUser({ role: 'admin' });
    const flagger = await createUser({ reputation: 60 });
    const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
    await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, reason: 'Too high', status: 'pending' });
    await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'resolved' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/admin/price-flags')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].cardId.name).toBe('Test Card');
    expect(res.body[0].flaggedBy.reputation).toBe(60);
  });

  it('returns all flags when status=all', async () => {
    const admin = await createUser({ role: 'admin' });
    const flagger = await createUser({ reputation: 60 });
    const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
    await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'pending' });
    await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'dismissed' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/admin/price-flags?status=all')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .expect(200);

    expect(res.body.length).toBe(2);
  });

  it('rejects a non-moderator, non-admin user', async () => {
    const editor = await createUser({ role: 'editor' });
    const app = buildApp();
    await request(app)
      .get('/api/admin/price-flags')
      .set('Authorization', `Bearer ${makeToken(editor._id, 'editor')}`)
      .expect(403);
  });

  it('returns 401 without a token', async () => {
    const app = buildApp();
    await request(app).get('/api/admin/price-flags').expect(401);
  });
});

describe('PUT /api/admin/price-flags/:id', () => {
  it('resolve triggers a forced price refresh and writes a ModerationHistory entry', async () => {
    const admin = await createUser({ role: 'admin' });
    const flagger = await createUser({ reputation: 60 });
    const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
    const flag = await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'pending' });
    axios.get.mockResolvedValue({ data: { prices: { usd: '12.34' } } });

    const app = buildApp();
    const res = await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ action: 'resolve' })
      .expect(200);

    expect(res.body.status).toBe('resolved');
    expect(res.body.resolvedBy).toBe(admin._id.toString());

    const updatedCard = await Card.findById(card._id);
    expect(updatedCard.price).toBe(12.34);
    expect(updatedCard.lastPrice).toBe(5);

    const history = await ModerationHistory.findOne({ actionType: 'price_update' });
    expect(history).not.toBeNull();
    expect(history.actionDetails.action).toBe('resolve');
  });

  it('dismiss does not change the card price', async () => {
    const admin = await createUser({ role: 'admin' });
    const flagger = await createUser({ reputation: 60 });
    const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
    const flag = await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'pending' });

    const app = buildApp();
    const res = await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ action: 'dismiss' })
      .expect(200);

    expect(res.body.status).toBe('dismissed');
    expect(axios.get).not.toHaveBeenCalled();

    const unchangedCard = await Card.findById(card._id);
    expect(unchangedCard.price).toBe(5);
  });

  it('rejects an invalid action', async () => {
    const admin = await createUser({ role: 'admin' });
    const flagger = await createUser({ reputation: 60 });
    const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
    const flag = await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'pending' });

    const app = buildApp();
    await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ action: 'delete' })
      .expect(400);
  });
});

process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Card is registered dynamically by server.js; register a minimal version here
// so routes/priceFlags.js's mongoose.model('Card') lookup succeeds in tests.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  price: { type: Number, default: 0 },
  isFoil: { type: Boolean, default: false }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

const User = require('../models/User');
const PriceFlag = require('../models/PriceFlag');

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
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cards', require('../routes/priceFlags'));
  return app;
}

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'editor' }, 'test-secret');
}

async function createUser(reputation = 0) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`, username: `user_${suffix}`,
    passwordHash: 'x', role: 'editor', isActive: true, reputation,
  });
}

describe('POST /api/cards/:id/flag-price', () => {
  it('rejects a user with reputation below 50', async () => {
    const user = await createUser(20);
    const card = await Card.create({ userId: user._id, name: 'Test Card', price: 5 });

    const app = buildApp();
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ reason: 'Price seems wrong' })
      .expect(403);
  });

  it('creates a flag for a user with reputation >= 50', async () => {
    const user = await createUser(50);
    const card = await Card.create({ userId: user._id, name: 'Test Card', price: 5 });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ reason: 'Price seems wrong' })
      .expect(201);

    expect(res.body.cardId).toBe(card._id.toString());
    expect(res.body.flaggedBy).toBe(user._id.toString());
    expect(res.body.status).toBe('pending');
    expect(res.body.reason).toBe('Price seems wrong');
  });

  it('returns 409 for a duplicate pending flag on the same card by the same user', async () => {
    const user = await createUser(100);
    const card = await Card.create({ userId: user._id, name: 'Test Card', price: 5 });

    const app = buildApp();
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({})
      .expect(201);

    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({})
      .expect(409);

    expect(res.body.message).toMatch(/already have a pending flag/i);
  });

  it('allows a new flag after the prior one was resolved (not pending anymore)', async () => {
    const user = await createUser(100);
    const card = await Card.create({ userId: user._id, name: 'Test Card', price: 5 });
    await PriceFlag.create({ cardId: card._id, flaggedBy: user._id, status: 'resolved' });

    const app = buildApp();
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({})
      .expect(201);
  });

  it('returns 404 for a card belonging to another user', async () => {
    const owner = await createUser(100);
    const intruder = await createUser(100);
    const card = await Card.create({ userId: owner._id, name: 'Test Card', price: 5 });

    const app = buildApp();
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${makeToken(intruder._id)}`)
      .send({})
      .expect(404);
  });

  it('returns 401 without a token', async () => {
    const user = await createUser(100);
    const card = await Card.create({ userId: user._id, name: 'Test Card', price: 5 });

    const app = buildApp();
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .send({})
      .expect(401);
  });
});

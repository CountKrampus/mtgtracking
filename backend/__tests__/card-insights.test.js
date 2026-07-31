process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

// Card is registered dynamically by server.js; register a minimal version here
// so routes/cardInsights.js's mongoose.model('Card') lookup succeeds in tests.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  quantity: { type: Number, default: 1 },
  condition: String,
  price: { type: Number, default: 0 },
  types: [String],
  colors: [String],
  oracleText: String
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

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
  await User.deleteMany({});
  await Card.deleteMany({});
  jest.clearAllMocks();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/cards', require('../routes/cardInsights'));
  return app;
}

describe('GET /api/cards/:id/similar', () => {
  test('queries Scryfall by type and color and returns up to 20 results', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Grizzly Bears', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['G']
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Runeclaw Bear' }, { name: 'Watchwolf' }] } });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/cards/${card._id}/similar`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('t%3Acreature'));
  });

  test('404s for a card the caller does not own', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    const app = buildApp();
    await request(app)
      .get(`/api/cards/${new mongoose.Types.ObjectId()}/similar`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(404);
  });
});

describe('GET /api/cards/:id/synergies', () => {
  test('detects tribal synergy from oracle text and returns categorized results', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Goblin Chieftain', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['R'],
      oracleText: 'Goblin creatures you control get +1/+1 and have haste.'
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Goblin Warchief' }] } });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/cards/${card._id}/synergies`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body.tribal.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('keywords');
    expect(res.body).toHaveProperty('mechanics');
  });
});

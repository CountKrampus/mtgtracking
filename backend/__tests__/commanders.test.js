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
// so routes/commanders.js's mongoose.model('Card') lookup succeeds in tests.
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
const { ApiCache } = require('../utils/apiCache');

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
  await ApiCache.deleteMany({});
  jest.clearAllMocks();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/commanders', require('../routes/commanders'));
  return app;
}

describe('GET /api/commanders/recommend', () => {
  test('with no colors argument, searches without a color-identity restriction', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    await Card.create({
      userId: user._id, name: 'Goblin Rally', quantity: 1, condition: 'NM', price: 0,
      colors: ['R'], oracleText: 'Create three 1/1 red Goblin creature tokens.'
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Krenko, Mob Boss' }] } });

    const app = buildApp();
    const res = await request(app)
      .get('/api/commanders/recommend')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).not.toMatch(/id[:<]/);
    expect(calledUrl).toContain('t%3Alegendary');
  });

  test('with a colors argument, restricts the query to that color identity', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    axios.get.mockResolvedValue({ data: { data: [] } });

    const app = buildApp();
    await request(app)
      .get('/api/commanders/recommend?colors=UB')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toMatch(/id%3Aub|id:ub/i);
  });

  test('falls back to a plain legendary-creature search on Scryfall error', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    axios.get.mockRejectedValueOnce(new Error('scryfall down'))
      .mockResolvedValueOnce({ data: { data: [{ name: 'The Ur-Dragon' }] } });

    const app = buildApp();
    const res = await request(app)
      .get('/api/commanders/recommend')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toEqual([{ name: 'The Ur-Dragon' }]);
  });

  test('caches the Scryfall query so a second identical request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'user4', passwordHash: 'x', role: 'editor' });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Krenko, Mob Boss' }] } });

    const app = buildApp();
    await request(app).get('/api/commanders/recommend').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    await request(app).get('/api/commanders/recommend').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

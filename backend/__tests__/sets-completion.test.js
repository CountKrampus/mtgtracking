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
// so routes/sets.js's mongoose.model('Card') lookup succeeds in tests.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  set: String,
  setCode: String,
  quantity: { type: Number, default: 1 },
  condition: String,
  price: { type: Number, default: 0 }
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
  app.use('/api/sets', require('../routes/sets'));
  return app;
}

describe('GET /api/sets/completion', () => {
  test('returns owned/total counts per set, sorted by completion percentage descending', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    await Card.create([
      { userId: user._id, name: 'Card A', set: 'Alpha', setCode: 'lea', quantity: 1, condition: 'NM', price: 0 },
      { userId: user._id, name: 'Card B', set: 'Beta', setCode: 'leb', quantity: 1, condition: 'NM', price: 0 },
      { userId: user._id, name: 'Card C', set: 'Beta', setCode: 'leb', quantity: 2, condition: 'NM', price: 0 }
    ]);
    axios.get.mockImplementation((url) => {
      if (url.includes('/sets/lea')) return Promise.resolve({ data: { name: 'Limited Edition Alpha', card_count: 100, released_at: '1993-08-05', set_type: 'core' } });
      if (url.includes('/sets/leb')) return Promise.resolve({ data: { name: 'Limited Edition Beta', card_count: 10, released_at: '1993-10-01', set_type: 'core' } });
      return Promise.reject(new Error('unexpected set code'));
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/sets/completion')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    // Beta: 2 unique / 10 = 20%, Alpha: 1 unique / 100 = 1% -> Beta first
    expect(res.body[0].setCode).toBe('LEB');
    expect(res.body[0].ownedUnique).toBe(2);
    expect(res.body[0].totalOwned).toBe(3);
    expect(res.body[0].totalInSet).toBe(10);
  });

  test('skips sets Scryfall cannot find without failing the whole request', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    await Card.create({ userId: user._id, name: 'Card A', set: 'Unknown', setCode: 'zzz', quantity: 1, condition: 'NM', price: 0 });
    axios.get.mockRejectedValue(new Error('not found'));

    const app = buildApp();
    const res = await request(app)
      .get('/api/sets/completion')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  test('caches set metadata so a second request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    await Card.create({ userId: user._id, name: 'Card A', set: 'Alpha', setCode: 'lea', quantity: 1, condition: 'NM', price: 0 });
    axios.get.mockResolvedValue({ data: { name: 'Limited Edition Alpha', card_count: 100, released_at: '1993-08-05', set_type: 'core' } });

    const app = buildApp();
    await request(app).get('/api/sets/completion').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    await request(app).get('/api/sets/completion').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

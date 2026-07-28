process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  set: String,
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  condition: String,
});
const Card = mongoose.model('Card', cardSchema);

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
  await mongoose.connection.dropDatabase();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/usersPublic'));
  return app;
}

describe('GET /api/users/:username/compare', () => {
  let app, me;

  beforeEach(async () => {
    app = buildApp();
    me = await User.create({ email: 'me@test.com', username: 'testme', passwordHash: 'x', role: 'user' });
  });

  test('401 without auth', async () => {
    await request(app).get('/api/users/alice/compare').expect(401);
  });

  test('404 — target user not found', async () => {
    const res = await request(app)
      .get('/api/users/ghost/compare')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('403 — target user has private collection', async () => {
    await User.create({
      email: 'alice@test.com', username: 'alice', passwordHash: 'x', role: 'user',
      privacy: { showCollection: false }
    });

    const res = await request(app)
      .get('/api/users/alice/compare')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(403);
    expect(res.body.message).toMatch(/private/i);
  });

  test('200 — returns correct comparison shape and set-difference logic', async () => {
    const alice = await User.create({
      email: 'alice@test.com', username: 'alice', passwordHash: 'x', role: 'user',
      avatarUrl: 'https://example.com/avatar.jpg', reputation: 5,
      privacy: { showCollection: true }
    });

    await Card.create([
      { userId: me._id, name: 'Lightning Bolt', set: 'M21', price: 1.5, condition: 'NM', quantity: 2 },
      { userId: me._id, name: 'Counterspell', set: 'MM2', price: 3.0, condition: 'LP', quantity: 1 },
      { userId: alice._id, name: 'Counterspell', set: 'MM2', price: 3.0, condition: 'NM', quantity: 1 },
      { userId: alice._id, name: 'Sol Ring', set: 'C21', price: 2.0, condition: 'NM', quantity: 1 },
    ]);

    const res = await request(app)
      .get('/api/users/alice/compare')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.targetUser.username).toBe('alice');
    expect(res.body.targetUser.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(res.body.targetUser.reputation).toBe(5);

    const theyNames = res.body.theyHaveYouDont.map(c => c.name);
    const youNames = res.body.youHaveTheyDont.map(c => c.name);
    expect(theyNames).toContain('Sol Ring');
    expect(theyNames).not.toContain('Counterspell');
    expect(youNames).toContain('Lightning Bolt');
    expect(youNames).not.toContain('Counterspell');

    expect(res.body.theirTotal).toBeCloseTo(2.0);
    expect(res.body.yourTotal).toBeCloseTo(1.5);
    expect(res.body.balance).toBeCloseTo(0.5);
  });

  test('200 — results sorted by price descending, capped at 200', async () => {
    const bigcollector = await User.create({
      email: 'big@test.com', username: 'bigcollector', passwordHash: 'x', role: 'user',
      privacy: { showCollection: true }
    });

    const bigCollection = Array.from({ length: 300 }, (_, i) => ({
      userId: bigcollector._id,
      name: `Card${i}`,
      set: 'TST',
      price: i * 0.1,
      condition: 'NM',
      quantity: 1,
    }));
    await Card.insertMany(bigCollection);

    const res = await request(app)
      .get('/api/users/bigcollector/compare')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.theyHaveYouDont.length).toBeLessThanOrEqual(200);
    expect(res.body.theyHaveYouDont[0].price).toBeGreaterThanOrEqual(
      res.body.theyHaveYouDont[1].price
    );
  });
});

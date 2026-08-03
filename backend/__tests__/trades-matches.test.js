process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TradeListing = require('../models/TradeListing');
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
  await mongoose.connection.dropDatabase();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/trades', require('../routes/trades'));
  return app;
}

describe('GET /api/trades/matches', () => {
  let app, me, other;

  beforeEach(async () => {
    app = buildApp();
    me = await User.create({ email: 'me@test.com', username: 'meuser', passwordHash: 'x', role: 'user' });
    other = await User.create({ email: 'other@test.com', username: 'other', passwordHash: 'x', role: 'user' });
  });

  test('401 without auth', async () => {
    await request(app).get('/api/trades/matches').expect(401);
  });

  test('finds another user\'s want listing matching one of your have listings', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'sol ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(1);
    expect(res.body.havesTheyWant[0].listing.cardName).toBe('Sol Ring');
    expect(res.body.havesTheyWant[0].matches).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches[0].username).toBe('other');
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });

  test('finds another user\'s have listing matching one of your want listings', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'want', cardName: 'Counterspell', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'have', cardName: 'Counterspell', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.wantsTheyHave).toHaveLength(1);
    expect(res.body.wantsTheyHave[0].listing.cardName).toBe('Counterspell');
    expect(res.body.wantsTheyHave[0].matches).toHaveLength(1);
    expect(res.body.havesTheyWant).toHaveLength(0);
  });

  test('omits your own listings from matching against each other', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'want', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });

  test('ignores cancelled/completed listings on both sides', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'Sol Ring', status: 'cancelled',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
  });

  test('groups multiple matching users under the same listing', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    const other2 = await User.create({ email: 'other2@test.com', username: 'other2', passwordHash: 'x', role: 'user' });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other2._id, username: 'other2', type: 'want', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches).toHaveLength(2);
  });

  test('does not crash and excludes a listing with an empty-string cardName', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'Sol Ring', status: 'active',
    });
    // Bypasses Mongoose validation on purpose (TradeListing.create() would reject
    // an empty cardName - required rejects '' too, not just null/undefined) to
    // simulate a malformed/legacy document that skipped schema validation.
    await TradeListing.collection.insertOne({
      userId: other._id, username: 'other', type: 'want', cardName: '', status: 'active',
      cardSet: '', cardSetCode: '', scryfallId: '', imageUrl: '', condition: 'NM',
      quantity: 1, estimatedValue: 0, notes: '', createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches[0].username).toBe('other');
    expect(res.body.havesTheyWant[0].matches.every(m => m.cardName !== '')).toBe(true);
  });

  test('omits a listing entirely when it has no matches', async () => {
    await TradeListing.create({
      userId: me._id, username: 'meuser', type: 'have', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });
});

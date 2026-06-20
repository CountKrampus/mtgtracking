process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Deck = require('../models/Deck');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

beforeEach(async () => {
  await Deck.syncIndexes();
});

const testUserId = () => new mongoose.Types.ObjectId();

test('shareCode defaults to null', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.shareCode).toBeNull();
});

test('isPublic defaults to false', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.isPublic).toBe(false);
});

test('importCount defaults to 0', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.importCount).toBe(0);
});

test('shareCode can be set and retrieved', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Shared Deck', shareCode: 'abc123def456' });
  const found = await Deck.findById(deck._id);
  expect(found.shareCode).toBe('abc123def456');
});

test('two decks cannot have the same non-null shareCode', async () => {
  await Deck.create({ userId: testUserId(), name: 'Deck A', shareCode: 'uniquecode1' });
  await expect(
    Deck.create({ userId: testUserId(), name: 'Deck B', shareCode: 'uniquecode1' })
  ).rejects.toMatchObject({ code: 11000 });
});

test('multiple decks can have null shareCode', async () => {
  await Deck.create({ userId: testUserId(), name: 'Deck A' });
  await expect(
    Deck.create({ userId: testUserId(), name: 'Deck B' })
  ).resolves.toBeDefined();
});

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'admin' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  // verifyToken populates req.user from the JWT; requireAuth then gates the route
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  const decksRouter = require('../routes/decks');
  // Card model is defined in server.js, not a standalone file.
  // The share/visibility routes don't use Card, so pass null.
  decksRouter.injectDependencies(null, null, null);
  app.use('/api/decks', decksRouter);
  return app;
}

describe('POST /api/decks/:id/share', () => {
  test('generates a shareCode and returns shareUrl', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/decks/${deck._id}/share`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.shareCode).toBeTruthy();
    expect(res.body.shareUrl).toMatch(/^\/shared\/deck\//);

    const updated = await Deck.findById(deck._id);
    expect(updated.shareCode).toBe(res.body.shareCode);
  });

  test('does not regenerate shareCode on second call', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'existing123' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/decks/${deck._id}/share`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.shareCode).toBe('existing123');
  });
});

describe('PATCH /api/decks/:id/visibility', () => {
  test('sets isPublic to true when deck is already shared', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'code123' });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: true });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(true);

    const updated = await Deck.findById(deck._id);
    expect(updated.isPublic).toBe(true);
  });

  test('returns 400 if deck has no shareCode', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'userd', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck' });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/share link/i);
  });

  test('sets isPublic to false (unlist)', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'usere', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'code456', isPublic: true });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: false });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(false);

    const updated = await Deck.findById(deck._id);
    expect(updated.isPublic).toBe(false);
  });
});

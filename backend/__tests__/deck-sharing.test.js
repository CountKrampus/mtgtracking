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

describe('GET /api/decks/shared/:shareCode', () => {
  test('returns deck and owner for a valid shareCode', async () => {
    const user = await User.create({ email: 'f@test.com', username: 'userf', displayName: 'User F', passwordHash: 'h' });
    await Deck.create({
      userId: user._id,
      name: 'Public Deck',
      shareCode: 'pubcode1',
      isPublic: true,
      mainDeck: [{ scryfallId: 'abc', name: 'Lightning Bolt', quantity: 4 }]
    });
    const app = buildApp();

    const res = await request(app).get('/api/decks/shared/pubcode1');

    expect(res.status).toBe(200);
    expect(res.body.deck.name).toBe('Public Deck');
    expect(res.body.deck.mainDeck).toHaveLength(1);
    expect(res.body.owner.username).toBe('userf');
    expect(res.body.owner.displayName).toBe('User F');
  });

  test('returns 404 for unknown shareCode', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/decks/shared/notacode');
    expect(res.status).toBe(404);
  });

  test('works without auth header', async () => {
    const user = await User.create({ email: 'g@test.com', username: 'userg', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Open Deck', shareCode: 'opencode' });
    const app = buildApp();

    const res = await request(app).get('/api/decks/shared/opencode');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/decks/community', () => {
  test('returns only isPublic decks', async () => {
    const user = await User.create({ email: 'h@test.com', username: 'userh', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Private', shareCode: 'priv1', isPublic: false });
    await Deck.create({ userId: user._id, name: 'Public', shareCode: 'pub2', isPublic: true });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Public');
    expect(res.body.total).toBe(1);
  });

  test('filters by format', async () => {
    const user = await User.create({ email: 'i@test.com', username: 'useri', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Commander Deck', shareCode: 'cmd1', isPublic: true, format: 'commander' });
    await Deck.create({ userId: user._id, name: 'Modern Deck', shareCode: 'mod1', isPublic: true, format: 'modern' });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community?format=commander');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Commander Deck');
  });

  test('filters by commander name (case-insensitive)', async () => {
    const user = await User.create({ email: 'j@test.com', username: 'userj', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Atraxa Deck', shareCode: 'at1', isPublic: true, commander: { name: "Atraxa, Praetors' Voice" } });
    await Deck.create({ userId: user._id, name: 'Other Deck', shareCode: 'ot1', isPublic: true, commander: { name: 'Urza, Lord High Artificer' } });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community?commander=atraxa');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Atraxa Deck');
  });

  test('does not include mainDeck in community listing', async () => {
    const user = await User.create({ email: 'k@test.com', username: 'userk', passwordHash: 'h' });
    await Deck.create({
      userId: user._id, name: 'Listed', shareCode: 'lst1', isPublic: true,
      mainDeck: [{ scryfallId: 'x', name: 'Forest', quantity: 40 }]
    });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
    expect(res.body.decks[0].mainDeck).toBeUndefined();
    expect(res.body.decks[0].cardCount).toBe(1);
  });

  test('works without auth header', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
  });
});

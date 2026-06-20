const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const Deck = require('../models/Deck');

/**
 * Create a signed JWT for the given userId.
 * Must match the secret in jest.setup.js ('test-secret').
 */
function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

/**
 * Build a minimal Express app that mirrors the server.js mount order:
 *   1. Public users routes (no auth)
 *   2. Auth-protected users routes
 *
 * Jest setup sets MULTI_USER_ENABLED=true, so real JWT tokens are required
 * for authenticated endpoints. Pass a token via the Authorization header.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  // Mount public route first (same pattern as server.js)
  app.use('/api/users', require('../routes/usersPublic'));
  // Auth-protected routes
  app.use('/api/users', require('../routes/users'));
  return app;
}

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

// ---------------------------------------------------------------------------
// GET /api/users/:username/public-profile
// ---------------------------------------------------------------------------
describe('GET /api/users/:username/public-profile', () => {
  it('returns 404 for unknown username', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/users/unknownuser/public-profile');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns basic profile fields with pinnedCards null when no unlock purchased', async () => {
    await User.create({
      email: 'alice@test.com',
      username: 'alice',
      passwordHash: 'hash',
      role: 'user',
      reputation: 42,
      privacy: { isPublic: true },
    });

    const app = buildApp();
    const res = await request(app).get('/api/users/alice/public-profile');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.reputation).toBe(42);
    expect(res.body.pinnedCards).toBeNull();
    expect(res.body.publicDecks).toBeNull();
    expect(res.body.collectionStats).toBeNull();
    expect(res.body.wishlistPreview).toBeNull();
  });

  it('returns empty pinnedCards array when favoriteCardsShowcase unlock is purchased', async () => {
    const user = await User.create({
      email: 'bob@test.com',
      username: 'bob',
      passwordHash: 'hash',
      role: 'user',
      privacy: { isPublic: true },
    });

    const cosmetic = await Cosmetic.create({
      name: 'Favorite Cards Showcase',
      category: 'favoriteCardsShowcase',
      cost: 500,
      isActive: true,
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: {
        purchased: [cosmetic._id.toString()],
      },
    });

    const app = buildApp();
    const res = await request(app).get('/api/users/bob/public-profile');
    expect(res.status).toBe(200);
    // pinnedCards is revealed (empty array, since user has none set)
    expect(Array.isArray(res.body.pinnedCards)).toBe(true);
  });

  it('shows pinnedCards content when unlock purchased and cards are set', async () => {
    const user = await User.create({
      email: 'carol@test.com',
      username: 'carol',
      passwordHash: 'hash',
      role: 'user',
      privacy: { isPublic: true },
      pinnedCards: [
        { scryfallId: 'abc123', name: 'Lightning Bolt', imageUrl: 'http://example.com/bolt.jpg' },
      ],
    });

    const cosmetic = await Cosmetic.create({
      name: 'Favorite Cards Showcase',
      category: 'favoriteCardsShowcase',
      cost: 500,
      isActive: true,
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: [cosmetic._id.toString()] },
    });

    const app = buildApp();
    const res = await request(app).get('/api/users/carol/public-profile');
    expect(res.status).toBe(200);
    expect(res.body.pinnedCards).toHaveLength(1);
    expect(res.body.pinnedCards[0].name).toBe('Lightning Bolt');
  });

  it('returns 404 for inactive users', async () => {
    await User.create({
      email: 'inactive@test.com',
      username: 'inactiveuser',
      passwordHash: 'hash',
      role: 'user',
      isActive: false,
    });

    const app = buildApp();
    const res = await request(app).get('/api/users/inactiveuser/public-profile');
    expect(res.status).toBe(404);
  });

  it('returns 404 when privacy.isPublic is false (active user with private profile)', async () => {
    await User.create({
      email: 'private@test.com',
      username: 'privateuser',
      passwordHash: 'hash',
      role: 'user',
      privacy: { isPublic: false },
    });

    const app = buildApp();
    const res = await request(app).get('/api/users/privateuser/public-profile');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns publicDecks when deckShowcase cosmetic is purchased and user has public decks', async () => {
    const user = await User.create({
      email: 'deckuser@test.com',
      username: 'deckuser',
      passwordHash: 'hash',
      role: 'user',
      privacy: { isPublic: true, showDecks: true },
    });

    const cosmetic = await Cosmetic.create({
      name: 'Deck Showcase',
      category: 'deckShowcase',
      cost: 500,
      isActive: true,
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: [cosmetic._id.toString()] },
    });

    await Deck.create({ userId: user._id, name: 'My Deck', isPublic: true });

    const app = buildApp();
    const res = await request(app).get('/api/users/deckuser/public-profile');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.publicDecks)).toBe(true);
    expect(res.body.publicDecks).toHaveLength(1);
    expect(res.body.publicDecks[0].name).toBe('My Deck');
  });

  it('returns null for publicDecks when privacy.showDecks is false even if deckShowcase is purchased', async () => {
    const user = await User.create({
      email: 'nodecks@test.com',
      username: 'nodecksuser',
      passwordHash: 'hash',
      role: 'user',
      privacy: { isPublic: true, showDecks: false },
    });

    const cosmetic = await Cosmetic.create({
      name: 'Deck Showcase',
      category: 'deckShowcase',
      cost: 500,
      isActive: true,
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: [cosmetic._id.toString()] },
    });

    await Deck.create({ userId: user._id, name: 'Hidden Deck', isPublic: true });

    const app = buildApp();
    const res = await request(app).get('/api/users/nodecksuser/public-profile');
    expect(res.status).toBe(200);
    expect(res.body.publicDecks).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/me/unlock-status
// ---------------------------------------------------------------------------
describe('GET /api/users/me/unlock-status', () => {
  it('returns all false when no ForumLevel exists for the user', async () => {
    const user = await User.create({
      email: 'dave@test.com',
      username: 'dave',
      passwordHash: 'hash',
      role: 'user',
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .get('/api/users/me/unlock-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      favoriteCardsShowcase: false,
      deckShowcase: false,
      collectionStatsWidget: false,
      wishlistPreview: false,
    });
  });

  it('returns favoriteCardsShowcase: true when that cosmetic is purchased', async () => {
    const user = await User.create({
      email: 'eve@test.com',
      username: 'eve',
      passwordHash: 'hash',
      role: 'user',
    });

    const cosmetic = await Cosmetic.create({
      name: 'Favorite Cards Showcase',
      category: 'favoriteCardsShowcase',
      cost: 500,
      isActive: true,
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: [cosmetic._id.toString()] },
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .get('/api/users/me/unlock-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.favoriteCardsShowcase).toBe(true);
    expect(res.body.deckShowcase).toBe(false);
    expect(res.body.collectionStatsWidget).toBe(false);
    expect(res.body.wishlistPreview).toBe(false);
  });

  it('returns all true when all four unlock cosmetics are purchased', async () => {
    const user = await User.create({
      email: 'frank@test.com',
      username: 'frank',
      passwordHash: 'hash',
      role: 'user',
    });

    const categories = ['favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview'];
    const ids = [];
    for (const cat of categories) {
      const c = await Cosmetic.create({ name: cat, category: cat, cost: 100, isActive: true });
      ids.push(c._id.toString());
    }

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: ids },
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .get('/api/users/me/unlock-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      favoriteCardsShowcase: true,
      deckShowcase: true,
      collectionStatsWidget: true,
      wishlistPreview: true,
    });
  });

  it('ignores inactive cosmetics', async () => {
    const user = await User.create({
      email: 'grace@test.com',
      username: 'grace',
      passwordHash: 'hash',
      role: 'user',
    });

    const cosmetic = await Cosmetic.create({
      name: 'Inactive Showcase',
      category: 'deckShowcase',
      cost: 100,
      isActive: false, // inactive
    });

    await ForumLevel.create({
      userId: user._id,
      cosmetics: { purchased: [cosmetic._id.toString()] },
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .get('/api/users/me/unlock-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deckShowcase).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/pinned-cards
// ---------------------------------------------------------------------------
describe('PUT /api/users/pinned-cards', () => {
  it('sets pinned cards and returns them', async () => {
    const user = await User.create({
      email: 'hank@test.com',
      username: 'hank',
      passwordHash: 'hash',
      role: 'user',
    });

    const cards = [
      { scryfallId: 'abc1', name: 'Lightning Bolt', imageUrl: 'http://example.com/bolt.jpg' },
      { scryfallId: 'abc2', name: 'Counterspell', imageUrl: '' },
    ];

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .put('/api/users/pinned-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards });

    expect(res.status).toBe(200);
    expect(res.body.pinnedCards).toHaveLength(2);
    expect(res.body.pinnedCards[0].name).toBe('Lightning Bolt');
    expect(res.body.pinnedCards[1].scryfallId).toBe('abc2');

    // Verify persisted in DB
    const updated = await User.findById(user._id).lean();
    expect(updated.pinnedCards).toHaveLength(2);
  });

  it('rejects more than 5 pinned cards with 400', async () => {
    const user = await User.create({
      email: 'irene@test.com',
      username: 'irene',
      passwordHash: 'hash',
      role: 'user',
    });

    const cards = Array.from({ length: 6 }, (_, i) => ({
      scryfallId: `id${i}`,
      name: `Card ${i}`,
      imageUrl: '',
    }));

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .put('/api/users/pinned-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/maximum 5/i);
  });

  it('rejects non-array body with 400', async () => {
    const user = await User.create({
      email: 'jane@test.com',
      username: 'jane',
      passwordHash: 'hash',
      role: 'user',
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .put('/api/users/pinned-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must be an array/i);
  });

  it('filters out cards missing name or scryfallId', async () => {
    const user = await User.create({
      email: 'kyle@test.com',
      username: 'kyle',
      passwordHash: 'hash',
      role: 'user',
    });

    const cards = [
      { scryfallId: 'id1', name: 'Lightning Bolt' },
      { scryfallId: 'id2' },          // missing name — filtered out
      { name: 'Counterspell' },       // missing scryfallId — filtered out
    ];

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .put('/api/users/pinned-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards });

    expect(res.status).toBe(200);
    expect(res.body.pinnedCards).toHaveLength(1);
    expect(res.body.pinnedCards[0].name).toBe('Lightning Bolt');
  });

  it('allows setting empty array to clear pinned cards', async () => {
    const user = await User.create({
      email: 'lisa@test.com',
      username: 'lisa',
      passwordHash: 'hash',
      role: 'user',
      pinnedCards: [{ scryfallId: 'abc1', name: 'Old Card' }],
    });

    const token = makeToken(user._id);
    const app = buildApp();
    const res = await request(app)
      .put('/api/users/pinned-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards: [] });

    expect(res.status).toBe(200);
    expect(res.body.pinnedCards).toHaveLength(0);
  });
});

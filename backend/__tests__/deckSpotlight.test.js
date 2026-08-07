process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Deck = require('../models/Deck');
const DeckSpotlight = require('../models/DeckSpotlight');
const Card = require('../models/Card');
const { verifyToken } = require('../middleware/auth');

let mongod;
let app;
let adminUser;
let adminToken;
let regularUser;
let regularToken;
let publicDeck;

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use(verifyToken);
  a.use('/api/deck-spotlight', require('../routes/deckSpotlight'));
  return a;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();

  adminUser = await User.create({
    username: 'spotlightadmin',
    email: 'spotlightadmin@test.com',
    passwordHash: 'hashedpassword',
    role: 'admin',
  });

  adminToken = makeToken(adminUser);

  regularUser = await User.create({
    username: 'regularuser',
    email: 'regularuser@test.com',
    passwordHash: 'hashedpassword',
    role: 'editor',
  });

  regularToken = makeToken(regularUser);

  publicDeck = await Deck.create({
    userId: adminUser._id,
    name: 'Test Spotlight Deck',
    format: 'commander',
    isPublic: true,
    mainDeck: [{ scryfallId: 'abc123', name: 'Sol Ring', quantity: 1 }],
    importCount: 5,
  });

  app = buildApp();
});

describe('POST /api/deck-spotlight', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deckId: publicDeck._id });
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-public deck', async () => {
    const privateDeck = await Deck.create({
      userId: adminUser._id,
      name: 'Private Deck',
      format: 'commander',
      isPublic: false,
      mainDeck: [],
    });
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deckId: privateDeck._id });
    expect(res.status).toBe(400);
  });

  it('creates spotlight and returns 201 for admin with public deck', async () => {
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deckId: publicDeck._id });
    expect(res.status).toBe(201);
    expect(res.body.deckId.toString()).toBe(publicDeck._id.toString());
    expect(res.body.buildLabel).toBeDefined();
    expect(res.body.budgetTier).toBeDefined();
    const diff = new Date(res.body.expiresAt) - Date.now();
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it('returns 400 when deckId is missing', async () => {
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when deck does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deckId: fakeId });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/deck-spotlight/active', () => {
  it('returns null spotlight when none exists', async () => {
    const res = await request(app).get('/api/deck-spotlight/active');
    expect(res.status).toBe(200);
    expect(res.body.spotlight).toBeNull();
  });

  it('returns active spotlight after one is created', async () => {
    // Create a spotlight directly
    await DeckSpotlight.create({
      deckId: publicDeck._id,
      featuredBy: adminUser._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      buildLabel: 'Casual Build',
      budgetTier: 'Budget',
      totalValue: 0,
    });

    const res = await request(app).get('/api/deck-spotlight/active');
    expect(res.status).toBe(200);
    expect(res.body.spotlight).not.toBeNull();
  });
});

describe('DELETE /api/deck-spotlight/:id', () => {
  let spotlightId;

  beforeEach(async () => {
    const spotlight = await DeckSpotlight.create({
      deckId: publicDeck._id,
      featuredBy: adminUser._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      buildLabel: 'Casual Build',
      budgetTier: 'Budget',
      totalValue: 0,
    });
    spotlightId = spotlight._id;
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete(`/api/deck-spotlight/${spotlightId}`)
      .set('Authorization', `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });

  it('expires spotlight early for admin', async () => {
    const res = await request(app)
      .delete(`/api/deck-spotlight/${spotlightId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Spotlight expired');
    const updated = await DeckSpotlight.findById(spotlightId);
    expect(updated.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

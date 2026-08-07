process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Deck = require('../models/Deck');
const Card = require('../models/Card');
const { verifyToken } = require('../middleware/auth');

let mongoServer;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use(verifyToken);
  const decksRouter = require('../routes/decks');
  decksRouter.injectDependencies(Card, null, null);
  a.use('/api/decks', decksRouter);
  return a;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

async function makeUser() {
  return User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
}

describe('GET /api/decks/:id/ownership', () => {
  test('a deck with no real partner commander does not report a phantom missing card', async () => {
    // Regression: deck.partnerCommander is a Mongoose single-nested
    // subdocument path - even stored as null, Mongoose casts it into a
    // truthy empty object on read, so `deck.partnerCommander ? [...] : []`
    // always included it, injecting a nameless/scryfallId-less phantom
    // "card" that could never match the collection and always landed in
    // missingCards.
    const user = await makeUser();
    const deck = await Deck.create({
      userId: user._id,
      name: 'Test Deck',
      commander: { scryfallId: 'sf-commander', name: 'Test Commander', colorIdentity: ['G'] },
      partnerCommander: null,
      mainDeck: [{ scryfallId: 'sf-1', name: 'Card One', quantity: 1 }]
    });
    await Card.create({ userId: user._id, name: 'Test Commander', scryfallId: 'sf-commander', condition: 'NM', quantity: 1 });
    await Card.create({ userId: user._id, name: 'Card One', scryfallId: 'sf-1', condition: 'NM', quantity: 1 });
    const token = tokenFor(user);

    const res = await request(app)
      .get(`/api/decks/${deck._id}/ownership`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.missingCards).toEqual([]);
    expect(res.body.summary.missingCount).toBe(0);
    expect(res.body.summary.ownedCount).toBe(2); // commander + 1 mainDeck card, no phantom
    expect(res.body.summary.completionPercentage).toBe(100);
  });

  test('a deck with a real partner commander is still correctly included and checked for ownership', async () => {
    const user = await makeUser();
    const deck = await Deck.create({
      userId: user._id,
      name: 'Test Deck',
      commander: { scryfallId: 'sf-commander', name: 'Test Commander', colorIdentity: ['G'] },
      partnerCommander: { scryfallId: 'sf-partner', name: 'Test Partner', colorIdentity: ['W'] },
      mainDeck: []
    });
    await Card.create({ userId: user._id, name: 'Test Commander', scryfallId: 'sf-commander', condition: 'NM', quantity: 1 });
    // Partner commander deliberately NOT in the collection - should show as
    // a real, named missing card, not silently dropped.
    const token = tokenFor(user);

    const res = await request(app)
      .get(`/api/decks/${deck._id}/ownership`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.summary.ownedCount).toBe(1);
    expect(res.body.summary.missingCount).toBe(1);
    expect(res.body.missingCards[0].name).toBe('Test Partner');
  });

  test('rejects unauthenticated requests', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['G'] }, mainDeck: [] });
    await request(app).get(`/api/decks/${deck._id}/ownership`).expect(401);
  });
});

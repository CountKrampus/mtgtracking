process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Deck = require('../models/Deck');
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
  await Deck.deleteMany({});
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  const decksRouter = require('../routes/decks');
  // Card model is defined inline in server.js, not a standalone file, and
  // server.js can't be safely required from a test (it calls app.listen and
  // mongoose.connect unconditionally). The /stats route guards its
  // Card-backed deckValue computation with `if (Card)`, so passing null here
  // (same convention as deck-sharing.test.js and achievements.test.js) is
  // sufficient for testing the powerLevel/saltScore wiring itself.
  decksRouter.injectDependencies(null, null, null);
  app.use('/api/decks', decksRouter);
  return app;
}

describe('GET /api/decks/:id/stats power level and salt score', () => {
  test('includes powerLevel and saltScore computed from the deck\'s cards', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    const deck = await Deck.create({
      userId: user._id,
      name: 'Salty Deck',
      commander: { scryfallId: 'cmd-1', name: 'Cyclonic Rift' },
      mainDeck: [
        { scryfallId: 'c-1', name: 'Sol Ring', quantity: 1 },
        { scryfallId: 'c-2', name: 'Rhystic Study', quantity: 1 }
      ],
      statistics: { avgManaCost: 2.5 }
    });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/decks/${deck._id}/stats`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body.saltScore.score).toBe(6); // Cyclonic Rift 3 + Rhystic Study 2 + Sol Ring 1
    expect(res.body.powerLevel.level).toBeGreaterThanOrEqual(1);
    expect(res.body.powerLevel.breakdown.fastMana).toBe(1);
  });
});

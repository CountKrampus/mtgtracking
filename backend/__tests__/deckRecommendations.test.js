process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const axios = require('axios');

jest.mock('axios');

const User = require('../models/User');
const Deck = require('../models/Deck');
const Card = require('../models/Card');
const { verifyToken } = require('../middleware/auth');

let mongoServer;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  // decks.js does not call verifyToken itself (unlike cardInsights.js) - it
  // expects the caller to apply it before mounting, same as
  // deck-stats-power-salt.test.js and deck-sharing.test.js already do.
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
  jest.clearAllMocks();
});

async function makeUser() {
  return User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
}

function scryfallCard(overrides) {
  return { id: 'sf-' + Math.random().toString(36).slice(2), name: 'Test Card', mana_cost: '{1}{G}', type_line: 'Sorcery', ...overrides };
}

describe('GET /api/decks/:id/recommendations', () => {
  test('requires a valid category', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    const token = tokenFor(user);

    await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=bogus`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  test('returns Scryfall results filtered to the deck color identity, excluding cards already in the deck', async () => {
    const user = await makeUser();
    const deck = await Deck.create({
      userId: user._id,
      name: 'Test Deck',
      commander: { name: 'Test Commander', colors: ['G'] },
      mainDeck: [{ name: 'Rampant Growth', manaCost: '{1}{G}', types: ['Sorcery'], colors: ['G'], scryfallId: 'already-in-deck' }]
    });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.category).toBe('ramp');
    expect(res.body.scope).toBe('all');
    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate', 'Kodama\'s Reach']);
    const requestedUrl = axios.get.mock.calls[0][0];
    expect(requestedUrl).toContain('id%3C%3Dg'); // id<=g, url-encoded
  });

  test('scope=owned filters results down to cards in the collection by scryfallId', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', scryfallId: 'candidate-1', quantity: 1 });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate']);
    expect(res.body.cards[0].owned).toBe(true);
  });

  test('scope=owned falls back to name matching for collection cards missing a scryfallId', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', quantity: 1 }); // no scryfallId (offline import)
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate']);
  });

  test('scope=all marks each card with the correct owned flag rather than filtering', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', scryfallId: 'candidate-1', quantity: 1 });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards).toHaveLength(2);
    const byName = Object.fromEntries(res.body.cards.map(c => [c.name, c.owned]));
    expect(byName['Cultivate']).toBe(true);
    expect(byName["Kodama's Reach"]).toBe(false);
  });

  test('scope=owned finds an owned card ranked outside the top 20 Scryfall results, not just the first page', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    // The owned card is ranked 21st by Scryfall/EDHREC popularity - a naive
    // slice(0, 20) applied before ownership filtering would never see it.
    await Card.create({ userId: user._id, name: 'Card 21', condition: 'NM', scryfallId: 'candidate-21', quantity: 1 });
    const token = tokenFor(user);

    const results = Array.from({ length: 25 }, (_, i) => scryfallCard({ id: `candidate-${i + 1}`, name: `Card ${i + 1}` }));
    axios.get.mockResolvedValueOnce({ data: { data: results } });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Card 21']);
  });

  test('rejects unauthenticated requests', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await request(app).get(`/api/decks/${deck._id}/recommendations?category=ramp`).expect(401);
  });

  test('404s for a deck that does not belong to the requesting user', async () => {
    const owner = await makeUser();
    const otherUser = await User.create({ email: 'other@test.com', username: 'other', passwordHash: 'x', role: 'editor' });
    const deck = await Deck.create({ userId: owner._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });

    await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .expect(404);
  });
});

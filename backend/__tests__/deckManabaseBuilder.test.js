process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const axios = require('axios');

jest.mock('axios');

// The route fetches each COLOR_SOURCES candidate matching the deck's colors
// sequentially with a real 500ms delay between calls. A 2-color deck's
// candidate pool (any entry containing either color) runs well past Jest's
// default 5s per-test timeout, so this whole file needs a longer one.
jest.setTimeout(30000);

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

// Builds a fake Scryfall /cards/named response for a given card name and USD
// price - the route looks up each COLOR_SOURCES candidate by name via
// Scryfall (one call per candidate) to get both its price AND a real
// scryfallId/image/mana cost in a single request, rather than calling the
// price-only getPriceWithFallback utility - see this task's note on why:
// add-card's duplicate-detection compares scryfallId, so every candidate
// needs a distinct real one, not all sharing `undefined`.
function mockScryfallNamedLookup(pricesByName, defaultPrice = 1) {
  axios.get.mockImplementation(async (url) => {
    const match = decodeURIComponent(url).match(/fuzzy=(.+)$/);
    const name = match ? match[1] : '';
    const usd = pricesByName[name] ?? defaultPrice;
    return {
      data: {
        id: `sf-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name,
        mana_cost: '',
        image_uris: { normal: `https://example.com/${name}.jpg` },
        prices: { usd: String(usd) },
      },
    };
  });
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

describe('GET /api/decks/:id/manabase-builder', () => {
  test('requires a budget query param', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['W', 'U'] }, mainDeck: [] });
    await request(app)
      .get(`/api/decks/${deck._id}/manabase-builder`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(400);
  });

  test('returns candidates matching the deck color identity, priced, with a greedy suggested package within budget', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['W', 'U'] }, mainDeck: [] });

    mockScryfallNamedLookup({ 'Tundra': 200, 'Hallowed Fountain': 15, 'Azorius Signet': 3 });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/manabase-builder?budget=20`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.budget).toBe(20);
    // Candidates should only include W/U-relevant fixers, not e.g. Taiga (R/G)
    const candidateNames = res.body.candidates.map(c => c.name);
    expect(candidateNames).toContain('Hallowed Fountain');
    expect(candidateNames).not.toContain('Taiga');

    // Suggested package respects the $20 budget - Tundra ($200) must be excluded
    const suggestedNames = res.body.suggested.map(c => c.name);
    expect(suggestedNames).not.toContain('Tundra');
    const suggestedTotal = res.body.suggested.reduce((sum, c) => sum + c.price, 0);
    expect(suggestedTotal).toBeLessThanOrEqual(20);

    // Every candidate must carry its own real, distinct scryfallId - not
    // left undefined - otherwise POST /:id/add-card's duplicate check
    // (`c.scryfallId === scryfallId`) would false-match the second
    // undefined-scryfallId land added against the first one already added.
    const ids = res.body.candidates.map(c => c.scryfallId);
    expect(ids.every(id => !!id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    // COLOR_SOURCES mixes real lands with mana rocks that happen to fix
    // color (Signets) - the frontend persists this `types` value verbatim
    // when adding a card to the deck, so mislabeling a rock as a Land would
    // corrupt the deck's own type-based stats/filtering afterward.
    const byName = Object.fromEntries(res.body.candidates.map(c => [c.name, c]));
    expect(byName['Hallowed Fountain'].types).toEqual(['Land']);
    expect(byName['Azorius Signet'].types).toEqual(['Artifact']);
  });

  test('excludes lands already in the deck from both candidates and suggested', async () => {
    const user = await makeUser();
    const deck = await Deck.create({
      userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['W', 'U'] },
      mainDeck: [{ name: 'Hallowed Fountain', types: ['Land'], colors: [], scryfallId: 'already-owned' }]
    });
    mockScryfallNamedLookup({});

    const res = await request(app)
      .get(`/api/decks/${deck._id}/manabase-builder?budget=100`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.candidates.map(c => c.name)).not.toContain('Hallowed Fountain');
  });

  test('weighs a 5-color universal fixer by only the colors the deck actually needs, not all 5', async () => {
    const user = await makeUser();
    // Mono-white deck: Command Tower (5-color) should not automatically
    // outrank a 2-color card just because it lists 5 colors on paper.
    const deck = await Deck.create({ userId: user._id, name: 'Mono W', commander: { name: 'Test Commander', colorIdentity: ['W'] }, mainDeck: [] });
    mockScryfallNamedLookup({}, 2); // every candidate priced at $2 via the helper's default

    const res = await request(app)
      .get(`/api/decks/${deck._id}/manabase-builder?budget=2`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    // With an equal price and only 1 relevant color each for this mono-W
    // deck, Command Tower must not be valued as if it fixed 5 colors.
    const commandTower = res.body.candidates.find(c => c.name === 'Command Tower');
    expect(commandTower.relevantColorCount).toBe(1);
  });

  test('rejects unauthenticated requests', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['W'] }, mainDeck: [] });
    await request(app).get(`/api/decks/${deck._id}/manabase-builder?budget=20`).expect(401);
  });

  test('404s for a deck that does not belong to the requesting user', async () => {
    const owner = await makeUser();
    const otherUser = await User.create({ email: 'o@test.com', username: 'other', passwordHash: 'x', role: 'editor' });
    const deck = await Deck.create({ userId: owner._id, name: 'Test Deck', commander: { name: 'Test Commander', colorIdentity: ['W'] }, mainDeck: [] });
    await request(app)
      .get(`/api/decks/${deck._id}/manabase-builder?budget=20`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .expect(404);
  });
});

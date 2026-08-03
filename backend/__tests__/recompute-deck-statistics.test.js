const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Deck = require('../models/Deck');
const { recomputeDeckStatistics } = require('../scripts/recomputeDeckStatistics');

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

function buildDeckData(overrides = {}) {
  return {
    name: 'Test Deck',
    commander: { scryfallId: 'sf-1', name: 'Krenko, Mob Boss', manaCost: '{2}{R}{R}', colorIdentity: ['R'] },
    partnerCommander: null,
    mainDeck: Array.from({ length: 99 }, (_, i) => ({
      scryfallId: `sf-main-${i}`, name: `Card ${i}`, quantity: 1, manaCost: '{1}', types: ['Instant'], colors: [],
    })),
    ...overrides,
  };
}

describe('recomputeDeckStatistics', () => {
  test('fixes a deck whose stored totalCards was inflated by the partnerCommander bug', async () => {
    const deck = await Deck.create(buildDeckData({ statistics: { totalCards: 101 } }));

    const summary = await recomputeDeckStatistics();

    expect(summary).toEqual({ decksChecked: 1, decksFixed: 1 });
    const updated = await Deck.findById(deck._id);
    expect(updated.statistics.totalCards).toBe(100);
  });

  test('leaves a deck untouched when its stored totalCards already matches the recomputed value', async () => {
    await Deck.create(buildDeckData({ statistics: { totalCards: 100 } }));

    const summary = await recomputeDeckStatistics();

    expect(summary).toEqual({ decksChecked: 1, decksFixed: 0 });
  });

  test('correctly counts 101 for a deck with a real partner commander', async () => {
    const deck = await Deck.create(buildDeckData({
      partnerCommander: { scryfallId: 'sf-2', name: 'Krenko, Tin Street Kingpin', manaCost: '{1}{R}', colorIdentity: ['R'] },
      statistics: { totalCards: 999 },
    }));

    const summary = await recomputeDeckStatistics();

    expect(summary).toEqual({ decksChecked: 1, decksFixed: 1 });
    const updated = await Deck.findById(deck._id);
    expect(updated.statistics.totalCards).toBe(101);
  });

  test('is idempotent - running it twice in a row only fixes decks the first time', async () => {
    await Deck.create(buildDeckData({ statistics: { totalCards: 101 } }));

    const first = await recomputeDeckStatistics();
    const second = await recomputeDeckStatistics();

    expect(first.decksFixed).toBe(1);
    expect(second.decksFixed).toBe(0);
  });
});

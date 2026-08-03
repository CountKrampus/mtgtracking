const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Deck = require('../models/Deck');
const { calculateDeckStatistics, validateDeck } = require('../utils/deckHelpers');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function buildDeckData(partnerCommander) {
  return {
    name: 'Test Deck',
    commander: { scryfallId: 'sf-1', name: 'Krenko, Mob Boss', manaCost: '{2}{R}{R}', colorIdentity: ['R'] },
    partnerCommander,
    mainDeck: Array.from({ length: 99 }, (_, i) => ({
      scryfallId: `sf-main-${i}`, name: `Card ${i}`, quantity: 1, manaCost: '{1}', types: ['Instant'], colors: [],
    })),
  };
}

describe('calculateDeckStatistics — partnerCommander truthiness on a Mongoose document', () => {
  test('a plain object with partnerCommander: null counts correctly (99 mainDeck + 1 commander = 100)', () => {
    const stats = calculateDeckStatistics(buildDeckData(null));
    expect(stats.totalCards).toBe(100);
  });

  test('a Mongoose document with no real partner commander still counts 100, not 101', () => {
    const deck = new Deck(buildDeckData(null));
    // Confirms the actual bug mechanism: Mongoose casts `partnerCommander: null` into a
    // truthy empty subdocument rather than preserving null, on the single-nested-schema path.
    expect(deck.partnerCommander).toBeTruthy();
    expect(deck.partnerCommander.name).toBeUndefined();

    const stats = calculateDeckStatistics(deck);
    expect(stats.totalCards).toBe(100);
  });

  test('a Mongoose document with a real partner commander correctly counts 101', () => {
    const deck = new Deck(buildDeckData({ scryfallId: 'sf-2', name: 'Krenko, Tin Street Kingpin', manaCost: '{1}{R}', colorIdentity: ['R'] }));
    const stats = calculateDeckStatistics(deck);
    expect(stats.totalCards).toBe(101);
  });
});

describe('validateDeck — partnerCommander truthiness on a Mongoose document', () => {
  test('a Mongoose document with no real partner commander validates as exactly 100 cards', () => {
    const deck = new Deck(buildDeckData(null));
    const result = validateDeck(deck);
    expect(result.errors).toEqual([]);
  });

  test('a Mongoose document with a real partner commander validates against 101 total (99 mainDeck is one short)', () => {
    const deck = new Deck(buildDeckData({ scryfallId: 'sf-2', name: 'Krenko, Tin Street Kingpin', manaCost: '{1}{R}', colorIdentity: ['R'] }));
    const result = validateDeck(deck);
    expect(result.errors).toContain('Deck must have exactly 100 cards (currently 101)');
  });
});

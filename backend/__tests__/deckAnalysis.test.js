const { calculateSaltScore, estimatePowerLevel } = require('../utils/deckAnalysis');

describe('calculateSaltScore', () => {
  test('sums salt values for salty cards in mainDeck and commander', () => {
    const deck = {
      mainDeck: [
        { name: 'Rhystic Study' }, // salt 2
        { name: 'Sol Ring' },      // salt 1
        { name: 'Forest' }         // salt 0 (not in table)
      ],
      commander: { name: 'Cyclonic Rift' } // salt 3
    };
    const result = calculateSaltScore(deck);
    expect(result.score).toBe(6);
    expect(result.cards).toEqual([
      { name: 'Cyclonic Rift', salt: 3 },
      { name: 'Rhystic Study', salt: 2 },
      { name: 'Sol Ring', salt: 1 }
    ]);
  });

  test('returns zero score for a deck with no salty cards', () => {
    const deck = { mainDeck: [{ name: 'Forest' }, { name: 'Island' }] };
    expect(calculateSaltScore(deck)).toEqual({ score: 0, cards: [] });
  });

  test('handles a deck with no mainDeck', () => {
    expect(calculateSaltScore({})).toEqual({ score: 0, cards: [] });
  });
});

describe('estimatePowerLevel', () => {
  test('scores a low-power deck near the bottom of the range', () => {
    const deck = {
      mainDeck: [{ name: 'Forest' }, { name: 'Grizzly Bears' }],
      statistics: { avgManaCost: 3.5 }
    };
    const result = estimatePowerLevel(deck, 0);
    expect(result.level).toBe(3);
    expect(result.breakdown.fastMana).toBe(0);
  });

  test('scores a high-power deck with fast mana, tutors, and combo pieces higher', () => {
    const deck = {
      mainDeck: [
        { name: 'Sol Ring' }, { name: 'Mana Crypt' },
        { name: 'Demonic Tutor' }, { name: 'Vampiric Tutor' },
        { name: "Thassa's Oracle" }, { name: 'Demonic Consultation' }
      ],
      statistics: { avgManaCost: 2.0 }
    };
    const result = estimatePowerLevel(deck, 3000);
    expect(result.level).toBeGreaterThan(6);
    expect(result.breakdown.fastMana).toBe(2);
    expect(result.breakdown.tutors).toBe(2);
    expect(result.breakdown.comboPieces).toBe(2);
  });

  test('caps level at 10 and floors at 1', () => {
    const deck = { mainDeck: [], statistics: { avgManaCost: 3.5 } };
    const result = estimatePowerLevel(deck, 0);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.level).toBeLessThanOrEqual(10);
  });

  test('handles a deck with no mainDeck', () => {
    expect(estimatePowerLevel({}, 0)).toEqual({ level: 1, breakdown: {} });
  });
});

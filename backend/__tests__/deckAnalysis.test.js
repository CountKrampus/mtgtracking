const { calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, calculateGlobalScore, COLOR_SOURCES } = require('../utils/deckAnalysis');

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

describe('calculateManabaseScore', () => {
  test('grades a mono-color deck as A when it has enough basics', () => {
    const deck = {
      mainDeck: [
        ...Array(25).fill({ name: 'Forest' }),
        { name: 'Llanowar Elves', manaCost: '{G}' },
        { name: 'Craterhoof Behemoth', manaCost: '{5}{G}{G}' }
      ]
    };
    const result = calculateManabaseScore(deck);
    expect(result.landCount).toBe(25);
    expect(result.bySourceColor.G.sources).toBe(25);
    expect(['A', 'A-']).toContain(result.grade);
  });

  test('grades a two-color deck with heavy double-pip demand and no fixing as poor', () => {
    const deck = {
      mainDeck: [
        ...Array(10).fill({ name: 'Plains' }),
        ...Array(10).fill({ name: 'Island' }),
        { name: 'Approach of the Second Sun', manaCost: '{5}{W}{W}' },
        { name: 'Cryptic Command', manaCost: '{1}{U}{U}{U}' }
      ]
    };
    const result = calculateManabaseScore(deck);
    expect(result.bySourceColor.W.sources).toBe(10);
    expect(result.bySourceColor.U.sources).toBe(10);
    expect(['D', 'F', 'C']).toContain(result.grade);
  });

  test('counts COLOR_SOURCES nonbasic lands and rocks toward the colors they produce', () => {
    const deck = {
      mainDeck: [
        ...Array(15).fill({ name: 'Island' }),
        { name: 'Command Tower' },
        { name: 'Arcane Signet' },
        { name: 'Counterspell', manaCost: '{U}{U}' }
      ]
    };
    const result = calculateManabaseScore(deck);
    expect(result.bySourceColor.U.sources).toBe(17); // 15 Islands + Command Tower + Arcane Signet
    expect(result.landCount).toBe(16); // Command Tower is a land, Arcane Signet is not
  });

  test('a color with zero pip demand does not affect the grade', () => {
    const deck = {
      mainDeck: [
        ...Array(30).fill({ name: 'Forest' }),
        { name: 'Craterhoof Behemoth', manaCost: '{5}{G}{G}' }
      ]
    };
    const result = calculateManabaseScore(deck);
    expect(result.bySourceColor.W).toBeUndefined();
  });

  test('handles a deck with no mainDeck', () => {
    const result = calculateManabaseScore({});
    expect(result).toEqual({ grade: 'N/A', bySourceColor: {}, landCount: 0, recommendedLandRange: [36, 38] });
  });

  test('COLOR_SOURCES entries expose both colors and a cycle label', () => {
    expect(COLOR_SOURCES['Tundra']).toEqual({ colors: ['W', 'U'], cycle: 'trueDual' });
    expect(COLOR_SOURCES['Command Tower']).toEqual({ colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' });
  });
});

describe('calculateDeckHealthScore', () => {
  test('scores a deck with good curve, ramp, draw, and removal highly', () => {
    const deck = {
      mainDeck: [
        ...Array(36).fill({ name: 'Forest', types: ['Land'] }),
        { name: 'Llanowar Elves', manaCost: '{G}', types: ['Creature'] },
        { name: 'Rampant Growth', manaCost: '{1}{G}', types: ['Sorcery'] },
        { name: 'Sylvan Library', manaCost: '{G}', types: ['Enchantment'] },
        { name: 'Beast Within', manaCost: '{2}{G}', types: ['Instant'] },
        ...Array(60).fill({ name: 'Grizzly Bears', manaCost: '{1}{G}', types: ['Creature'] })
      ]
    };
    const result = calculateDeckHealthScore(deck);
    expect(result.score).toBeGreaterThan(50);
    expect(result.breakdown.ramp).toBeGreaterThan(0);
    expect(result.breakdown.draw).toBeGreaterThan(0);
  });

  test('scores a deck with no ramp, draw, or removal lower than one with all three', () => {
    const bareDeck = {
      mainDeck: [
        ...Array(36).fill({ name: 'Forest', types: ['Land'] }),
        ...Array(64).fill({ name: 'Grizzly Bears', manaCost: '{1}{G}', types: ['Creature'] })
      ]
    };
    const equippedDeck = {
      mainDeck: [
        ...Array(36).fill({ name: 'Forest', types: ['Land'] }),
        { name: 'Rampant Growth', manaCost: '{1}{G}', types: ['Sorcery'] },
        { name: 'Sylvan Library', manaCost: '{G}', types: ['Enchantment'] },
        { name: 'Beast Within', manaCost: '{2}{G}', types: ['Instant'] },
        ...Array(61).fill({ name: 'Grizzly Bears', manaCost: '{1}{G}', types: ['Creature'] })
      ]
    };
    expect(calculateDeckHealthScore(equippedDeck).score).toBeGreaterThan(calculateDeckHealthScore(bareDeck).score);
  });

  test('handles a deck with no mainDeck', () => {
    expect(calculateDeckHealthScore({})).toEqual({ score: 0, breakdown: { curveSmoothness: 0, ramp: 0, draw: 0, removal: 0, landRatio: 0 } });
  });
});

describe('calculateGlobalScore', () => {
  test('averages a strong deck across all four inputs toward the high end', () => {
    const score = calculateGlobalScore(
      { level: 8 },
      { score: 2 },
      { grade: 'A' },
      { score: 90 }
    );
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('a high salt score pulls the global score down without dominating it', () => {
    const lowSalt = calculateGlobalScore({ level: 6 }, { score: 0 }, { grade: 'B' }, { score: 70 });
    const highSalt = calculateGlobalScore({ level: 6 }, { score: 30 }, { grade: 'B' }, { score: 70 });
    expect(highSalt).toBeLessThan(lowSalt);
    expect(highSalt).toBeGreaterThan(0);
  });

  test('handles an N/A manabase grade (empty deck) without throwing', () => {
    const score = calculateGlobalScore({ level: 1 }, { score: 0 }, { grade: 'N/A' }, { score: 0 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

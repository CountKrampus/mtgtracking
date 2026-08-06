const { parseCMC } = require('./deckHelpers');

// Ported verbatim from frontend/src/components/DeckDetail.js:107-127.
// Keep both tables in sync if MTG's meta/salt consensus changes.
const SALTY_CARDS = {
  'Cyclonic Rift': 3, 'Armageddon': 3, 'Winter Orb': 3, 'Static Orb': 3,
  'Stasis': 3, 'Blood Moon': 3, 'Back to Basics': 3, 'Vorinclex, Voice of Hunger': 3,
  'Iona, Shield of Emeria': 3, 'Jin-Gitaxias, Core Augur': 3, 'Expropriate': 3,
  "Thassa's Oracle": 3, 'Demonic Consultation': 3, 'Tergrid, God of Fright': 3,
  'Grand Arbiter Augustin IV': 3, 'Narset, Parter of Veils': 3, 'Hullbreacher': 3,
  'Opposition Agent': 3, 'Drannith Magistrate': 3, 'Rule of Law': 3,
  'Smothering Tithe': 2, 'Rhystic Study': 2, 'Dockside Extortionist': 2,
  'Fierce Guardianship': 2, 'Deflecting Swat': 2, 'Force of Will': 2,
  'Mana Drain': 2, 'Counterspell': 2, 'Pact of Negation': 2,
  'Craterhoof Behemoth': 2, 'Tooth and Nail': 2, 'Triumph of the Hordes': 2,
  'Vorinclex, Monstrous Raider': 2, 'Omniscience': 2, 'Enter the Infinite': 2,
  'Time Stretch': 2, 'Time Warp': 2, 'Extra Turn': 2, 'Seedborn Muse': 2,
  'Consecrated Sphinx': 2, 'Necropotence': 2, 'Ad Nauseam': 2,
  'Sol Ring': 1, 'Mana Crypt': 1, 'Mana Vault': 1, 'Chrome Mox': 1,
  'Mox Diamond': 1, 'Jeweled Lotus': 1, 'Ancient Tomb': 1, "Gaea's Cradle": 1,
  'Strip Mine': 1, 'Wasteland': 1, 'Beast Within': 1,
  'Path to Exile': 1, 'Swords to Plowshares': 1, 'Esper Sentinel': 1,
  'Mystic Remora': 1, 'Demonic Tutor': 1, 'Vampiric Tutor': 1, 'Worldly Tutor': 1,
  'Enlightened Tutor': 1, 'Imperial Seal': 1, 'Gamble': 1,
};

// Ported verbatim from frontend/src/components/DeckDetail.js:129-149.
const POWER_INDICATORS = {
  fastMana: ['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond',
             'Jeweled Lotus', 'Ancient Tomb', "Gaea's Cradle", 'Lotus Petal',
             'Dark Ritual', 'Cabal Ritual', 'Simian Spirit Guide'],
  tutors: ['Demonic Tutor', 'Vampiric Tutor', 'Worldly Tutor', 'Enlightened Tutor',
           'Mystical Tutor', 'Imperial Seal', 'Gamble', 'Diabolic Intent',
           'Finale of Devastation', "Green Sun's Zenith", 'Chord of Calling',
           'Survival of the Fittest', 'Natural Order', 'Birthing Pod'],
  comboPieces: ["Thassa's Oracle", 'Demonic Consultation', 'Tainted Pact',
                'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Doomsday',
                'Isochron Scepter', 'Dramatic Reversal', 'Paradox Engine',
                'Basalt Monolith', 'Rings of Brighthearth', 'Power Artifact',
                'Walking Ballista', 'Heliod, Sun-Crowned', 'Spike Feeder',
                'Kiki-Jiki, Mirror Breaker', 'Splinter Twin', 'Zealous Conscripts'],
  efficientRemoval: ['Swords to Plowshares', 'Path to Exile', 'Abrupt Decay',
                     "Assassin's Trophy", 'Force of Will', 'Pact of Negation',
                     'Fierce Guardianship', 'Deflecting Swat', 'Mana Drain'],
  powerhouses: ['Rhystic Study', 'Smothering Tithe', 'Dockside Extortionist',
                'Consecrated Sphinx', 'Necropotence', 'Ad Nauseam', 'Sylvan Library',
                'Mystic Remora', 'Esper Sentinel', 'Seedborn Muse', 'Prophet of Kruphix'],
  ramp: ['Rampant Growth', 'Cultivate', 'Kodama\'s Reach', 'Farseek', 'Nature\'s Lore',
         'Three Visits', 'Sakura-Tribe Elder', 'Llanowar Elves', 'Elvish Mystic',
         'Birds of Paradise', 'Arbor Elf', 'Wood Elves', 'Skyshroud Claim',
         'Explosive Vegetation', 'Signet', 'Talisman'], // last two match by substring below, not exact name
  draw: ['Sylvan Library', 'Phyrexian Arena', 'Mystic Remora', 'Rhystic Study',
         'Fact or Fiction', 'Blue Sun\'s Zenith', 'Harmonize', 'Night\'s Whisper',
         'Sign in Blood', 'Read the Bones', 'Divination', 'Concentrate',
         'Windfall', 'Faithless Looting', 'Guardian Project'],
};

const BASIC_LAND_COLORS = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

// Nonbasic lands and mana rocks that produce specific colors. Not exhaustive
// (same spirit as SALTY_CARDS/POWER_INDICATORS above) - covers the most common
// Commander staples. Cards that produce colorless-only mana (Sol Ring, Mana
// Crypt, Mana Vault, etc.) are deliberately absent - they live in
// POWER_INDICATORS.fastMana instead, a different classification for a
// different purpose, and must never be treated as a color source here.
const COLOR_SOURCES = {
  // True duals / original duals
  'Tundra': ['W', 'U'], 'Underground Sea': ['U', 'B'], 'Badlands': ['B', 'R'],
  'Taiga': ['R', 'G'], 'Savannah': ['G', 'W'], 'Scrubland': ['W', 'B'],
  'Volcanic Island': ['U', 'R'], 'Bayou': ['B', 'G'], 'Plateau': ['R', 'W'],
  'Tropical Island': ['G', 'U'],
  // Shocklands
  'Hallowed Fountain': ['W', 'U'], 'Watery Grave': ['U', 'B'], 'Blood Crypt': ['B', 'R'],
  'Stomping Ground': ['R', 'G'], 'Temple Garden': ['G', 'W'], 'Godless Shrine': ['W', 'B'],
  'Steam Vents': ['U', 'R'], 'Overgrown Tomb': ['B', 'G'], 'Sacred Foundry': ['R', 'W'],
  'Breeding Pool': ['G', 'U'],
  // Fetchlands (count toward both colors they can fetch, since which basic/dual
  // they actually grab varies by deck - a simplification, not a precise model)
  'Flooded Strand': ['W', 'U'], 'Polluted Delta': ['U', 'B'], 'Bloodstained Mire': ['B', 'R'],
  'Wooded Foothills': ['R', 'G'], 'Windswept Heath': ['G', 'W'], 'Marsh Flats': ['W', 'B'],
  'Scalding Tarn': ['U', 'R'], 'Verdant Catacombs': ['B', 'G'], 'Arid Mesa': ['R', 'W'],
  'Misty Rainforest': ['G', 'U'],
  // Universal fixers
  'Command Tower': ['W', 'U', 'B', 'R', 'G'], 'Exotic Orchard': ['W', 'U', 'B', 'R', 'G'],
  'Path of Ancestry': ['W', 'U', 'B', 'R', 'G'], 'Arcane Signet': ['W', 'U', 'B', 'R', 'G'],
  'Fellwar Stone': ['W', 'U', 'B', 'R', 'G'], 'Chromatic Lantern': ['W', 'U', 'B', 'R', 'G'],
  // Signets (two-color rocks)
  'Azorius Signet': ['W', 'U'], 'Dimir Signet': ['U', 'B'], 'Rakdos Signet': ['B', 'R'],
  'Gruul Signet': ['R', 'G'], 'Selesnya Signet': ['G', 'W'], 'Orzhov Signet': ['W', 'B'],
  'Izzet Signet': ['U', 'R'], 'Golgari Signet': ['B', 'G'], 'Boros Signet': ['R', 'W'],
  'Simic Signet': ['G', 'U'],
};

// COLOR_SOURCES mixes actual lands (duals/shocks/fetches/Command Tower/Exotic
// Orchard/Path of Ancestry) with mana rocks that happen to fix color
// (Signets/Arcane Signet/Fellwar Stone/Chromatic Lantern) - both belong in
// that table since it's about "what colors does this produce," but only the
// former group counts toward land count. Listed separately here rather than
// tagging COLOR_SOURCES entries, since land-vs-rock and color-production are
// two independent questions about the same card.
const NONBASIC_LAND_NAMES = new Set([
  'Tundra', 'Underground Sea', 'Badlands', 'Taiga', 'Savannah', 'Scrubland',
  'Volcanic Island', 'Bayou', 'Plateau', 'Tropical Island',
  'Hallowed Fountain', 'Watery Grave', 'Blood Crypt', 'Stomping Ground', 'Temple Garden',
  'Godless Shrine', 'Steam Vents', 'Overgrown Tomb', 'Sacred Foundry', 'Breeding Pool',
  'Flooded Strand', 'Polluted Delta', 'Bloodstained Mire', 'Wooded Foothills', 'Windswept Heath',
  'Marsh Flats', 'Scalding Tarn', 'Verdant Catacombs', 'Arid Mesa', 'Misty Rainforest',
  'Command Tower', 'Exotic Orchard', 'Path of Ancestry',
]);

function isLandCard(card) {
  return (card.types || []).includes('Land')
    || Object.prototype.hasOwnProperty.call(BASIC_LAND_COLORS, card.name)
    || NONBASIC_LAND_NAMES.has(card.name);
}

// Frank Karsten's published mana-source-count research (ChannelFireball,
// widely used as the community-standard reference), scaled from his 60-card
// baseline (14/18/21+ sources for single/double/triple-pip) to Commander's
// 99-card singleton format by the commonly-cited ~1.6x factor.
const KARSTEN_TARGETS = { 1: 22, 2: 29, 3: 34 };

function calculateManabaseScore(deck) {
  if (!deck.mainDeck) return { grade: 'N/A', bySourceColor: {}, landCount: 0, recommendedLandRange: [36, 38] };

  const allCards = [...deck.mainDeck];
  if (deck.commander) allCards.push(deck.commander);
  if (deck.partnerCommander?.name) allCards.push(deck.partnerCommander);

  let landCount = 0;
  const sourcesByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const pipCountByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 }; // both "is this color played" and "avg pips/card"

  allCards.forEach(card => {
    const quantity = card.quantity || 1;

    if (isLandCard(card)) landCount += quantity;

    const basicColor = BASIC_LAND_COLORS[card.name];
    if (basicColor) sourcesByColor[basicColor] += quantity;

    const fixingColors = COLOR_SOURCES[card.name];
    if (fixingColors) fixingColors.forEach(c => { sourcesByColor[c] += quantity; });

    if (!isLandCard(card) && card.manaCost) {
      const pipMatches = card.manaCost.match(/\{([WUBRG])\}/g) || [];
      pipMatches.forEach(symbol => {
        const color = symbol.replace(/[{}]/g, '');
        pipCountByColor[color] += quantity;
      });
    }
  });

  const bySourceColor = {};
  let worstGradeValue = null;

  // Grade is driven by the single worst-performing color with any pip
  // demand, not an average - a deck's manabase is only as good as its
  // weakest requirement, per the spec. Known tradeoff: a deliberately light
  // splash (1-2 low-pip cards in a color with few dedicated sources) can
  // still drag the whole grade down, even though light splashes are an
  // accepted, low-risk pattern in real deckbuilding. Not fixed here since the
  // spec calls for worst-color grading explicitly; revisit only if this
  // proves misleading in practice against real decks.
  Object.keys(pipCountByColor).forEach(color => {
    if (pipCountByColor[color] === 0) return; // color not actually played - no requirement

    const nonLandCardsOfColor = allCards.filter(c => !isLandCard(c) && (c.manaCost || '').includes(`{${color}}`));
    const cardCountOfColor = nonLandCardsOfColor.reduce((sum, c) => sum + (c.quantity || 1), 0) || 1;
    const avgPipsPerCard = pipCountByColor[color] / cardCountOfColor;

    let target;
    if (avgPipsPerCard >= 3) target = KARSTEN_TARGETS[3];
    else if (avgPipsPerCard >= 2) target = KARSTEN_TARGETS[2];
    else target = KARSTEN_TARGETS[1];

    const sources = sourcesByColor[color];
    bySourceColor[color] = { sources, target };

    const ratio = sources / target;
    worstGradeValue = worstGradeValue === null ? ratio : Math.min(worstGradeValue, ratio);
  });

  let grade;
  if (worstGradeValue === null) grade = 'N/A';
  else if (worstGradeValue >= 1.1) grade = 'A';
  else if (worstGradeValue >= 0.95) grade = 'A-';
  else if (worstGradeValue >= 0.85) grade = 'B+';
  else if (worstGradeValue >= 0.75) grade = 'B';
  else if (worstGradeValue >= 0.65) grade = 'C';
  else if (worstGradeValue >= 0.5) grade = 'D';
  else grade = 'F';

  return { grade, bySourceColor, landCount, recommendedLandRange: [36, 38] };
}

// Ported from frontend/src/components/DeckDetail.js:196-212 (was a useMemo over
// `deck`; here it's a plain function since there's no React lifecycle server-side).
function calculateSaltScore(deck) {
  if (!deck.mainDeck) return { score: 0, cards: [] };
  let totalSalt = 0;
  const saltyCardsInDeck = [];
  deck.mainDeck.forEach(card => {
    const cardSalt = SALTY_CARDS[card.name] || 0;
    if (cardSalt > 0) {
      totalSalt += cardSalt;
      saltyCardsInDeck.push({ name: card.name, salt: cardSalt });
    }
  });
  if (deck.commander && SALTY_CARDS[deck.commander.name]) {
    totalSalt += SALTY_CARDS[deck.commander.name];
    saltyCardsInDeck.push({ name: deck.commander.name, salt: SALTY_CARDS[deck.commander.name] });
  }
  return { score: totalSalt, cards: saltyCardsInDeck.sort((a, b) => b.salt - a.salt) };
}

// Ported from frontend/src/components/DeckDetail.js:215-241 (was a useMemo over
// `deck` and `ownership`; `deckValue` here replaces `ownership?.summary?.totalValue`).
function estimatePowerLevel(deck, deckValue) {
  if (!deck.mainDeck) return { level: 1, breakdown: {} };
  const allCards = deck.mainDeck.map(c => c.name);
  if (deck.commander) allCards.push(deck.commander.name);
  let score = 0;
  const breakdown = {
    fastMana: 0, tutors: 0, comboPieces: 0, efficientRemoval: 0, powerhouses: 0,
    avgCmc: deck.statistics?.avgManaCost || 3.5,
    deckValue: deckValue || 0,
  };
  allCards.forEach(cardName => {
    if (POWER_INDICATORS.fastMana.includes(cardName)) breakdown.fastMana++;
    if (POWER_INDICATORS.tutors.includes(cardName)) breakdown.tutors++;
    if (POWER_INDICATORS.comboPieces.includes(cardName)) breakdown.comboPieces++;
    if (POWER_INDICATORS.efficientRemoval.includes(cardName)) breakdown.efficientRemoval++;
    if (POWER_INDICATORS.powerhouses.includes(cardName)) breakdown.powerhouses++;
  });
  score += Math.min(breakdown.fastMana * 0.5, 2);
  score += Math.min(breakdown.tutors * 0.4, 2);
  score += Math.min(breakdown.comboPieces * 0.6, 2);
  score += Math.min(breakdown.efficientRemoval * 0.3, 1);
  score += Math.min(breakdown.powerhouses * 0.3, 1.5);
  if (breakdown.avgCmc < 2.5) score += 1;
  else if (breakdown.avgCmc < 3) score += 0.5;
  if (breakdown.deckValue > 1000) score += 0.5;
  if (breakdown.deckValue > 2500) score += 0.5;
  return { level: Math.min(10, Math.max(1, Math.round(3 + score))), breakdown };
}

function calculateDeckHealthScore(deck) {
  if (!deck.mainDeck) return { score: 0, breakdown: { curveSmoothness: 0, ramp: 0, draw: 0, removal: 0, landRatio: 0 } };

  const allCards = deck.mainDeck;
  let totalCards = 0, landCards = 0;
  const curveBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  let ramp = 0, draw = 0, removal = 0;

  allCards.forEach(card => {
    const quantity = card.quantity || 1;
    totalCards += quantity;
    if (isLandCard(card)) { landCards += quantity; return; }

    const cmc = parseCMC(card.manaCost);
    const bucket = cmc >= 7 ? '7+' : cmc.toString();
    curveBuckets[bucket] += quantity;

    const isRamp = POWER_INDICATORS.ramp.some(name =>
      name === card.name || ((name === 'Signet' || name === 'Talisman') && card.name.includes(name))
    );
    if (isRamp) ramp += quantity;
    if (POWER_INDICATORS.draw.includes(card.name)) draw += quantity;
    if (POWER_INDICATORS.efficientRemoval.includes(card.name)) removal += quantity;
  });

  // Curve smoothness: penalize decks that are too top-heavy (fewer than 30% of
  // nonland cards at CMC 0-2) or too thin early (fewer than 10% at CMC 1-2).
  const nonLandTotal = totalCards - landCards;
  const cheapCards = curveBuckets[0] + curveBuckets[1] + curveBuckets[2];
  const veryCheapCards = curveBuckets[1] + curveBuckets[2];
  let curveSmoothness = 100;
  if (nonLandTotal > 0) {
    const cheapRatio = cheapCards / nonLandTotal;
    const veryCheapRatio = veryCheapCards / nonLandTotal;
    if (cheapRatio < 0.3) curveSmoothness -= (0.3 - cheapRatio) * 200;
    if (veryCheapRatio < 0.1) curveSmoothness -= (0.1 - veryCheapRatio) * 150;
    curveSmoothness = Math.max(0, Math.min(100, Math.round(curveSmoothness)));
  } else {
    curveSmoothness = 0;
  }

  // Ramp/draw/removal: Commander norms are roughly 10/10/10 out of 99 - scale
  // each count to a 0-100 sub-score capped at the norm (more isn't scored
  // higher past the norm; this is a floor-check, not a maximize-everything score).
  const rampScore = Math.min(100, Math.round((ramp / 10) * 100));
  const drawScore = Math.min(100, Math.round((draw / 10) * 100));
  const removalScore = Math.min(100, Math.round((removal / 10) * 100));

  // Land ratio: 36-38 lands out of 99 is the target range (matches
  // calculateManabaseScore's recommendedLandRange) - full marks inside it,
  // tapering off outside.
  let landRatio = 100;
  if (landCards < 36) landRatio = Math.max(0, 100 - (36 - landCards) * 10);
  else if (landCards > 38) landRatio = Math.max(0, 100 - (landCards - 38) * 10);

  const score = Math.round(
    curveSmoothness * 0.3 + rampScore * 0.2 + drawScore * 0.2 + removalScore * 0.15 + landRatio * 0.15
  );

  return { score, breakdown: { curveSmoothness, ramp: rampScore, draw: drawScore, removal: removalScore, landRatio } };
}

const GRADE_TO_PERCENT = { 'A': 100, 'A-': 92, 'B+': 85, 'B': 77, 'C': 65, 'D': 50, 'F': 30, 'N/A': 50 };

function calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore) {
  const powerPercent = ((powerLevel?.level || 1) / 10) * 100;
  // Salt inverted and capped at 30 so a single extremely salty deck doesn't
  // zero out the whole average - most decks land well under this.
  const saltPercent = 100 - Math.min(30, saltScore?.score || 0) * (100 / 30);
  const manabasePercent = GRADE_TO_PERCENT[manabaseScore?.grade] ?? 50;
  const healthPercent = healthScore?.score || 0;

  return Math.round(
    powerPercent * 0.25 + saltPercent * 0.15 + manabasePercent * 0.3 + healthPercent * 0.3
  );
}

module.exports = {
  calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, calculateGlobalScore,
  SALTY_CARDS, POWER_INDICATORS, COLOR_SOURCES
};

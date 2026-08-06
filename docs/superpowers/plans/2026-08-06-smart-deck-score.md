# Smart Deck Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Manabase Score and Deck Health Score to Commander decks, replacing the existing Power Level + Salt Score two-card row in `DeckDetail.js` with a unified "Smart Deck Score" panel (headline global score + a 4-item strip that swaps to a per-score detail view on click).

**Architecture:** Two new pure-function score calculators (`calculateManabaseScore`, `calculateDeckHealthScore`) plus a `calculateGlobalScore` normalizer are added to `backend/utils/deckAnalysis.js`, following the exact shape of the existing `calculateSaltScore`/`estimatePowerLevel`, and wired into the `/decks/:id/stats` route response. The frontend `DeckDetail.js` gets its own matching copy of the same four calculations (mirroring how `calculateSaltScore`/`estimatePowerLevel` are *already* duplicated there today — the backend computes and returns them via `/stats`, but the frontend currently ignores that response and recomputes independently client-side via `useMemo`; this plan preserves that existing convention rather than changing it) — and a new UI panel replaces the current Power Level/Salt Score row.

**Tech Stack:** Node/Express (backend), React (frontend, no test infra). Backend is TDD (jest, existing `backend/__tests__/deckAnalysis.test.js`).

**Spec:** `docs/superpowers/specs/2026-08-06-smart-deck-score-design.md`

---

## Task 1: `COLOR_SOURCES` table + `calculateManabaseScore` (backend)

**Files:**
- Modify: `backend/utils/deckAnalysis.js`
- Modify: `backend/__tests__/deckAnalysis.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `backend/__tests__/deckAnalysis.test.js` (after the existing `estimatePowerLevel` describe block):

```js
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
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest deckAnalysis --silent` (use `dangerouslyDisableSandbox: true` — required for this repo's mongodb-memory-server-dependent test setup even though this specific file has no DB dependency, since jest's global setup still initializes it)
Expected: FAIL — `calculateManabaseScore is not a function`.

- [ ] **Step 3: Add `COLOR_SOURCES` and `calculateManabaseScore` to `backend/utils/deckAnalysis.js`**

Add after the existing `POWER_INDICATORS` constant (before `calculateSaltScore`):

```js
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
  const demandByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const pipCountByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 }; // for computing avg pips/card

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
        demandByColor[color] += quantity;
        pipCountByColor[color] += quantity;
      });
    }
  });

  const bySourceColor = {};
  let worstGradeValue = null;

  Object.keys(demandByColor).forEach(color => {
    if (demandByColor[color] === 0) return; // color not actually played - no requirement

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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: all `calculateManabaseScore` tests + all pre-existing tests in the file pass.

- [ ] **Step 5: Update the module exports**

Change the `module.exports` line at the bottom of `backend/utils/deckAnalysis.js` from:
```js
module.exports = { calculateSaltScore, estimatePowerLevel, SALTY_CARDS, POWER_INDICATORS };
```
to:
```js
module.exports = { calculateSaltScore, estimatePowerLevel, calculateManabaseScore, SALTY_CARDS, POWER_INDICATORS, COLOR_SOURCES };
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/deckAnalysis.js backend/__tests__/deckAnalysis.test.js
git commit -m "feat: add calculateManabaseScore grounded in Karsten mana-source targets"
```

---

## Task 2: `calculateDeckHealthScore` (backend)

**Files:**
- Modify: `backend/utils/deckAnalysis.js`
- Modify: `backend/__tests__/deckAnalysis.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `backend/__tests__/deckAnalysis.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: FAIL — `calculateDeckHealthScore is not a function`.

- [ ] **Step 3: Extend `POWER_INDICATORS` with `ramp`/`draw`, add `calculateDeckHealthScore`**

In `backend/utils/deckAnalysis.js`, add two new keys to the existing `POWER_INDICATORS` object (add these lines inside the object, alongside `fastMana`/`tutors`/etc — do not create a second `POWER_INDICATORS` declaration):

```js
  ramp: ['Rampant Growth', 'Cultivate', 'Kodama\'s Reach', 'Farseek', 'Nature\'s Lore',
         'Three Visits', 'Sakura-Tribe Elder', 'Llanowar Elves', 'Elvish Mystic',
         'Birds of Paradise', 'Arbor Elf', 'Wood Elves', 'Skyshroud Claim',
         'Explosive Vegetation', 'Signet', 'Talisman'], // last two match by substring below, not exact name
  draw: ['Sylvan Library', 'Phyrexian Arena', 'Mystic Remora', 'Rhystic Study',
         'Fact or Fiction', 'Blue Sun\'s Zenith', 'Harmonize', 'Night\'s Whisper',
         'Sign in Blood', 'Read the Bones', 'Divination', 'Concentrate',
         'Windfall', 'Faithless Looting', 'Guardian Project'],
```

(The `ramp` list's last two entries, `'Signet'`/`'Talisman'`, are intentionally partial strings — `calculateDeckHealthScore` below matches them via substring `.includes()` against card names like "Azorius Signet"/"Boros Talisman" rather than exact equality, since there are ~10 of each and enumerating every color combination twice — once here, once in `COLOR_SOURCES` from Task 1 — would be pure duplication. Every other list in `POWER_INDICATORS` continues to match by exact name.)

Add `calculateDeckHealthScore` after `estimatePowerLevel`. It reuses Task 1's `isLandCard` (not a fresh `(card.types||[]).includes('Land')` check) so this function's land count agrees with `calculateManabaseScore`'s — offline-imported cards can be missing `types` metadata until "Update Full Card Data" is run, and only `isLandCard`'s name-based fallback (`BASIC_LAND_COLORS`/`NONBASIC_LAND_NAMES`) catches those correctly:

```js
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
```

Note: this function calls `parseCMC`, which already exists in `backend/utils/deckHelpers.js`, not in `deckAnalysis.js`. Add this import at the top of `deckAnalysis.js`:
```js
const { parseCMC } = require('./deckHelpers');
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: all pass, including the pre-existing Task 1 tests.

- [ ] **Step 5: Update module exports**

```js
module.exports = { calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, SALTY_CARDS, POWER_INDICATORS, COLOR_SOURCES };
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/deckAnalysis.js backend/__tests__/deckAnalysis.test.js
git commit -m "feat: add calculateDeckHealthScore (curve, ramp, draw, removal, land ratio)"
```

---

## Task 3: `calculateGlobalScore` + wire into `/decks/:id/stats`

**Files:**
- Modify: `backend/utils/deckAnalysis.js`
- Modify: `backend/routes/decks.js`
- Modify: `backend/__tests__/deckAnalysis.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `backend/__tests__/deckAnalysis.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: FAIL — `calculateGlobalScore is not a function`.

- [ ] **Step 3: Add `calculateGlobalScore` to `backend/utils/deckAnalysis.js`**

Add after `calculateDeckHealthScore`:

```js
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: all pass.

- [ ] **Step 5: Update module exports**

```js
module.exports = {
  calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, calculateGlobalScore,
  SALTY_CARDS, POWER_INDICATORS, COLOR_SOURCES
};
```

- [ ] **Step 6: Wire into `backend/routes/decks.js`**

Change the import at the top of the file (currently `const { calculateSaltScore, estimatePowerLevel } = require('../utils/deckAnalysis');`) to:
```js
const { calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, calculateGlobalScore } = require('../utils/deckAnalysis');
```

In the `/:id/stats` route, directly after the existing:
```js
    const saltScore = calculateSaltScore(deck);
    const powerLevel = estimatePowerLevel(deck, deckValue);
```
add:
```js
    const manabaseScore = calculateManabaseScore(deck);
    const healthScore = calculateDeckHealthScore(deck);
    const globalScore = calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore);
```

Then update both `res.json(...)` calls in this route (the early-return `if (!GameSession)` branch, and the final response later in the route) to include the three new fields alongside the existing `powerLevel, saltScore`. For the early-return branch, change:
```js
      return res.json({ gamesPlayed: 0, wins: 0, winRate: 0, avgPlacement: 0, avgTurns: 0, avgDuration: 0, bestMatchups: [], worstMatchups: [], powerLevel, saltScore });
```
to:
```js
      return res.json({ gamesPlayed: 0, wins: 0, winRate: 0, avgPlacement: 0, avgTurns: 0, avgDuration: 0, bestMatchups: [], worstMatchups: [], powerLevel, saltScore, manabaseScore, healthScore, globalScore });
```

For the final response later in the same route (find the `res.json({ gamesPlayed, wins, ...` call at the end of the handler, after the session-processing loop), add `manabaseScore, healthScore, globalScore` to that object alongside its existing `powerLevel, saltScore` fields.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass, including any pre-existing `decks.js` route tests that assert on the `/stats` response shape (if such a test exists and asserts an exact object equality rather than checking specific fields, it may need updating to include the three new fields — check `backend/__tests__/` for a decks-stats test file first).

- [ ] **Step 8: Commit**

```bash
git add backend/utils/deckAnalysis.js backend/routes/decks.js backend/__tests__/deckAnalysis.test.js
git commit -m "feat: add calculateGlobalScore and wire all three new scores into /decks/:id/stats"
```

---

## Task 4: Frontend — port calculations, replace the Power Level/Salt Score row with the Smart Deck Score panel

**Files:**
- Modify: `frontend/src/components/DeckDetail.js`

This is a frontend-only task (no test infra in this repo) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Add the ported calculation constants and functions**

In `frontend/src/components/DeckDetail.js`, first add two new keys to the file's existing `POWER_INDICATORS` constant (around line 129–149), inside the object alongside `fastMana`/`tutors`/etc — mirroring exactly what Task 2 Step 3 did to the backend's copy of the same object, do NOT create a second, separately-named object on the frontend:

```js
  ramp: ['Rampant Growth', 'Cultivate', 'Kodama\'s Reach', 'Farseek', 'Nature\'s Lore',
         'Three Visits', 'Sakura-Tribe Elder', 'Llanowar Elves', 'Elvish Mystic',
         'Birds of Paradise', 'Arbor Elf', 'Wood Elves', 'Skyshroud Claim',
         'Explosive Vegetation', 'Signet', 'Talisman'],
  draw: ['Sylvan Library', 'Phyrexian Arena', 'Mystic Remora', 'Rhystic Study',
         'Fact or Fiction', 'Blue Sun\'s Zenith', 'Harmonize', 'Night\'s Whisper',
         'Sign in Blood', 'Read the Bones', 'Divination', 'Concentrate',
         'Windfall', 'Faithless Looting', 'Guardian Project'],
```

Then, after the (now-extended) `POWER_INDICATORS` constant and before the `DeckDetail` component function, add the rest of the ported calculation logic — this is the frontend copy of everything else added to `backend/utils/deckAnalysis.js` in Tasks 1–3, kept in sync per this file's existing documented convention (see the `SALTY_CARDS`/`POWER_INDICATORS` comments already there):

```js
const BASIC_LAND_COLORS = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

const COLOR_SOURCES = {
  'Tundra': ['W', 'U'], 'Underground Sea': ['U', 'B'], 'Badlands': ['B', 'R'],
  'Taiga': ['R', 'G'], 'Savannah': ['G', 'W'], 'Scrubland': ['W', 'B'],
  'Volcanic Island': ['U', 'R'], 'Bayou': ['B', 'G'], 'Plateau': ['R', 'W'],
  'Tropical Island': ['G', 'U'],
  'Hallowed Fountain': ['W', 'U'], 'Watery Grave': ['U', 'B'], 'Blood Crypt': ['B', 'R'],
  'Stomping Ground': ['R', 'G'], 'Temple Garden': ['G', 'W'], 'Godless Shrine': ['W', 'B'],
  'Steam Vents': ['U', 'R'], 'Overgrown Tomb': ['B', 'G'], 'Sacred Foundry': ['R', 'W'],
  'Breeding Pool': ['G', 'U'],
  'Flooded Strand': ['W', 'U'], 'Polluted Delta': ['U', 'B'], 'Bloodstained Mire': ['B', 'R'],
  'Wooded Foothills': ['R', 'G'], 'Windswept Heath': ['G', 'W'], 'Marsh Flats': ['W', 'B'],
  'Scalding Tarn': ['U', 'R'], 'Verdant Catacombs': ['B', 'G'], 'Arid Mesa': ['R', 'W'],
  'Misty Rainforest': ['G', 'U'],
  'Command Tower': ['W', 'U', 'B', 'R', 'G'], 'Exotic Orchard': ['W', 'U', 'B', 'R', 'G'],
  'Path of Ancestry': ['W', 'U', 'B', 'R', 'G'], 'Arcane Signet': ['W', 'U', 'B', 'R', 'G'],
  'Fellwar Stone': ['W', 'U', 'B', 'R', 'G'], 'Chromatic Lantern': ['W', 'U', 'B', 'R', 'G'],
  'Azorius Signet': ['W', 'U'], 'Dimir Signet': ['U', 'B'], 'Rakdos Signet': ['B', 'R'],
  'Gruul Signet': ['R', 'G'], 'Selesnya Signet': ['G', 'W'], 'Orzhov Signet': ['W', 'B'],
  'Izzet Signet': ['U', 'R'], 'Golgari Signet': ['B', 'G'], 'Boros Signet': ['R', 'W'],
  'Simic Signet': ['G', 'U'],
};

const KARSTEN_TARGETS = { 1: 22, 2: 29, 3: 34 };

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

function calculateManabaseScore(deck) {
  if (!deck.mainDeck) return { grade: 'N/A', bySourceColor: {}, landCount: 0, recommendedLandRange: [36, 38] };

  const allCards = [...deck.mainDeck];
  if (deck.commander) allCards.push(deck.commander);
  if (deck.partnerCommander?.name) allCards.push(deck.partnerCommander);

  let landCount = 0;
  const sourcesByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const demandByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const pipCountByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };

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
        demandByColor[color] += quantity;
        pipCountByColor[color] += quantity;
      });
    }
  });

  const bySourceColor = {};
  let worstGradeValue = null;

  Object.keys(demandByColor).forEach(color => {
    if (demandByColor[color] === 0) return;

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

    const cmc = parseCmcFromManaCost(card.manaCost);
    const bucket = cmc >= 7 ? '7+' : cmc.toString();
    curveBuckets[bucket] += quantity;

    const isRamp = POWER_INDICATORS.ramp.some(name =>
      name === card.name || ((name === 'Signet' || name === 'Talisman') && card.name.includes(name))
    );
    if (isRamp) ramp += quantity;
    if (POWER_INDICATORS.draw.includes(card.name)) draw += quantity;
    if (POWER_INDICATORS.efficientRemoval.includes(card.name)) removal += quantity;
  });

  const nonLandTotal = totalCards - landCards;
  const cheapCards = curveBuckets[0] + curveBuckets[1] + curveBuckets[2];
  const veryCheapCards = curveBuckets[0] + curveBuckets[1];
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

  const rampScore = Math.min(100, Math.round((ramp / 10) * 100));
  const drawScore = Math.min(100, Math.round((draw / 10) * 100));
  const removalScore = Math.min(100, Math.round((removal / 10) * 100));

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
  const saltPercent = 100 - Math.min(30, saltScore?.score || 0) * (100 / 30);
  const manabasePercent = GRADE_TO_PERCENT[manabaseScore?.grade] ?? 50;
  const healthPercent = healthScore?.score || 0;

  return Math.round(
    powerPercent * 0.25 + saltPercent * 0.15 + manabasePercent * 0.3 + healthPercent * 0.3
  );
}
```

- [ ] **Step 2: Compute the two new scores + global score inside the component**

Inside the `DeckDetail` function, directly after the existing `powerLevel` `useMemo` block (around line 242), add:

```js
  // ── Manabase Score ────────────────────────────────────────────────────────
  const manabaseScore = useMemo(() => calculateManabaseScore(deck), [deck]);

  // ── Deck Health Score ─────────────────────────────────────────────────────
  const healthScore = useMemo(() => calculateDeckHealthScore(deck), [deck]);

  // ── Global Score ──────────────────────────────────────────────────────────
  const globalScore = useMemo(
    () => calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore),
    [powerLevel, saltScore, manabaseScore, healthScore]
  );

  // ── Smart Deck Score panel: which sub-score's detail view is showing ──────
  const [activeScoreDetail, setActiveScoreDetail] = useState(null); // null | 'power' | 'salt' | 'mana' | 'health'
```

- [ ] **Step 3: Replace the Power Level + Salt Score row with the Smart Deck Score panel**

Replace the entire block from `{/* Row: Power Level + Salt Score */}` through its closing `</div>` (the full two-card grid, roughly lines 698–776 as read at plan-writing time — locate by the `{/* Row: Power Level + Salt Score */}` comment, since line numbers may have shifted) with:

```jsx
          {/* Smart Deck Score panel */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <div className="text-center mb-4">
              <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Smart Deck Score</div>
              <div className="flex items-center justify-center">
                <span className={`text-5xl font-bold ${
                  globalScore >= 80 ? 'text-green-400' :
                  globalScore >= 60 ? 'text-yellow-400' :
                  globalScore >= 40 ? 'text-orange-400' : 'text-red-400'
                }`}>{globalScore}</span>
                <span className="text-white/40 text-xl ml-1">/100</span>
              </div>
            </div>

            {activeScoreDetail === null ? (
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => setActiveScoreDetail('power')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Power</div>
                  <div className="text-white font-bold text-lg">{powerLevel.level}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('salt')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Salt</div>
                  <div className="text-white font-bold text-lg">{saltScore.score}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('mana')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Mana</div>
                  <div className="text-white font-bold text-lg">{manabaseScore.grade}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('health')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Health</div>
                  <div className="text-white font-bold text-lg">{healthScore.score}</div>
                </button>
              </div>
            ) : (
              <div className="bg-white/5 rounded p-4">
                <button onClick={() => setActiveScoreDetail(null)} className="text-white/60 hover:text-white text-sm mb-3 flex items-center gap-1">
                  ← Back
                </button>

                {activeScoreDetail === 'power' && (
                  <div>
                    <div className="flex items-center justify-center mb-3">
                      <span className={`text-4xl font-bold ${
                        powerLevel.level >= 9 ? 'text-red-500' :
                        powerLevel.level >= 7 ? 'text-orange-500' :
                        powerLevel.level >= 5 ? 'text-yellow-500' :
                        powerLevel.level >= 3 ? 'text-green-500' : 'text-blue-500'
                      }`}>{powerLevel.level}</span>
                      <span className="text-white/40 text-lg ml-1">/10</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-white/60">Fast Mana:</span><span className="text-white">{powerLevel.breakdown.fastMana} cards</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Tutors:</span><span className="text-white">{powerLevel.breakdown.tutors} cards</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Combo Pieces:</span><span className="text-white">{powerLevel.breakdown.comboPieces} cards</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Efficient Removal:</span><span className="text-white">{powerLevel.breakdown.efficientRemoval} cards</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Powerhouses:</span><span className="text-white">{powerLevel.breakdown.powerhouses} cards</span></div>
                    </div>
                  </div>
                )}

                {activeScoreDetail === 'salt' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className={`text-4xl font-bold ${
                        saltScore.score >= 20 ? 'text-red-500' :
                        saltScore.score >= 10 ? 'text-orange-500' :
                        saltScore.score >= 5 ? 'text-yellow-500' : 'text-green-500'
                      }`}>{saltScore.score}</span>
                    </div>
                    {saltScore.cards.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {saltScore.cards.map((card, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-white">{card.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              card.salt >= 3 ? 'bg-red-500/30 text-red-300' :
                              card.salt >= 2 ? 'bg-orange-500/30 text-orange-300' : 'bg-yellow-500/30 text-yellow-300'
                            }`}>+{card.salt}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/40 text-center text-sm">No salty cards detected! Your playgroup will thank you.</div>
                    )}
                  </div>
                )}

                {activeScoreDetail === 'mana' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className="text-4xl font-bold text-white">{manabaseScore.grade}</span>
                    </div>
                    <div className="text-white/60 text-sm mb-2">
                      Lands: {manabaseScore.landCount} (recommended {manabaseScore.recommendedLandRange[0]}-{manabaseScore.recommendedLandRange[1]})
                    </div>
                    {Object.keys(manabaseScore.bySourceColor).length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(manabaseScore.bySourceColor).map(([color, data]) => (
                          <div key={color} className="flex justify-between">
                            <span className="text-white/60">{color} sources:</span>
                            <span className="text-white">{data.sources} / {data.target} target</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/40 text-center text-sm">No colored mana requirements found.</div>
                    )}
                  </div>
                )}

                {activeScoreDetail === 'health' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className="text-4xl font-bold text-white">{healthScore.score}</span>
                      <span className="text-white/40 text-lg ml-1">/100</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-white/60">Curve Smoothness:</span><span className="text-white">{healthScore.breakdown.curveSmoothness}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Ramp:</span><span className="text-white">{healthScore.breakdown.ramp}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Draw:</span><span className="text-white">{healthScore.breakdown.draw}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Removal:</span><span className="text-white">{healthScore.breakdown.removal}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Land Ratio:</span><span className="text-white">{healthScore.breakdown.landRatio}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DeckDetail.js
git commit -m "feat: replace Power Level/Salt Score row with unified Smart Deck Score panel"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all pass.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual smoke test**

With both servers running, open a Commander deck in Deck Builder → Deck Detail:
- Confirm the Smart Deck Score panel renders in place of the old Power Level/Salt Score row, with a headline 0–100 number.
- Click each of Power/Salt/Mana/Health — confirm the strip swaps to that score's detail view with the correct breakdown, and "← Back" restores the strip.
- Compare the Manabase Score's per-color source counts against the deck's actual land base by eye for a deck you know well, to sanity-check the numbers look reasonable (not a formal correctness proof, just a gut check).
- Confirm a deck with zero colored pips (e.g. a mostly-colorless deck) doesn't crash the Manabase detail view (shows the "No colored mana requirements found" empty state).

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

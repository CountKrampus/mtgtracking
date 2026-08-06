# Smart Deck Manabase Builder (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a budget-driven manabase builder to Deck Detail — set a $ budget, get a suggested fixing-land package, toggle individual lands with a live client-side Manabase Score preview, bulk-add whatever's selected.

**HARD DEPENDENCY, READ FIRST:** This plan assumes Phase 1 (`docs/superpowers/plans/2026-08-06-smart-deck-score.md`) and Phase 2 (`docs/superpowers/plans/2026-08-06-smart-deck-recommendations.md`) are **already implemented and merged** before starting Task 1 below. This plan's Task 1 modifies `COLOR_SOURCES` and `calculateManabaseScore`, which Phase 1 creates; Task 2 reuses `getDeckColorIdentity`, which Phase 2 creates. If those phases aren't built yet, stop and build them first — do not attempt to build Phase 3 standalone.

**Architecture:** `COLOR_SOURCES` (introduced by Phase 1, in both `backend/utils/deckAnalysis.js` and its frontend copy in `DeckDetail.js`) gets its value shape changed from a plain color array to `{ colors, cycle }`, requiring `calculateManabaseScore` and its existing tests to be updated in the same task. A new `GET /api/decks/:id/manabase-builder` route in `decks.js` looks up each candidate land directly via Scryfall's `/cards/named` endpoint (the same endpoint `getPriceWithFallback` calls internally) to get its price **and** a real `scryfallId`/image/mana cost in one request — not the price-only `getPriceWithFallback` utility, since every candidate needs a genuine distinct `scryfallId` (see Task 2's note on why) — then greedy-selects a package within budget. The frontend adds a new section to `DeckDetail.js`; the live score preview runs entirely client-side against the file's own `calculateManabaseScore` copy, with zero backend round-trips per checkbox toggle.

**Tech Stack:** Node/Express (backend, TDD via jest), React (frontend, no test infra).

**Spec:** `docs/superpowers/specs/2026-08-06-smart-deck-manabase-builder-design.md`

---

## Task 1: Extend `COLOR_SOURCES` with `cycle`, update `calculateManabaseScore` and its tests

**Files:**
- Modify: `backend/utils/deckAnalysis.js`
- Modify: `backend/__tests__/deckAnalysis.test.js`
- Modify: `frontend/src/components/DeckDetail.js`

This task changes a table Phase 1 introduced from `{ 'Name': ['W','U'] }` to `{ 'Name': { colors: ['W','U'], cycle: 'trueDual' } }` in both the backend and its frontend copy, and fixes every consumer of the old shape.

- [ ] **Step 1: Update the failing/changed tests first**

In `backend/__tests__/deckAnalysis.test.js`, the existing `calculateManabaseScore` describe block's third test (`'counts COLOR_SOURCES nonbasic lands and rocks toward the colors they produce'`) already only asserts on `sourcesByColor`/`landCount`, not on `COLOR_SOURCES`'s internal shape directly, so it does not need changes. Add one new test to the same describe block to lock in the new shape:

```js
  test('COLOR_SOURCES entries expose both colors and a cycle label', () => {
    expect(COLOR_SOURCES['Tundra']).toEqual({ colors: ['W', 'U'], cycle: 'trueDual' });
    expect(COLOR_SOURCES['Command Tower']).toEqual({ colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' });
  });
```

(This requires `COLOR_SOURCES` to be imported in the test file — it already is, per Phase 1's Task 1 Step 5 module-exports change.)

- [ ] **Step 2: Run tests, verify the new test fails and no others regress yet**

Run: `cd backend && npx jest deckAnalysis --silent` (use `dangerouslyDisableSandbox: true`)
Expected: the new test FAILS (`COLOR_SOURCES['Tundra']` is still a plain array); all pre-existing tests still PASS (they don't depend on the internal shape).

- [ ] **Step 3: Replace `COLOR_SOURCES` in `backend/utils/deckAnalysis.js`**

Replace the entire existing `COLOR_SOURCES` constant with:

```js
const COLOR_SOURCES = {
  // True duals / original duals
  'Tundra': { colors: ['W', 'U'], cycle: 'trueDual' }, 'Underground Sea': { colors: ['U', 'B'], cycle: 'trueDual' },
  'Badlands': { colors: ['B', 'R'], cycle: 'trueDual' }, 'Taiga': { colors: ['R', 'G'], cycle: 'trueDual' },
  'Savannah': { colors: ['G', 'W'], cycle: 'trueDual' }, 'Scrubland': { colors: ['W', 'B'], cycle: 'trueDual' },
  'Volcanic Island': { colors: ['U', 'R'], cycle: 'trueDual' }, 'Bayou': { colors: ['B', 'G'], cycle: 'trueDual' },
  'Plateau': { colors: ['R', 'W'], cycle: 'trueDual' }, 'Tropical Island': { colors: ['G', 'U'], cycle: 'trueDual' },
  // Shocklands
  'Hallowed Fountain': { colors: ['W', 'U'], cycle: 'shockland' }, 'Watery Grave': { colors: ['U', 'B'], cycle: 'shockland' },
  'Blood Crypt': { colors: ['B', 'R'], cycle: 'shockland' }, 'Stomping Ground': { colors: ['R', 'G'], cycle: 'shockland' },
  'Temple Garden': { colors: ['G', 'W'], cycle: 'shockland' }, 'Godless Shrine': { colors: ['W', 'B'], cycle: 'shockland' },
  'Steam Vents': { colors: ['U', 'R'], cycle: 'shockland' }, 'Overgrown Tomb': { colors: ['B', 'G'], cycle: 'shockland' },
  'Sacred Foundry': { colors: ['R', 'W'], cycle: 'shockland' }, 'Breeding Pool': { colors: ['G', 'U'], cycle: 'shockland' },
  // Fetchlands
  'Flooded Strand': { colors: ['W', 'U'], cycle: 'fetchland' }, 'Polluted Delta': { colors: ['U', 'B'], cycle: 'fetchland' },
  'Bloodstained Mire': { colors: ['B', 'R'], cycle: 'fetchland' }, 'Wooded Foothills': { colors: ['R', 'G'], cycle: 'fetchland' },
  'Windswept Heath': { colors: ['G', 'W'], cycle: 'fetchland' }, 'Marsh Flats': { colors: ['W', 'B'], cycle: 'fetchland' },
  'Scalding Tarn': { colors: ['U', 'R'], cycle: 'fetchland' }, 'Verdant Catacombs': { colors: ['B', 'G'], cycle: 'fetchland' },
  'Arid Mesa': { colors: ['R', 'W'], cycle: 'fetchland' }, 'Misty Rainforest': { colors: ['G', 'U'], cycle: 'fetchland' },
  // Universal fixers
  'Command Tower': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Exotic Orchard': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Path of Ancestry': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Arcane Signet': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Fellwar Stone': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Chromatic Lantern': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  // Signets (two-color rocks)
  'Azorius Signet': { colors: ['W', 'U'], cycle: 'signet' }, 'Dimir Signet': { colors: ['U', 'B'], cycle: 'signet' },
  'Rakdos Signet': { colors: ['B', 'R'], cycle: 'signet' }, 'Gruul Signet': { colors: ['R', 'G'], cycle: 'signet' },
  'Selesnya Signet': { colors: ['G', 'W'], cycle: 'signet' }, 'Orzhov Signet': { colors: ['W', 'B'], cycle: 'signet' },
  'Izzet Signet': { colors: ['U', 'R'], cycle: 'signet' }, 'Golgari Signet': { colors: ['B', 'G'], cycle: 'signet' },
  'Boros Signet': { colors: ['R', 'W'], cycle: 'signet' }, 'Simic Signet': { colors: ['G', 'U'], cycle: 'signet' },
};
```

- [ ] **Step 4: Fix `calculateManabaseScore`'s two consumers of `COLOR_SOURCES`**

In the same file, `calculateManabaseScore` reads `COLOR_SOURCES[card.name]` twice — once to add to `sourcesByColor` (treating the value as a plain color array via `.forEach`), and implicitly via the same access pattern. Change:
```js
    const fixingColors = COLOR_SOURCES[card.name];
    if (fixingColors) fixingColors.forEach(c => { sourcesByColor[c] += quantity; });
```
to:
```js
    const fixingEntry = COLOR_SOURCES[card.name];
    if (fixingEntry) fixingEntry.colors.forEach(c => { sourcesByColor[c] += quantity; });
```

- [ ] **Step 5: Run tests, verify all pass**

Run: `cd backend && npx jest deckAnalysis --silent` (sandbox disabled)
Expected: all pass, including the new `COLOR_SOURCES` shape test and every pre-existing Phase 1 test (the `sourcesByColor` counting behavior is unchanged, only the internal table shape changed).

- [ ] **Step 6: Apply the identical changes to `frontend/src/components/DeckDetail.js`**

Repeat Steps 3–4 verbatim against `DeckDetail.js`'s own copy of `COLOR_SOURCES` and `calculateManabaseScore` (added there by Phase 1's Task 4) — same table replacement, same `fixingColors.forEach` → `fixingEntry.colors.forEach` fix. Keep both copies byte-identical to each other, per this codebase's established "ported verbatim, kept in sync" convention for this file.

- [ ] **Step 7: Verify the frontend compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add backend/utils/deckAnalysis.js backend/__tests__/deckAnalysis.test.js frontend/src/components/DeckDetail.js
git commit -m "refactor: extend COLOR_SOURCES with cycle metadata for the manabase builder"
```

---

## Task 2: `GET /api/decks/:id/manabase-builder` (backend)

**Files:**
- Modify: `backend/routes/decks.js`
- Create: `backend/__tests__/deckManabaseBuilder.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/deckManabaseBuilder.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest deckManabaseBuilder --silent` (sandbox disabled)
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Add the route to `backend/routes/decks.js`**

Add this import near the top of the file, alongside the existing `deckAnalysis` import (note: `axios` is already imported in this file for other routes, and `getPriceWithFallback` is deliberately NOT used here — see the note below):
```js
const { COLOR_SOURCES } = require('../utils/deckAnalysis');
```

Add the route after the `/:id/recommendations` route added by Phase 2's Task 1:

```js
// Looks up each candidate directly via Scryfall's /cards/named (the same
// endpoint utils/pricing.js's getPriceWithFallback calls internally) instead
// of calling getPriceWithFallback itself, because every candidate here needs
// a real, distinct scryfallId for POST /:id/add-card to work correctly
// afterward - that route's duplicate-check compares scryfallId, and
// getPriceWithFallback doesn't return one (price-only). Fetching the full
// card once gives price + scryfallId + image + mana cost together.
async function fetchCandidateCardData(name) {
  try {
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    return {
      scryfallId: response.data.id,
      manaCost: response.data.mana_cost || '',
      imageUrl: response.data.image_uris?.normal || response.data.card_faces?.[0]?.image_uris?.normal || null,
      price: response.data.prices?.usd ? parseFloat(response.data.prices.usd) : 0,
    };
  } catch (error) {
    return { scryfallId: null, manaCost: '', imageUrl: null, price: 0 };
  }
}

router.get('/:id/manabase-builder', requireAuth, async (req, res) => {
  try {
    const budget = parseFloat(req.query.budget);
    if (!budget || budget <= 0) {
      return res.status(400).json({ message: 'budget is required and must be a positive number' });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const deckColors = getDeckColorIdentity(deck);
    const existingNames = new Set([
      ...deck.mainDeck.map(c => c.name),
      deck.commander?.name,
      deck.partnerCommander?.name,
    ].filter(Boolean));

    const candidateEntries = Object.entries(COLOR_SOURCES).filter(([name, entry]) =>
      !existingNames.has(name) && entry.colors.some(c => deckColors.includes(c))
    );

    // Sequential with a small delay, matching this codebase's existing
    // convention for repeated Scryfall lookups (bulk price updates elsewhere
    // in this app use the same 500ms-between-calls courtesy).
    const priced = [];
    for (const [name, entry] of candidateEntries) {
      const relevantColorCount = entry.colors.filter(c => deckColors.includes(c)).length;
      const cardData = await fetchCandidateCardData(name);
      priced.push({ name, colors: entry.colors, cycle: entry.cycle, relevantColorCount, ...cardData });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const byValue = [...priced].sort((a, b) => {
      const aValue = a.price > 0 ? a.relevantColorCount / a.price : 0;
      const bValue = b.price > 0 ? b.relevantColorCount / b.price : 0;
      return bValue - aValue;
    });

    const suggested = [];
    let runningTotal = 0;
    for (const card of byValue) {
      if (card.price === 0) continue; // no price data - skip from auto-suggestion, still listed in candidates
      if (runningTotal + card.price > budget) continue;
      suggested.push(card);
      runningTotal += card.price;
    }

    res.json({ budget, suggested, candidates: priced });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Note: this route depends on `getDeckColorIdentity` (added to this same file by Phase 2's Task 1) already being present — if it isn't, this task cannot proceed (see the hard-dependency note at the top of this plan).

**Real bug found while implementing this task:** `getDeckColorIdentity` read `card.colors` for the commander/partnerCommander, but the `Deck` schema actually stores their color identity under `colorIdentity` (`colors` is only a real field on `mainDeck` cards - see `backend/models/Deck.js`). This silently "worked" for Phase 2's `/recommendations` route only because most real decks' `mainDeck` cards happen to also carry the deck's colors; a deck whose color signal comes purely from the commander (e.g. this task's own test fixtures, which use an empty `mainDeck`) got treated as colorless. Fixed the shared helper:
```js
function getDeckColorIdentity(deck) {
  const colors = new Set();
  // commander/partnerCommander store color identity under `colorIdentity`
  // (per the Deck schema), while mainDeck cards store it under `colors` -
  // these are genuinely different field names, not interchangeable.
  [deck.commander, deck.partnerCommander].forEach(card => {
    (card?.colorIdentity || []).forEach(c => colors.add(c));
  });
  deck.mainDeck.forEach(card => {
    (card?.colors || []).forEach(c => colors.add(c));
  });
  return Array.from(colors);
}
```
This also required fixing the test fixtures above (and in the already-merged `backend/__tests__/deckRecommendations.test.js`) to create decks with `commander: { colorIdentity: [...] }` instead of `commander: { colors: [...] }`, and adding a regression test to `deckRecommendations.test.js` proving commander-only color identity (empty `mainDeck`) is respected.

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest deckManabaseBuilder --silent` (sandbox disabled)
Expected: 6/6 pass. Note this test file has a real `setTimeout(..., 500)` per candidate in the route — a 2-color deck's real candidate pool is ~30+ `COLOR_SOURCES` entries (any entry containing either color), not the few originally estimated here, so this file needs `jest.setTimeout(30000)` (added near the top of the file) and takes tens of real seconds to run; that's expected, not a hang.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass, including Task 1's updated `deckAnalysis.test.js` and Phase 1/2's existing suites.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deckManabaseBuilder.test.js
git commit -m "feat: add GET /api/decks/:id/manabase-builder (budget-constrained greedy land suggestions)"
```

---

## Task 3: Frontend — Manabase Builder section on Deck Detail

**Files:**
- Modify: `frontend/src/components/DeckDetail.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Add new state**

Add alongside the other `useState` declarations (near Phase 2's `recCategory`/`recScope` state):
```js
  const [manabaseBudget, setManabaseBudget] = useState('');
  const [manabaseCandidates, setManabaseCandidates] = useState([]);
  const [selectedManabaseLands, setSelectedManabaseLands] = useState(new Set()); // Set of card names
  const [loadingManabaseBuilder, setLoadingManabaseBuilder] = useState(false);
```

- [ ] **Step 2: Add the fetch handler**

Add this function in the component body, near Phase 2's recommendation handlers:

```js
  const suggestLandPackage = async () => {
    const budget = parseFloat(manabaseBudget);
    if (!budget || budget <= 0) return;
    setLoadingManabaseBuilder(true);
    try {
      const token = localStorage.getItem('authToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/decks/${deck._id}/manabase-builder?budget=${budget}`, { headers });
      const data = response.ok ? await response.json() : { suggested: [] };
      setManabaseCandidates(data.suggested || []);
      setSelectedManabaseLands(new Set((data.suggested || []).map(c => c.name)));
    } catch (error) {
      console.error('Error fetching manabase builder suggestions:', error);
      setManabaseCandidates([]);
    } finally {
      setLoadingManabaseBuilder(false);
    }
  };

  const toggleManabaseLand = (name) => {
    setSelectedManabaseLands(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
```

- [ ] **Step 3: Compute the live projected score**

Add this `useMemo`, directly after the existing `manabaseScore` `useMemo` added by Phase 1's Task 4 Step 2:

```js
  // ── Manabase Builder: live projected score for the currently-selected package ──
  const projectedManabaseScore = useMemo(() => {
    if (selectedManabaseLands.size === 0) return manabaseScore;
    const selectedCards = manabaseCandidates
      .filter(c => selectedManabaseLands.has(c.name))
      .map(c => ({ name: c.name, types: ['Land'], colors: c.colors }));
    const hypotheticalDeck = { ...deck, mainDeck: [...deck.mainDeck, ...selectedCards] };
    return calculateManabaseScore(hypotheticalDeck);
  }, [deck, manabaseCandidates, selectedManabaseLands, manabaseScore]);
```

- [ ] **Step 4: Add the "Add Selected to Deck" handler**

Reuses the exact same add-card call Phase 2's Task 2 Step 3 already introduced (`addRecommendationToDeck` posts `{ scryfallId, name, manaCost, types, colors, imageUrl }` to `/decks/:id/add-card`). Unlike Phase 2's version, this route's `scryfallId` is a real, distinct value per land (Task 2 fetches it directly from Scryfall specifically so this works) — it must be included, not omitted, since `add-card`'s duplicate-check compares `scryfallId`, and adding a second land with a missing/shared id would false-positive match against the first:

```js
  const addSelectedLandsToDeck = async () => {
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const toAdd = manabaseCandidates.filter(c => selectedManabaseLands.has(c.name));
    for (const land of toAdd) {
      try {
        await axios.post(`${API_URL}/decks/${deck._id}/add-card`, {
          scryfallId: land.scryfallId,
          name: land.name,
          manaCost: land.manaCost,
          types: ['Land'],
          colors: land.colors,
          imageUrl: land.imageUrl,
        }, { headers });
      } catch (error) {
        console.error(`Error adding ${land.name} to deck:`, error);
      }
    }
    setManabaseCandidates([]);
    setSelectedManabaseLands(new Set());
    onRefresh?.();
  };
```

- [ ] **Step 5: Render the Manabase Builder section**

Add this new section directly after Phase 2's Recommendations section (right after its closing `</div>`):

```jsx
          {/* Manabase Builder */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Manabase Builder</h3>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/60 text-sm">Budget: $</span>
              <input
                type="number"
                min="0"
                step="1"
                value={manabaseBudget}
                onChange={(e) => setManabaseBudget(e.target.value)}
                placeholder="50"
                className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
              />
              <button
                onClick={suggestLandPackage}
                disabled={loadingManabaseBuilder || !manabaseBudget}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded text-sm font-medium transition"
              >
                {loadingManabaseBuilder ? 'Suggesting...' : 'Suggest Land Package'}
              </button>
            </div>

            {manabaseCandidates.length > 0 && (
              <>
                <div className="bg-white/5 rounded p-3 mb-3 flex items-center justify-between">
                  <span className="text-white/60 text-sm">Manabase Score</span>
                  <span className="text-white text-sm font-semibold">
                    {manabaseScore.grade} → <span className="text-green-400">{projectedManabaseScore.grade}</span>
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  {manabaseCandidates.map(card => (
                    <label key={card.name} className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedManabaseLands.has(card.name)}
                        onChange={() => toggleManabaseLand(card.name)}
                      />
                      <span className="text-white flex-1">{card.name}</span>
                      <span className="text-white/40 text-xs capitalize">{card.cycle}</span>
                      <span className="text-white/60">${card.price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={addSelectedLandsToDeck}
                  disabled={selectedManabaseLands.size === 0}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-semibold transition"
                >
                  Add Selected to Deck
                </button>
              </>
            )}
          </div>
```

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DeckDetail.js
git commit -m "feat: add Manabase Builder section with live client-side score preview"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all pass.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual smoke test**

With both servers running, open a Commander deck in Deck Builder → Deck Detail:
- Enter a budget (e.g. $30) and click "Suggest Land Package" — confirm suggestions appear, all within budget, all matching the deck's colors.
- Confirm the "Manabase Score: X → Y" line shows a real projected grade.
- Uncheck a land — confirm the projected score updates live, with no network request (check the browser's network tab shows no new request on toggle).
- Click "Add Selected to Deck" — confirm the selected lands actually appear in the deck's card list after refresh, and the section clears.
- Try a very low budget (e.g. $1) — confirm it still returns candidates (for pricing/inspection) even if `suggested` ends up empty, rather than erroring.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

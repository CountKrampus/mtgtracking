# Discord Bot Commands — Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new Discord bot slash commands (`/similar`, `/synergy`, `/commander`, `/sets`, `/location`, `/deckstats`) by extracting 4 features that today only exist as client-side Scryfall-calling logic in the React frontend into new backend routes, plus extending one existing route.

**Architecture:** New backend routes live in new router files (`backend/routes/cardInsights.js`, `backend/routes/commanders.js`, `backend/routes/sets.js`), mounted in `server.js` alongside the existing router-file pattern (see `app.use('/api/cards', require('./routes/priceFlags'))`). A new `backend/utils/deckAnalysis.js` holds the extracted power-level/salt-score pure functions, consumed by an extended `GET /api/decks/:id/stats`. The bot's 6 new command files follow the exact conventions of the existing 11 (`deferReply` first, `replyNotLinked` on 401, embed replies).

**Tech Stack:** Node/Express/Mongoose (backend), discord.js v14 (bot), Jest + supertest + mongodb-memory-server (backend tests), Jest + `jest.mock('../src/apiClient')` (bot tests).

---

## Task 1: Extract deck power-level / salt-score into a shared backend util

**Files:**
- Create: `backend/utils/deckAnalysis.js`
- Test: `backend/__tests__/deckAnalysis.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/deckAnalysis.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest deckAnalysis --runInBand`
Expected: FAIL with "Cannot find module '../utils/deckAnalysis'"

- [ ] **Step 3: Write the implementation**

```js
// backend/utils/deckAnalysis.js

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
};

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

module.exports = { calculateSaltScore, estimatePowerLevel, SALTY_CARDS, POWER_INDICATORS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest deckAnalysis --runInBand`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/deckAnalysis.js backend/__tests__/deckAnalysis.test.js
git commit -m "feat: extract deck power-level/salt-score into a shared backend util"
```

---

## Task 2: Add powerLevel/saltScore to GET /api/decks/:id/stats

**Files:**
- Modify: `backend/routes/decks.js:469-526` (the existing `/:id/stats` route)
- Test: `backend/__tests__/deck-stats-power-salt.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/deck-stats-power-salt.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Deck = require('../models/Deck');
require('../server'); // registers the Card model used by decks.js's ownership pass
const Card = mongoose.model('Card');
const { verifyToken } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Deck.deleteMany({});
  await Card.deleteMany({});
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/decks', require('../routes/decks'));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest deck-stats-power-salt --runInBand`
Expected: FAIL — `res.body.saltScore` is undefined

- [ ] **Step 3: Implement**

Read the current route body first (`backend/routes/decks.js:469-526`) — it already fetches `deck` and computes `gamesPlayed`/matchups. Add power level and salt score alongside the existing response, reusing the same owned/missing-value pass that `/:id/ownership` does (`backend/routes/decks.js:348-418`) so `/stats` doesn't require a second round-trip to `/ownership` first:

```js
// backend/routes/decks.js — add near the top of the file, with the other requires:
const { calculateSaltScore, estimatePowerLevel } = require('../utils/deckAnalysis');
```

```js
// backend/routes/decks.js — inside router.get('/:id/stats', ...), after
// `const deck = await Deck.findOne(query);` and its not-found check, before the
// `if (!GameSession)` branch, insert:

    // Deck value for the power-level formula — same owned/missing pass as
    // GET /:id/ownership (backend/routes/decks.js:348-418), inlined here so
    // /stats doesn't require the bot/frontend to call /ownership first.
    let deckValue = 0;
    if (Card) {
      const cardQuery = buildUserQuery({}, req);
      const collectionCards = await Card.find(cardQuery);
      const collectionMap = new Map();
      collectionCards.forEach(c => {
        if (c.scryfallId) {
          if (!collectionMap.has(c.scryfallId)) collectionMap.set(c.scryfallId, []);
          collectionMap.get(c.scryfallId).push(c);
        }
      });
      const allDeckCards = [
        deck.commander,
        ...(deck.partnerCommander ? [deck.partnerCommander] : []),
        ...deck.mainDeck
      ];
      allDeckCards.forEach(deckCard => {
        const owned = collectionMap.get(deckCard.scryfallId) || [];
        deckValue += owned.length > 0 ? owned[0].price : (deckCard.price || 0);
      });
    }

    const saltScore = calculateSaltScore(deck);
    const powerLevel = estimatePowerLevel(deck, deckValue);
```

Then add both to the final `res.json({...})` call in that route:

```js
    res.json({
      gamesPlayed,
      wins,
      winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
      avgPlacement: gamesPlayed > 0 ? Math.round((totalPlacement / gamesPlayed) * 10) / 10 : 0,
      avgTurns: gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0,
      avgDuration: gamesWithDuration > 0 ? Math.round(totalDuration / gamesWithDuration) : 0,
      bestMatchups,
      worstMatchups,
      powerLevel,
      saltScore
    });
```

The route also has an early-return branch for when the `GameSession` model isn't available (`backend/routes/decks.js:475-477`). Move the `deckValue`/`saltScore`/`powerLevel` computation above that branch (not after it), and add both fields to its return too, so `/deckstats` still works for decks with no `GameSession` model available:

```js
    if (!GameSession) {
      return res.json({ gamesPlayed: 0, wins: 0, winRate: 0, avgPlacement: 0, avgTurns: 0, avgDuration: 0, bestMatchups: [], worstMatchups: [], powerLevel, saltScore });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest deck-stats-power-salt --runInBand`
Expected: PASS

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest --runInBand`
Expected: all existing tests still pass (in particular any existing `/:id/stats` tests)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deck-stats-power-salt.test.js
git commit -m "feat: add power level and salt score to deck stats endpoint"
```

---

## Task 3: Add GET /api/cards/:id/similar and GET /api/cards/:id/synergies

**Files:**
- Create: `backend/routes/cardInsights.js`
- Modify: `backend/server.js` (mount the new router)
- Test: `backend/__tests__/card-insights.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/card-insights.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
require('../server');
const Card = mongoose.model('Card');
const { verifyToken } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Card.deleteMany({});
  jest.clearAllMocks();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/cards', require('../routes/cardInsights'));
  return app;
}

describe('GET /api/cards/:id/similar', () => {
  test('queries Scryfall by type and color and returns up to 20 results', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Grizzly Bears', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['G']
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Runeclaw Bear' }, { name: 'Watchwolf' }] } });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/cards/${card._id}/similar`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('t%3Acreature'));
  });

  test('404s for a card the caller does not own', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    const app = buildApp();
    await request(app)
      .get(`/api/cards/${new mongoose.Types.ObjectId()}/similar`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(404);
  });
});

describe('GET /api/cards/:id/synergies', () => {
  test('detects tribal synergy from oracle text and returns categorized results', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Goblin Chieftain', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['R'],
      oracleText: 'Goblin creatures you control get +1/+1 and have haste.'
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Goblin Warchief' }] } });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/cards/${card._id}/synergies`)
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body.tribal.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('keywords');
    expect(res.body).toHaveProperty('mechanics');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest card-insights --runInBand`
Expected: FAIL with "Cannot find module '../routes/cardInsights'"

- [ ] **Step 3: Implement the route file**

```js
// backend/routes/cardInsights.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

// GET /api/cards/:id/similar - ports frontend/src/components/CollectionView.js:551-570
router.get('/:id/similar', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const queries = [];
    if (card.types?.length > 0) queries.push(`t:${card.types[0].toLowerCase()}`);
    if (card.colors?.length > 0) queries.push(`(${card.colors.map(c => `c:${c.toLowerCase()}`).join(' ')})`);
    else queries.push('c:colorless');
    queries.push(`-!"${card.name}"`);

    try {
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(queries.join(' '))}&order=edhrec&unique=cards`);
      return res.json(response.data.data.slice(0, 20));
    } catch (scryfallError) {
      if (card.types?.length > 0) {
        const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=t:${card.types[0].toLowerCase()}&order=edhrec&unique=cards`);
        return res.json(fallback.data.data.slice(0, 20));
      }
      return res.json([]);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/cards/:id/synergies - ports frontend/src/components/CollectionView.js:590-690
const TRIBE_PATTERN = /\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid|Artifact|Enchantment)\b/gi;
const NAME_TRIBE_PATTERN = /\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid)\b/gi;

const KEYWORD_PATTERNS = [
  { keyword: 'flying', search: 'o:"flying" OR o:"creatures with flying"' },
  { keyword: 'deathtouch', search: 'o:"deathtouch"' },
  { keyword: 'lifelink', search: 'o:"lifelink" OR o:"whenever you gain life"' },
  { keyword: 'trample', search: 'o:"trample"' },
  { keyword: 'haste', search: 'o:"haste"' },
  { keyword: 'vigilance', search: 'o:"vigilance"' },
  { keyword: 'first strike', search: 'o:"first strike" OR o:"double strike"' },
  { keyword: 'hexproof', search: 'o:"hexproof"' },
  { keyword: 'indestructible', search: 'o:"indestructible"' },
  { keyword: 'menace', search: 'o:"menace"' },
  { keyword: 'reach', search: 'o:"reach"' },
  { keyword: 'flash', search: 'o:"flash"' },
  { keyword: 'prowess', search: 'o:"prowess" OR o:"whenever you cast a noncreature"' },
  { keyword: 'ward', search: 'o:"ward"' },
];

const MECHANIC_PATTERNS = [
  { pattern: /\+1\/\+1 counter/i, search: 'o:"+1/+1 counter" OR o:"proliferate"' },
  { pattern: /-1\/-1 counter/i, search: 'o:"-1/-1 counter" OR o:"wither"' },
  { pattern: /draw.*(card|cards)/i, search: 'o:"whenever you draw" OR o:"draw a card"' },
  { pattern: /discard/i, search: 'o:"discard" o:"whenever"' },
  { pattern: /creature dies|when.*dies/i, search: 'o:"when" o:"dies" OR o:"whenever a creature dies"' },
  { pattern: /sacrifice/i, search: 'o:"sacrifice" o:"whenever" OR o:"sacrifice a creature"' },
  { pattern: /token/i, search: 'o:"create" o:"token"' },
  { pattern: /graveyard/i, search: 'o:"from your graveyard" OR o:"in your graveyard"' },
  { pattern: /exile/i, search: 'o:"exile" o:"return"' },
  { pattern: /enters the battlefield|etb/i, search: 'o:"enters the battlefield" o:"whenever"' },
  { pattern: /life.*gain|gain.*life/i, search: 'o:"gain life" OR o:"whenever you gain life"' },
  { pattern: /deals.*damage.*opponent/i, search: 'o:"deals damage to" o:"opponent"' },
  { pattern: /mana/i, search: 'o:"add" o:"mana"' },
  { pattern: /equipment|equip/i, search: 't:equipment OR o:"equipped creature"' },
  { pattern: /aura|enchant creature/i, search: 't:aura OR o:"enchanted creature"' },
  { pattern: /spell.*cast|cast.*spell/i, search: 'o:"whenever you cast" o:"spell"' },
  { pattern: /attack/i, search: 'o:"whenever" o:"attacks"' },
  { pattern: /untap/i, search: 'o:"untap" o:"whenever"' },
  { pattern: /copy/i, search: 'o:"copy" o:"spell" OR o:"copy" o:"creature"' },
];

router.get('/:id/synergies', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const results = { tribal: [], keywords: [], mechanics: [] };
    const colorQuery = card.colors?.length > 0 ? `id<=${card.colors.map(c => c[0].toLowerCase()).join('')}` : 'id:c';

    if (card.types?.some(t => t.toLowerCase() === 'creature')) {
      const ot = card.oracleText || '';
      const typeMatch = ot.match(TRIBE_PATTERN);
      const nameTypes = card.name.match(NAME_TRIBE_PATTERN);
      const tribes = [...new Set([...(typeMatch || []), ...(nameTypes || [])])].map(t => t.toLowerCase());
      if (tribes.length > 0) {
        const tribe = tribes[0];
        try {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"${tribe}" ${colorQuery} -t:${tribe} -!"${card.name}"&order=edhrec&unique=cards`);
          results.tribal = r.data.data.slice(0, 12);
        } catch (e) {
          try {
            const r2 = await axios.get(`https://api.scryfall.com/cards/search?q=t:${tribe} ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
            results.tribal = r2.data.data.slice(0, 12);
          } catch (e2) { /* no tribal results */ }
        }
      }
    }

    const ot = (card.oracleText || '').toLowerCase();
    const foundKeywords = KEYWORD_PATTERNS.filter(({ keyword }) => ot.includes(keyword));
    if (foundKeywords.length > 0) {
      try {
        const r = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundKeywords[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
        results.keywords = r.data.data.slice(0, 12);
      } catch (e) { /* no keyword results */ }
    }

    const foundMechanics = MECHANIC_PATTERNS.filter(({ pattern }) => pattern.test(ot));
    if (foundMechanics.length > 0) {
      try {
        const r = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundMechanics[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
        results.mechanics = r.data.data.slice(0, 12);
      } catch (e) { /* no mechanic results */ }
    }

    if (results.mechanics.length === 0) {
      try {
        if (card.types?.includes('Instant') || card.types?.includes('Sorcery')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"whenever you cast" (o:"instant" OR o:"sorcery") ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        } else if (card.types?.includes('Artifact')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"artifact" o:"whenever" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        } else if (card.types?.includes('Enchantment')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"enchantment" o:"whenever" OR o:"constellation" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        }
      } catch (e) { /* no fallback mechanic results */ }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in server.js**

Add near the other `/api/cards` router mount (`backend/server.js:186`, `app.use('/api/cards', require('./routes/priceFlags'));`):

```js
app.use('/api/cards', require('./routes/cardInsights'));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest card-insights --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/routes/cardInsights.js backend/server.js backend/__tests__/card-insights.test.js
git commit -m "feat: add similar-cards and synergies backend endpoints"
```

---

## Task 4: Add GET /api/commanders/recommend

**Files:**
- Create: `backend/routes/commanders.js`
- Modify: `backend/server.js` (mount the new router)
- Test: `backend/__tests__/commanders.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/commanders.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
require('../server');
const Card = mongoose.model('Card');
const { verifyToken } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Card.deleteMany({});
  jest.clearAllMocks();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/commanders', require('../routes/commanders'));
  return app;
}

describe('GET /api/commanders/recommend', () => {
  test('with no colors argument, searches without a color-identity restriction', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    await Card.create({
      userId: user._id, name: 'Goblin Rally', quantity: 1, condition: 'NM', price: 0,
      colors: ['R'], oracleText: 'Create three 1/1 red Goblin creature tokens.'
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Krenko, Mob Boss' }] } });

    const app = buildApp();
    const res = await request(app)
      .get('/api/commanders/recommend')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).not.toMatch(/id[:<]/);
    expect(calledUrl).toContain('t%3Alegendary');
  });

  test('with a colors argument, restricts the query to that color identity', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    axios.get.mockResolvedValue({ data: { data: [] } });

    const app = buildApp();
    await request(app)
      .get('/api/commanders/recommend?colors=UB')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toMatch(/id%3Aub|id:ub/i);
  });

  test('falls back to a plain legendary-creature search on Scryfall error', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    axios.get.mockRejectedValueOnce(new Error('scryfall down'))
      .mockResolvedValueOnce({ data: { data: [{ name: 'The Ur-Dragon' }] } });

    const app = buildApp();
    const res = await request(app)
      .get('/api/commanders/recommend')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toEqual([{ name: 'The Ur-Dragon' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest commanders --runInBand`
Expected: FAIL with "Cannot find module '../routes/commanders'"

- [ ] **Step 3: Implement**

```js
// backend/routes/commanders.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

const THEME_SEARCHES = {
  tokens: 'o:"create" o:"token"',
  graveyard: 'o:"graveyard"',
  counters: 'o:"+1/+1 counter"',
  lifegain: 'o:"gain" o:"life"',
  sacrifice: 'o:"sacrifice"',
  spellslinger: 'o:"instant" o:"sorcery"',
  artifacts: 'o:"artifact"',
  enchantments: 'o:"enchantment"',
  tribal: 'o:"creature" o:"type"',
  ramp: 'o:"add" o:"mana"',
  draw: 'o:"draw" o:"card"',
  control: 'o:"counter" OR o:"destroy"'
};

const THEME_PATTERNS = [
  { name: 'tokens', patterns: [/create.*token/, /token.*creature/] },
  { name: 'graveyard', patterns: [/from.*graveyard/, /into.*graveyard/, /mill/] },
  { name: 'counters', patterns: [/\+1\/\+1 counter/, /proliferate/] },
  { name: 'lifegain', patterns: [/gain.*life/, /lifelink/] },
  { name: 'sacrifice', patterns: [/sacrifice.*creature/, /when.*dies/] },
  { name: 'spellslinger', patterns: [/instant.*sorcery/, /when.*cast.*spell/] },
  { name: 'artifacts', patterns: [/artifact.*enter/, /artifact.*you.*control/] },
  { name: 'enchantments', patterns: [/enchantment.*enter/, /constellation/] },
  { name: 'tribal', patterns: [/creature.*type/, /creatures.*you.*control.*get/] },
  { name: 'ramp', patterns: [/add.*mana/, /search.*land/] },
  { name: 'draw', patterns: [/draw.*card/, /whenever.*draw/] },
  { name: 'control', patterns: [/counter.*spell/, /destroy.*target/, /exile.*target/] }
];

// Only WUBRG letters survive; anything else in the argument is dropped rather
// than rejected outright, so a typo degrades to "no restriction" instead of a 400.
function sanitizeColors(input) {
  if (!input) return '';
  return [...new Set(input.toLowerCase().replace(/[^wubrg]/g, '').split(''))].join('');
}

// GET /api/commanders/recommend?colors=<identity> - ports the collection-analysis
// branch of frontend/src/App.js:265-366 (getCommanderRecommendations), NOT the
// manual "finder" mode (App.js:400+, searchCommandersByPreference).
router.get('/recommend', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);

    const themeCounts = {};
    cards.forEach(card => {
      const oracleText = (card.oracleText || '').toLowerCase();
      THEME_PATTERNS.forEach(({ name, patterns }) => {
        if (patterns.some(p => p.test(oracleText))) {
          themeCounts[name] = (themeCounts[name] || 0) + card.quantity;
        }
      });
    });

    const colors = sanitizeColors(req.query.colors);
    const colorQuery = colors ? `id:${colors}` : '';

    const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
    const themeQuery = topTheme ? (THEME_SEARCHES[topTheme[0]] || '') : '';

    const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
    try {
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
      return res.json(response.data.data.slice(0, 20));
    } catch (scryfallError) {
      const fallback = await axios.get('https://api.scryfall.com/cards/search?q=t:legendary+t:creature&order=edhrec&unique=cards');
      return res.json(fallback.data.data.slice(0, 20));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in server.js**

Add alongside the other new mount from Task 3:

```js
app.use('/api/commanders', require('./routes/commanders'));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest commanders --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/routes/commanders.js backend/server.js backend/__tests__/commanders.test.js
git commit -m "feat: add commander recommendation backend endpoint"
```

---

## Task 5: Add GET /api/sets/completion

**Files:**
- Create: `backend/routes/sets.js`
- Modify: `backend/server.js` (mount the new router)
- Test: `backend/__tests__/sets-completion.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/sets-completion.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
require('../server');
const Card = mongoose.model('Card');
const { verifyToken } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Card.deleteMany({});
  jest.clearAllMocks();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/sets', require('../routes/sets'));
  return app;
}

describe('GET /api/sets/completion', () => {
  test('returns owned/total counts per set, sorted by completion percentage descending', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    await Card.create([
      { userId: user._id, name: 'Card A', set: 'Alpha', setCode: 'lea', quantity: 1, condition: 'NM', price: 0 },
      { userId: user._id, name: 'Card B', set: 'Beta', setCode: 'leb', quantity: 1, condition: 'NM', price: 0 },
      { userId: user._id, name: 'Card C', set: 'Beta', setCode: 'leb', quantity: 2, condition: 'NM', price: 0 }
    ]);
    axios.get.mockImplementation((url) => {
      if (url.includes('/sets/lea')) return Promise.resolve({ data: { name: 'Limited Edition Alpha', card_count: 100, released_at: '1993-08-05', set_type: 'core' } });
      if (url.includes('/sets/leb')) return Promise.resolve({ data: { name: 'Limited Edition Beta', card_count: 10, released_at: '1993-10-01', set_type: 'core' } });
      return Promise.reject(new Error('unexpected set code'));
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/sets/completion')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    // Beta: 2 unique / 10 = 20%, Alpha: 1 unique / 100 = 1% -> Beta first
    expect(res.body[0].setCode).toBe('LEB');
    expect(res.body[0].ownedUnique).toBe(2);
    expect(res.body[0].totalOwned).toBe(3);
    expect(res.body[0].totalInSet).toBe(10);
  });

  test('skips sets Scryfall cannot find without failing the whole request', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    await Card.create({ userId: user._id, name: 'Card A', set: 'Unknown', setCode: 'zzz', quantity: 1, condition: 'NM', price: 0 });
    axios.get.mockRejectedValue(new Error('not found'));

    const app = buildApp();
    const res = await request(app)
      .get('/api/sets/completion')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest sets-completion --runInBand`
Expected: FAIL with "Cannot find module '../routes/sets'"

- [ ] **Step 3: Implement**

```js
// backend/routes/sets.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

// GET /api/sets/completion - ports frontend/src/App.js:463-522 (getSetCompletionData)
router.get('/completion', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);

    const cardsBySet = {};
    cards.forEach(card => {
      if (card.setCode) {
        const code = card.setCode.toLowerCase();
        if (!cardsBySet[code]) {
          cardsBySet[code] = { setCode: code, ownedCards: new Set(), totalOwned: 0 };
        }
        cardsBySet[code].ownedCards.add(card.name);
        cardsBySet[code].totalOwned += card.quantity;
      }
    });

    const completionData = [];
    const setCodes = Object.keys(cardsBySet);

    for (const code of setCodes.slice(0, 20)) {
      try {
        const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
        const setInfo = setResponse.data;
        completionData.push({
          setCode: code.toUpperCase(),
          setName: setInfo.name,
          ownedUnique: cardsBySet[code].ownedCards.size,
          totalInSet: setInfo.card_count,
          totalOwned: cardsBySet[code].totalOwned,
          releasedAt: setInfo.released_at,
          setType: setInfo.set_type
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // Skip sets Scryfall can't find - matches frontend behavior at App.js:508-511
      }
    }

    completionData.sort((a, b) => (b.ownedUnique / b.totalInSet) - (a.ownedUnique / a.totalInSet));
    res.json(completionData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in server.js**

```js
app.use('/api/sets', require('./routes/sets'));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest sets-completion --runInBand`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/routes/sets.js backend/server.js backend/__tests__/sets-completion.test.js
git commit -m "feat: add set completion backend endpoint"
```

---

## Task 6: Bot command /similar

**Files:**
- Create: `discord-bot/src/commands/similar.js`
- Test: `discord-bot/__tests__/similar.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/similar.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const { resolveCard } = require('../src/lib/resolveCard');
const similarCommand = require('../src/commands/similar');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue('Grizzly Bears') },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/similar', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers, resolves the card, and shows similar cards in an embed', async () => {
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Grizzly Bears' } });
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Runeclaw Bear', prices: { usd: '0.10' } }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await similarCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(api.get).toHaveBeenCalledWith('/cards/card-1/similar');
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Similar to Grizzly Bears' })]
    }));
  });

  test('replies not-linked when resolveCard reports not_linked', async () => {
    resolveCard.mockResolvedValue({ status: 'not_linked' });
    const interaction = mockInteraction();
    await similarCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });

  test('shows a no-match message when resolveCard finds nothing', async () => {
    resolveCard.mockResolvedValue({ status: 'no_match' });
    const interaction = mockInteraction();
    await similarCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Couldn't find")
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest similar --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/similar'"

- [ ] **Step 3: Implement**

First check `discord-bot/src/lib/notLinked.js` to confirm `replyNotLinked`'s exact signature (used by every other command) — reuse it here instead of hand-rolling the not-linked message.

```js
// discord-bot/src/commands/similar.js
const { client } = require('../apiClient');
const { resolveCard } = require('../lib/resolveCard');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'similar',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('card', true);
    const api = client(interaction.user.id);
    const resolved = await resolveCard(interaction, api, name);

    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: '⌛ Selection timed out.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const res = await api.get(`/cards/${card._id}/similar`);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const fields = res.data.slice(0, 10).map(c => ({
      name: c.name,
      value: c.prices?.usd ? `$${c.prices.usd}` : 'N/A',
      inline: true
    }));

    return interaction.followUp({
      embeds: [{ title: `Similar to ${card.name}`, fields: fields.length > 0 ? fields : [{ name: 'No results', value: 'N/A' }] }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest similar --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/similar.js discord-bot/__tests__/similar.test.js
git commit -m "feat: add /similar Discord bot command"
```

---

## Task 7: Bot command /synergy

**Files:**
- Create: `discord-bot/src/commands/synergy.js`
- Test: `discord-bot/__tests__/synergy.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/synergy.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const { resolveCard } = require('../src/lib/resolveCard');
const synergyCommand = require('../src/commands/synergy');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue('Goblin Chieftain') },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/synergy', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers, resolves the card, and shows tribal/keywords/mechanics fields', async () => {
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Goblin Chieftain' } });
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { tribal: [{ name: 'Goblin Warchief' }], keywords: [], mechanics: [] }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await synergyCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/cards/card-1/synergies');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Synergies for Goblin Chieftain');
    const tribalField = embed.fields.find(f => f.name === 'Tribal');
    expect(tribalField.value).toContain('Goblin Warchief');
    const keywordsField = embed.fields.find(f => f.name === 'Keywords');
    expect(keywordsField.value).toBe('None found');
  });

  test('replies not-linked when resolveCard reports not_linked', async () => {
    resolveCard.mockResolvedValue({ status: 'not_linked' });
    const interaction = mockInteraction();
    await synergyCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest synergy --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/synergy'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/synergy.js
const { client } = require('../apiClient');
const { resolveCard } = require('../lib/resolveCard');
const { replyNotLinked } = require('../lib/notLinked');

function formatList(cards) {
  if (!cards || cards.length === 0) return 'None found';
  return cards.slice(0, 5).map(c => c.name).join('\n');
}

module.exports = {
  name: 'synergy',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('card', true);
    const api = client(interaction.user.id);
    const resolved = await resolveCard(interaction, api, name);

    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: '⌛ Selection timed out.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const res = await api.get(`/cards/${card._id}/synergies`);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    return interaction.followUp({
      embeds: [{
        title: `Synergies for ${card.name}`,
        fields: [
          { name: 'Tribal', value: formatList(res.data.tribal) },
          { name: 'Keywords', value: formatList(res.data.keywords) },
          { name: 'Mechanics', value: formatList(res.data.mechanics) }
        ]
      }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest synergy --runInBand`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/synergy.js discord-bot/__tests__/synergy.test.js
git commit -m "feat: add /synergy Discord bot command"
```

---

## Task 8: Bot command /commander

**Files:**
- Create: `discord-bot/src/commands/commander.js`
- Test: `discord-bot/__tests__/commander.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/commander.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const commanderCommand = require('../src/commands/commander');

function mockInteraction(colors = null) {
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue(colors) },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/commander', () => {
  afterEach(() => jest.clearAllMocks());

  test('calls /commanders/recommend with no colors param when none given', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'The Ur-Dragon', prices: { usd: '5.00' } }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(null);
    await commanderCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/commanders/recommend', { params: {} });
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Commander Recommendations' })]
    }));
  });

  test('passes the colors argument through as a query param when given', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('UB');
    await commanderCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/commanders/recommend', { params: { colors: 'UB' } });
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(null);
    await commanderCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest commander --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/commander'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/commander.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'commander',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const colors = interaction.options.getString('colors');
    const api = client(interaction.user.id);
    const params = colors ? { colors } : {};
    const res = await api.get('/commanders/recommend', { params });

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const fields = res.data.slice(0, 10).map(c => ({
      name: c.name,
      value: c.prices?.usd ? `$${c.prices.usd}` : 'N/A',
      inline: true
    }));

    return interaction.followUp({
      embeds: [{ title: 'Commander Recommendations', fields: fields.length > 0 ? fields : [{ name: 'No results', value: 'N/A' }] }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest commander --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/commander.js discord-bot/__tests__/commander.test.js
git commit -m "feat: add /commander Discord bot command"
```

---

## Task 9: Bot command /sets

**Files:**
- Create: `discord-bot/src/commands/sets.js`
- Test: `discord-bot/__tests__/sets.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/sets.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const setsCommand = require('../src/commands/sets');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/sets', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the top 10 sets by completion percentage', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ setCode: 'LEB', setName: 'Limited Edition Beta', ownedUnique: 2, totalInSet: 10, totalOwned: 3 }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await setsCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/sets/completion');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Set Completion');
    expect(embed.fields[0].value).toContain('2/10');
    expect(embed.fields[0].value).toContain('20%');
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await setsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest "__tests__/sets.test.js" --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/sets'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/sets.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'sets',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const api = client(interaction.user.id);
    const res = await api.get('/sets/completion');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const fields = res.data.slice(0, 10).map(s => {
      const pct = s.totalInSet > 0 ? Math.round((s.ownedUnique / s.totalInSet) * 100) : 0;
      return {
        name: `${s.setCode} — ${s.setName}`,
        value: `${s.ownedUnique}/${s.totalInSet} (${pct}%)`
      };
    });

    return interaction.followUp({
      embeds: [{ title: 'Set Completion', fields: fields.length > 0 ? fields : [{ name: 'No data', value: 'No sets tracked yet' }] }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest "__tests__/sets.test.js" --runInBand`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/sets.js discord-bot/__tests__/sets.test.js
git commit -m "feat: add /sets Discord bot command"
```

---

## Task 10: Bot command /location

**Files:**
- Create: `discord-bot/src/commands/location.js`
- Test: `discord-bot/__tests__/location.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/location.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const locationCommand = require('../src/commands/location');

function mockInteraction(name) {
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue(name) },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/location', () => {
  afterEach(() => jest.clearAllMocks());

  test('lists cards at the single matching location', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Box 2' }] }) // /locations
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Sol Ring', quantity: 1, location: 'Binder 1' },
          { name: 'Forest', quantity: 4, location: 'Box 2' }
        ] }) // /cards
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder 1');
    await locationCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/locations');
    expect(api.get).toHaveBeenNthCalledWith(2, '/cards');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Binder 1');
    expect(embed.description).toContain('Sol Ring x1');
    expect(embed.description).not.toContain('Forest');
  });

  test('lists available locations when no location matches', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Box 2' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('nonexistent');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Binder 1')
    }));
  });

  test('asks for a more specific name when multiple locations match', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Binder 2' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Multiple locations match')
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder 1');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest "__tests__/location.test.js" --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/location'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/location.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'location',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const locRes = await api.get('/locations');
    if (locRes.status === 401) return replyNotLinked(interaction);
    if (locRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${locRes.status}).`, ephemeral: true });
    }

    const needle = name.trim().toLowerCase();
    const matches = locRes.data.filter(l => l.name.toLowerCase().includes(needle));

    if (matches.length === 0) {
      const available = locRes.data.map(l => l.name).join(', ') || 'none yet';
      return interaction.followUp({ content: `❌ No location matches "${name}". Available locations: ${available}`, ephemeral: true });
    }
    if (matches.length > 1) {
      const names = matches.map(l => l.name).join(', ');
      return interaction.followUp({ content: `❌ Multiple locations match "${name}": ${names}. Be more specific.`, ephemeral: true });
    }

    const location = matches[0];
    const cardsRes = await api.get('/cards');
    if (cardsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${cardsRes.status}).`, ephemeral: true });
    }

    const cardsHere = cardsRes.data.filter(c => c.location === location.name);
    const lines = cardsHere.slice(0, 25).map(c => `${c.name} x${c.quantity}`);
    const truncated = cardsHere.length > 25 ? `\n...and ${cardsHere.length - 25} more` : '';

    return interaction.followUp({
      embeds: [{
        title: location.name,
        description: lines.length > 0 ? lines.join('\n') + truncated : 'No cards stored here yet.'
      }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest "__tests__/location.test.js" --runInBand`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/location.js discord-bot/__tests__/location.test.js
git commit -m "feat: add /location Discord bot command"
```

---

## Task 11: Bot command /deckstats

**Files:**
- Create: `discord-bot/src/commands/deckstats.js`
- Test: `discord-bot/__tests__/deckstats.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/deckstats.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const deckstatsCommand = require('../src/commands/deckstats');

function mockInteraction(name) {
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue(name) },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/deckstats', () => {
  afterEach(() => jest.clearAllMocks());

  test('resolves the deck by name and shows power level and salt score', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ _id: 'deck-1', name: 'Edgar Markov' }] }) // /decks
        .mockResolvedValueOnce({
          status: 200,
          data: { powerLevel: { level: 7, breakdown: {} }, saltScore: { score: 8, cards: [{ name: 'Rhystic Study', salt: 2 }] } }
        }) // /decks/:id/stats
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('edgar markov');
    await deckstatsCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
    expect(api.get).toHaveBeenNthCalledWith(2, '/decks/deck-1/stats');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Edgar Markov — Power & Salt');
    expect(embed.fields.find(f => f.name === 'Power Level').value).toBe('7/10');
    expect(embed.fields.find(f => f.name === 'Salt Score').value).toBe('8');
    expect(embed.fields.find(f => f.name === 'Salty Cards').value).toContain('Rhystic Study');
  });

  test('reports no match for an unknown deck name', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('Nonexistent Deck');
    await deckstatsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('No deck named')
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('Edgar Markov');
    await deckstatsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npx jest deckstats --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/deckstats'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/deckstats.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deckstats',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.followUp({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const statsRes = await api.get(`/decks/${match._id}/stats`);
    if (statsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${statsRes.status}).`, ephemeral: true });
    }

    const { powerLevel, saltScore } = statsRes.data;
    const fields = [
      { name: 'Power Level', value: `${powerLevel.level}/10`, inline: true },
      { name: 'Salt Score', value: String(saltScore.score), inline: true }
    ];
    if (saltScore.cards?.length > 0) {
      fields.push({
        name: 'Salty Cards',
        value: saltScore.cards.slice(0, 5).map(c => `${c.name} (${c.salt})`).join('\n')
      });
    }

    return interaction.followUp({
      embeds: [{ title: `${match.name} — Power & Salt`, fields }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npx jest deckstats --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/deckstats.js discord-bot/__tests__/deckstats.test.js
git commit -m "feat: add /deckstats Discord bot command"
```

---

## Task 12: Register the 6 new commands and wire up dispatch

**Files:**
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/src/index.js` (command dispatch map)

- [ ] **Step 1: Add the 6 new SlashCommandBuilder entries**

In `discord-bot/src/registerCommands.js`, add to the `commands` array (before the closing `].map(c => c.toJSON());` line, after the existing `deck` command):

```js
  new SlashCommandBuilder().setName('similar').setDescription('Find cards similar to one you own')
    .addStringOption(o => o.setName('card').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('synergy').setDescription('Find cards that synergize with one you own')
    .addStringOption(o => o.setName('card').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('commander').setDescription('Get commander recommendations based on your collection')
    .addStringOption(o => o.setName('colors').setDescription('Restrict to a color identity, e.g. UB or WUBRG')),

  new SlashCommandBuilder().setName('sets').setDescription('Show your set completion progress'),

  new SlashCommandBuilder().setName('location').setDescription('List cards stored at a location')
    .addStringOption(o => o.setName('name').setDescription('Location name').setRequired(true)),

  new SlashCommandBuilder().setName('deckstats').setDescription("Show a deck's power level and salt score")
    .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),
```

- [ ] **Step 2: Wire the 6 new commands into the dispatch map**

Read `discord-bot/src/index.js` first to find the existing command dispatch Map (it maps command names to the required command modules — follow the exact same pattern used for the 11 existing commands, e.g. `commands.set('deck', require('./commands/deck'));`). Add:

```js
commands.set('similar', require('./commands/similar'));
commands.set('synergy', require('./commands/synergy'));
commands.set('commander', require('./commands/commander'));
commands.set('sets', require('./commands/sets'));
commands.set('location', require('./commands/location'));
commands.set('deckstats', require('./commands/deckstats'));
```

- [ ] **Step 3: Register commands to the test guild**

Run: `cd discord-bot && node src/registerCommands.js`
Expected: `Registered 17 slash commands to guild <guild-id>.`

- [ ] **Step 4: Run the full bot test suite**

Run: `cd discord-bot && npx jest --runInBand`
Expected: all tests pass (11 existing command test files + 6 new ones + resolveCard/add tests = full suite green)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/registerCommands.js discord-bot/src/index.js
git commit -m "feat: register and dispatch the 6 new Discord bot commands"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass, including all new ones from Tasks 1-5

- [ ] **Step 2: Run the full discord-bot test suite**

Run: `cd discord-bot && npx jest --runInBand`
Expected: all tests pass, including all new ones from Tasks 6-11

- [ ] **Step 3: Manual smoke test**

Restart the backend (`cd backend && npm run dev`, or however it's currently running) and the bot (`cd discord-bot && npm start`) so both pick up the new routes and the freshly-registered commands. In Discord, run each of the 6 new commands against a real linked account with some collection/deck data, and confirm each renders a sensible embed rather than an error.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: the commit before Task 1, head: the commit after Task 12) before merging, same as the original 17-task Discord bot plan.

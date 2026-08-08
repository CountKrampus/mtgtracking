# Community Deck Sharing & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deck sharing infrastructure (share links + public toggle) and a community deck browser where users can discover and import each other's decks.

**Architecture:** Extend the `Deck` model with `shareCode`, `isPublic`, and `importCount` fields. New public backend routes serve shared decks and a paginated, filterable community index. Two new frontend components handle the community browser (`CommunityDecks.js`) and public permalink view (`SharedDeckView.js`). The existing `DeckDetail.js` gains share controls; the Sidebar gains a "Community Decks" nav entry.

**Tech Stack:** Node.js/Express/Mongoose (backend), React + Tailwind CSS + lucide-react (frontend), MongoMemoryServer + Jest/Supertest (tests), `crypto.randomBytes` for share codes.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/models/Deck.js` | Add `shareCode`, `isPublic`, `importCount` fields |
| Modify | `backend/routes/decks.js` | Fix share route; add visibility, community, import routes |
| Create | `backend/__tests__/deck-sharing.test.js` | Tests for all new routes |
| Create | `frontend/src/components/CommunityDecks/SharedDeckView.js` | Public permalink deck view |
| Create | `frontend/src/components/CommunityDecks/CommunityDecks.js` | Browsable community deck index |
| Modify | `frontend/src/App.js` | `/shared/deck/:code` URL route + `community-decks` view |
| Modify | `frontend/src/components/Sidebar.js` | "Community Decks" nav entry |
| Modify | `frontend/src/components/DeckDetail.js` | Share button + public toggle |

---

## Task 1: Deck schema fields

**Files:**
- Modify: `backend/models/Deck.js`
- Create: `backend/__tests__/deck-sharing.test.js` (schema tests only)

- [ ] **Step 1: Add three fields to the Deck schema**

In `backend/models/Deck.js`, add the following three fields inside `deckSchema` before the `createdAt` field:

```js
shareCode: { type: String, default: null, sparse: true },
isPublic: { type: Boolean, default: false },
importCount: { type: Number, default: 0 },
```

Also add an index on `shareCode` after the schema definition (before `deckSchema.pre('save', ...)`):

```js
deckSchema.index({ shareCode: 1 }, { sparse: true, unique: true });
```

The sparse+unique index means multiple decks can have `shareCode: null` without conflicting, but no two decks can share the same non-null code.

- [ ] **Step 2: Write failing schema tests**

Create `backend/__tests__/deck-sharing.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

const Deck = require('../models/Deck');

const testUserId = () => new mongoose.Types.ObjectId();

test('shareCode defaults to null', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.shareCode).toBeNull();
});

test('isPublic defaults to false', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.isPublic).toBe(false);
});

test('importCount defaults to 0', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.importCount).toBe(0);
});

test('shareCode can be set and retrieved', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Shared Deck', shareCode: 'abc123def456' });
  const found = await Deck.findById(deck._id);
  expect(found.shareCode).toBe('abc123def456');
});

test('two decks cannot have the same non-null shareCode', async () => {
  await Deck.create({ userId: testUserId(), name: 'Deck A', shareCode: 'uniquecode1' });
  await expect(
    Deck.create({ userId: testUserId(), name: 'Deck B', shareCode: 'uniquecode1' })
  ).rejects.toThrow();
});
```

- [ ] **Step 3: Run tests — expect failures (schema not yet updated)**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -10
```

Expected: at least the duplicate shareCode test fails (no unique index yet).

- [ ] **Step 4: Run tests after schema change — expect all pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -10
```

Expected: 5 passed.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --forceExit 2>&1 | tail -5
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/models/Deck.js backend/__tests__/deck-sharing.test.js
git commit -m "feat: add shareCode, isPublic, importCount fields to Deck schema"
```

---

## Task 2: Fix share route + add visibility route

**Files:**
- Modify: `backend/routes/decks.js`
- Modify: `backend/__tests__/deck-sharing.test.js` (add route tests)

**Background:** The existing `POST /:id/share` route always overwrites `deck.shareCode` with a new code. Now that `shareCode` is in the schema, fix it to only generate a code on first share. Also add `PATCH /:id/visibility` to toggle `isPublic`.

- [ ] **Step 1: Add route tests to deck-sharing.test.js**

Add this block at the bottom of `backend/__tests__/deck-sharing.test.js` (after the schema tests):

```js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'admin' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const decksRouter = require('../routes/decks');
  const Card = require('../models/Card');
  decksRouter.injectDependencies(Card, null, null);
  app.use('/api/decks', decksRouter);
  return app;
}

describe('POST /api/decks/:id/share', () => {
  test('generates a shareCode and returns shareUrl', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/decks/${deck._id}/share`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.shareCode).toBeTruthy();
    expect(res.body.shareUrl).toMatch(/^\/shared\/deck\//);

    const updated = await Deck.findById(deck._id);
    expect(updated.shareCode).toBe(res.body.shareCode);
  });

  test('does not regenerate shareCode on second call', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'existing123' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/decks/${deck._id}/share`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.shareCode).toBe('existing123');
  });
});

describe('PATCH /api/decks/:id/visibility', () => {
  test('sets isPublic to true when deck is already shared', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'code123' });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: true });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(true);

    const updated = await Deck.findById(deck._id);
    expect(updated.isPublic).toBe(true);
  });

  test('returns 400 if deck has no shareCode', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'userd', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck' });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/share link/i);
  });

  test('sets isPublic to false (unlist)', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'usere', passwordHash: 'h' });
    const deck = await Deck.create({ userId: user._id, name: 'My Deck', shareCode: 'code456', isPublic: true });
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/decks/${deck._id}/visibility`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isPublic: false });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(false);
  });
});
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -15
```

Expected: PATCH tests fail (route doesn't exist yet).

- [ ] **Step 3: Fix the share route in decks.js**

Find this block in `backend/routes/decks.js` (around line 512):

```js
const isFirstShare = !deck.shareCode;
deck.shareCode = require('crypto').randomBytes(8).toString('hex');
await deck.save();
```

Replace with:

```js
const isFirstShare = !deck.shareCode;
if (isFirstShare) {
  deck.shareCode = require('crypto').randomBytes(8).toString('hex');
}
await deck.save();
```

- [ ] **Step 4: Add PATCH /api/decks/:id/visibility route**

In `backend/routes/decks.js`, add this route immediately before the existing `POST /:id/share` route (before line ~511):

```js
// Toggle deck visibility (public/private)
router.patch('/:id/visibility', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    if (!deck.shareCode) return res.status(400).json({ message: 'Generate a share link first' });
    deck.isPublic = !!req.body.isPublic;
    await deck.save();
    res.json({ isPublic: deck.isPublic, shareCode: deck.shareCode });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Run full suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --forceExit 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deck-sharing.test.js
git commit -m "feat: fix share route to preserve existing shareCode; add PATCH /decks/:id/visibility"
```

---

## Task 3: Public GET routes — shared deck + community index

**Files:**
- Modify: `backend/routes/decks.js`
- Modify: `backend/__tests__/deck-sharing.test.js` (add GET tests)

**Important:** Both new GET routes must be added BEFORE the existing `router.get('/:id', requireAuth, ...)` route in decks.js. Express matches routes in order — if `/:id` comes first, `/shared/:shareCode` and `/community` are swallowed as IDs.

- [ ] **Step 1: Add GET tests to deck-sharing.test.js**

Add this block at the bottom of `backend/__tests__/deck-sharing.test.js`:

```js
describe('GET /api/decks/shared/:shareCode', () => {
  test('returns deck and owner for a valid shareCode', async () => {
    const user = await User.create({ email: 'f@test.com', username: 'userf', displayName: 'User F', passwordHash: 'h' });
    await Deck.create({
      userId: user._id,
      name: 'Public Deck',
      shareCode: 'pubcode1',
      isPublic: true,
      mainDeck: [{ scryfallId: 'abc', name: 'Lightning Bolt', quantity: 4 }]
    });
    const app = buildApp();

    const res = await request(app).get('/api/decks/shared/pubcode1');

    expect(res.status).toBe(200);
    expect(res.body.deck.name).toBe('Public Deck');
    expect(res.body.deck.mainDeck).toHaveLength(1);
    expect(res.body.owner.username).toBe('userf');
    expect(res.body.owner.displayName).toBe('User F');
  });

  test('returns 404 for unknown shareCode', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/decks/shared/notacode');
    expect(res.status).toBe(404);
  });

  test('works without auth header', async () => {
    const user = await User.create({ email: 'g@test.com', username: 'userg', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Open Deck', shareCode: 'opencode' });
    const app = buildApp();

    const res = await request(app).get('/api/decks/shared/opencode');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/decks/community', () => {
  test('returns only isPublic decks', async () => {
    const user = await User.create({ email: 'h@test.com', username: 'userh', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Private', shareCode: 'priv1', isPublic: false });
    await Deck.create({ userId: user._id, name: 'Public', shareCode: 'pub2', isPublic: true });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Public');
    expect(res.body.total).toBe(1);
  });

  test('filters by format', async () => {
    const user = await User.create({ email: 'i@test.com', username: 'useri', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Commander Deck', shareCode: 'cmd1', isPublic: true, format: 'commander' });
    await Deck.create({ userId: user._id, name: 'Modern Deck', shareCode: 'mod1', isPublic: true, format: 'modern' });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community?format=commander');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Commander Deck');
  });

  test('filters by commander name (case-insensitive)', async () => {
    const user = await User.create({ email: 'j@test.com', username: 'userj', passwordHash: 'h' });
    await Deck.create({ userId: user._id, name: 'Atraxa Deck', shareCode: 'at1', isPublic: true, commander: { name: 'Atraxa, Praetors\' Voice' } });
    await Deck.create({ userId: user._id, name: 'Other Deck', shareCode: 'ot1', isPublic: true, commander: { name: 'Urza, Lord High Artificer' } });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community?commander=atraxa');
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(1);
    expect(res.body.decks[0].name).toBe('Atraxa Deck');
  });

  test('does not include mainDeck in community listing', async () => {
    const user = await User.create({ email: 'k@test.com', username: 'userk', passwordHash: 'h' });
    await Deck.create({
      userId: user._id, name: 'Listed', shareCode: 'lst1', isPublic: true,
      mainDeck: [{ scryfallId: 'x', name: 'Forest', quantity: 40 }]
    });
    const app = buildApp();

    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
    expect(res.body.decks[0].mainDeck).toBeUndefined();
    expect(res.body.decks[0].cardCount).toBe(1);
  });

  test('works without auth header', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/decks/community');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -15
```

Expected: the GET shared and GET community tests fail (routes don't exist yet).

- [ ] **Step 3: Add GET /api/decks/shared/:shareCode and GET /api/decks/community to decks.js**

In `backend/routes/decks.js`, find the `router.get('/:id', requireAuth, ...)` route. Add these two new routes **immediately before it**:

```js
// Public: get a deck by share code (no auth required)
router.get('/shared/:shareCode', async (req, res) => {
  try {
    const deck = await Deck.findOne({ shareCode: req.params.shareCode })
      .populate('userId', 'username displayName')
      .lean();
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    const owner = deck.userId || {};
    const { userId, ...deckData } = deck;
    res.json({ deck: deckData, owner: { username: owner.username, displayName: owner.displayName } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Public: browse community decks (no auth required)
router.get('/community', async (req, res) => {
  try {
    const { format, colors, commander, tags, sort = 'newest', page = 1 } = req.query;
    const filter = { isPublic: true };
    if (format) filter.format = format;
    if (colors) {
      const colorList = colors.split(',').map(c => c.trim()).filter(Boolean);
      if (colorList.length) filter['commander.colorIdentity'] = { $all: colorList };
    }
    if (commander) filter['commander.name'] = { $regex: commander, $options: 'i' };
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }

    const sortMap = {
      newest:   { updatedAt: -1 },
      imported: { importCount: -1 },
      name:     { name: 1 }
    };
    const sortQuery = sortMap[sort] || sortMap.newest;
    const PAGE_SIZE = 20;
    const skip = (Math.max(1, parseInt(page)) - 1) * PAGE_SIZE;

    const [decks, total] = await Promise.all([
      Deck.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('userId', 'username displayName')
        .lean(),
      Deck.countDocuments(filter)
    ]);

    const result = decks.map(d => {
      const { mainDeck, userId, ...rest } = d;
      return { ...rest, cardCount: (mainDeck || []).length, owner: { username: userId?.username, displayName: userId?.displayName } };
    });

    res.json({ decks: result, total, page: parseInt(page), pages: Math.ceil(total / PAGE_SIZE) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -10
```

- [ ] **Step 5: Run full suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --forceExit 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deck-sharing.test.js
git commit -m "feat: add GET /decks/shared/:shareCode and GET /decks/community public routes"
```

---

## Task 4: Import route

**Files:**
- Modify: `backend/routes/decks.js`
- Modify: `backend/__tests__/deck-sharing.test.js` (add import tests)

- [ ] **Step 1: Add import tests to deck-sharing.test.js**

Add at the bottom of `backend/__tests__/deck-sharing.test.js`:

```js
describe('POST /api/decks/community/:shareCode/import', () => {
  test('clones deck into requesting user collection', async () => {
    const owner = await User.create({ email: 'l@test.com', username: 'userl', passwordHash: 'h' });
    const importer = await User.create({ email: 'm@test.com', username: 'userm', passwordHash: 'h' });
    await Deck.create({
      userId: owner._id,
      name: 'Great Deck',
      shareCode: 'import1',
      isPublic: true,
      mainDeck: [{ scryfallId: 'abc', name: 'Lightning Bolt', quantity: 4 }]
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/decks/community/import1/import')
      .set('Authorization', `Bearer ${makeToken(importer._id)}`);

    expect(res.status).toBe(201);
    expect(res.body.deckId).toBeTruthy();

    const newDeck = await Deck.findById(res.body.deckId);
    expect(newDeck.name).toBe('Great Deck');
    expect(newDeck.userId.toString()).toBe(importer._id.toString());
    expect(newDeck.shareCode).toBeNull();
    expect(newDeck.isPublic).toBe(false);
    expect(newDeck.importCount).toBe(0);
    expect(newDeck.mainDeck).toHaveLength(1);
  });

  test('increments importCount on the original deck', async () => {
    const owner = await User.create({ email: 'n@test.com', username: 'usern', passwordHash: 'h' });
    const importer = await User.create({ email: 'o@test.com', username: 'usero', passwordHash: 'h' });
    const original = await Deck.create({ userId: owner._id, name: 'Popular', shareCode: 'import2', isPublic: true, importCount: 5 });
    const app = buildApp();

    await request(app)
      .post('/api/decks/community/import2/import')
      .set('Authorization', `Bearer ${makeToken(importer._id)}`);

    const updated = await Deck.findById(original._id);
    expect(updated.importCount).toBe(6);
  });

  test('returns 401 without auth', async () => {
    const owner = await User.create({ email: 'p@test.com', username: 'userp', passwordHash: 'h' });
    await Deck.create({ userId: owner._id, name: 'Deck', shareCode: 'import3', isPublic: true });
    const app = buildApp();

    const res = await request(app).post('/api/decks/community/import3/import');
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown shareCode', async () => {
    const importer = await User.create({ email: 'q@test.com', username: 'userq', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/decks/community/nocode/import')
      .set('Authorization', `Bearer ${makeToken(importer._id)}`);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -15
```

Expected: import tests fail (route doesn't exist yet).

- [ ] **Step 3: Add POST /api/decks/community/:shareCode/import to decks.js**

In `backend/routes/decks.js`, add this route immediately before `router.post('/:id/share', ...)`:

```js
// Authenticated: import (clone) a community deck into your collection
router.post('/community/:shareCode/import', requireAuth, async (req, res) => {
  try {
    const original = await Deck.findOne({ shareCode: req.params.shareCode }).lean();
    if (!original) return res.status(404).json({ message: 'Deck not found' });

    const userId = getUserId(req);
    const { _id, shareCode, isPublic, importCount, userId: _ownerId, createdAt, updatedAt, __v, ...deckData } = original;

    const newDeck = new Deck({
      ...deckData,
      userId,
      shareCode: null,
      isPublic: false,
      importCount: 0
    });
    await newDeck.save();

    await Deck.findByIdAndUpdate(original._id, { $inc: { importCount: 1 } });

    res.status(201).json({ deckId: newDeck._id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 4: Run all deck-sharing tests — expect all pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest deck-sharing --forceExit 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --forceExit 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deck-sharing.test.js
git commit -m "feat: add POST /decks/community/:shareCode/import route"
```

---

## Task 5: SharedDeckView frontend component

**Files:**
- Create: `frontend/src/components/CommunityDecks/SharedDeckView.js`
- Modify: `frontend/src/App.js`

**What it does:** Renders when visiting `/shared/deck/:shareCode` directly in the browser. Fetches the deck, displays it in full (grouped by card type), shows owner credit, and offers an "Import" button for logged-in users. No auth required to view.

- [ ] **Step 1: Create the CommunityDecks directory and SharedDeckView.js**

Create `frontend/src/components/CommunityDecks/SharedDeckView.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { useAuthContext } from '../../contexts/AuthContext';

const COLOR_PIPS = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲' };
const FORMAT_COLORS = {
  commander: 'bg-purple-600/30 text-purple-300 border-purple-500/40',
  standard:  'bg-blue-600/30 text-blue-300 border-blue-500/40',
  modern:    'bg-green-600/30 text-green-300 border-green-500/40',
  pioneer:   'bg-teal-600/30 text-teal-300 border-teal-500/40',
  legacy:    'bg-amber-600/30 text-amber-300 border-amber-500/40',
  vintage:   'bg-red-600/30 text-red-300 border-red-500/40',
  pauper:    'bg-gray-600/30 text-gray-300 border-gray-500/40',
  draft:     'bg-orange-600/30 text-orange-300 border-orange-500/40',
  other:     'bg-slate-600/30 text-slate-300 border-slate-500/40',
};
const TYPE_ORDER = ['Commander', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'];

function groupByType(mainDeck) {
  const groups = {};
  TYPE_ORDER.forEach(t => { groups[t] = []; });
  (mainDeck || []).forEach(card => {
    const type = TYPE_ORDER.find(t => (card.types || []).includes(t)) || 'Other';
    groups[type].push(card);
  });
  return groups;
}

function SharedDeckView({ shareCode }) {
  const { authUser } = useAuthContext();
  const [deck, setDeck] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/decks/shared/${shareCode}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.message)))
      .then(data => { setDeck(data.deck); setOwner(data.owner); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, [shareCode]);

  const handleImport = async () => {
    if (!authUser) { setImportMsg('Log in to import decks.'); return; }
    setImporting(true);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const res = await fetch(`${API_URL}/decks/community/${shareCode}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`✅ Deck imported! Open your Deck Builder to view it.`);
      } else {
        setImportMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setImportMsg(`❌ Error: ${e.message}`);
    }
    setImporting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center text-white text-xl">
      Loading deck...
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center text-red-400 text-xl">
      {error === 'Deck not found' ? '🔍 Deck not found or no longer shared.' : `Error: ${error}`}
    </div>
  );

  const groups = groupByType(deck.mainDeck);
  const colorIdentity = deck.commander?.colorIdentity || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="relative overflow-hidden">
        {deck.commander?.imageUrl && (
          <div className="absolute inset-0 opacity-20">
            <img src={deck.commander.imageUrl} alt="" className="w-full h-full object-cover object-top blur-sm scale-110" />
          </div>
        )}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-start gap-6">
            {deck.commander?.imageUrl && (
              <img src={deck.commander.imageUrl} alt={deck.commander.name}
                className="w-28 rounded-xl shadow-2xl border border-white/20 hidden sm:block flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-white mb-1">{deck.name}</h1>
              {deck.commander?.name && (
                <p className="text-purple-300 text-sm mb-2">Commander: {deck.commander.name}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {deck.format && (
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${FORMAT_COLORS[deck.format] || FORMAT_COLORS.other}`}>
                    {deck.format}
                  </span>
                )}
                {colorIdentity.map(c => (
                  <span key={c} className="text-base" title={c}>{COLOR_PIPS[c] || c}</span>
                ))}
              </div>
              {owner && (
                <p className="text-gray-400 text-sm">
                  by <span className="text-purple-300 font-medium">@{owner.username}</span>
                  {owner.displayName ? ` (${owner.displayName})` : ''}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-400">
                <span>{(deck.mainDeck || []).length} cards</span>
                {deck.totalValue > 0 && <span>${deck.totalValue.toFixed(2)} estimated value</span>}
                {deck.importCount > 0 && <span>Imported {deck.importCount}×</span>}
              </div>
              {deck.description && <p className="text-gray-300 text-sm mt-3 max-w-xl">{deck.description}</p>}
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg"
              >
                {importing ? 'Importing...' : '+ Import to My Decks'}
              </button>
              {importMsg && <p className="text-xs mt-2 text-center max-w-[160px]">{importMsg}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Decklist */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TYPE_ORDER.filter(t => groups[t].length > 0).map(type => (
            <div key={type} className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h3 className="text-white font-semibold text-sm mb-2 border-b border-white/10 pb-1">
                {type} <span className="text-gray-400 font-normal">({groups[type].reduce((s, c) => s + (c.quantity || 1), 0)})</span>
              </h3>
              <ul className="space-y-0.5">
                {groups[type].map((card, i) => (
                  <li key={i} className="text-sm text-gray-300 flex justify-between">
                    <span className="truncate">{card.name}</span>
                    {card.quantity > 1 && <span className="text-gray-500 ml-2 flex-shrink-0">×{card.quantity}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SharedDeckView;
```

- [ ] **Step 2: Wire SharedDeckView into App.js**

In `frontend/src/App.js`, add the import near the top with other component imports:

```js
import SharedDeckView from './components/CommunityDecks/SharedDeckView';
```

Then find the **innermost app component** that renders the main UI (the component that uses `useAuthContext()` — search for `const { authUser` near the top of the file to find it). At the very beginning of that component's return statement, before anything else, add:

```jsx
// Public URL: /shared/deck/:shareCode
const sharedDeckMatch = window.location.pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
if (sharedDeckMatch) {
  return <SharedDeckView shareCode={sharedDeckMatch[1]} />;
}
```

This check should be placed as the very first thing in the render (before loading spinners, before main layout) so that shared deck URLs get the dedicated full-page view.

- [ ] **Step 3: Manual test**

Start the backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm start`). Navigate to `/shared/deck/ANYCODE` in the browser. Expected: custom full-page 404-style message ("Deck not found or no longer shared.") — proving the route is wired.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommunityDecks/SharedDeckView.js frontend/src/App.js
git commit -m "feat: add SharedDeckView component and /shared/deck/:code URL routing"
```

---

## Task 6: CommunityDecks browser component

**Files:**
- Create: `frontend/src/components/CommunityDecks/CommunityDecks.js`

- [ ] **Step 1: Create CommunityDecks.js**

Create `frontend/src/components/CommunityDecks/CommunityDecks.js`:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Globe, TrendingUp, ArrowUpDown } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuthContext } from '../../contexts/AuthContext';
import SharedDeckView from './SharedDeckView';

const FORMATS = ['commander', 'standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'draft', 'oathbreaker', 'other'];
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const COLOR_LABELS = { W: '☀️ White', U: '💧 Blue', B: '💀 Black', R: '🔥 Red', G: '🌲 Green' };
const COLOR_PIPS = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲' };
const FORMAT_COLORS = {
  commander: 'bg-purple-600/30 text-purple-300 border-purple-500/40',
  standard:  'bg-blue-600/30 text-blue-300 border-blue-500/40',
  modern:    'bg-green-600/30 text-green-300 border-green-500/40',
  pioneer:   'bg-teal-600/30 text-teal-300 border-teal-500/40',
  legacy:    'bg-amber-600/30 text-amber-300 border-amber-500/40',
  vintage:   'bg-red-600/30 text-red-300 border-red-500/40',
  pauper:    'bg-gray-600/30 text-gray-300 border-gray-500/40',
  draft:     'bg-orange-600/30 text-orange-300 border-orange-500/40',
  other:     'bg-slate-600/30 text-slate-300 border-slate-500/40',
};

function DeckCard({ deck, onView }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/40 transition group">
      {deck.commander?.imageUrl ? (
        <div className="h-24 overflow-hidden relative">
          <img src={deck.commander.imageUrl} alt="" className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-300" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center text-4xl">
          🃏
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">{deck.name}</h3>
          {deck.format && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 capitalize ${FORMAT_COLORS[deck.format] || FORMAT_COLORS.other}`}>
              {deck.format}
            </span>
          )}
        </div>
        {deck.commander?.name && (
          <p className="text-purple-300 text-xs mb-1 truncate">{deck.commander.name}</p>
        )}
        <p className="text-gray-400 text-xs mb-2">
          by <span className="text-gray-300">@{deck.owner?.username}</span>
        </p>
        <div className="flex items-center gap-2 mb-3">
          {(deck.commander?.colorIdentity || []).map(c => (
            <span key={c} className="text-sm" title={c}>{COLOR_PIPS[c] || c}</span>
          ))}
          {(deck.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-300 rounded">{tag}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>{deck.cardCount || 0} cards</span>
          {deck.totalValue > 0 && <span>${deck.totalValue.toFixed(2)}</span>}
          {deck.importCount > 0 && <span>↓ {deck.importCount}</span>}
        </div>
        <button
          onClick={() => onView(deck.shareCode)}
          className="w-full py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 hover:text-white rounded-lg text-xs font-medium transition"
        >
          View Deck →
        </button>
      </div>
    </div>
  );
}

function CommunityDecks() {
  const [decks, setDecks] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [viewingShareCode, setViewingShareCode] = useState(null);

  // Filters
  const [format, setFormat] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [commander, setCommander] = useState('');
  const [commanderInput, setCommanderInput] = useState('');
  const [tags, setTags] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [sort, setSort] = useState('newest');

  const fetchDecks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (selectedColors.length) params.set('colors', selectedColors.join(','));
    if (commander) params.set('commander', commander);
    if (tags) params.set('tags', tags);
    params.set('sort', sort);
    params.set('page', page);

    fetch(`${API_URL}/decks/community?${params}`)
      .then(r => r.json())
      .then(d => { setDecks(d.decks || []); setTotal(d.total || 0); setPages(d.pages || 1); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [format, selectedColors, commander, tags, sort, page]);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  // Debounce commander/tags input
  useEffect(() => {
    const t = setTimeout(() => { setCommander(commanderInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [commanderInput]);

  useEffect(() => {
    const t = setTimeout(() => { setTags(tagsInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [tagsInput]);

  const toggleColor = (c) => {
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setPage(1);
  };

  if (viewingShareCode) {
    return (
      <div>
        <div className="p-4">
          <button onClick={() => setViewingShareCode(null)} className="text-purple-300 hover:text-white text-sm transition">
            ← Back to Community
          </button>
        </div>
        <SharedDeckView shareCode={viewingShareCode} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={22} className="text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Community Decks</h1>
        {total > 0 && <span className="text-gray-400 text-sm">{total} decks</span>}
      </div>

      {/* Filter bar */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Format */}
          <select
            value={format}
            onChange={e => { setFormat(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All Formats</option>
            {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>

          {/* Color toggles */}
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => toggleColor(c)}
                title={COLOR_LABELS[c]}
                className={`w-8 h-8 rounded-lg text-base border transition ${
                  selectedColors.includes(c)
                    ? 'bg-purple-600/50 border-purple-400 shadow-sm'
                    : 'bg-white/5 border-white/10 hover:border-purple-500/40'
                }`}
              >
                {COLOR_PIPS[c]}
              </button>
            ))}
          </div>

          {/* Commander search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Commander name..."
              value={commanderInput}
              onChange={e => setCommanderInput(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg pl-8 pr-3 py-1.5 text-sm w-44"
            />
          </div>

          {/* Tags */}
          <input
            type="text"
            placeholder="Tags (comma-separated)..."
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm w-48"
          />

          {/* Sort */}
          <select
            value={sort}
            onChange={e => { setSort(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm ml-auto"
          >
            <option value="newest">Newest</option>
            <option value="imported">Most Imported</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading decks...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-16">{error}</div>
      ) : decks.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="text-xl mb-2">No decks found</p>
          <p className="text-sm">Try adjusting your filters, or share your own deck!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {decks.map(deck => (
              <DeckCard key={deck._id} deck={deck} onView={setViewingShareCode} />
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-lg text-sm transition"
              >
                ← Previous
              </button>
              <span className="text-gray-400 text-sm">Page {page} of {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-lg text-sm transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CommunityDecks;
```

- [ ] **Step 2: Wire CommunityDecks into App.js**

In `frontend/src/App.js`:

1. Add import near other component imports:
```js
import CommunityDecks from './components/CommunityDecks/CommunityDecks';
```

2. Find where `currentView === 'forum'` is rendered (around line 5543). Add a new case immediately after the forum block:
```jsx
{currentView === 'community-decks' && (
  <CommunityDecks />
)}
```

- [ ] **Step 3: Manual test**

Navigate the app and manually set `currentView` to `'community-decks'` via the browser console: `localStorage.setItem('currentView', 'community-decks')` then refresh. The community browser should appear (likely showing "No decks found" since no decks are shared yet).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CommunityDecks/CommunityDecks.js frontend/src/App.js
git commit -m "feat: add CommunityDecks browser component with filters, pagination, and deck cards"
```

---

## Task 7: Sidebar entry + DeckDetail share controls

**Files:**
- Modify: `frontend/src/components/Sidebar.js`
- Modify: `frontend/src/components/DeckDetail.js`

- [ ] **Step 1: Add Globe import and Community Decks nav entry to Sidebar.js**

In `frontend/src/components/Sidebar.js`:

1. Add `Globe` to the lucide-react import line:
```js
import {
  // ... existing imports ...
  Globe,
} from 'lucide-react';
```

2. Find the `allNavItems` array (around line 68). Add the Community Decks entry after the `forum` entry:
```js
{ id: 'community-decks', label: 'Community Decks', icon: Globe },
```

The full array should look like:
```js
const allNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'collection', label: 'Collection', icon: BookOpen },
  { id: 'decks', label: 'Deck Builder', icon: Layers, feature: 'deckBuilder' },
  { id: 'wishlist', label: 'Wishlist', icon: Heart, feature: 'wishlist' },
  { id: 'forum', label: 'Forum', icon: MessageSquare },
  { id: 'community-decks', label: 'Community Decks', icon: Globe },
  { id: 'lifecounter', label: 'Life Counter', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];
```

- [ ] **Step 2: Add share state to DeckDetail.js**

In `frontend/src/components/DeckDetail.js`, find the existing `useState` declarations (first ~30 lines of the component). Add:

```js
const [shareCode, setShareCode] = useState(deck.shareCode || null);
const [isPublic, setIsPublic] = useState(deck.isPublic || false);
const [shareLoading, setShareLoading] = useState(false);
const [shareCopied, setShareCopied] = useState(false);
```

Also add these two handler functions inside the component (after the state declarations, before the return):

```js
const handleShare = async () => {
  setShareLoading(true);
  try {
    const token = localStorage.getItem('mtg_access_token');
    const res = await fetch(`${API_URL}/decks/${deck._id}/share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (res.ok) setShareCode(data.shareCode);
  } catch (e) { /* ignore */ }
  setShareLoading(false);
};

const handleCopyLink = () => {
  const url = `${window.location.origin}/shared/deck/${shareCode}`;
  navigator.clipboard.writeText(url).then(() => {
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  });
};

const handleTogglePublic = async () => {
  try {
    const token = localStorage.getItem('mtg_access_token');
    const res = await fetch(`${API_URL}/decks/${deck._id}/visibility`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !isPublic })
    });
    const data = await res.json();
    if (res.ok) setIsPublic(data.isPublic);
  } catch (e) { /* ignore */ }
};
```

- [ ] **Step 3: Add share controls to DeckDetail header**

In `frontend/src/components/DeckDetail.js`, find the `<div className="flex items-center gap-2">` that contains the "Edit Deck", "Export", and "← Back" buttons (around line 368). Add the share controls **before** the "Export" button:

```jsx
{/* Share controls */}
{!shareCode ? (
  <button
    onClick={handleShare}
    disabled={shareLoading}
    className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white rounded-lg text-sm transition"
  >
    {shareLoading ? '...' : '🔗 Share'}
  </button>
) : (
  <div className="flex items-center gap-1.5">
    <button
      onClick={handleCopyLink}
      className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 rounded-lg text-sm transition"
    >
      {shareCopied ? '✅ Copied!' : '🔗 Copy Link'}
    </button>
    <button
      onClick={handleTogglePublic}
      className={`px-3 py-1 rounded-lg text-sm border transition ${
        isPublic
          ? 'bg-purple-600/40 border-purple-400/60 text-purple-200'
          : 'bg-white/10 border-white/20 text-gray-300 hover:border-purple-400/40'
      }`}
      title={isPublic ? 'Listed in Community — click to unlist' : 'Click to list in Community Decks'}
    >
      {isPublic ? '🌐 Public' : '🌐 List Publicly'}
    </button>
  </div>
)}
```

- [ ] **Step 4: Manual smoke test**

Start the app. Open a deck in DeckDetail. Expected:
- "🔗 Share" button appears in the header
- Click it → button changes to "🔗 Copy Link" + "🌐 List Publicly"
- Click "Copy Link" → clipboard gets the share URL, button shows "✅ Copied!" briefly
- Click "🌐 List Publicly" → button turns purple and shows "🌐 Public"
- Navigate to Community Decks via sidebar → the deck appears in the browser

Also navigate directly to `/shared/deck/{yourShareCode}` in the browser → full SharedDeckView appears.

- [ ] **Step 5: Run full backend test suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --forceExit 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Sidebar.js frontend/src/components/DeckDetail.js
git commit -m "feat: add Community Decks sidebar entry and share controls in DeckDetail"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Deck schema: `shareCode`, `isPublic`, `importCount` — Task 1
- ✅ Fix share route (preserve existing code) — Task 2
- ✅ `PATCH /:id/visibility` (400 without shareCode) — Task 2
- ✅ `GET /shared/:shareCode` public, no auth — Task 3
- ✅ `GET /community` with all 5 filters + 3 sort options + pagination — Task 3
- ✅ Community response excludes mainDeck, includes cardCount + owner — Task 3
- ✅ `POST /community/:shareCode/import` — clones deck, increments importCount, 401 without auth — Task 4
- ✅ `SharedDeckView.js` — full decklist, grouped by type, commander art header, import button — Task 5
- ✅ `/shared/deck/:shareCode` URL routing in App.js — Task 5
- ✅ `CommunityDecks.js` — filter bar (format, colors, commander, tags, sort), paginated grid, view deck — Task 6
- ✅ `currentView === 'community-decks'` in App.js — Task 6
- ✅ "Community Decks" sidebar nav entry — Task 7
- ✅ DeckDetail share button + copy link + public toggle — Task 7

**Placeholder scan:** None found.

**Type consistency:** `shareCode` (String), `isPublic` (Boolean), `importCount` (Number) used consistently across all tasks. Route paths consistent: `/api/decks/shared/:shareCode`, `/api/decks/community`, `/api/decks/community/:shareCode/import`.

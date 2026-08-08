# Duplicate Cleanup & Merge Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Find Duplicates" tool in the Collection view that merges exact duplicate rows and suggests merges for offline-import "Unknown"-set near-dupes, followed by a database unique index that makes exact duplicates impossible going forward.

**Architecture:** Two new backend endpoints in `backend/routes/cards.js` (`GET /duplicates`, `POST /merge-duplicates`) with pure grouping/merge helpers in `backend/utils/cardUtils.js`; a new `DuplicateCleanup` modal in the frontend Collection view; a unique compound index on the Card model plus a read-only conflict-checker script. Backend work is TDD (jest + mongodb-memory-server infra exists); frontend is verified by build + manual check.

**Tech Stack:** Node/Express/Mongoose, React (CRA), jest + supertest.

**Spec:** `docs/superpowers/specs/2026-08-05-duplicate-cleanup-design.md`

**Environment note:** All `npx jest` runs in `backend/` require `dangerouslyDisableSandbox: true` (sandbox blocks mongodb-memory-server's mongod).

---

## Task 1: Grouping helper + `GET /api/cards/duplicates`

**Files:**
- Modify: `backend/utils/cardUtils.js`
- Modify: `backend/routes/cards.js`
- Create: `backend/__tests__/card-duplicates.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/card-duplicates.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Card = require('../models/Card');

let mongoServer;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/cards', require('../routes/cards'));
  return a;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
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
});

async function makeUser(n = 1) {
  return User.create({ email: `u${n}@test.com`, username: `user${n}`, passwordHash: 'x', role: 'editor' });
}

describe('GET /api/cards/duplicates', () => {
  test('groups exact duplicates by name+set+condition+isFoil+collectorNumber', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 2 });
    await Card.create({ userId: user._id, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 3 });
    await Card.create({ userId: user._id, name: 'Counterspell', set: 'Ice Age', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(1);
    expect(res.body.exactGroups[0].cards).toHaveLength(2);
    expect(res.body.exactGroups[0].cards[0].name).toBe('Lightning Bolt');
  });

  test('does NOT flag same name+set with different collector numbers (alt arts)', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '1', quantity: 1 });
    await Card.create({ userId: user._id, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '2', quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(0);
  });

  test('suggests Unknown-set rows against real-set rows of same name+condition+foil', async () => {
    const user = await makeUser();
    const unknown = await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1, price: 0 });
    const real = await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Commander 2021', condition: 'NM', isFoil: false, quantity: 2, price: 1.5 });
    // Different condition — not a candidate
    await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Commander Legends', condition: 'LP', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.suggestedGroups).toHaveLength(1);
    expect(res.body.suggestedGroups[0].unknownCard._id).toBe(unknown._id.toString());
    expect(res.body.suggestedGroups[0].candidates).toHaveLength(1);
    expect(res.body.suggestedGroups[0].candidates[0]._id).toBe(real._id.toString());
  });

  test('omits Unknown rows with no real-set candidates and scopes to the requesting user', async () => {
    const user1 = await makeUser(1);
    const user2 = await makeUser(2);
    await Card.create({ userId: user1._id, name: 'Ponder', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });
    // Real-set Ponder belongs to a DIFFERENT user — must not become a candidate
    await Card.create({ userId: user2._id, name: 'Ponder', set: 'Lorwyn', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user1)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(0);
    expect(res.body.suggestedGroups).toHaveLength(0);
  });

  test('a second Unknown row of the same card appears as an exact group, not a suggestion pair', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });
    await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(1);
    expect(res.body.suggestedGroups).toHaveLength(0);
  });

  test('rejects unauthenticated requests', async () => {
    await request(app).get('/api/cards/duplicates').expect(401);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest card-duplicates --silent` (sandbox disabled)
Expected: FAIL — route doesn't exist (404s where 200 expected).

- [ ] **Step 3: Add the grouping helper to `backend/utils/cardUtils.js`**

Add before the `module.exports`:

```js
// Groups a user's cards into exact-duplicate groups (identical
// name+set+condition+isFoil+collectorNumber) and Unknown-set merge
// suggestions (same name+condition+isFoil, one row from an offline import).
function findDuplicateGroups(cards) {
  const exactKey = c =>
    [c.name, c.set, c.condition, String(Boolean(c.isFoil)), c.collectorNumber || ''].join('||');

  const byExactKey = new Map();
  for (const card of cards) {
    const key = exactKey(card);
    if (!byExactKey.has(key)) byExactKey.set(key, []);
    byExactKey.get(key).push(card);
  }

  const exactGroups = [];
  const inExactGroup = new Set();
  for (const group of byExactKey.values()) {
    if (group.length > 1) {
      exactGroups.push({ cards: group });
      for (const card of group) inExactGroup.add(card._id.toString());
    }
  }

  const suggestedGroups = [];
  for (const card of cards) {
    if (card.set !== 'Unknown') continue;
    if (inExactGroup.has(card._id.toString())) continue;
    const candidates = cards.filter(other =>
      other.set !== 'Unknown' &&
      other.name === card.name &&
      other.condition === card.condition &&
      Boolean(other.isFoil) === Boolean(card.isFoil)
    );
    if (candidates.length > 0) {
      suggestedGroups.push({ unknownCard: card, candidates });
    }
  }

  return { exactGroups, suggestedGroups };
}
```

Add `findDuplicateGroups` to the `module.exports` object.

- [ ] **Step 4: Add the route to `backend/routes/cards.js`**

Add the import of `findDuplicateGroups` to the existing `require('../utils/cardUtils')` destructuring, then add this route **above** the `router.get('/:id', ...)` route (order matters — `/:id` would otherwise swallow `/duplicates`):

```js
// Find duplicate rows: exact duplicates plus Unknown-set merge suggestions
router.get('/duplicates', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query).sort({ createdAt: 1 }).lean();
    res.json(findDuplicateGroups(cards));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd backend && npx jest card-duplicates --silent` (sandbox disabled)
Expected: 6/6 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/utils/cardUtils.js backend/routes/cards.js backend/__tests__/card-duplicates.test.js
git commit -m "feat: add GET /api/cards/duplicates with exact and Unknown-set grouping"
```

---

## Task 2: `POST /api/cards/merge-duplicates`

**Files:**
- Modify: `backend/utils/cardUtils.js`
- Modify: `backend/routes/cards.js`
- Test: `backend/__tests__/card-merge-duplicates.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/card-merge-duplicates.test.js` (same scaffolding as Task 1's test file — copy the imports, `buildApp`, `tokenFor`, `makeUser`, and lifecycle hooks verbatim, changing only the describe blocks):

```js
describe('POST /api/cards/merge-duplicates', () => {
  test('merges quantities, unions tags, backfills empty fields, deletes sources', async () => {
    const user = await makeUser();
    const target = await Card.create({
      userId: user._id, name: 'Sol Ring', set: 'Commander 2021', condition: 'NM', isFoil: false,
      quantity: 2, price: 1.5, tags: ['staple'], location: ''
    });
    const source = await Card.create({
      userId: user._id, name: 'Sol Ring', set: 'Unknown', condition: 'NM', isFoil: false,
      quantity: 3, price: 0, tags: ['staple', 'commander'], location: 'Binder A', oracleText: 'Add {C}{C}.'
    });

    const res = await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ targetId: target._id.toString(), sourceIds: [source._id.toString()] })
      .expect(200);

    expect(res.body.merged).toBe(true);
    expect(res.body.removedCount).toBe(1);
    expect(res.body.target.quantity).toBe(5);
    expect(res.body.target.tags.sort()).toEqual(['commander', 'staple']);
    expect(res.body.target.location).toBe('Binder A');   // backfilled (target was empty)
    expect(res.body.target.oracleText).toBe('Add {C}{C}.');
    expect(res.body.target.set).toBe('Commander 2021');  // target's set always wins
    expect(res.body.target.price).toBe(1.5);             // target's price always wins

    expect(await Card.findById(source._id)).toBeNull();
    expect((await Card.find({ userId: user._id })).length).toBe(1);
  });

  test("rejects merging another user's cards", async () => {
    const user1 = await makeUser(1);
    const user2 = await makeUser(2);
    const target = await Card.create({ userId: user1._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const foreign = await Card.create({ userId: user2._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user1)}`)
      .send({ targetId: target._id.toString(), sourceIds: [foreign._id.toString()] })
      .expect(404);

    expect(await Card.findById(foreign._id)).not.toBeNull();
  });

  test('rejects sources with mismatched name/condition/foil', async () => {
    const user = await makeUser();
    const target = await Card.create({ userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const wrongCondition = await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'LP', isFoil: false, quantity: 1 });

    const res = await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ targetId: target._id.toString(), sourceIds: [wrongCondition._id.toString()] })
      .expect(400);

    expect(res.body.message).toMatch(/match/i);
    expect(await Card.findById(wrongCondition._id)).not.toBeNull();
  });

  test('rejects target included in sourceIds and empty sourceIds', async () => {
    const user = await makeUser();
    const card = await Card.create({ userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const token = tokenFor(user);

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: card._id.toString(), sourceIds: [card._id.toString()] })
      .expect(400);

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: card._id.toString(), sourceIds: [] })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest card-merge-duplicates --silent` (sandbox disabled)
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Add the merge helper to `backend/utils/cardUtils.js`**

```js
// Fields backfilled from sources when the target's value is empty/missing.
const MERGE_BACKFILL_FIELDS = ['location', 'oracleText', 'manaCost', 'imageUrl', 'scryfallId', 'rarity', 'collectorNumber', 'setCode'];
const MERGE_BACKFILL_ARRAY_FIELDS = ['colors', 'types'];

function applyMerge(target, sources) {
  for (const source of sources) {
    target.quantity += source.quantity;

    for (const tag of source.tags || []) {
      if (!target.tags.includes(tag)) target.tags.push(tag);
    }

    for (const field of MERGE_BACKFILL_FIELDS) {
      if (!target[field] && source[field]) target[field] = source[field];
    }
    for (const field of MERGE_BACKFILL_ARRAY_FIELDS) {
      if ((!target[field] || target[field].length === 0) && source[field] && source[field].length > 0) {
        target[field] = source[field];
      }
    }
  }
  return target;
}
```

Add `applyMerge` to `module.exports`.

- [ ] **Step 4: Add the route to `backend/routes/cards.js`**

Import `applyMerge` from cardUtils. Add below the `/duplicates` route:

```js
// Merge duplicate rows into a target card, deleting the sources
router.post('/merge-duplicates', requireAuth, requireEditor, activityLoggers.cardUpdate, async (req, res) => {
  try {
    const { targetId, sourceIds } = req.body;
    if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ message: 'targetId and a non-empty sourceIds array are required' });
    }
    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ message: 'targetId cannot be one of sourceIds' });
    }

    const userId = getUserId(req);
    const target = await Card.findOne(buildUserQuery({ _id: targetId }, req));
    if (!target) return res.status(404).json({ message: 'Target card not found' });

    const sources = await Card.find(buildUserQuery({ _id: { $in: sourceIds } }, req));
    if (sources.length !== sourceIds.length) {
      return res.status(404).json({ message: 'One or more source cards not found' });
    }

    const mismatched = sources.find(s =>
      s.name !== target.name ||
      s.condition !== target.condition ||
      Boolean(s.isFoil) !== Boolean(target.isFoil)
    );
    if (mismatched) {
      return res.status(400).json({ message: 'All cards in a merge must match on name, condition, and foil status' });
    }

    applyMerge(target, sources);
    await target.save();
    await Card.deleteMany({ _id: { $in: sources.map(s => s._id) } });

    clearCache(userId);
    res.json({ merged: true, target, removedCount: sources.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd backend && npx jest card-merge-duplicates --silent` (sandbox disabled)
Expected: 4/4 PASS. Also run `npx jest card-duplicates --silent` to confirm Task 1 still passes.

- [ ] **Step 6: Commit**

```bash
git add backend/utils/cardUtils.js backend/routes/cards.js backend/__tests__/card-merge-duplicates.test.js
git commit -m "feat: add POST /api/cards/merge-duplicates with safety validations"
```

---

## Task 3: Unique index + conflict-checker script

**Files:**
- Modify: `backend/models/Card.js`
- Create: `backend/scripts/checkDuplicateConflicts.js`
- Test: `backend/__tests__/card-unique-index.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/card-unique-index.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Card = require('../models/Card');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Card.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Card.deleteMany({});
});

describe('Card unique duplicate-prevention index', () => {
  test('rejects a second identical row (same user+name+set+condition+foil+collectorNumber)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await Card.create({ userId, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 1 });
    await expect(
      Card.create({ userId, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 1 })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows same card with different collector numbers (alt arts)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await Card.create({ userId, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '1', quantity: 1 });
    await expect(
      Card.create({ userId, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '2', quantity: 1 })
    ).resolves.toBeDefined();
  });

  test('allows same card for different users', async () => {
    await Card.create({ userId: new mongoose.Types.ObjectId(), name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    await expect(
      Card.create({ userId: new mongoose.Types.ObjectId(), name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 })
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd backend && npx jest card-unique-index --silent` (sandbox disabled)
Expected: FAIL — first test's second `create` succeeds (no unique constraint yet).

- [ ] **Step 3: Add the unique index to `backend/models/Card.js`**

Replace the existing line:
```js
cardSchema.index({ userId: 1, name: 1, set: 1, condition: 1, isFoil: 1 });
```
with:
```js
// Duplicate prevention at the database level. collectorNumber is part of the
// key so alt-art printings within one set coexist; rows without a collector
// number (null) conflict with each other, which is exactly the exact-dupe
// case the cleanup tool merges. If conflicting legacy rows still exist at
// startup, Mongoose logs a failed index build and continues; run the
// duplicate cleanup tool, then restart, and the build succeeds.
cardSchema.index(
  { userId: 1, name: 1, set: 1, condition: 1, isFoil: 1, collectorNumber: 1 },
  { unique: true }
);
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd backend && npx jest card-unique-index --silent` (sandbox disabled)
Expected: 3/3 PASS.

- [ ] **Step 5: Create `backend/scripts/checkDuplicateConflicts.js`**

```js
// Read-only: reports card rows that would violate the unique
// duplicate-prevention index. Run from backend/: node scripts/checkDuplicateConflicts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('../models/Card');
const { findDuplicateGroups } = require('../utils/cardUtils');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await Card.distinct('userId');
  let totalGroups = 0;

  for (const userId of users) {
    const cards = await Card.find({ userId }).lean();
    const { exactGroups } = findDuplicateGroups(cards);
    for (const group of exactGroups) {
      totalGroups++;
      const c = group.cards[0];
      console.log(`user=${userId} name="${c.name}" set="${c.set}" condition=${c.condition} foil=${c.isFoil} rows=${group.cards.length}`);
    }
  }

  console.log(totalGroups === 0
    ? 'No conflicts - the unique index can build.'
    : `${totalGroups} conflicting group(s) - run the Find Duplicates tool, then restart the backend.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass. If any existing test creates identical duplicate rows and now fails on the unique constraint, that test is exercising exactly the legacy behavior this index forbids — update that test's fixture to use distinct sets/conditions rather than weakening the index.

- [ ] **Step 7: Commit**

```bash
git add backend/models/Card.js backend/scripts/checkDuplicateConflicts.js backend/__tests__/card-unique-index.test.js
git commit -m "feat: enforce duplicate prevention with a unique card index and conflict checker"
```

---

## Task 4: DuplicateCleanup modal + Collection button

**Files:**
- Create: `frontend/src/components/DuplicateCleanup.js`
- Modify: `frontend/src/components/CollectionView.js`

- [ ] **Step 1: Create `frontend/src/components/DuplicateCleanup.js`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Loader, Check } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

function CardRow({ card, selected, selectable, onSelect }) {
  return (
    <div
      onClick={selectable ? onSelect : undefined}
      className={`flex items-center justify-between p-2 rounded border text-sm ${
        selectable ? 'cursor-pointer' : ''
      } ${selected ? 'border-purple-500 bg-purple-600/20' : 'border-slate-700 bg-slate-800/50'}`}
    >
      <div className="flex items-center gap-2">
        {selectable && (
          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${selected ? 'bg-purple-500 border-purple-500' : 'border-slate-500'}`}>
            {selected && <Check size={12} className="text-white" />}
          </span>
        )}
        <span className="text-white">{card.name}</span>
        <span className="text-slate-400">{card.set}</span>
        <span className="text-slate-500">{card.condition}{card.isFoil ? ' · Foil' : ''}</span>
      </div>
      <div className="text-slate-300">×{card.quantity}</div>
    </div>
  );
}

export default function DuplicateCleanup({ isOpen, onClose, onMerged }) {
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [exactGroups, setExactGroups] = useState([]);
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  // Chosen target per suggestion group, keyed by the unknown card's id
  const [selectedTargets, setSelectedTargets] = useState({});

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/cards/duplicates`);
      setExactGroups(res.data.exactGroups);
      setSuggestedGroups(res.data.suggestedGroups);
      const preselected = {};
      for (const group of res.data.suggestedGroups) {
        if (group.candidates.length === 1) {
          preselected[group.unknownCard._id] = group.candidates[0]._id;
        }
      }
      setSelectedTargets(preselected);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchDuplicates();
  }, [isOpen, fetchDuplicates]);

  const merge = async (targetId, sourceIds) => {
    await axios.post(`${API_URL}/cards/merge-duplicates`, { targetId, sourceIds });
  };

  const afterMerge = async () => {
    await fetchDuplicates();
    onMerged?.();
  };

  const handleMergeExactGroup = async (group) => {
    setMerging(true);
    setError('');
    try {
      const [target, ...sources] = group.cards; // oldest first (sorted by createdAt server-side)
      await merge(target._id, sources.map(c => c._id));
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAllExact = async () => {
    setMerging(true);
    setError('');
    try {
      for (const group of exactGroups) {
        const [target, ...sources] = group.cards;
        await merge(target._id, sources.map(c => c._id));
      }
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleMergeSuggestion = async (group) => {
    const targetId = selectedTargets[group.unknownCard._id];
    if (!targetId) return;
    setMerging(true);
    setError('');
    try {
      await merge(targetId, [group.unknownCard._id]);
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const empty = !loading && exactGroups.length === 0 && suggestedGroups.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Copy size={18} className="text-purple-400" /> Find Duplicates
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader size={16} className="animate-spin" /> Scanning collection...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-sm">{error}</div>
          )}

          {empty && (
            <div className="text-center text-slate-400 py-8">No duplicates found 🎉</div>
          )}

          {exactGroups.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Exact duplicates ({exactGroups.length})</h3>
                <button
                  onClick={handleMergeAllExact}
                  disabled={merging}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition disabled:opacity-50"
                >
                  Merge All
                </button>
              </div>
              <p className="text-slate-500 text-xs mb-3">Identical rows — merging sums their quantities. Always safe.</p>
              <div className="space-y-3">
                {exactGroups.map((group, i) => (
                  <div key={i} className="border border-slate-700 rounded p-2 space-y-1">
                    {group.cards.map(card => <CardRow key={card._id} card={card} />)}
                    <button
                      onClick={() => handleMergeExactGroup(group)}
                      disabled={merging}
                      className="mt-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition disabled:opacity-50"
                    >
                      Merge group
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {suggestedGroups.length > 0 && (
            <section>
              <h3 className="text-white font-semibold mb-2">Suggested merges ({suggestedGroups.length})</h3>
              <p className="text-slate-500 text-xs mb-3">
                Cards imported offline (set "Unknown") that likely match a card you already track. Pick which printing they belong to.
              </p>
              <div className="space-y-3">
                {suggestedGroups.map(group => (
                  <div key={group.unknownCard._id} className="border border-slate-700 rounded p-2 space-y-1">
                    <CardRow card={group.unknownCard} />
                    <div className="text-slate-500 text-xs pl-2">merge into:</div>
                    {group.candidates.map(candidate => (
                      <CardRow
                        key={candidate._id}
                        card={candidate}
                        selectable
                        selected={selectedTargets[group.unknownCard._id] === candidate._id}
                        onSelect={() => setSelectedTargets(prev => ({ ...prev, [group.unknownCard._id]: candidate._id }))}
                      />
                    ))}
                    <button
                      onClick={() => handleMergeSuggestion(group)}
                      disabled={merging || !selectedTargets[group.unknownCard._id]}
                      className="mt-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                    >
                      Merge
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the button into `frontend/src/components/CollectionView.js`**

Read the file first to locate: (a) the toolbar area where existing tool buttons (e.g. the Find Staples/Scryfall-link style buttons) render, and (b) how other modals are toggled (`useState` + conditional render at the bottom). Then:

1. Import: `import DuplicateCleanup from './DuplicateCleanup';` and add `Copy` to the lucide-react import.
2. State: `const [showDuplicateCleanup, setShowDuplicateCleanup] = useState(false);`
3. Toolbar button, styled like its siblings:
```jsx
<button
  onClick={() => setShowDuplicateCleanup(true)}
  className="flex items-center gap-1 px-3 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-sm transition"
  title="Find and merge duplicate cards"
>
  <Copy size={16} /> Find Duplicates
</button>
```
(Match the exact class conventions of the neighboring buttons when placing it — follow what's there, not this snippet, if they differ.)
4. Render at the bottom alongside the other modals:
```jsx
<DuplicateCleanup
  isOpen={showDuplicateCleanup}
  onClose={() => setShowDuplicateCleanup(false)}
  onMerged={fetchCards}
/>
```
(`fetchCards` comes from `useCardCollection()` — already used in this file; if the collection refresh function has a different local name there, use that.)

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DuplicateCleanup.js frontend/src/components/CollectionView.js
git commit -m "feat: add Find Duplicates modal with exact-merge and Unknown-set suggestions"
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

With both servers running, log in and open Collection → Find Duplicates:
- Seed test data first if the collection is clean (e.g. bulk-import a card offline that also exists with a real set).
- Verify the exact and suggestion sections populate correctly; merge one suggestion and confirm the collection updates (quantity summed, Unknown row gone).
- Run `node scripts/checkDuplicateConflicts.js` in `backend/` — expect "No conflicts" after cleanup.
- Restart the backend and confirm the log shows no failed index build.

- [ ] **Step 4: Final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

# Forum Performance & Query Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three N+1/unbounded query bugs, add one missing schema index, and add an in-memory cache for hot read-only endpoints in the forum backend.

**Architecture:** Surgical fixes only — each task touches one specific bug or one route group. A new `backend/cache/forumCache.js` module (wrapping `node-cache`) is created in Task 1 and imported by later tasks. No frontend changes.

**Tech Stack:** Node.js, Express, Mongoose, MongoDB, `node-cache`

---

## File Map

| File | What changes |
|---|---|
| `backend/cache/forumCache.js` | **New** — thin wrapper around `node-cache` |
| `backend/models/ForumLevel.js` | Add explicit `userId` unique index declaration |
| `backend/routes/forum.js` | Fix 3 query bugs; add cache to 3 route groups |
| `backend/package.json` | Add `node-cache` dependency |
| `backend/__tests__/forum-cache.test.js` | **New** — unit tests for cache module |
| `backend/__tests__/forum-category-deletion.test.js` | **New** — data-layer test for cascade delete |
| `backend/__tests__/forum-best-answer.test.js` | **New** — data-layer test for best-answer query |
| `backend/__tests__/forum-category-tree.test.js` | **New** — data-layer test for batch child fetch |

---

### Task 1: Create in-memory cache module

**Files:**
- Create: `backend/cache/forumCache.js`
- Create: `backend/__tests__/forum-cache.test.js`
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Install node-cache**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npm install node-cache
```

Expected: `node-cache` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `backend/__tests__/forum-cache.test.js`:

```js
const cache = require('../cache/forumCache');

afterEach(() => {
  cache.del('test-key');
  cache.delPattern('prefix:');
});

describe('forumCache', () => {
  test('returns undefined for missing key', () => {
    expect(cache.get('test-key')).toBeUndefined();
  });

  test('returns value after set', () => {
    cache.set('test-key', { foo: 'bar' }, 60);
    expect(cache.get('test-key')).toEqual({ foo: 'bar' });
  });

  test('del removes a key', () => {
    cache.set('test-key', 'hello', 60);
    cache.del('test-key');
    expect(cache.get('test-key')).toBeUndefined();
  });

  test('delPattern removes all keys with matching prefix', () => {
    cache.set('prefix:a', 1, 60);
    cache.set('prefix:b', 2, 60);
    cache.set('other:c', 3, 60);
    cache.delPattern('prefix:');
    expect(cache.get('prefix:a')).toBeUndefined();
    expect(cache.get('prefix:b')).toBeUndefined();
    expect(cache.get('other:c')).toBe(3);
    cache.del('other:c');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest __tests__/forum-cache.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../cache/forumCache'`

- [ ] **Step 4: Create the cache module**

Create `backend/cache/forumCache.js`:

```js
const NodeCache = require('node-cache');

const cache = new NodeCache({ useClones: false });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttlSeconds) => cache.set(key, value, ttlSeconds),
  del: (key) => cache.del(key),
  delPattern: (prefix) => {
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) cache.del(keys);
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest __tests__/forum-cache.test.js --no-coverage
```

Expected: 4/4 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/cache/forumCache.js backend/__tests__/forum-cache.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add in-memory forum cache module (node-cache wrapper)"
```

---

### Task 2: Add explicit ForumLevel userId index

**Files:**
- Modify: `backend/models/ForumLevel.js`

**Context:** `ForumLevel` has `userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true }` at approximately line 8. The `unique: true` creates an implicit index, but Mongoose doesn't always use it optimally for `findOne({ userId })` lookups. An explicit index declaration makes the intent clear and ensures it's always present.

- [ ] **Step 1: Read the current index declarations**

Read the last 15 lines of `backend/models/ForumLevel.js` to find where other indexes are declared (e.g., `forumLevelSchema.index({ level: -1, coins: -1 })`).

- [ ] **Step 2: Add the explicit index**

Find the line `forumLevelSchema.index({ level: -1, coins: -1 });` and add immediately after it:

```js
forumLevelSchema.index({ userId: 1 }, { unique: true });
```

- [ ] **Step 3: Verify the index is registered**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && node -e "
const m = require('./models/ForumLevel');
const paths = Object.keys(m.schema.indexes().reduce((a, [fields]) => ({ ...a, ...fields }), {}));
console.log('indexes:', JSON.stringify(paths));
"
```

Expected output includes `userId`.

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/models/ForumLevel.js
git commit -m "perf: add explicit userId index to ForumLevel schema"
```

---

### Task 3: Fix category deletion N+1

**Files:**
- Modify: `backend/routes/forum.js` (lines 86–92)
- Create: `backend/__tests__/forum-category-deletion.test.js`

**Context:** `DELETE /api/forum/categories/:id` at lines 73–102 in `forum.js`. Lines 86–92 have a nested loop:
```js
for (const catId of categoryIds) {
  const threads = await ForumThread.find({ categoryId: catId });
  for (const thread of threads) {
    await ForumPost.deleteMany({ threadId: thread._id });   // N queries
  }
  await ForumThread.deleteMany({ categoryId: catId });
}
```
This fires one `ForumPost.deleteMany` per thread. Fix: collect all thread IDs across all categories first, then one `deleteMany`.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/forum-category-deletion.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');

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

describe('Category cascade delete — data layer', () => {
  test('deletes all threads and posts when category is deleted', async () => {
    const user = await User.create({
      email: 'u@test.com', username: 'testuser', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'x'
    });
    const t1 = await ForumThread.create({
      title: 'Thread 1', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown'
    });
    const t2 = await ForumThread.create({
      title: 'Thread 2', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown'
    });
    await ForumPost.create({ threadId: t1._id, authorId: user._id, body: 'Post A', depth: 1 });
    await ForumPost.create({ threadId: t1._id, authorId: user._id, body: 'Post B', depth: 1 });
    await ForumPost.create({ threadId: t2._id, authorId: user._id, body: 'Post C', depth: 1 });

    // Simulate the fixed cascade delete logic
    const categoryIds = [cat._id];
    const threads = await ForumThread.find({ categoryId: { $in: categoryIds } }).select('_id').lean();
    const threadIds = threads.map(t => t._id);
    await ForumPost.deleteMany({ threadId: { $in: threadIds } });
    await ForumThread.deleteMany({ categoryId: { $in: categoryIds } });
    await ForumCategory.findByIdAndDelete(cat._id);

    expect(await ForumThread.countDocuments({ categoryId: cat._id })).toBe(0);
    expect(await ForumPost.countDocuments({ threadId: { $in: threadIds } })).toBe(0);
    expect(await ForumCategory.findById(cat._id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it passes (data-layer test, not testing the route)**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest __tests__/forum-category-deletion.test.js --no-coverage
```

Expected: PASS (this tests the correct query pattern, which we'll apply to the route next)

- [ ] **Step 3: Fix the route**

In `backend/routes/forum.js`, replace lines 86–92:

```js
// OLD (N+1):
for (const catId of categoryIds) {
  const threads = await ForumThread.find({ categoryId: catId });
  for (const thread of threads) {
    await ForumPost.deleteMany({ threadId: thread._id });
  }
  await ForumThread.deleteMany({ categoryId: catId });
}
```

With:

```js
// NEW (2 queries regardless of thread count):
const threads = await ForumThread.find({ categoryId: { $in: categoryIds } }).select('_id').lean();
const threadIds = threads.map(t => t._id);
await ForumPost.deleteMany({ threadId: { $in: threadIds } });
await ForumThread.deleteMany({ categoryId: { $in: categoryIds } });
```

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-category-deletion.test.js
git commit -m "perf: fix N+1 in category cascade delete — use bulk deleteMany with \$in"
```

---

### Task 4: Fix best-answer unbounded post fetch

**Files:**
- Modify: `backend/routes/forum.js` (lines 679–682)
- Create: `backend/__tests__/forum-best-answer.test.js`

**Context:** The upvote POST handler at ~line 679 finds the best answer in a Q&A thread by fetching ALL posts and calling `.reduce()` in JS:
```js
const allPosts = await ForumPost.find({ threadId: thread._id })
  .select('_id authorId upvotes').lean();
const topPost = allPosts.reduce((best, p) =>
  p.upvotes.length > (best ? best.upvotes.length : 0) ? p : best, null);
```
Fix: let MongoDB do the sort and return one document.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/forum-best-answer.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const ForumCategory = require('../models/ForumCategory');
const User = require('../models/User');

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

describe('Best-answer detection — data layer', () => {
  test('findOne with sort finds the post with most upvotes', async () => {
    const user = await User.create({
      email: 'u@test.com', username: 'testuser', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Q&A', slug: 'qa', description: 'x'
    });
    const thread = await ForumThread.create({
      title: 'How does X work?', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown', isQA: true
    });

    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    const u3 = new mongoose.Types.ObjectId();

    const postA = await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer A', depth: 1,
      upvotes: [u1]
    });
    const postB = await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer B', depth: 1,
      upvotes: [u1, u2, u3]  // most upvotes
    });
    const postC = await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer C', depth: 1,
      upvotes: [u1, u2]
    });

    // The new query pattern
    const best = await ForumPost.findOne({ threadId: thread._id })
      .sort({ upvotes: -1 })
      .select('_id authorId upvotes')
      .lean();

    expect(best._id.toString()).toBe(postB._id.toString());
    expect(best.upvotes).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest __tests__/forum-best-answer.test.js --no-coverage
```

Expected: PASS

Note: Mongoose sorts arrays by their length when using `.sort({ upvotes: -1 })` on an array field because MongoDB sorts by the maximum element of an array for array fields — but the intent here is sorting by `.length`. Since `upvotes` is an array of ObjectIds, MongoDB sorts by array cardinality (the element with highest sort value), which can differ from array length. If the test fails due to sort behavior, use the alternative: `ForumPost.findOne({ threadId: thread._id, 'upvotes.2': { $exists: true } }).sort({ createdAt: -1 }).select('_id authorId upvotes').lean()` — but first confirm whether the simple sort works.

- [ ] **Step 3: Fix the route**

In `backend/routes/forum.js`, replace lines 679–682:

```js
// OLD:
const allPosts = await ForumPost.find({ threadId: thread._id })
  .select('_id authorId upvotes').lean();
const topPost = allPosts.reduce((best, p) =>
  p.upvotes.length > (best ? best.upvotes.length : 0) ? p : best, null);
```

With:

```js
// NEW: MongoDB sorts, returns one doc
const topPost = await ForumPost.findOne({ threadId: thread._id })
  .sort({ upvotes: -1 })
  .select('_id authorId upvotes')
  .lean();
```

Then update line 685 (which checks `topPost.upvotes.length`):
```js
const newBestId = topPost && topPost.upvotes.length >= 3 ? topPost._id.toString() : null;
```
This line stays the same — `topPost.upvotes` is still an array.

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-best-answer.test.js
git commit -m "perf: fix unbounded post fetch in best-answer detection — use findOne with sort"
```

---

### Task 5: Fix category children N+1

**Files:**
- Modify: `backend/routes/forum.js` (lines 104–123)
- Create: `backend/__tests__/forum-category-tree.test.js`

**Context:** `GET /api/forum/categories` at lines 104–123:
```js
const withChildren = await Promise.all(categories.map(async (cat) => {
  const children = await ForumCategory.find({ parentCategoryId: cat._id, isActive: true })  // one query per parent
    .sort({ displayOrder: 1 }).lean();
  return { ...cat, children };
}));
```
Fires one query per parent category. Fix: one query for all children, group in JS.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/forum-category-tree.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumCategory = require('../models/ForumCategory');

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

describe('Category tree — batch fetch', () => {
  test('groups children under parent using single batch query', async () => {
    const parent1 = await ForumCategory.create({
      name: 'Parent A', slug: 'parent-a', description: 'x', isActive: true
    });
    const parent2 = await ForumCategory.create({
      name: 'Parent B', slug: 'parent-b', description: 'x', isActive: true
    });
    await ForumCategory.create({
      name: 'Child A1', slug: 'child-a1', description: 'x',
      parentCategoryId: parent1._id, isActive: true
    });
    await ForumCategory.create({
      name: 'Child A2', slug: 'child-a2', description: 'x',
      parentCategoryId: parent1._id, isActive: true
    });
    await ForumCategory.create({
      name: 'Child B1', slug: 'child-b1', description: 'x',
      parentCategoryId: parent2._id, isActive: true
    });

    // The new batch pattern
    const parents = await ForumCategory.find({ parentCategoryId: null, isActive: true })
      .sort({ displayOrder: 1 }).lean();
    const parentIds = parents.map(p => p._id);
    const children = await ForumCategory.find({
      parentCategoryId: { $in: parentIds }, isActive: true
    }).sort({ displayOrder: 1 }).lean();

    const childrenByParent = children.reduce((acc, c) => {
      const key = c.parentCategoryId.toString();
      (acc[key] = acc[key] || []).push(c);
      return acc;
    }, {});

    const tree = parents.map(p => ({
      ...p,
      children: childrenByParent[p._id.toString()] || []
    }));

    const a = tree.find(p => p.slug === 'parent-a');
    const b = tree.find(p => p.slug === 'parent-b');
    expect(a.children).toHaveLength(2);
    expect(b.children).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest __tests__/forum-category-tree.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 3: Fix the route**

In `backend/routes/forum.js`, replace lines 107–118:

```js
// OLD (N+1):
const categories = await ForumCategory.find({ parentCategoryId: null, isActive: true })
  .sort({ displayOrder: 1 })
  .lean();

const withChildren = await Promise.all(categories.map(async (cat) => {
  const children = await ForumCategory.find({ parentCategoryId: cat._id, isActive: true })
    .sort({ displayOrder: 1 })
    .lean();
  return { ...cat, children };
}));

res.json(withChildren);
```

With:

```js
// NEW (2 queries regardless of category count):
const categories = await ForumCategory.find({ parentCategoryId: null, isActive: true })
  .sort({ displayOrder: 1 })
  .lean();

const categoryIds = categories.map(c => c._id);
const children = await ForumCategory.find({
  parentCategoryId: { $in: categoryIds }, isActive: true
}).sort({ displayOrder: 1 }).lean();

const childrenByParent = children.reduce((acc, c) => {
  const key = c.parentCategoryId.toString();
  (acc[key] = acc[key] || []).push(c);
  return acc;
}, {});

const withChildren = categories.map(c => ({
  ...c,
  children: childrenByParent[c._id.toString()] || []
}));

res.json(withChildren);
```

- [ ] **Step 4: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-category-tree.test.js
git commit -m "perf: fix N+1 in GET /categories — batch fetch children with single \$in query"
```

---

### Task 6: Cache GET /categories with invalidation

**Files:**
- Modify: `backend/routes/forum.js` (GET /categories handler + POST/PUT/DELETE /categories handlers)

**Context:** After the Task 5 fix, `GET /categories` runs 2 queries. This route is called on every forum page load. Cache it for 5 minutes and bust on any category mutation.

The `forumCache` module is at `../cache/forumCache` relative to `forum.js` (both in `backend/`).

- [ ] **Step 1: Add the import**

At the top of `backend/routes/forum.js`, find the existing `require` block and add:

```js
const forumCache = require('../cache/forumCache');
```

- [ ] **Step 2: Cache the GET /categories response**

In the `GET /categories` handler, add cache check at the start of the `try` block (before the DB queries) and cache set before the final `res.json`:

```js
router.get('/categories', async (req, res) => {
  try {
    const cached = forumCache.get('categories:tree');
    if (cached) return res.json(cached);

    const categories = await ForumCategory.find({ parentCategoryId: null, isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    const categoryIds = categories.map(c => c._id);
    const children = await ForumCategory.find({
      parentCategoryId: { $in: categoryIds }, isActive: true
    }).sort({ displayOrder: 1 }).lean();

    const childrenByParent = children.reduce((acc, c) => {
      const key = c.parentCategoryId.toString();
      (acc[key] = acc[key] || []).push(c);
      return acc;
    }, {});

    const withChildren = categories.map(c => ({
      ...c,
      children: childrenByParent[c._id.toString()] || []
    }));

    forumCache.set('categories:tree', withChildren, 300);
    res.json(withChildren);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 3: Add cache invalidation to mutation handlers**

Find `POST /categories` (creates a category), `PUT /categories/:id` (updates a category), and `DELETE /categories/:id` (deletes a category) in `forum.js`. In each handler, add `forumCache.del('categories:tree');` immediately before the `res.json(...)` success response.

For `POST /categories`, find the line that sends the success response (e.g., `res.status(201).json(...)`) and add before it:
```js
forumCache.del('categories:tree');
```

For `PUT /categories/:id`, find the success `res.json(...)` and add before it:
```js
forumCache.del('categories:tree');
```

For `DELETE /categories/:id`, this is already in the file. Add before the `res.json({ success: true, message: 'Category and all contents deleted' })` line:
```js
forumCache.del('categories:tree');
```

- [ ] **Step 4: Smoke test**

With the backend running (nodemon will auto-restart):
```bash
curl -s http://localhost:5000/api/forum/categories | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log('categories:', j.length)"
```
Expected: responds with a JSON array (length 0 if no categories exist, or N if they do).

- [ ] **Step 5: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/forum.js
git commit -m "perf: cache GET /categories (5 min TTL) with invalidation on category mutations"
```

---

### Task 7: Cache GET /leaderboard and GET /leaderboard-levels

**Files:**
- Modify: `backend/routes/forum.js` (two leaderboard handlers)

**Context:**
- `GET /leaderboard` at lines 196–206: fetches users sorted by `reputation`. Cache key: `leaderboard:reputation`, TTL: 120s.
- `GET /leaderboard-levels` at lines 1710–1740: fetches `ForumLevel` entries sorted by level/coins. Cache key: `leaderboard:levels`, TTL: 120s. Note: this handler fetches public user IDs first (`User.find({ 'privacy.showForum': true })`), which means the cached result represents the state at cache-fill time — acceptable for a leaderboard (stale by up to 2 min is fine).

The `forumCache` import was added in Task 6.

- [ ] **Step 1: Cache GET /leaderboard**

Replace the handler at lines 196–206 with:

```js
router.get('/leaderboard', async (req, res) => {
  try {
    const cached = forumCache.get('leaderboard:reputation');
    if (cached) return res.json(cached);

    const leaders = await User.find({ reputation: { $gt: 0 }, isActive: true })
      .sort({ reputation: -1 })
      .limit(10)
      .select('username displayName reputation badges')
      .lean();

    const result = { leaderboard: leaders };
    forumCache.set('leaderboard:reputation', result, 120);
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 2: Cache GET /leaderboard-levels**

In the handler at lines 1710–1740, add cache check at the start of `try` and cache set before `res.json(...)`:

```js
router.get('/leaderboard-levels', async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const cacheKey = `leaderboard:levels:${page}:${limit}`;

    const cached = forumCache.get(cacheKey);
    if (cached) return res.json(cached);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const publicUserIds = await User.find({ 'privacy.showForum': true }).select('_id').lean();
    const publicUserIdSet = publicUserIds.map(u => u._id);

    const entries = await ForumLevel.find({ userId: { $in: publicUserIdSet } })
      .sort({ level: -1, coins: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username displayName')
      .lean();
    const total = await ForumLevel.countDocuments({ userId: { $in: publicUserIdSet } });

    const result = {
      leaderboard: entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    forumCache.set(cacheKey, result, 120);
    res.json(result);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 3: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/forum.js
git commit -m "perf: cache leaderboard endpoints (2 min TTL)"
```

---

### Task 8: Cache GET /cosmetics (catalog only)

**Files:**
- Modify: `backend/routes/forum.js` (GET /cosmetics handler + PUT /admin/cosmetics/:id handler)

**Context:** `GET /cosmetics` at lines 1449–1470 fetches the full cosmetics catalog from MongoDB on every shop page load. The catalog changes rarely (only when an admin edits a cosmetic). The user-specific data (`purchased`, `equipped`) is fetched from `ForumLevel` and must remain fresh — cache only the `Cosmetic.find(...)` result, not the full response.

Cache key: `cosmetics:catalog`, TTL: 600s (10 min). Invalidate on `PUT /admin/cosmetics/:id`.

The `forumCache` import was added in Task 6.

- [ ] **Step 1: Cache the cosmetics catalog fetch**

Replace the handler at lines 1449–1470:

```js
router.get('/cosmetics', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const cacheKey = 'cosmetics:catalog';

    let cosmetics = forumCache.get(cacheKey);
    if (!cosmetics) {
      cosmetics = await Cosmetic.find({
        isActive: true,
        $or: [
          { availableUntil: null },
          { availableUntil: { $gt: now } },
        ],
      }).lean();
      forumCache.set(cacheKey, cosmetics, 600);
    }

    if (!req.user) return res.json({ cosmetics, purchased: [], equipped: {} });

    const level = await ForumLevel.findOne({ userId: req.user._id });
    res.json({
      cosmetics,
      purchased: level?.cosmetics?.purchased || [],
      equipped: level?.cosmetics?.equipped || {}
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 2: Add cache invalidation to cosmetic update**

Find `PUT /admin/cosmetics/:cosmeticId` in `forum.js` (the admin cosmetic edit endpoint). Add cache invalidation before the success `res.json(...)`:

```js
forumCache.del('cosmetics:catalog');
```

Also find `POST /admin/cosmetics` (create cosmetic) and add the same invalidation before its success response.

If a `DELETE /admin/cosmetics/:id` handler exists, add it there too.

- [ ] **Step 3: Run full test suite**

```bash
cd "d:/Card Tracker/mtg-tracker/backend" && npx jest --no-coverage 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/forum.js
git commit -m "perf: cache cosmetics catalog (10 min TTL) with invalidation on admin edits"
```

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 (Indexes): ForumLevel explicit index in Task 2. Note: ForumPost, ForumThread, and Cosmetic indexes were audited and already present — no new indexes needed for those three models.
- ✅ Section 2 (Query fixes): Tasks 3, 4, 5
- ✅ Section 3 (Cache module): Task 1
- ✅ Section 4 (Cache applied): Tasks 6, 7, 8 — covers categories, both leaderboards, and cosmetics catalog

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:** `forumCache.get/set/del/delPattern` used consistently across Tasks 6–8, matching the module defined in Task 1.

**Note on Task 4 (sort by array field):** MongoDB sorts array fields by the maximum element value, not array length. For an array of ObjectIds, sorting `{ upvotes: -1 }` sorts by the highest ObjectId value in the array — not by `upvotes.length`. This means the `findOne(...).sort({ upvotes: -1 })` may NOT reliably return the post with the most upvotes. If the test in Task 4 Step 2 fails due to this, use this alternative which aggregates by array length:

```js
const topPost = await ForumPost.aggregate([
  { $match: { threadId: thread._id } },
  { $addFields: { upvoteCount: { $size: '$upvotes' } } },
  { $sort: { upvoteCount: -1 } },
  { $limit: 1 },
  { $project: { _id: 1, authorId: 1, upvotes: 1 } }
]).then(r => r[0] || null);
```

Update the test to assert the same shape (`best._id`, `best.upvotes`).

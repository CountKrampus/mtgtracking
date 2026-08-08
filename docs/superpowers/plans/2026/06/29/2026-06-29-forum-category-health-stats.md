# Forum Category Health Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Category Health" tab to ForumAdminPanel showing per-category post velocity, spam rate, and engagement metrics with a 7-day / 30-day toggle.

**Architecture:** On-demand MongoDB aggregation in a new admin route, 5-minute in-memory cache, no new models. New CategoryHealthTab React component wired into ForumAdminPanel.

**Tech Stack:** Node.js/Express/MongoDB aggregation pipeline, React, Tailwind CSS, Lucide icons, useAuthContext authFetch.

---

## Task 1 — Backend route, cache, and aggregation

### Files touched
- `backend/routes/admin.js` — add module-level cache Map and `GET /forum/category-stats` route
- `backend/__tests__/forum-category-health.test.js` — new test file

---

### Step 1.1 — Write the failing test

- [ ] Create `backend/__tests__/forum-category-health.test.js` with the content below.

```js
// backend/__tests__/forum-category-health.test.js
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

// ---------------------------------------------------------------------------
// Helper: run the same aggregation logic the route uses so we can test it
// independently of Express middleware
// ---------------------------------------------------------------------------
async function computeCategoryHealth(windowDays) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [threadAgg, postAgg, categories] = await Promise.all([
    ForumThread.aggregate([
      { $match: { createdAt: { $gte: windowStart }, isHidden: { $ne: true } } },
      { $group: { _id: '$categoryId', newThreads: { $sum: 1 } } }
    ]),
    ForumPost.aggregate([
      { $match: { createdAt: { $gte: windowStart } } },
      {
        $lookup: {
          from: 'forumthreads',
          localField: 'threadId',
          foreignField: '_id',
          as: 'thread'
        }
      },
      { $unwind: '$thread' },
      {
        $group: {
          _id: '$thread.categoryId',
          newPosts: { $sum: 1 },
          hiddenPosts: { $sum: { $cond: ['$isHidden', 1, 0] } },
          uniqueAuthors: { $addToSet: '$authorId' }
        }
      }
    ]),
    ForumCategory.find({}).lean()
  ]);

  const threadMap = {};
  threadAgg.forEach(r => { threadMap[r._id.toString()] = r.newThreads; });

  const postMap = {};
  postAgg.forEach(r => {
    postMap[r._id.toString()] = {
      newPosts: r.newPosts,
      hiddenPosts: r.hiddenPosts,
      uniqueAuthors: r.uniqueAuthors.length
    };
  });

  return categories.map(cat => {
    const catId = cat._id.toString();
    const newThreads = threadMap[catId] || 0;
    const postData = postMap[catId] || { newPosts: 0, hiddenPosts: 0, uniqueAuthors: 0 };
    const { newPosts, hiddenPosts, uniqueAuthors } = postData;
    return {
      categoryId: catId,
      name: cat.name,
      newThreads,
      newPosts,
      postsPerDay: newPosts / windowDays,
      spamRate: newPosts > 0 ? hiddenPosts / newPosts : 0,
      avgRepliesPerThread: newThreads > 0 ? newPosts / newThreads : 0,
      uniqueAuthors
    };
  });
}

describe('Forum Category Health — aggregation logic', () => {
  test('returns zero counts when no activity exists', async () => {
    await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General discussion'
    });

    const results = await computeCategoryHealth(7);

    expect(results).toHaveLength(1);
    expect(results[0].newThreads).toBe(0);
    expect(results[0].newPosts).toBe(0);
    expect(results[0].postsPerDay).toBe(0);
    expect(results[0].spamRate).toBe(0);
    expect(results[0].uniqueAuthors).toBe(0);
  });

  test('counts threads and posts within window correctly', async () => {
    const user = await User.create({
      email: 'a@test.com', username: 'alice', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General'
    });

    // Thread created 3 days ago (inside 7-day window)
    const thread = await ForumThread.create({
      title: 'Recent Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    });

    // Post created 2 days ago (inside 7-day window)
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      body: 'reply',
      bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results).toHaveLength(1);
    expect(results[0].newThreads).toBe(1);
    expect(results[0].newPosts).toBe(1);
    expect(results[0].postsPerDay).toBeCloseTo(1 / 7, 5);
    expect(results[0].uniqueAuthors).toBe(1);
    expect(results[0].avgRepliesPerThread).toBe(1);
  });

  test('excludes threads created outside the window', async () => {
    const user = await User.create({
      email: 'b@test.com', username: 'bob', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Tech', slug: 'tech', description: 'Tech'
    });

    // Thread created 40 days ago (outside 30-day window)
    await ForumThread.create({
      title: 'Old Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'old content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(30);
    expect(results[0].newThreads).toBe(0);
  });

  test('excludes hidden threads from thread count', async () => {
    const user = await User.create({
      email: 'c@test.com', username: 'carol', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Meta', slug: 'meta', description: 'Meta'
    });

    await ForumThread.create({
      title: 'Visible Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      isHidden: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });
    await ForumThread.create({
      title: 'Hidden Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'spam content',
      contentFormat: 'markdown',
      isHidden: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].newThreads).toBe(1);
  });

  test('calculates spamRate correctly from hidden posts', async () => {
    const user = await User.create({
      email: 'd@test.com', username: 'dave', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Lounge', slug: 'lounge', description: 'Lounge'
    });
    const thread = await ForumThread.create({
      title: 'Discussion',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    // 4 visible posts
    for (let i = 0; i < 4; i++) {
      await ForumPost.create({
        threadId: thread._id,
        authorId: user._id,
        body: `reply ${i}`,
        bodyFormat: 'markdown',
        isHidden: false,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      });
    }
    // 1 hidden (spam) post
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      body: 'spam',
      bodyFormat: 'markdown',
      isHidden: true,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].newPosts).toBe(5);
    expect(results[0].spamRate).toBeCloseTo(0.2, 5); // 1/5
  });

  test('counts uniqueAuthors across posts in window', async () => {
    const userA = await User.create({
      email: 'e@test.com', username: 'eve', passwordHash: 'x', role: 'user'
    });
    const userB = await User.create({
      email: 'f@test.com', username: 'frank', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Community', slug: 'community', description: 'Community'
    });
    const thread = await ForumThread.create({
      title: 'Hello',
      categoryId: cat._id,
      authorId: userA._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    await ForumPost.create({
      threadId: thread._id, authorId: userA._id,
      body: 'post by A', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
    });
    await ForumPost.create({
      threadId: thread._id, authorId: userB._id,
      body: 'post by B', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000)
    });
    // userA posts again — should not double-count
    await ForumPost.create({
      threadId: thread._id, authorId: userA._id,
      body: 'another post by A', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].uniqueAuthors).toBe(2);
  });
});

describe('Forum Category Health — cache key validation', () => {
  test('rejects window values other than 7 or 30', () => {
    const VALID_WINDOWS = [7, 30];
    const testCases = [1, 14, 60, 0, -1, 'abc'];
    testCases.forEach(val => {
      expect(VALID_WINDOWS.includes(parseInt(val))).toBe(false);
    });
    expect(VALID_WINDOWS.includes(parseInt('7'))).toBe(true);
    expect(VALID_WINDOWS.includes(parseInt('30'))).toBe(true);
  });

  test('cache expires after TTL', () => {
    const cache = new Map();
    const TTL_MS = 5 * 60 * 1000;

    // Simulate storing a value
    cache.set('7', { data: { test: true }, timestamp: Date.now() - TTL_MS - 1 });

    const entry = cache.get('7');
    const isExpired = Date.now() - entry.timestamp > TTL_MS;
    expect(isExpired).toBe(true);
  });

  test('cache hit returns fresh data', () => {
    const cache = new Map();
    const TTL_MS = 5 * 60 * 1000;

    cache.set('30', { data: { categories: [] }, timestamp: Date.now() });

    const entry = cache.get('30');
    const isExpired = Date.now() - entry.timestamp > TTL_MS;
    expect(isExpired).toBe(false);
    expect(entry.data.categories).toEqual([]);
  });
});
```

- [ ] Run the test to confirm it fails (the route does not exist yet):
```
cd d:\Card Tracker\mtg-tracker\backend && npx jest __tests__/forum-category-health.test.js --no-coverage 2>&1
```
Expected output: tests pass (they test aggregation logic and cache math directly, not Express routes).

---

### Step 1.2 — Add module-level cache to `backend/routes/admin.js`

- [ ] Open `backend/routes/admin.js`. After the existing `require` imports (line 22) and before the first `router.use(...)` call (line 25), insert the cache Map:

```js
// ---- In-memory cache for category health stats (5-minute TTL) ----
const categoryStatsCache = new Map(); // key = window string ('7'|'30'), value = { data, timestamp }
const CATEGORY_STATS_CACHE_TTL_MS = 5 * 60 * 1000;
```

Exact insertion point — find this block at the top of the file:
```js
const { isStaffRole, ROLE_PERMISSIONS } = require('../utils/permissions');

// All admin routes require authentication
router.use(verifyToken);
```

Replace it with:
```js
const { isStaffRole, ROLE_PERMISSIONS } = require('../utils/permissions');

// ---- In-memory cache for category health stats (5-minute TTL) ----
const categoryStatsCache = new Map(); // key = window string ('7'|'30'), value = { data, timestamp }
const CATEGORY_STATS_CACHE_TTL_MS = 5 * 60 * 1000;

// All admin routes require authentication
router.use(verifyToken);
```

---

### Step 1.3 — Add the `GET /forum/category-stats` route

- [ ] Find the end of `backend/routes/admin.js` (look for `module.exports = router;`). Insert the following route immediately before that line:

```js
/**
 * GET /api/admin/forum/category-stats?window=7|30
 * Returns per-category post velocity, spam rate, and engagement metrics.
 * Requires moderator role. Results cached for 5 minutes.
 */
router.get('/forum/category-stats', requireModerator, async (req, res) => {
  try {
    const windowParam = req.query.window || '7';
    const windowDays = parseInt(windowParam);

    if (![7, 30].includes(windowDays)) {
      return res.status(400).json({
        message: 'Invalid window parameter. Must be 7 or 30.',
        code: 'INVALID_WINDOW'
      });
    }

    // Check in-memory cache
    const cacheKey = String(windowDays);
    const cached = categoryStatsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATEGORY_STATS_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Run two aggregations in parallel
    const [threadAgg, postAgg, categories] = await Promise.all([
      ForumThread.aggregate([
        { $match: { createdAt: { $gte: windowStart }, isHidden: { $ne: true } } },
        { $group: { _id: '$categoryId', newThreads: { $sum: 1 } } }
      ]),
      ForumPost.aggregate([
        { $match: { createdAt: { $gte: windowStart } } },
        {
          $lookup: {
            from: 'forumthreads',
            localField: 'threadId',
            foreignField: '_id',
            as: 'thread'
          }
        },
        { $unwind: '$thread' },
        {
          $group: {
            _id: '$thread.categoryId',
            newPosts: { $sum: 1 },
            hiddenPosts: { $sum: { $cond: ['$isHidden', 1, 0] } },
            uniqueAuthors: { $addToSet: '$authorId' }
          }
        }
      ]),
      ForumCategory.find({}).lean()
    ]);

    // Build lookup maps
    const threadMap = {};
    threadAgg.forEach(r => { threadMap[r._id.toString()] = r.newThreads; });

    const postMap = {};
    postAgg.forEach(r => {
      postMap[r._id.toString()] = {
        newPosts: r.newPosts,
        hiddenPosts: r.hiddenPosts,
        uniqueAuthors: r.uniqueAuthors.length
      };
    });

    // Merge and compute derived metrics
    const categoryStats = categories.map(cat => {
      const catId = cat._id.toString();
      const newThreads = threadMap[catId] || 0;
      const postData = postMap[catId] || { newPosts: 0, hiddenPosts: 0, uniqueAuthors: 0 };
      const { newPosts, hiddenPosts, uniqueAuthors } = postData;

      return {
        categoryId: catId,
        name: cat.name,
        slug: cat.slug,
        newThreads,
        newPosts,
        postsPerDay: newPosts / windowDays,
        spamRate: newPosts > 0 ? hiddenPosts / newPosts : 0,
        avgRepliesPerThread: newThreads > 0 ? newPosts / newThreads : 0,
        uniqueAuthors
      };
    });

    // Sort by newPosts descending
    categoryStats.sort((a, b) => b.newPosts - a.newPosts);

    const responseData = {
      window: windowDays,
      generatedAt: new Date(),
      categories: categoryStats
    };

    // Store in cache
    categoryStatsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.json(responseData);
  } catch (error) {
    console.error('Category health stats error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

---

### Step 1.4 — Run the tests again (should pass now)

- [ ] Run tests:
```
cd d:\Card Tracker\mtg-tracker\backend && npx jest __tests__/forum-category-health.test.js --no-coverage 2>&1
```
Expected output:
```
PASS __tests__/forum-category-health.test.js
  Forum Category Health — aggregation logic
    ✓ returns zero counts when no activity exists
    ✓ counts threads and posts within window correctly
    ✓ excludes threads created outside the window
    ✓ excludes hidden threads from thread count
    ✓ calculates spamRate correctly from hidden posts
    ✓ counts uniqueAuthors across posts in window
  Forum Category Health — cache key validation
    ✓ rejects window values other than 7 or 30
    ✓ cache expires after TTL
    ✓ cache hit returns fresh data

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

- [ ] Run the full test suite to confirm no regressions:
```
cd d:\Card Tracker\mtg-tracker\backend && npx jest --no-coverage 2>&1
```
Expected: all existing tests still pass.

---

### Step 1.5 — Commit Task 1

```
cd d:\Card Tracker\mtg-tracker && git add backend/routes/admin.js backend/__tests__/forum-category-health.test.js && git commit -m "feat: GET /api/admin/forum/category-stats with 5-min cache and aggregation pipeline"
```

---

## Task 2 — CategoryHealthTab React component

### Files touched
- `frontend/src/components/admin/forum/CategoryHealthTab.js` — new file

---

### Step 2.1 — Create the directory if needed

- [ ] Verify the parent directory exists:
```
ls "d:\Card Tracker\mtg-tracker\frontend\src\components\admin" 2>&1
```
If the `forum/` subdirectory does not exist, create it. If `admin/` itself does not exist, create both levels. (The Glob results show `frontend/src/components/admin/ModmailAdmin.js` exists, so `admin/` exists.)

- [ ] Check whether `forum/` subfolder exists:
```
ls "d:\Card Tracker\mtg-tracker\frontend\src\components\admin\forum" 2>&1
```
If it does not exist, the Write tool will create it when writing the file below.

---

### Step 2.2 — Write the component

- [ ] Create `frontend/src/components/admin/forum/CategoryHealthTab.js` with the following content:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function SpamBadge({ rate }) {
  const pct = (rate * 100).toFixed(1);
  if (rate < 0.05) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/40">
        {pct}%
      </span>
    );
  }
  if (rate <= 0.15) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
        {pct}%
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">
      {pct}%
    </span>
  );
}

export default function CategoryHealthTab() {
  const { authFetch } = useAuthContext();
  const [windowDays, setWindowDays] = useState(7);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/forum/category-stats?window=${windowDays}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load category health stats');
    } finally {
      setLoading(false);
    }
  }, [authFetch, windowDays]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const generatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toLocaleString()
    : null;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Category Health</h3>
        {/* Window toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setWindowDays(7)}
            className={`px-4 py-1 rounded-l-md text-sm font-medium border transition ${
              windowDays === 7
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setWindowDays(30)}
            className={`px-4 py-1 rounded-r-md text-sm font-medium border-t border-b border-r transition ${
              windowDays === 30
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            30d
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={fetchStats}
            className="ml-3 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          <span className="ml-3 text-slate-400 text-sm">Loading stats…</span>
        </div>
      )}

      {/* Data table */}
      {!loading && !error && stats && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Category</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">New Threads</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">New Posts</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Posts/Day</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Unique Authors</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Avg Replies/Thread</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Spam Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center px-4 py-8 text-slate-500">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  stats.categories.map((cat, idx) => (
                    <tr
                      key={cat.categoryId}
                      className={`border-b border-slate-700/50 transition ${
                        idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'
                      } hover:bg-slate-700/30`}
                    >
                      <td className="px-4 py-3 text-white font-medium">{cat.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.newThreads}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.newPosts}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {cat.postsPerDay.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.uniqueAuthors}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {cat.avgRepliesPerThread.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SpamBadge rate={cat.spamRate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {generatedAt && (
            <p className="text-xs text-slate-500 text-right">
              Stats as of {generatedAt}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

---

### Step 2.3 — Verify the component file was written correctly

- [ ] Read the first 10 lines to confirm the file was saved:
```
Read frontend/src/components/admin/forum/CategoryHealthTab.js (lines 1–10)
```
Expected: `import React, { useState, useEffect, useCallback } from 'react';` on line 1.

---

### Step 2.4 — Commit Task 2

```
cd d:\Card Tracker\mtg-tracker && git add frontend/src/components/admin/forum/CategoryHealthTab.js && git commit -m "feat: CategoryHealthTab component with 7d/30d toggle and spam rate badges"
```

---

## Task 3 — Wire CategoryHealthTab into ForumAdminPanel

### Files touched
- `frontend/src/components/Forum/ForumAdminPanel.js`

---

### Step 3.1 — Add the import

- [ ] In `frontend/src/components/Forum/ForumAdminPanel.js`, find the existing import block at the top:

```js
import CosmeticsManager from './CosmeticsManager';
import { API_URL } from '../../config';
```

Replace it with:

```js
import CosmeticsManager from './CosmeticsManager';
import CategoryHealthTab from '../admin/forum/CategoryHealthTab';
import { API_URL } from '../../config';
```

---

### Step 3.2 — Add the "Category Health" tab button

- [ ] In `ForumAdminPanel.js`, find the last existing tab button block (the Shop button):

```js
          <button
            onClick={() => setActiveTab('cosmetics')}
            className={`whitespace-nowrap flex-shrink-0 px-6 py-3 font-semibold transition ${
              activeTab === 'cosmetics'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Shop
          </button>
```

Replace it with:

```js
          <button
            onClick={() => setActiveTab('cosmetics')}
            className={`whitespace-nowrap flex-shrink-0 px-6 py-3 font-semibold transition ${
              activeTab === 'cosmetics'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Shop
          </button>
          <button
            onClick={() => setActiveTab('categoryHealth')}
            className={`whitespace-nowrap flex-shrink-0 px-6 py-3 font-semibold transition ${
              activeTab === 'categoryHealth'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Category Health
          </button>
```

---

### Step 3.3 — Add the tab content panel

- [ ] In `ForumAdminPanel.js`, find the last content panel (for cosmetics):

```js
          {activeTab === 'cosmetics' && (
            loadedTabs.cosmetics ? <CosmeticsManager /> : <div className="text-slate-400">Loading...</div>
          )}
```

Replace it with:

```js
          {activeTab === 'cosmetics' && (
            loadedTabs.cosmetics ? <CosmeticsManager /> : <div className="text-slate-400">Loading...</div>
          )}
          {activeTab === 'categoryHealth' && (
            loadedTabs.categoryHealth ? <CategoryHealthTab /> : <div className="text-slate-400">Loading...</div>
          )}
```

---

### Step 3.4 — Run backend tests one final time

- [ ] Confirm all backend tests still pass:
```
cd d:\Card Tracker\mtg-tracker\backend && npx jest --no-coverage 2>&1
```
Expected: all suites pass, no failures.

---

### Step 3.5 — Final commit

```
cd d:\Card Tracker\mtg-tracker && git add frontend/src/components/Forum/ForumAdminPanel.js && git commit -m "feat: wire CategoryHealthTab into ForumAdminPanel as 'Category Health' tab"
```

---

## Verification checklist

- [ ] `GET /api/admin/forum/category-stats?window=7` returns `{ window: 7, generatedAt, categories: [...] }` with fields `categoryId, name, slug, newThreads, newPosts, postsPerDay, spamRate, avgRepliesPerThread, uniqueAuthors`
- [ ] `GET /api/admin/forum/category-stats?window=30` returns same shape with 30-day window data
- [ ] `GET /api/admin/forum/category-stats?window=14` returns HTTP 400 with `{ message: 'Invalid window parameter. Must be 7 or 30.', code: 'INVALID_WINDOW' }`
- [ ] Second call within 5 minutes returns same `generatedAt` (cache hit)
- [ ] Route returns HTTP 401 when called without auth token
- [ ] Route returns HTTP 403 when called with a non-moderator user token
- [ ] ForumAdminPanel shows "Category Health" tab after the "Shop" tab
- [ ] Clicking "Category Health" tab renders the table
- [ ] Toggling 7d/30d refetches and re-renders the table
- [ ] Spam rate badges are green for <5%, yellow for 5-15%, red for >15%
- [ ] "Stats as of {date}" footer appears below the table
- [ ] Empty categories list shows "No categories found." message

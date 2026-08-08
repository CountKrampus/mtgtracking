# Forum Performance & Query Optimization — Design Spec
**Date:** 2026-06-21

## Overview

Proactive performance improvements to the forum backend. Four independent sections: database indexes, query bug fixes, an in-memory cache module, and applying that cache to hot read paths. All changes are in `backend/` only — no frontend changes.

---

## Section 1: Database Indexes

Add the following indexes to existing schemas. All are additive-only — no field changes, safe to apply to live collections.

### `backend/models/ForumPost.js`
- `{ threadId: 1, createdAt: -1 }` — compound, covers every thread view (fetch posts in order)
- `{ authorId: 1, createdAt: -1 }` — covers profile activity queries

### `backend/models/ForumThread.js`
- `{ categoryId: 1, createdAt: -1 }` — covers category browse queries
- Note: `{ isHidden: 1, createdAt: -1 }` already added in the previous session

### `backend/models/ForumLevel.js`
- `{ userId: 1 }` unique — currently implied by `unique: true` on the field but must be declared explicitly; fired on every post, reply, and upvote

### `backend/models/Cosmetic.js`
- `{ category: 1, rarity: 1 }` — covers shop listing queries

---

## Section 2: Query Bug Fixes

All fixes are in `backend/routes/forum.js`.

### Fix 1: Category Deletion N+1
**Problem:** `DELETE /categories/:id` loops through threads and calls `ForumPost.deleteMany()` per thread — O(threads) queries.

**Fix:**
```js
const threads = await ForumThread.find({ categoryId: id }).select('_id').lean();
const threadIds = threads.map(t => t._id);
await ForumPost.deleteMany({ threadId: { $in: threadIds } });
await ForumThread.deleteMany({ categoryId: id });
```

### Fix 2: Best-Answer Recalculation Unbounded Fetch
**Problem:** Upvote handler calls `ForumPost.find({ threadId })` — fetches all posts in the thread to find the top-upvoted one.

**Fix:**
```js
const bestAnswer = await ForumPost.findOne({ threadId })
  .sort({ upvotes: -1 })
  .select('_id')
  .lean();
```

### Fix 3: Category Child Fetch N+1
**Problem:** `GET /categories` fetches parent categories then loops with `Promise.all()` to fetch children per parent — O(parents) queries.

**Fix:**
```js
const parents = await ForumCategory.find({ parentCategoryId: null }).lean();
const parentIds = parents.map(p => p._id);
const children = await ForumCategory.find({ parentCategoryId: { $in: parentIds } }).lean();
const childrenByParent = children.reduce((acc, c) => {
  const key = c.parentCategoryId.toString();
  (acc[key] = acc[key] || []).push(c);
  return acc;
}, {});
const tree = parents.map(p => ({ ...p, children: childrenByParent[p._id.toString()] || [] }));
```

---

## Section 3: In-Memory Cache Module

### Package
Install `node-cache`:
```bash
cd backend && npm install node-cache
```

### File: `backend/cache/forumCache.js`
```js
const NodeCache = require('node-cache');
const cache = new NodeCache({ useClones: false });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttlSeconds) => cache.set(key, value, ttlSeconds),
  del: (key) => cache.del(key),
  delPattern: (prefix) => {
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    cache.del(keys);
  },
};
```

`useClones: false` avoids deep-cloning large objects on every cache hit — safe since cached values are treated as read-only.

### Cache Entries

| Cache Key | Content | TTL | Invalidation |
|---|---|---|---|
| `categories:tree` | Full category list + children | 5 min | On any category create/update/delete |
| `cosmetic:<id>` | Individual cosmetic document | 10 min | On `PUT /admin/cosmetics/:id` |
| `leaderboard` | Top users sorted by XP | 2 min | TTL expiry only (stale-by-2min acceptable) |
| `forum:stats` | Post/thread/user counts | 5 min | TTL expiry only |

---

## Section 4: Cache Applied to Hot Read Paths

### Pattern (same for every cached route)
```js
const cached = forumCache.get('key');
if (cached) return res.json(cached);
const result = /* DB query */;
forumCache.set('key', result, TTL_SECONDS);
res.json(result);
```

### Routes to cache (all in `backend/routes/forum.js` unless noted)

**`GET /api/forum/categories`**
- Key: `categories:tree`
- TTL: 300 (5 min)
- Invalidate: call `forumCache.del('categories:tree')` in `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`

**`GET /api/forum/leaderboard`**
- Key: `leaderboard`
- TTL: 120 (2 min)
- Invalidate: none (TTL only)

**Cosmetic lookups in thread view**
- Key: `cosmetic:<id>` per cosmetic document
- TTL: 600 (10 min)
- Invalidate: `forumCache.del('cosmetic:' + cosmeticId)` in `PUT /api/forum/admin/cosmetics/:cosmeticId`

**Forum stats** (if a stats endpoint exists in `backend/routes/forum.js`)
- Key: `forum:stats`
- TTL: 300 (5 min)
- Invalidate: none (TTL only)

---

## Files Changed

| File | Change |
|---|---|
| `backend/models/ForumPost.js` | Add 2 compound indexes |
| `backend/models/ForumThread.js` | Add 1 compound index |
| `backend/models/ForumLevel.js` | Add explicit unique index |
| `backend/models/Cosmetic.js` | Add compound index |
| `backend/cache/forumCache.js` | New file — cache module |
| `backend/routes/forum.js` | Fix 3 query bugs + apply cache to 3 route groups |
| `backend/package.json` | Add `node-cache` dependency |

## Out of Scope

- Frontend rendering optimization / virtualization
- Redis or any persistent cache
- MongoDB aggregation pipeline rewrites
- Any admin panel or shop UI changes (separate sub-projects)

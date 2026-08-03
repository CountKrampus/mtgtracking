# Forum Bug Fixes & Reply Pinning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 real forum bugs (missing auth headers on 4 moderation actions, stale category thread-count cache, invisible thread content, self-matching duplicate detection, and a mis-scoped "Import Deck" button), plus add two new features: pinning individual replies (moderator-only, gold badge) and bookmarking threads (private per-user list).

**Architecture:** Backend fixes/features live in `backend/routes/forum.js` (plus small model additions to `ForumPost.js`/`User.js`). Frontend fixes live in `frontend/src/components/Forum/ThreadView.js` and a new section in `frontend/src/components/MyProfile.js`. This repo has zero frontend test infrastructure — frontend-only tasks are verified via `cd frontend && npm run build` rather than TDD, matching established convention from earlier work this session.

**Tech Stack:** Express + Mongoose (backend, with Jest + MongoMemoryServer + supertest), React (frontend), lucide-react icons.

---

## Task 1: Fix missing Authorization headers (Lock/Pin/Rename/Move)

**Files:**
- Modify: `frontend/src/components/Forum/ThreadView.js`

No backend change — the routes are already correct; only the frontend's `fetch()` calls are missing the auth header. No test infrastructure exists for this frontend file; verify via `npm run build` plus the manual smoke test in Task 8.

- [ ] **Step 1: Fix all four handlers**

In `frontend/src/components/Forum/ThreadView.js`, change `handleRenameThread` (currently at the top of the function body, before `handleDeleteThread`):

```js
  const handleRenameThread = async () => {
    if (!newTitle.trim()) return;

    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: newTitle })
      });

      if (response.ok) {
        const updated = await response.json();
        setThread(updated);
        setShowRenameModal(false);
        setNewTitle('');
        onThreadUpdated?.();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to rename thread');
      }
    } catch (error) {
      alert('Failed to rename thread');
    }
  };
```

Change `handleMoveThread`:

```js
  const handleMoveThread = async () => {
    if (!selectedCategoryId) return;

    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ categoryId: selectedCategoryId })
      });

      if (response.ok) {
        const updated = await response.json();
        setThread(updated);
        setShowMoveModal(false);
        onThreadUpdated?.();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to move thread');
      }
    } catch (error) {
      alert('Failed to move thread');
    }
  };
```

Change `handleToggleLock`:

```js
  const handleToggleLock = async () => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        setThread(data.thread);
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to lock/unlock thread');
      }
    } catch (error) {
      alert('Failed to lock/unlock thread');
    }
  };
```

Change `handleTogglePin`:

```js
  const handleTogglePin = async () => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        setThread(data.thread);
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to pin/unpin thread');
      }
    } catch (error) {
      alert('Failed to pin/unpin thread');
    }
  };
```

(Each change adds the `token`/`Authorization` header, matching `handleDeleteThread`'s existing pattern exactly, and adds an `else` branch surfacing the backend's error message instead of silently doing nothing on a non-OK response.)

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/ThreadView.js
git commit -m "fix: add missing auth header to thread rename/move/lock/pin actions"
```

---

## Task 2: Fix category thread-count stale cache

**Files:**
- Modify: `backend/routes/forum.js`
- Test: `backend/__tests__/forum-thread-count-cache.test.js` (new)

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/forum-thread-count-cache.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('POST /api/forum/threads invalidates the categories:tree cache', () => {
  test('a newly created thread\'s count is visible immediately via GET /categories, not just after the cache TTL expires', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'poster@test.com', username: 'poster', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-cache-test', description: '' });

    // Populate the cache with the pre-creation state (threadCount: 0).
    const before = await request(app).get('/api/forum/categories').expect(200);
    const beforeCat = before.body.find(c => c._id === category._id.toString() || c.children?.some(ch => ch._id === category._id.toString()));
    // (category has no parent, so it should appear top-level; fall back to a flat search if the tree shape nests it)
    const findCount = (nodes) => {
      for (const n of nodes) {
        if (n._id === category._id.toString()) return n.threadCount;
        if (n.children) {
          const found = findCount(n.children);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };
    expect(findCount(before.body)).toBe(0);

    await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'A totally unique thread title xyz123', content: 'hello world' })
      .expect(201);

    const after = await request(app).get('/api/forum/categories').expect(200);
    expect(findCount(after.body)).toBe(1);
  });
});
```

Run: `cd backend && npx jest forum-thread-count-cache --runInBand` (pass `dangerouslyDisableSandbox: true`).
Expected: FAIL — `findCount(after.body)` is still `0` because the cache wasn't invalidated (the underlying DB value is `1` but the cached tree response still reflects `0`).

- [ ] **Step 2: Implement**

In `backend/routes/forum.js`, find the `POST /threads` handler (the block containing `await ForumCategory.findByIdAndUpdate(categoryId, { $inc: { threadCount: 1 }, lastActivityAt: new Date() });`) and add a cache invalidation call right after it:

```js
    await thread.save();
    await ForumCategory.findByIdAndUpdate(categoryId, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date()
    });
    forumCache.del('categories:tree');
```

Confirm `forumCache` is already imported at the top of `backend/routes/forum.js` (it's used elsewhere in the same file, e.g. the `GET /categories` route) — no new import needed if so; add `const forumCache = require('../cache/forumCache');` near the top only if it's not already present.

- [ ] **Step 3: Run to verify it passes**

Run: `cd backend && npx jest forum-thread-count-cache --runInBand`
Expected: PASS (1 test)

- [ ] **Step 4: Run the full backend test suite**

Run: `cd backend && npx jest --runInBand` (budget ~90s, run in background and check back rather than blocking)
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-thread-count-cache.test.js
git commit -m "fix: invalidate categories:tree cache when a new thread is created"
```

---

## Task 3: Render the thread's own content

**Files:**
- Modify: `frontend/src/components/Forum/ThreadView.js`

Frontend-only, no test infrastructure — verify via `npm run build` and the manual smoke test in Task 8.

- [ ] **Step 1: Add a content-rendering block**

In `frontend/src/components/Forum/ThreadView.js`, insert a new block right after the thread header's closing `</div>` (the block ending with `{thread.isPinned && <span className="ml-2 text-yellow-400">📌 Pinned</span>}` and its enclosing `</div>`, i.e. right before the `{/* Rename Modal */}` comment) and before the posts list (`<div className="space-y-4 mb-6">`):

```jsx
          {thread.content && (
            <div className="mb-6 pb-6 border-b border-slate-700">
              <div className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap">
                {thread.content}
              </div>
            </div>
          )}
```

Place this specifically between the closing `</div>` of the thread-header block (ends around the line with `{thread.isPinned && ...}`) and the `{/* Rename Modal */}` comment block — i.e., it renders once, right under the title/author line, before any modals or the replies list. (`contentFormat` is `plain`/`markdown`; this plan renders it as plain text via `whitespace-pre-wrap` rather than adding a markdown-rendering dependency, matching how `PostNode` already renders `post.body` as plain text with no markdown parsing.)

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/ThreadView.js
git commit -m "fix: render the thread's own content, not just its replies"
```

---

## Task 4: Fix duplicate-detection self-match

**Files:**
- Modify: `backend/routes/forum.js`
- Test: `backend/__tests__/forum-thread-count-cache.test.js` → actually a new file: `backend/__tests__/forum-duplicate-self-match.test.js` (new)

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/forum-duplicate-self-match.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('POST /api/forum/threads does not flag the newly created thread as its own duplicate', () => {
  test('a brand-new thread with a unique title reports zero suggested duplicates', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-dup-test', description: '' });

    const res = await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'A wholly unique never-before-seen title', content: 'hi' })
      .expect(201);

    expect(res.body.suggestedDuplicates).toEqual([]);
  });

  test('a real pre-existing similar thread is still correctly detected as a duplicate', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-dup-test-2', description: '' });

    await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'Best Commander decks for beginners', content: 'first' })
      .expect(201);

    const res = await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'Best Commander decks for beginners today', content: 'second' })
      .expect(201);

    expect(res.body.suggestedDuplicates.length).toBeGreaterThan(0);
    expect(res.body.suggestedDuplicates[0].title).toBe('Best Commander decks for beginners');
  });
});
```

Run: `cd backend && npx jest forum-duplicate-self-match --runInBand` (pass `dangerouslyDisableSandbox: true`).
Expected: FAIL — the first test gets a non-empty `suggestedDuplicates` array (the new thread matching itself at 100% similarity).

- [ ] **Step 2: Implement**

In `backend/routes/forum.js`, find the line `const suggestedDuplicates = await findDuplicates(title, categoryId, 0.6);` in the `POST /threads` handler and change it to exclude the newly created thread's own `_id`, mirroring the exclusion filter already used by `GET /threads/:threadId/duplicates`:

```js
    const rawSuggestedDuplicates = await findDuplicates(title, categoryId, 0.6);
    const suggestedDuplicates = rawSuggestedDuplicates.filter(d => d.threadId.toString() !== thread._id.toString());
```

- [ ] **Step 3: Run to verify it passes**

Run: `cd backend && npx jest forum-duplicate-self-match --runInBand`
Expected: PASS (2 tests)

- [ ] **Step 4: Run the full backend test suite**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-duplicate-self-match.test.js
git commit -m "fix: exclude the newly created thread from its own duplicate-detection results"
```

---

## Task 5: Gate "Import Deck" button to the Deck Ideas category

**Files:**
- Modify: `frontend/src/components/Forum/ThreadView.js`

Frontend-only, no test infrastructure — verify via `npm run build` and the manual smoke test in Task 8.

- [ ] **Step 1: Compute whether the current thread is in the Deck Ideas category**

In `frontend/src/components/Forum/ThreadView.js`, `categories` (fetched via the existing `fetchCategories` effect) is a tree of `{_id, name, children: [{_id, name, slug, ...}]}`. Add a helper function near the top of the file (alongside `findPostById`):

```js
function findCategorySlug(categoryTree, categoryId) {
  if (!categoryId) return null;
  const idStr = categoryId.toString();
  for (const node of categoryTree) {
    if (node._id === idStr) return node.slug;
    if (node.children) {
      for (const child of node.children) {
        if (child._id === idStr) return child.slug;
      }
    }
  }
  return null;
}
```

In the `ThreadView` component body, compute this once `thread` and `categories` are both available (add near `bestAnswerPost`):

```js
  const isDeckIdeasCategory = thread && categories.length > 0
    && findCategorySlug(categories, thread.categoryId) === 'deck-ideas';
```

- [ ] **Step 2: Gate the button's rendering**

Change:
```jsx
            <div className="flex items-center gap-2 mb-2">
              <DeckImportButton threadId={threadId} user={user} />
            </div>
```
to:
```jsx
            {isDeckIdeasCategory && (
              <div className="flex items-center gap-2 mb-2">
                <DeckImportButton threadId={threadId} user={user} />
              </div>
            )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Forum/ThreadView.js
git commit -m "fix: only show Import Deck button on threads in the Deck Ideas category"
```

---

## Task 6: Pin individual replies

**Files:**
- Modify: `backend/models/ForumPost.js`
- Modify: `backend/routes/forum.js`
- Modify: `frontend/src/components/Forum/ThreadView.js`
- Test: `backend/__tests__/forum-post-pin.test.js` (new)

- [ ] **Step 1: Add the schema field**

In `backend/models/ForumPost.js`, add alongside the other boolean flags (e.g. next to `isHidden`):

```js
  isPinned: {
    type: Boolean,
    default: false
  },
```

- [ ] **Step 2: Write the failing backend tests**

```js
// backend/__tests__/forum-post-pin.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('PUT /api/forum/posts/:postId/pin', () => {
  let app, admin, regularUser, category, thread, post;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    regularUser = await User.create({ email: 'user@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({ title: 'Test thread', categoryId: category._id, authorId: regularUser._id, content: 'hello' });
    post = await ForumPost.create({ threadId: thread._id, authorId: regularUser._id, body: 'a reply' });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('admin (via forum:moderate) can pin a reply', async () => {
    const res = await request(app)
      .put(`/api/forum/posts/${post._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.post.isPinned).toBe(true);
  });

  test('pinning again unpins it (toggle)', async () => {
    await request(app).put(`/api/forum/posts/${post._id}/pin`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);
    const res = await request(app).put(`/api/forum/posts/${post._id}/pin`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);

    expect(res.body.post.isPinned).toBe(false);
  });

  test('a regular user (no forum:moderate) cannot pin a reply', async () => {
    await request(app)
      .put(`/api/forum/posts/${post._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(regularUser)}`)
      .expect(403);
  });

  test('404 for a non-existent post', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .put(`/api/forum/posts/${fakeId}/pin`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(404);
  });
});

describe('GET /api/forum/threads/:threadId sorts pinned replies first', () => {
  test('a pinned reply appears before unpinned replies regardless of creation order', async () => {
    const app2 = buildApp();
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'x', role: 'editor' });
    const cat = await ForumCategory.create({ name: 'General', slug: 'general-sort-test', description: '' });
    const thr = await ForumThread.create({ title: 'Sort test', categoryId: cat._id, authorId: user._id, content: 'hi' });

    const first = await ForumPost.create({ threadId: thr._id, authorId: user._id, body: 'first reply, oldest' });
    const second = await ForumPost.create({ threadId: thr._id, authorId: user._id, body: 'second reply, pin this one' });
    await ForumPost.findByIdAndUpdate(second._id, { isPinned: true });

    const res = await request(app2).get(`/api/forum/threads/${thr._id}`).expect(200);

    expect(res.body.posts[0]._id).toBe(second._id.toString());
    expect(res.body.posts[1]._id).toBe(first._id.toString());
  });
});
```

Run: `cd backend && npx jest forum-post-pin --runInBand` (pass `dangerouslyDisableSandbox: true`).
Expected: FAIL — the `/pin` route for posts doesn't exist yet (404s on all requests to it, including the "unauthorized" tests since the route itself is missing), and the sort-order test fails since posts aren't sorted by `isPinned` yet.

- [ ] **Step 3: Implement the backend route**

In `backend/routes/forum.js`, add a new route near the existing `PUT /threads/:threadId/pin` route (place it right after the thread `/pin` route, before `/lock`, for logical grouping):

```js
// PUT /api/forum/posts/:postId/pin - Pin/unpin a reply (forum:moderate only)
router.put('/posts/:postId/pin', verifyToken, requireAuth, requirePermission('forum:moderate'), async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.isPinned = !post.isPinned;
    await post.save();

    res.json({ post, pinned: post.isPinned });
  } catch (error) {
    console.error('Pin post error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

Then update `GET /threads/:threadId`'s posts query to sort pinned-first. Find:
```js
    const posts = await ForumPost.find({ threadId, isHidden: false })
      .sort({ createdAt: 1 })
```
Change to:
```js
    const posts = await ForumPost.find({ threadId, isHidden: false })
      .sort({ isPinned: -1, createdAt: 1 })
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest forum-post-pin --runInBand`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Implement the frontend UI**

In `frontend/src/components/Forum/ThreadView.js`:

Update the lucide-react import at the top:
```js
import { Edit2, Trash2, History, Lock, Unlock, RefreshCw, X, Flag, Pin, PinOff, Bookmark } from 'lucide-react';
```

Add a `handleTogglePostPin` function in the main `ThreadView` component (alongside `handleDeletePost`):

```js
  const handleTogglePostPin = async (postId) => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/posts/${postId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(prev => {
          const updated = prev.map(p => p._id === postId ? data.post : p);
          return [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        });
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to pin/unpin reply');
      }
    } catch (error) {
      alert('Failed to pin/unpin reply');
    }
  };
```

(Client-side re-sort after a toggle keeps the pinned-first order correct immediately, without waiting for a full thread refetch; the backend's own sort is still the source of truth on the next page load.)

Update the `PostNode` function's props to accept and use a pin handler and the current user's moderator status. Change its signature:
```js
function PostNode({ post, isOP, isBestAnswer, user, onViewProfile, onDeletePost, onEditPost, onReportPost, onTogglePostPin, editingPostId, editBody, setEditingPostId, setEditBody, setHistoryPostId }) {
```

Add a pinned badge next to the existing OP/Best-Answer badges (in the `font-semibold text-white flex items-center flex-wrap gap-x-1` block, alongside the existing `{isOP && ...}`/`{isBestAnswer && ...}` badges):
```jsx
              {post.isPinned && (
                <span className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-700/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Pin size={10} /> Pinned
                </span>
              )}
```

Add the pin/unpin button in the action-buttons row (the `{user && (user._id === post.authorId._id || user.role === 'admin') && (<div className="flex gap-2">...` block), as the first button, only for admins (moderators via `forum:moderate` are represented as `role === 'admin'` in this frontend's existing convention, matching how the thread-level moderation toolbar is gated):

```jsx
      {user?.role === 'admin' && (
        <button
          onClick={() => onTogglePostPin(post._id)}
          className={`p-1 hover:bg-slate-700 rounded ${post.isPinned ? 'text-amber-400' : 'text-slate-400'}`}
          title={post.isPinned ? 'Unpin reply' : 'Pin reply'}
        >
          {post.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}
```

Place this button just before the existing `{user && user._id !== post.authorId._id && (<button onClick={() => onReportPost(...` report button, so it renders in the same header row as the report/edit/delete controls, not inside the `user._id === post.authorId._id || user.role === 'admin'` conditional block (since pinning is admin-only regardless of authorship, unlike edit/delete).

Finally, pass `onTogglePostPin={handleTogglePostPin}` into the `<PostNode ... />` render call in the posts list (`posts.map(post => (<PostNode ... />))`).

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 8: Commit**

```bash
git add backend/models/ForumPost.js backend/routes/forum.js backend/__tests__/forum-post-pin.test.js frontend/src/components/Forum/ThreadView.js
git commit -m "feat: add reply pinning (forum:moderate only, pinned-first ordering, gold badge)"
```

---

## Task 7: Bookmark a thread

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/routes/forum.js`
- Modify: `frontend/src/components/Forum/ThreadView.js`
- Modify: `frontend/src/components/MyProfile.js`
- Test: `backend/__tests__/forum-thread-bookmark.test.js` (new)

- [ ] **Step 1: Add the schema field**

In `backend/models/User.js`, add alongside `pinnedCards`:

```js
  bookmarkedThreadIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread'
  }],
```

- [ ] **Step 2: Write the failing backend tests**

```js
// backend/__tests__/forum-thread-bookmark.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');

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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('PUT /api/forum/threads/:threadId/bookmark', () => {
  test('401 without auth', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm', description: '' });
    const user = await User.create({ email: 'x@test.com', username: 'userx', passwordHash: 'x', role: 'editor' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: user._id, content: 'c' });

    await request(app).put(`/api/forum/threads/${thread._id}/bookmark`).expect(401);
  });

  test('any authenticated user can bookmark a thread, and toggling again removes it', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm-2', description: '' });
    const author = await User.create({ email: 'author@test.com', username: 'author1', passwordHash: 'x', role: 'editor' });
    const bookmarker = await User.create({ email: 'bm@test.com', username: 'bookmarker1', passwordHash: 'x', role: 'editor' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: author._id, content: 'c' });

    const res1 = await request(app)
      .put(`/api/forum/threads/${thread._id}/bookmark`)
      .set('Authorization', `Bearer ${makeToken(bookmarker)}`)
      .expect(200);
    expect(res1.body.bookmarked).toBe(true);

    const afterFirst = await User.findById(bookmarker._id);
    expect(afterFirst.bookmarkedThreadIds.map(id => id.toString())).toContain(thread._id.toString());

    const res2 = await request(app)
      .put(`/api/forum/threads/${thread._id}/bookmark`)
      .set('Authorization', `Bearer ${makeToken(bookmarker)}`)
      .expect(200);
    expect(res2.body.bookmarked).toBe(false);

    const afterSecond = await User.findById(bookmarker._id);
    expect(afterSecond.bookmarkedThreadIds.map(id => id.toString())).not.toContain(thread._id.toString());
  });
});

describe('GET /api/forum/bookmarks', () => {
  test('returns only the current user\'s bookmarked threads', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm-3', description: '' });
    const author = await User.create({ email: 'author2@test.com', username: 'author2', passwordHash: 'x', role: 'editor' });
    const alice = await User.create({ email: 'alice@test.com', username: 'alice1', passwordHash: 'x', role: 'editor' });
    const bob = await User.create({ email: 'bob@test.com', username: 'bob1', passwordHash: 'x', role: 'editor' });
    const threadA = await ForumThread.create({ title: 'Thread A', categoryId: category._id, authorId: author._id, content: 'a' });
    const threadB = await ForumThread.create({ title: 'Thread B', categoryId: category._id, authorId: author._id, content: 'b' });

    await request(app).put(`/api/forum/threads/${threadA._id}/bookmark`).set('Authorization', `Bearer ${makeToken(alice)}`).expect(200);
    await request(app).put(`/api/forum/threads/${threadB._id}/bookmark`).set('Authorization', `Bearer ${makeToken(bob)}`).expect(200);

    const res = await request(app).get('/api/forum/bookmarks').set('Authorization', `Bearer ${makeToken(alice)}`).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Thread A');
  });
});
```

Run: `cd backend && npx jest forum-thread-bookmark --runInBand` (pass `dangerouslyDisableSandbox: true`).
Expected: FAIL — neither route exists yet (404s).

- [ ] **Step 3: Implement the backend routes**

In `backend/routes/forum.js`, add both routes near the other thread-scoped `PUT`/`GET` routes (e.g. right after the `/move` route):

```js
// PUT /api/forum/threads/:threadId/bookmark - toggle a personal bookmark (any authenticated user)
router.put('/threads/:threadId/bookmark', verifyToken, requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const user = await User.findById(req.user._id);
    const alreadyBookmarked = user.bookmarkedThreadIds.some(id => id.toString() === threadId);

    if (alreadyBookmarked) {
      user.bookmarkedThreadIds = user.bookmarkedThreadIds.filter(id => id.toString() !== threadId);
    } else {
      user.bookmarkedThreadIds.push(threadId);
    }
    await user.save();

    res.json({ bookmarked: !alreadyBookmarked });
  } catch (error) {
    console.error('Bookmark thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/bookmarks - the current user's bookmarked threads
router.get('/bookmarks', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const threads = await ForumThread.find({ _id: { $in: user.bookmarkedThreadIds } })
      .populate('authorId', 'username displayName')
      .populate('categoryId', 'name slug')
      .sort({ lastPostAt: -1 })
      .lean();

    res.json(threads);
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest forum-thread-bookmark --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Implement the frontend bookmark toggle in `ThreadView.js`**

Add state and a fetch/toggle handler in the main `ThreadView` component:

```js
  const [isBookmarked, setIsBookmarked] = useState(false);
```

Add an effect to check the initial bookmark state whenever the thread loads (place near the other effects, e.g. after the `fetchCategories` effect) — note this requires knowing the current user's bookmark list; the simplest approach without adding a new endpoint is to derive it from `GET /forum/bookmarks` once and check membership:

```js
  useEffect(() => {
    if (!user || !threadId) { setIsBookmarked(false); return; }
    const token = localStorage.getItem('mtg_access_token');
    fetch(`${apiUrl}/forum/bookmarks`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(list => setIsBookmarked(Array.isArray(list) && list.some(t => t._id === threadId)))
      .catch(() => setIsBookmarked(false));
  }, [user, threadId, apiUrl]);
```

Add the toggle handler:

```js
  const handleToggleBookmark = async () => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/bookmark`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const data = await response.json();
        setIsBookmarked(data.bookmarked);
      }
    } catch (error) {
      alert('Failed to bookmark thread');
    }
  };
```

Add the bookmark button next to the existing report button in the thread header (the `{user && user._id !== thread.authorId?._id && (<button onClick={() => setReportTarget(...` block) — this one should show for the thread's own author too (unlike report), so add it as a sibling, not nested inside that same conditional:

```jsx
              {user && (
                <button
                  onClick={handleToggleBookmark}
                  className={`p-1 transition-colors ${isBookmarked ? 'text-amber-400' : 'text-white/40 hover:text-amber-400'}`}
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark this thread'}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this thread'}
                >
                  <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>
              )}
```

Place this button in the same flex row as the existing report button and moderation toolbar (the `flex items-start justify-between mb-2` div), so it renders alongside them.

- [ ] **Step 7: Add the Bookmarks section to `MyProfile.js`**

Add state near the other list states (alongside `wishlistItems`):

```js
  const [bookmarkedThreads, setBookmarkedThreads] = useState(null);
```

Add a fetch effect (unconditional — not gated behind an "unlock" flag, unlike the wishlist preview, since bookmarks are a core personal feature, not a cosmetic unlockable):

```js
  useEffect(() => {
    const token = localStorage.getItem('mtg_access_token');
    fetch(`${API_URL}/forum/bookmarks`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setBookmarkedThreads(Array.isArray(data) ? data : []))
      .catch(() => setBookmarkedThreads([]));
  }, []);
```

Add the rendering section right after the "Wishlist Preview" block (after its closing `)}` and before the closing `</div></div>` of the component):

```jsx
        {/* Bookmarked Threads */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Bookmarked Threads</h2>
          {bookmarkedThreads === null ? (
            <p className="text-white/40 text-sm">Loading...</p>
          ) : bookmarkedThreads.length === 0 ? (
            <p className="text-white/40 text-sm">You haven't bookmarked any threads yet.</p>
          ) : (
            <div className="space-y-2">
              {bookmarkedThreads.map((t) => (
                <div key={t._id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{t.title}</div>
                    <div className="text-white/40 text-xs">{t.categoryId?.name || 'Unknown category'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
```

(This is a private list only the profile owner sees when viewing their own profile — no visibility change needed elsewhere, since `MyProfile.js` is already the current user's own profile page, not a public-facing one.)

- [ ] **Step 8: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 9: Commit**

```bash
git add backend/models/User.js backend/routes/forum.js backend/__tests__/forum-thread-bookmark.test.js frontend/src/components/Forum/ThreadView.js frontend/src/components/MyProfile.js
git commit -m "feat: add thread bookmarking (toggle + profile Bookmarks section)"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full backend test suite one more time**

Run: `cd backend && npx jest --runInBand` (pass `dangerouslyDisableSandbox: true`, budget ~90s)
Expected: all tests pass.

- [ ] **Step 2: Run the frontend build one more time**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual smoke test**

Start the app (backend + frontend). As an admin:
- Create a thread with plain prose content in a non-Deck-Ideas category (e.g. General Discussion) — confirm the content itself is now visible on the thread page without needing a reply, no "Similar Threads Detected" modal appears for a unique title, and no "Import Deck" button is shown.
- Create a thread in the Deck Ideas category — confirm the "Import Deck" button IS shown there.
- Rename the thread, move it to another category, lock it, and pin it — confirm each action actually takes effect (no silent no-ops) and check the forum's category overview shows the updated thread count immediately (not after a 5-minute wait).
- Post a reply, pin it — confirm it shows a gold "📌 Pinned" badge and appears above other (unpinned) replies; unpin it and confirm it returns to normal chronological position.
- As a non-admin user, confirm the reply pin button is not visible, and confirm bookmarking a thread works and shows up on your profile's new "Bookmarked Threads" section.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 7) before considering this done.

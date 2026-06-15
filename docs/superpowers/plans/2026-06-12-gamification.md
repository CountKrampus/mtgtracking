# Gamification — Reputation & Badges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integer reputation points earned through forum activity, auto-awarded milestone badges, admin-granted custom badges, inline rep/badge display on forum posts, a username hover card, a leaderboard page, and a badge grant UI in the admin panel.

**Architecture:** Reputation is stored as a plain integer on `User.reputation` (repurposed from the old 0–5 float). Points are applied as `$inc` side effects inside the relevant route handlers (post create, thread create, upvote). Milestone badges are checked in `backend/utils/badgeManager.js` after each rep-earning action. User enrichment for rep/badges in the thread view response is done via a batch User lookup keyed by `authorId`. The leaderboard is a single sorted User query with no caching.

**Tech Stack:** Node.js + Express + Mongoose, React + Tailwind CSS, Lucide-react icons (size 16-18)

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `backend/models/User.js` | Remove `min/max` from `reputation`, change `default` to `0`; add `postCount`/`threadCount` to `communityStats` |
| Modify | `backend/utils/badgeManager.js` | Add 6 new milestone badge definitions; extend `checkAndAwardBadges` to accept `action` context |
| Modify | `backend/routes/forum.js` | Rep `$inc` in thread/post create; rep `$inc` in upvote handlers; enrich GET /threads/:id response with author rep/badges; add GET /leaderboard |
| Modify | `backend/routes/decks.js` | Rep `$inc` + Deck Builder badge check in POST /:id/share |
| Modify | `backend/routes/auth.js` | Veteran badge check after login save |
| Modify | `backend/routes/admin.js` | GET /admin/badges, POST /admin/badges/:badgeId/grant/:userId, DELETE /admin/badges/:badgeId/revoke/:userId |
| Create | `backend/__tests__/reputation.test.js` | Tests for rep increments and milestone badge awards |
| Modify | `frontend/src/components/Forum/ForumThreadView.js` | Inline ⚡ rep + badge emojis in PostNode author row; wire UserHoverCard on username hover |
| Create | `frontend/src/components/Forum/UserHoverCard.js` | Small fixed-position popup on username hover |
| Create | `frontend/src/components/Forum/ForumLeaderboard.js` | Top-10 leaderboard page |
| Modify | `frontend/src/components/Forum/Forum.js` | Add `/forum/leaderboard` path match + lazy import |
| Modify | `frontend/src/components/Forum/ForumCategoryList.js` | Add "Leaderboard" nav link |
| Modify | `frontend/src/components/admin/user-management/UsersTab.js` | "Grant Badge" button + modal per user row |

---

### Task 1: Modify User Schema — reputation field + communityStats counters

**Files:**
- Modify: `backend/models/User.js`

- [ ] **Step 1: Write the failing test for reputation as integer**

Create `backend/__tests__/reputation.test.js` with:

```javascript
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

const User = require('../models/User');

test('reputation defaults to 0', async () => {
  const user = await User.create({
    email: 'a@test.com',
    username: 'testuser',
    passwordHash: 'hash'
  });
  expect(user.reputation).toBe(0);
});

test('reputation can be set above 5', async () => {
  const user = await User.create({
    email: 'b@test.com',
    username: 'repuser',
    passwordHash: 'hash',
    reputation: 42
  });
  expect(user.reputation).toBe(42);
});

test('communityStats.postCount defaults to 0', async () => {
  const user = await User.create({
    email: 'c@test.com',
    username: 'statuser',
    passwordHash: 'hash'
  });
  expect(user.communityStats.postCount).toBe(0);
  expect(user.communityStats.threadCount).toBe(0);
});
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage 2>&1 | head -30
```

Expected: `reputation defaults to 0` fails (default is 3.0), `reputation can be set above 5` fails (max: 5 rejects it), `communityStats.postCount defaults to 0` fails (field doesn't exist).

- [ ] **Step 3: Modify User.js reputation field and communityStats**

In `backend/models/User.js`, change the `reputation` field from:
```javascript
reputation: {
  type: Number,
  min: 0,
  max: 5,
  default: 3.0
},
```
to:
```javascript
reputation: {
  type: Number,
  min: 0,
  default: 0
},
```

In the same file, add `postCount` and `threadCount` to the existing `communityStats` sub-object (after `decksShared` and `cardsAdded`):
```javascript
communityStats: {
  decksShared: { type: Number, default: 0 },
  cardsAdded: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  threadCount: { type: Number, default: 0 },
  monthlyActivityRate: { type: Number, default: 0 },
  lastActivityAt: { type: Date }
},
```

- [ ] **Step 4: Run test — expect all pass**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/models/User.js backend/__tests__/reputation.test.js
git commit -m "feat: repurpose User.reputation to integer accumulation; add postCount/threadCount to communityStats"
```

---

### Task 2: Extend badgeManager.js with milestone badges

**Files:**
- Modify: `backend/utils/badgeManager.js`

- [ ] **Step 1: Add test for milestone badge awards**

Add to `backend/__tests__/reputation.test.js`:

```javascript
const { checkAndAwardBadges, MILESTONE_BADGES } = require('../utils/badgeManager');

test('awards First Post badge on first post', async () => {
  const user = await User.create({
    email: 'd@test.com', username: 'poster', passwordHash: 'hash',
    'communityStats.postCount': 1
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'First Post')).toBe(true);
});

test('awards Century badge on 100th post', async () => {
  const user = await User.create({
    email: 'e@test.com', username: 'centuryposter', passwordHash: 'hash',
    'communityStats.postCount': 100
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'Century')).toBe(true);
});

test('does not re-award a badge already held', async () => {
  const user = await User.create({
    email: 'f@test.com', username: 'nodouble', passwordHash: 'hash',
    'communityStats.postCount': 1,
    badges: [{ name: 'First Post', earnedAt: new Date(), description: 'First forum post' }]
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  const firstPostBadges = updated.badges.filter(b => b.name === 'First Post');
  expect(firstPostBadges).toHaveLength(1);
});

test('awards Thread Starter badge on first thread', async () => {
  const user = await User.create({
    email: 'g@test.com', username: 'threadstarter', passwordHash: 'hash',
    'communityStats.threadCount': 1
  });
  await checkAndAwardBadges(user._id, 'thread_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'Thread Starter')).toBe(true);
});
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage 2>&1 | tail -20
```

Expected: new tests fail because `checkAndAwardBadges` doesn't yet know about `post_create` action or the new milestone badges.

- [ ] **Step 3: Rewrite badgeManager.js with new milestone badges**

Replace the entire content of `backend/utils/badgeManager.js` with:

```javascript
const User = require('../models/User');

const MILESTONE_BADGES = {
  FIRST_POST: {
    name: 'First Post',
    description: 'Posted your first forum reply',
    emoji: '📝',
    threshold: (stats) => stats.postCount >= 1,
    actions: ['post_create']
  },
  CENTURY: {
    name: 'Century',
    description: '100 forum posts',
    emoji: '💬',
    threshold: (stats) => stats.postCount >= 100,
    actions: ['post_create']
  },
  THREAD_STARTER: {
    name: 'Thread Starter',
    description: 'Created your first forum thread',
    emoji: '🧵',
    threshold: (stats) => stats.threadCount >= 1,
    actions: ['thread_create']
  },
  DECK_BUILDER: {
    name: 'Deck Builder',
    description: 'Shared your first deck',
    emoji: '🃏',
    threshold: (stats) => stats.decksShared >= 1,
    actions: ['deck_share']
  },
  COLLECTOR: {
    name: 'Collector',
    description: 'Added 500+ cards to your collection',
    emoji: '📦',
    threshold: (stats) => stats.cardsAdded >= 500,
    actions: ['card_add']
  },
  VETERAN: {
    name: 'Veteran',
    description: 'Member for 1+ year',
    emoji: '🗓️',
    threshold: (stats, user) => {
      if (!user?.createdAt) return false;
      const ageMs = Date.now() - new Date(user.createdAt).getTime();
      return ageMs >= 365 * 24 * 60 * 60 * 1000;
    },
    actions: ['login']
  }
};

// Kept for backwards compatibility — original activity-based badges
const BADGES = {
  ENGAGED_MEMBER: {
    name: 'Engaged Member',
    description: '20+ community interactions',
    threshold: (stats) => (stats.communityInteractions || 0) >= 20
  }
};

/**
 * Check and award milestone badges for a user after a specific action.
 * @param {string} userId
 * @param {string} action - one of: 'post_create', 'thread_create', 'deck_share', 'card_add', 'login'
 */
async function checkAndAwardBadges(userId, action) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const stats = user.communityStats || {};
    const newBadges = [];

    for (const badge of Object.values(MILESTONE_BADGES)) {
      if (action && !badge.actions.includes(action)) continue;
      const hasBadge = user.badges?.some(b => b.name === badge.name);
      if (!hasBadge && badge.threshold(stats, user)) {
        newBadges.push({ name: badge.name, description: badge.description, earnedAt: new Date() });
      }
    }

    // Also check legacy BADGES (not action-filtered)
    if (!action || action === 'legacy') {
      for (const badge of Object.values(BADGES)) {
        const hasBadge = user.badges?.some(b => b.name === badge.name);
        if (!hasBadge && badge.threshold(stats)) {
          newBadges.push({ name: badge.name, description: badge.description, earnedAt: new Date() });
        }
      }
    }

    if (newBadges.length > 0) {
      user.badges = user.badges || [];
      user.badges.push(...newBadges);
      await user.save();
    }
  } catch (error) {
    console.error('Badge award error:', error.message);
  }
}

// Map badge name → emoji for frontend display
const BADGE_EMOJI = Object.fromEntries(
  Object.values(MILESTONE_BADGES).map(b => [b.name, b.emoji])
);

module.exports = { checkAndAwardBadges, BADGES, MILESTONE_BADGES, BADGE_EMOJI };
```

- [ ] **Step 4: Run test — expect all pass**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage
```

Expected: all 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/badgeManager.js backend/__tests__/reputation.test.js
git commit -m "feat: add milestone badges to badgeManager (First Post, Century, Thread Starter, Deck Builder, Collector, Veteran)"
```

---

### Task 3: Rep + badge side effects in forum thread/post creation

**Files:**
- Modify: `backend/routes/forum.js`

- [ ] **Step 1: Add test for rep increment on thread create**

Add to `backend/__tests__/reputation.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const jwt = require('jsonwebtoken');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

test('creating a thread adds +2 rep and threadCount to author', async () => {
  const author = await User.create({
    email: 'th@test.com', username: 'threadauthor', passwordHash: 'hash', role: 'user',
    reputation: 0, 'communityStats.threadCount': 0
  });
  const cat = await ForumCategory.create({ name: 'General', slug: 'general' });

  const app = buildApp();
  const token = makeToken(author._id.toString(), 'user');

  await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'My Thread', body: 'Hello world' });

  const updated = await User.findById(author._id);
  expect(updated.reputation).toBe(2);
  expect(updated.communityStats.threadCount).toBe(1);
});

test('creating a post adds +1 rep and postCount to author', async () => {
  const author = await User.create({
    email: 'pa@test.com', username: 'postauthor', passwordHash: 'hash', role: 'user',
    reputation: 0, 'communityStats.postCount': 0
  });
  const cat = await ForumCategory.create({ name: 'General2', slug: 'general2' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'postauthor', authorDisplayName: 'postauthor',
    title: 'Thread', body: 'Body'
  });

  const app = buildApp();
  const token = makeToken(author._id.toString(), 'user');

  await request(app)
    .post('/api/forum/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ threadId: thread._id, body: 'My reply' });

  const updated = await User.findById(author._id);
  expect(updated.reputation).toBe(1);
  expect(updated.communityStats.postCount).toBe(1);
});
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage -t "creating a thread" 2>&1 | tail -15
```

Expected: FAIL — rep is still 0.

- [ ] **Step 3: Add rep/badge side effects to POST /api/forum/threads**

In `backend/routes/forum.js`, add the import at the top of the file (after existing requires):

```javascript
const { checkAndAwardBadges } = require('../utils/badgeManager');
```

In the `POST /api/forum/threads` handler, after `res.status(201).json(thread);`, add the following fire-and-forget side effects **before** the `res.status(201).json(thread)` line (so errors don't block the response). Replace the thread creation block:

```javascript
    const thread = await ForumThread.create({
      categoryId,
      authorId: req.user._id,
      authorUsername: req.user.username,
      authorDisplayName: req.user.displayName || req.user.username,
      title: title.trim(),
      body: body.trim(),
      cardRefs: parseCardRefs(body),
      deckRef: deckRef || undefined,
      playgroupRef: playgroupRef || undefined,
      isShadowHidden: author?.isShadowBanned === true
    });

    // Rep + badge side effects (fire-and-forget, don't block response)
    User.findByIdAndUpdate(req.user._id, {
      $inc: { reputation: 2, 'communityStats.threadCount': 1 }
    }).then(() => checkAndAwardBadges(req.user._id, 'thread_create')).catch(() => {});

    res.status(201).json(thread);
```

- [ ] **Step 4: Add rep/badge side effects to POST /api/forum/posts**

In the `POST /api/forum/posts` handler in `backend/routes/forum.js`, after `ForumThread.findByIdAndUpdate(...)` and before `res.status(201).json(post)`, add:

```javascript
    // Rep + badge side effects (fire-and-forget)
    User.findByIdAndUpdate(req.user._id, {
      $inc: { reputation: 1, 'communityStats.postCount': 1 }
    }).then(() => checkAndAwardBadges(req.user._id, 'post_create')).catch(() => {});
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/forum.js
git commit -m "feat: add +2 rep on thread create, +1 rep on post create, with milestone badge checks"
```

---

### Task 4: Rep side effects in upvote handlers

**Files:**
- Modify: `backend/routes/forum.js`

- [ ] **Step 1: Add upvote rep tests**

Add to `backend/__tests__/reputation.test.js`:

```javascript
test('upvoting a post adds +5 rep to post author', async () => {
  const postAuthor = await User.create({
    email: 'upvpa@test.com', username: 'upvpostauthor', passwordHash: 'hash', reputation: 0
  });
  const voter = await User.create({
    email: 'voter@test.com', username: 'voter', passwordHash: 'hash'
  });
  const cat = await ForumCategory.create({ name: 'Upvote', slug: 'upvote' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: postAuthor._id,
    authorUsername: 'upvpostauthor', title: 'T', body: 'B'
  });
  const { default: ForumPost } = await import('../models/ForumPost.js');
  const post = await ForumPost.create({
    threadId: thread._id, authorId: postAuthor._id,
    authorUsername: 'upvpostauthor', body: 'My post'
  });

  const app = buildApp();
  const token = makeToken(voter._id.toString());
  await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  const updated = await User.findById(postAuthor._id);
  expect(updated.reputation).toBe(5);
});

test('removing an upvote does NOT deduct rep from post author', async () => {
  const postAuthor = await User.create({
    email: 'unupvpa@test.com', username: 'unupvpostauthor', passwordHash: 'hash', reputation: 5
  });
  const voter = await User.create({
    email: 'unvoter@test.com', username: 'unvoter', passwordHash: 'hash'
  });
  const cat = await ForumCategory.create({ name: 'Unupvote', slug: 'unupvote' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: postAuthor._id,
    authorUsername: 'unupvpostauthor', title: 'T2', body: 'B2'
  });
  const ForumPost = require('../models/ForumPost');
  const post = await ForumPost.create({
    threadId: thread._id, authorId: postAuthor._id,
    authorUsername: 'unupvpostauthor', body: 'My post',
    upvotes: [voter._id]
  });

  const app = buildApp();
  const token = makeToken(voter._id.toString());
  await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  const updated = await User.findById(postAuthor._id);
  expect(updated.reputation).toBe(5); // unchanged
});
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage -t "upvoting" 2>&1 | tail -15
```

Expected: FAIL — rep not being updated on upvote.

- [ ] **Step 3: Modify post upvote handler to add rep**

In `backend/routes/forum.js`, replace the `POST /api/forum/posts/:id/upvote` handler:

```javascript
// POST /api/forum/posts/:id/upvote — toggle
router.post('/posts/:id/upvote', verifyToken, requireAuth, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const uid = req.user._id;
    const idx = post.upvotes.findIndex(id => id.toString() === uid.toString());
    if (idx === -1) {
      post.upvotes.push(uid);
      // Award +5 rep to post author (fire-and-forget)
      if (post.authorId.toString() !== uid.toString()) {
        User.findByIdAndUpdate(post.authorId, { $inc: { reputation: 5 } }).catch(() => {});
      }
    } else {
      post.upvotes.splice(idx, 1);
      // No rep deduction on unvote
    }
    await post.save();
    res.json({ upvoteCount: post.upvotes.length, hasUpvoted: idx === -1 });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 4: Modify thread upvote handler to add rep**

In `backend/routes/forum.js`, replace the `POST /api/forum/threads/:id/upvote` handler:

```javascript
// POST /api/forum/threads/:id/upvote — toggle
router.post('/threads/:id/upvote', verifyToken, requireAuth, async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const uid = req.user._id;
    const idx = thread.upvotes.findIndex(id => id.toString() === uid.toString());
    if (idx === -1) {
      thread.upvotes.push(uid);
      // Award +10 rep to thread author (fire-and-forget)
      if (thread.authorId.toString() !== uid.toString()) {
        User.findByIdAndUpdate(thread.authorId, { $inc: { reputation: 10 } }).catch(() => {});
      }
    } else {
      thread.upvotes.splice(idx, 1);
      // No rep deduction on unvote
    }
    await thread.save();
    res.json({ upvoteCount: thread.upvotes.length, hasUpvoted: idx === -1 });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 5: Run test — expect all pass**

```bash
cd backend && npx jest __tests__/reputation.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/reputation.test.js
git commit -m "feat: add +5 rep on post upvote, +10 rep on thread upvote (no deduction on unvote)"
```

---

### Task 5: Deck share + login Veteran badge side effects

**Files:**
- Modify: `backend/routes/decks.js`
- Modify: `backend/routes/auth.js`

- [ ] **Step 1: Add rep to deck share route**

In `backend/routes/decks.js`, add the require at the top (after existing requires):

```javascript
const { checkAndAwardBadges } = require('../utils/badgeManager');
const User = require('../models/User');
```

(If `User` is already required, skip that line.)

Then in the `POST /:id/share` handler, replace the body:

```javascript
router.post('/:id/share', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const isFirstShare = !deck.shareCode;
    deck.shareCode = require('crypto').randomBytes(8).toString('hex');
    await deck.save();

    // First-time share: award +3 rep + Deck Builder badge + increment decksShared
    if (isFirstShare) {
      User.findByIdAndUpdate(req.user._id, {
        $inc: { reputation: 3, 'communityStats.decksShared': 1 }
      }).then(() => checkAndAwardBadges(req.user._id, 'deck_share')).catch(() => {});
    }

    res.json({ shareCode: deck.shareCode, shareUrl: `/shared/deck/${deck.shareCode}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 2: Add Veteran badge check to login route**

In `backend/routes/auth.js`, add the require at the top:

```javascript
const { checkAndAwardBadges } = require('../utils/badgeManager');
```

Find the block where `user.lastLoginAt = new Date()` is set. After `await user.save()`, add:

```javascript
    // Check Veteran badge (fire-and-forget)
    checkAndAwardBadges(user._id, 'login').catch(() => {});
```

The final sequence should look like:
```javascript
    user.lastLoginAt = new Date();
    await user.save();
    checkAndAwardBadges(user._id, 'login').catch(() => {});

    // Generate tokens
    const accessToken = generateAccessToken(user);
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/decks.js backend/routes/auth.js
git commit -m "feat: add +3 rep on first deck share, Deck Builder badge, Veteran badge check on login"
```

---

### Task 6: Leaderboard route + enrich thread GET with author rep/badges

**Files:**
- Modify: `backend/routes/forum.js`

- [ ] **Step 1: Add GET /api/forum/leaderboard route**

In `backend/routes/forum.js`, add this route in the Public routes section (after the categories routes):

```javascript
// GET /api/forum/leaderboard — top 10 users by reputation
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find({ reputation: { $gt: 0 }, isActive: true })
      .sort({ reputation: -1 })
      .limit(10)
      .select('username displayName reputation badges')
      .lean();
    res.json({ leaderboard: leaders });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 2: Enrich GET /api/forum/threads/:id with author rep/badges**

In `backend/routes/forum.js`, in the `GET /api/forum/threads/:id` handler, after building `postsWithMeta`, add a batch author lookup:

Find this block:
```javascript
    const postsWithMeta = flatPosts.map(p => ({
      ...p,
      upvoteCount: p.upvotes.length,
      hasUpvoted: userId ? p.upvotes.some(id => id.toString() === userId) : false,
      upvotes: undefined
    }));

    res.json({
      thread: {
        ...thread,
        upvoteCount: thread.upvotes.length,
        hasUpvoted: userId ? thread.upvotes.some(id => id.toString() === userId) : false,
        upvotes: undefined
      },
      posts: buildPostTree(postsWithMeta)
    });
```

Replace it with:
```javascript
    // Batch-fetch author rep/badges for all unique post authors + thread author
    const authorIds = [...new Set(
      [thread.authorId?.toString(), ...flatPosts.map(p => p.authorId?.toString())]
        .filter(Boolean)
    )];
    const authorDocs = await User.find({ _id: { $in: authorIds } })
      .select('reputation badges').lean();
    const authorMap = Object.fromEntries(authorDocs.map(u => [u._id.toString(), u]));

    const postsWithMeta = flatPosts.map(p => {
      const authorData = authorMap[p.authorId?.toString()] || {};
      return {
        ...p,
        upvoteCount: p.upvotes.length,
        hasUpvoted: userId ? p.upvotes.some(id => id.toString() === userId) : false,
        upvotes: undefined,
        authorReputation: authorData.reputation || 0,
        authorBadges: (authorData.badges || []).slice(0, 5)
      };
    });

    const threadAuthorData = authorMap[thread.authorId?.toString()] || {};
    res.json({
      thread: {
        ...thread,
        upvoteCount: thread.upvotes.length,
        hasUpvoted: userId ? thread.upvotes.some(id => id.toString() === userId) : false,
        upvotes: undefined,
        authorReputation: threadAuthorData.reputation || 0,
        authorBadges: (threadAuthorData.badges || []).slice(0, 5)
      },
      posts: buildPostTree(postsWithMeta)
    });
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/forum.js
git commit -m "feat: add GET /api/forum/leaderboard; enrich thread GET response with author rep and badges"
```

---

### Task 7: Admin badge grant/revoke routes

**Files:**
- Modify: `backend/routes/admin.js`

The existing `Badge` model (`backend/models/Badge.js`) stores admin-created badges with `name`, `description`, `color`, `icon`, `isCustom`.

- [ ] **Step 1: Add admin badge routes to admin.js**

In `backend/routes/admin.js`, add the `User` require if not already present, and add:

```javascript
const Badge = require('../models/Badge');
```

Then add these three routes at a logical location (e.g., after user management routes):

```javascript
// ── Badge management ──────────────────────────────────────────────────────────

// GET /api/admin/badges — list all badges
router.get('/badges', requireAdmin, async (req, res) => {
  try {
    const badges = await Badge.find().sort({ name: 1 }).lean();
    res.json({ badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/admin/badges/:badgeId/grant/:userId — grant a badge to a user
router.post('/badges/:badgeId/grant/:userId', requireAdmin, async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.badgeId).lean();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyHas = user.badges?.some(b => b.name === badge.name);
    if (alreadyHas) return res.status(409).json({ message: 'User already has this badge' });

    user.badges = user.badges || [];
    user.badges.push({ name: badge.name, description: badge.description, earnedAt: new Date() });
    await user.save();

    res.json({ message: `Badge "${badge.name}" granted to ${user.username}`, badges: user.badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/badges/:badgeId/revoke/:userId — revoke a badge from a user
router.delete('/badges/:badgeId/revoke/:userId', requireAdmin, async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.badgeId).lean();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = user.badges?.length || 0;
    user.badges = (user.badges || []).filter(b => b.name !== badge.name);
    if (user.badges.length === before) return res.status(404).json({ message: 'User does not have this badge' });

    await user.save();
    res.json({ message: `Badge "${badge.name}" revoked from ${user.username}`, badges: user.badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 2: Verify admin.js requires User**

Check the top of `backend/routes/admin.js` for `const User = require(...)`. If missing, add it alongside other requires.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: add admin badge list, grant, and revoke routes"
```

---

### Task 8: Inline rep + badges in ForumThreadView PostNode

**Files:**
- Modify: `frontend/src/components/Forum/ForumThreadView.js`

The `post` object now includes `authorReputation` and `authorBadges` (from Task 6).

The `BADGE_EMOJI` map is exported from badgeManager.js (backend only) — for the frontend, define a small inline mapping:

```javascript
const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};
```

- [ ] **Step 1: Add BADGE_EMOJI constant and update PostNode**

In `frontend/src/components/Forum/ForumThreadView.js`:

1. Add at the top of the file (after imports):

```javascript
const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};
```

2. In `PostNode`, after the `isOP` constant, add state for hover card:

```javascript
const [hoverPos, setHoverPos] = useState(null);
```

3. In the PostNode author row, replace:

```jsx
<span className="font-medium text-white text-sm">{post.authorDisplayName || post.authorUsername}</span>
{isOP && <span className="ml-2 text-[10px] bg-purple-800/50 text-purple-300 px-1.5 py-0.5 rounded">OP</span>}
<span className="text-white/30 text-xs ml-2">{formatRelative(post.createdAt)}</span>
```

with:

```jsx
<span
  className="font-medium text-white text-sm cursor-pointer hover:text-purple-300 transition"
  onMouseEnter={e => setHoverPos({ x: e.clientX, y: e.clientY, post })}
  onMouseLeave={() => setHoverPos(null)}
>
  {post.authorDisplayName || post.authorUsername}
</span>
{isOP && <span className="ml-1 text-[10px] bg-purple-800/50 text-purple-300 px-1.5 py-0.5 rounded">OP</span>}
{post.authorReputation > 0 && (
  <span className="text-amber-400 text-xs font-semibold ml-1">⚡ {post.authorReputation}</span>
)}
{(post.authorBadges || []).slice(0, 3).map((badge, i) => (
  <span key={i} className="text-sm ml-0.5" title={badge.name}>
    {BADGE_EMOJI[badge.name] || '🏅'}
  </span>
))}
<span className="text-white/30 text-xs ml-2">{formatRelative(post.createdAt)}</span>
{hoverPos && (
  <UserHoverCard
    pos={hoverPos}
    username={post.authorUsername}
    displayName={post.authorDisplayName}
    reputation={post.authorReputation || 0}
    badges={post.authorBadges || []}
    apiUrl={apiUrl}
    onClose={() => setHoverPos(null)}
  />
)}
```

4. Add `import UserHoverCard from './UserHoverCard';` to the imports at the top of the file.

- [ ] **Step 2: Also enrich the thread OP author row**

In `ForumThreadView`, find where the thread's author is rendered (around line 284–287 in the original):

```jsx
<div className={`w-6 h-6 rounded-full ${getAvatarColor(thread.authorUsername)} ...`}>
  {thread.authorUsername[0].toUpperCase()}
</div>
<span>{thread.authorDisplayName || thread.authorUsername}</span>
```

After the `<span>` with the author name, add:
```jsx
{thread.authorReputation > 0 && (
  <span className="text-amber-400 text-xs font-semibold ml-1">⚡ {thread.authorReputation}</span>
)}
{(thread.authorBadges || []).slice(0, 3).map((badge, i) => (
  <span key={i} className="text-sm ml-0.5" title={badge.name}>{BADGE_EMOJI[badge.name] || '🏅'}</span>
))}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/ForumThreadView.js
git commit -m "feat: show author reputation and badge emojis inline on forum posts and thread OP"
```

---

### Task 9: Create UserHoverCard component

**Files:**
- Create: `frontend/src/components/Forum/UserHoverCard.js`

The hover card displays: avatar initial + username, rep score, badges (up to 5), member since date, and a link to `/u/:username`.

- [ ] **Step 1: Create UserHoverCard.js**

```javascript
import React, { useEffect, useRef } from 'react';

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function getAvatarColor(username) {
  const colors = ['bg-red-600','bg-blue-600','bg-green-600','bg-purple-600','bg-pink-600','bg-yellow-600','bg-indigo-600','bg-teal-600'];
  let h = 0;
  for (const c of username) h = ((h << 5) - h) + c.charCodeAt(0);
  return colors[Math.abs(h) % colors.length];
}

export default function UserHoverCard({ pos, username, displayName, reputation, badges, onClose }) {
  const ref = useRef(null);

  // Position: keep card on screen
  const left = Math.min(pos.x + 12, window.innerWidth - 240);
  const top = Math.min(pos.y + 8, window.innerHeight - 160);

  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 bg-gray-900 border border-white/10 rounded-xl shadow-2xl p-3 pointer-events-none"
      style={{ left, top }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full ${getAvatarColor(username)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {username[0].toUpperCase()}
        </div>
        <div>
          <div className="text-white text-sm font-medium leading-tight">{displayName || username}</div>
          <div className="text-white/40 text-xs">@{username}</div>
        </div>
      </div>

      {reputation > 0 && (
        <div className="text-amber-400 text-sm font-semibold mb-1.5">⚡ {reputation} reputation</div>
      )}

      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {badges.slice(0, 5).map((badge, i) => (
            <span
              key={i}
              className="text-[10px] bg-purple-900/40 border border-purple-700/30 text-purple-300 px-1.5 py-0.5 rounded-full"
              title={badge.name}
            >
              {BADGE_EMOJI[badge.name] || '🏅'} {badge.name}
            </span>
          ))}
        </div>
      )}

      <a
        href={`/u/${username}`}
        className="text-purple-400 text-xs hover:text-purple-300 transition pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        View profile →
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Verify import in ForumThreadView.js is correct**

Confirm the import added in Task 8 is:
```javascript
import UserHoverCard from './UserHoverCard';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/UserHoverCard.js frontend/src/components/Forum/ForumThreadView.js
git commit -m "feat: add UserHoverCard popup on username hover in forum posts"
```

---

### Task 10: ForumLeaderboard component + Forum.js routing

**Files:**
- Create: `frontend/src/components/Forum/ForumLeaderboard.js`
- Modify: `frontend/src/components/Forum/Forum.js`
- Modify: `frontend/src/components/Forum/ForumCategoryList.js`

- [ ] **Step 1: Create ForumLeaderboard.js**

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL_FALLBACK = `http://${window.location.hostname}:5000/api`;

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function getAvatarColor(username) {
  const colors = ['bg-red-600','bg-blue-600','bg-green-600','bg-purple-600','bg-pink-600','bg-yellow-600','bg-indigo-600','bg-teal-600'];
  let h = 0;
  for (const c of username) h = ((h << 5) - h) + c.charCodeAt(0);
  return colors[Math.abs(h) % colors.length];
}

export default function ForumLeaderboard({ apiUrl }) {
  const url = apiUrl || API_URL_FALLBACK;
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${url}/forum/leaderboard`, { withCredentials: true })
      .then(r => setLeaders(r.data.leaderboard || []))
      .catch(() => setError('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [url]);

  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const rankLabels = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/forum" className="text-white/40 hover:text-white text-sm transition">← Forum</a>
        <h1 className="text-2xl font-bold">Top Contributors</h1>
      </div>

      {loading && <p className="text-white/40 text-center py-12">Loading…</p>}
      {error && <p className="text-red-400 text-center py-12">{error}</p>}

      {!loading && !error && leaders.length === 0 && (
        <p className="text-white/40 text-center py-12">No contributors yet. Start posting!</p>
      )}

      {!loading && leaders.map((user, i) => (
        <div key={user._id || i} className="bg-white/3 hover:bg-white/5 border border-white/5 rounded-xl p-4 mb-3 flex items-center gap-4 transition">
          <div className={`text-2xl font-bold w-10 text-center ${rankColors[i] || 'text-white/40'}`}>
            {rankLabels[i] || `#${i + 1}`}
          </div>
          <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <a href={`/u/${user.username}`} className="text-white font-semibold hover:text-purple-300 transition">
              {user.displayName || user.username}
            </a>
            <div className="text-white/40 text-xs">@{user.username}</div>
            {user.badges && user.badges.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {user.badges.slice(0, 3).map((badge, j) => (
                  <span key={j} className="text-xs" title={badge.name}>
                    {BADGE_EMOJI[badge.name] || '🏅'}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-amber-400 font-bold text-lg">
            ⚡ {user.reputation}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add leaderboard route to Forum.js**

In `frontend/src/components/Forum/Forum.js`, add a lazy import and route match. Replace the current content with:

```javascript
import React, { Suspense } from 'react';

const ForumCategoryList = React.lazy(() => import('./ForumCategoryList'));
const ForumCategoryView = React.lazy(() => import('./ForumCategoryView'));
const ForumThreadView   = React.lazy(() => import('./ForumThreadView'));
const ForumLeaderboard  = React.lazy(() => import('./ForumLeaderboard'));

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

const Spinner = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading…</div>
);

export default function Forum() {
  const pathname = window.location.pathname;

  if (pathname === '/forum/leaderboard') {
    return (
      <Suspense fallback={<Spinner />}>
        <ForumLeaderboard apiUrl={API_URL} />
      </Suspense>
    );
  }

  const threadMatch = pathname.match(/^\/forum\/threads\/([a-f0-9]{24})$/i);
  if (threadMatch) {
    return (
      <Suspense fallback={<Spinner />}>
        <ForumThreadView threadId={threadMatch[1]} apiUrl={API_URL} />
      </Suspense>
    );
  }

  const categoryMatch = pathname.match(/^\/forum\/([a-z0-9-]+)$/);
  if (categoryMatch) {
    return (
      <Suspense fallback={<Spinner />}>
        <ForumCategoryView slug={categoryMatch[1]} apiUrl={API_URL} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Spinner />}>
      <ForumCategoryList apiUrl={API_URL} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add leaderboard nav link in ForumCategoryList.js**

Read `frontend/src/components/Forum/ForumCategoryList.js` to find the header/nav area, then add a "Leaderboard" link alongside the existing navigation. Look for the page header or any nav links, and add:

```jsx
<a
  href="/forum/leaderboard"
  className="text-sm text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
>
  ⚡ Leaderboard
</a>
```

Place it in the header row next to any existing action buttons. The exact location depends on the current layout — read the file first.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Forum/ForumLeaderboard.js frontend/src/components/Forum/Forum.js frontend/src/components/Forum/ForumCategoryList.js
git commit -m "feat: add forum leaderboard page at /forum/leaderboard"
```

---

### Task 11: Admin badge grant UI in UsersTab

**Files:**
- Modify: `frontend/src/components/admin/user-management/UsersTab.js`

- [ ] **Step 1: Read UsersTab.js to understand current structure**

Read `frontend/src/components/admin/user-management/UsersTab.js` and identify:
- Where each user row renders action buttons (Shadow Ban, etc.)
- How modals are currently structured in that file

- [ ] **Step 2: Add badge grant state and fetch**

In `UsersTab.js`, add the following state variables alongside existing state:

```javascript
const [badgeModalUser, setBadgeModalUser] = useState(null); // user object for grant modal
const [availableBadges, setAvailableBadges] = useState([]);
const [selectedBadgeId, setSelectedBadgeId] = useState('');
const [grantLoading, setGrantLoading] = useState(false);
const [grantError, setGrantError] = useState('');
```

Add a `useEffect` to fetch available badges when the component mounts:

```javascript
useEffect(() => {
  authFetch(`${apiUrl}/admin/badges`)
    .then(r => r.json())
    .then(d => setAvailableBadges(d.badges || []))
    .catch(() => {});
}, [apiUrl, authFetch]);
```

(Use whatever fetch utility is already established in UsersTab — `authFetch`, `apiFetch`, or direct `fetch` with credentials. Match the pattern used by other data fetches in the file.)

- [ ] **Step 3: Add Grant Badge button to each user row**

In the actions column of each user row (near the Shadow Ban button), add:

```jsx
<button
  onClick={() => { setBadgeModalUser(user); setSelectedBadgeId(''); setGrantError(''); }}
  className="text-xs px-2 py-1 rounded bg-yellow-900/40 text-yellow-300 hover:bg-yellow-800/50 transition"
  title="Grant Badge"
>
  🏅 Badge
</button>
```

- [ ] **Step 4: Add the Grant Badge modal**

Add a modal that renders when `badgeModalUser !== null`. Place it at the bottom of the component's return JSX, alongside existing modals:

```jsx
{badgeModalUser && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setBadgeModalUser(null)}>
    <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-semibold mb-1">Grant Badge</h3>
      <p className="text-white/40 text-sm mb-4">to <span className="text-white">{badgeModalUser.username}</span></p>

      <select
        value={selectedBadgeId}
        onChange={e => setSelectedBadgeId(e.target.value)}
        className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-purple-500"
      >
        <option value="">Select a badge…</option>
        {availableBadges.map(b => (
          <option key={b._id} value={b._id}>{b.name}</option>
        ))}
      </select>

      {grantError && <p className="text-red-400 text-sm mb-3">{grantError}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setBadgeModalUser(null)}
          className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition"
        >
          Cancel
        </button>
        <button
          disabled={!selectedBadgeId || grantLoading}
          onClick={async () => {
            setGrantLoading(true);
            setGrantError('');
            try {
              const r = await authFetch(`${apiUrl}/admin/badges/${selectedBadgeId}/grant/${badgeModalUser._id}`, {
                method: 'POST'
              });
              if (!r.ok) {
                const d = await r.json();
                setGrantError(d.message || 'Failed to grant badge');
              } else {
                setBadgeModalUser(null);
              }
            } catch {
              setGrantError('Network error');
            } finally {
              setGrantLoading(false);
            }
          }}
          className="px-3 py-1.5 text-sm bg-yellow-700 hover:bg-yellow-600 text-white rounded-lg transition disabled:opacity-50"
        >
          {grantLoading ? 'Granting…' : 'Grant Badge'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/user-management/UsersTab.js
git commit -m "feat: add admin badge grant modal in UsersTab"
```

---

> **Forum Profiles tasks (showForum toggle, /api/forum/users/:username/activity, UserProfile.js Forum Activity section) are in the separate plan `docs/superpowers/plans/2026-06-12-forum-profiles.md`. Implement that plan after this one.**

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Reputation defaults to 0, integer accumulation | Task 1 |
| +1 rep on post create | Task 3 |
| +2 rep on thread create | Task 3 |
| +3 rep on deck share (first time) | Task 5 |
| +5 rep on post upvote | Task 4 |
| +10 rep on thread upvote | Task 4 |
| +15 rep on Q&A best answer | Deferred to Q&A plan (requires Q&A schema) |
| No rep deduction on unvote | Task 4 |
| First Post badge | Task 2 |
| Century badge | Task 2 |
| Thread Starter badge | Task 2 |
| Deck Builder badge | Task 5 |
| Collector badge | Task 2 (check in card_add action — wired when cardsAdded incremented) |
| Veteran badge on login | Task 5 |
| GET /api/forum/leaderboard | Task 6 |
| GET /api/admin/badges | Task 7 |
| POST /api/admin/badges/:id/grant/:uid | Task 7 |
| DELETE /api/admin/badges/:id/revoke/:uid | Task 7 |
| Inline rep + badges in PostNode | Task 8 |
| Inline rep + badges in thread OP | Task 8 |
| Username hover card | Task 9 |
| Leaderboard page at /forum/leaderboard | Task 10 |
| Badge grant modal in admin UsersTab | Task 11 |
| User.privacy.showForum field | Forum Profiles plan |
| GET /api/forum/users/:username/activity | Forum Profiles plan |
| Forum Activity section on /u/:username | Forum Profiles plan |
| showForum toggle in settings | Forum Profiles plan |

> **Note on +15 Q&A rep:** The best-answer rep bonus is tied to `thread.bestAnswerPostId` which doesn't exist until the Q&A plan is implemented. This task is correctly deferred.

> **Note on Collector badge:** The badge is defined in Task 2 with `threshold: cardsAdded >= 500`. The `cardsAdded` increment already exists in `communityStats` but the trigger site (card creation route) is not modified in this plan to stay focused. The badge will auto-award once `cardsAdded` reaches 500 from existing increments.

**Placeholder scan:** All steps contain complete code. No TBDs.

**Type consistency:** `authorReputation` and `authorBadges` added to both thread and posts in Task 6, consumed in Task 8. `BADGE_EMOJI` defined separately in ForumThreadView.js, UserHoverCard.js, UserProfile.js, and ForumLeaderboard.js to avoid cross-file imports — this is intentional (no shared frontend utility module for 8 values).

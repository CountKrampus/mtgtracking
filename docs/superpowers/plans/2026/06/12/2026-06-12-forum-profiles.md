# Forum Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `/u/:username` public profile page with a "Forum Activity" section showing reputation score, badges, activity stats (post count, thread count, upvotes received, member since), recent posts, and top posts. Visibility is controlled by a new `showForum` toggle in `User.privacy`. The existing `UserProfile.js` is extended — no new page or route.

**Architecture:** `User.privacy.showForum` gates a new public route `GET /api/forum/users/:username/activity`. `UserProfile.js` fetches this route in a separate `useEffect` after the main profile loads and renders a `ForumActivitySection` inline component. The activity route aggregates post count, thread count, and upvote totals from `ForumPost` and `ForumThread` collections. The Settings modal gets a new toggle to control `showForum`.

**Dependency:** Requires `User.reputation` to be an integer (Gamification plan Task 1). The reputation value and `User.badges` are returned from this plan's activity route — those fields are already on User once Gamification Task 1 is done.

**Tech Stack:** Node.js + Express + Mongoose, React + Tailwind CSS

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `backend/models/User.js` | Add `showForum: Boolean` to `privacy` sub-object |
| Modify | `backend/routes/forum.js` | New `GET /api/forum/users/:username/activity` public route |
| Modify | `frontend/src/components/UserProfile.js` | Add `forumActivity` state, `ForumActivitySection` component, and `showForum` conditional render |
| Modify | Settings modal in `frontend/src/components/GameRoom.js` | Add `showForum` toggle in Privacy & Sharing tab |

---

### Task 1: Add User.privacy.showForum field

**Files:**
- Modify: `backend/models/User.js`

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/forum-profiles.test.js`:

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

test('User.privacy.showForum defaults to false', async () => {
  const user = await User.create({
    email: 'fp@test.com', username: 'fpuser', passwordHash: 'hash'
  });
  expect(user.privacy.showForum).toBe(false);
});

test('User.privacy.showForum can be set to true', async () => {
  const user = await User.create({
    email: 'fp2@test.com', username: 'fpuser2', passwordHash: 'hash',
    privacy: { showForum: true }
  });
  expect(user.privacy.showForum).toBe(true);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && npx jest __tests__/forum-profiles.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `showForum` field doesn't exist.

- [ ] **Step 3: Add showForum to User.privacy**

In `backend/models/User.js`, find the `privacy` sub-object:

```javascript
privacy: {
  isPublic: { type: Boolean, default: false },
  showCollection: { type: Boolean, default: false },
  showDecks: { type: Boolean, default: true },
  showWishlist: { type: Boolean, default: false },
  bio: { type: String, default: '' }
},
```

Replace with:

```javascript
privacy: {
  isPublic: { type: Boolean, default: false },
  showCollection: { type: Boolean, default: false },
  showDecks: { type: Boolean, default: true },
  showWishlist: { type: Boolean, default: false },
  showForum: { type: Boolean, default: false },
  bio: { type: String, default: '' }
},
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd backend && npx jest __tests__/forum-profiles.test.js --no-coverage
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/models/User.js backend/__tests__/forum-profiles.test.js
git commit -m "feat: add User.privacy.showForum field"
```

---

### Task 2: Add GET /api/forum/users/:username/activity route

**Files:**
- Modify: `backend/routes/forum.js`

This is a public route (no auth required). It returns 404 if `!user.privacy.isPublic || !user.privacy.showForum`. The response includes reputation, badges, post count, thread count, upvotes received, member since date, last 10 recent posts, and top 5 posts by upvote count. Posts with `isFlagHidden: true` or `isShadowHidden: true` are excluded.

- [ ] **Step 1: Add tests for the activity route**

Add to `backend/__tests__/forum-profiles.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

test('GET /api/forum/users/:username/activity returns 404 for private profile', async () => {
  await User.create({
    email: 'priv@t.com', username: 'privuser', passwordHash: 'hash',
    privacy: { isPublic: false, showForum: true }
  });
  const app = buildApp();
  const res = await request(app).get('/api/forum/users/privuser/activity');
  expect(res.status).toBe(404);
});

test('GET /api/forum/users/:username/activity returns 404 when showForum=false', async () => {
  await User.create({
    email: 'noshf@t.com', username: 'noshoforumuser', passwordHash: 'hash',
    privacy: { isPublic: true, showForum: false }
  });
  const app = buildApp();
  const res = await request(app).get('/api/forum/users/noshoforumuser/activity');
  expect(res.status).toBe(404);
});

test('GET /api/forum/users/:username/activity returns forum activity when public and showForum=true', async () => {
  const author = await User.create({
    email: 'pub@t.com', username: 'pubforumuser', passwordHash: 'hash',
    reputation: 42,
    badges: [{ name: 'First Post', description: 'First forum post', earnedAt: new Date() }],
    privacy: { isPublic: true, showForum: true }
  });
  const cat = await ForumCategory.create({ name: 'Test', slug: 'testfp' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'pubforumuser', title: 'T', body: 'B'
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'pubforumuser', body: 'My reply'
  });

  const app = buildApp();
  const res = await request(app).get('/api/forum/users/pubforumuser/activity');
  expect(res.status).toBe(200);
  expect(res.body.reputation).toBe(42);
  expect(res.body.badges).toHaveLength(1);
  expect(res.body.stats.threadCount).toBe(1);
  expect(res.body.recentPosts).toHaveLength(1);
});

test('GET /api/forum/users/:username/activity excludes flagged posts', async () => {
  const author = await User.create({
    email: 'fl@t.com', username: 'flagtestuser', passwordHash: 'hash',
    privacy: { isPublic: true, showForum: true }
  });
  const cat = await ForumCategory.create({ name: 'FlagTest', slug: 'flagtest' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'flagtestuser', title: 'T', body: 'B'
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'flagtestuser', body: 'Flagged post', isFlagHidden: true
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'flagtestuser', body: 'Visible post'
  });

  const app = buildApp();
  const res = await request(app).get('/api/forum/users/flagtestuser/activity');
  expect(res.status).toBe(200);
  expect(res.body.recentPosts).toHaveLength(1);
  expect(res.body.recentPosts[0].body).toContain('Visible post');
});
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd backend && npx jest __tests__/forum-profiles.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Add the activity route to forum.js**

In `backend/routes/forum.js`, add this route in the public routes section (after the leaderboard route, or after the categories routes):

```javascript
// GET /api/forum/users/:username/activity — public profile forum activity
router.get('/users/:username/activity', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('privacy reputation badges createdAt').lean();

    if (!user || !user.privacy?.isPublic || !user.privacy?.showForum) {
      return res.status(404).json({ message: 'Forum activity not available' });
    }

    const postQuery = {
      authorId: user._id,
      isFlagHidden: { $ne: true },
      isShadowHidden: { $ne: true }
    };

    const [recentPostDocs, threadCount, upvotesResult] = await Promise.all([
      ForumPost.find(postQuery).sort({ createdAt: -1 }).limit(10).lean(),
      ForumThread.countDocuments({ authorId: user._id }),
      ForumPost.aggregate([
        { $match: { authorId: user._id, isFlagHidden: { $ne: true }, isShadowHidden: { $ne: true } } },
        { $project: { upvoteCount: { $size: '$upvotes' } } },
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
      ])
    ]);

    // Populate thread titles for recent posts
    const threadIds = [...new Set(recentPostDocs.map(p => p.threadId?.toString()).filter(Boolean))];
    const recentThreads = await ForumThread.find({ _id: { $in: threadIds } }).select('title').lean();
    const recentThreadMap = Object.fromEntries(recentThreads.map(t => [t._id.toString(), t.title]));

    const recentPosts = recentPostDocs.map(p => ({
      _id: p._id,
      body: p.body.slice(0, 200),
      threadId: p.threadId,
      threadTitle: recentThreadMap[p.threadId?.toString()] || 'Unknown thread',
      createdAt: p.createdAt
    }));

    // Top 5 posts by upvotes
    const topPostDocs = await ForumPost.find(postQuery)
      .sort({ 'upvotes': -1 }).limit(5).lean();

    const topThreadIds = [...new Set(topPostDocs.map(p => p.threadId?.toString()).filter(Boolean))];
    const topThreadDocs = await ForumThread.find({ _id: { $in: topThreadIds } }).select('title').lean();
    const topThreadMap = Object.fromEntries(topThreadDocs.map(t => [t._id.toString(), t.title]));

    res.json({
      reputation: user.reputation || 0,
      badges: user.badges || [],
      stats: {
        postCount: recentPostDocs.length,
        threadCount,
        upvotesReceived: upvotesResult[0]?.total || 0,
        memberSince: user.createdAt
      },
      recentPosts,
      topPosts: topPostDocs.map(p => ({
        _id: p._id,
        body: p.body.slice(0, 200),
        threadId: p.threadId,
        threadTitle: topThreadMap[p.threadId?.toString()] || 'Unknown thread',
        upvoteCount: p.upvotes.length,
        createdAt: p.createdAt
      }))
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

> **Note on stats.postCount:** The `recentPosts` query is limited to 10, so `stats.postCount` would show max 10. For an accurate total, replace `recentPostDocs.length` with a separate `ForumPost.countDocuments(postQuery)` call in the `Promise.all`. Add it as a fourth item:
> ```javascript
> const [recentPostDocs, threadCount, upvotesResult, postCount] = await Promise.all([
>   ForumPost.find(postQuery).sort({ createdAt: -1 }).limit(10).lean(),
>   ForumThread.countDocuments({ authorId: user._id }),
>   ForumPost.aggregate([...]),
>   ForumPost.countDocuments(postQuery)
> ]);
> ```
> Then use `postCount` in `stats.postCount`.

Use the expanded version above (with 4 items in Promise.all) — it's the correct implementation.

- [ ] **Step 4: Fix the route to use accurate postCount**

Replace the `Promise.all` in the route with the 4-item version:

```javascript
    const [recentPostDocs, threadCount, upvotesResult, postCount] = await Promise.all([
      ForumPost.find(postQuery).sort({ createdAt: -1 }).limit(10).lean(),
      ForumThread.countDocuments({ authorId: user._id }),
      ForumPost.aggregate([
        { $match: { authorId: user._id, isFlagHidden: { $ne: true }, isShadowHidden: { $ne: true } } },
        { $project: { upvoteCount: { $size: '$upvotes' } } },
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
      ]),
      ForumPost.countDocuments(postQuery)
    ]);
```

And in the `stats` object, use `postCount` instead of `recentPostDocs.length`:

```javascript
      stats: {
        postCount,
        threadCount,
        upvotesReceived: upvotesResult[0]?.total || 0,
        memberSince: user.createdAt
      },
```

- [ ] **Step 5: Run test — expect all pass**

```bash
cd backend && npx jest __tests__/forum-profiles.test.js --no-coverage
```

Expected: all 6 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-profiles.test.js
git commit -m "feat: add GET /api/forum/users/:username/activity public route for forum profiles"
```

---

### Task 3: Update UserProfile.js — Forum Activity section

**Files:**
- Modify: `frontend/src/components/UserProfile.js`

The current `UserProfile.js` shows `reputation` as a 0–5 star rating (old model). Since reputation is now an integer point score, the display needs to be updated. The Forum Activity section is rendered after the existing "Community Standing" / "Activity & Contributions" sections.

- [ ] **Step 1: Read UserProfile.js to understand exact structure**

Read `frontend/src/components/UserProfile.js` in full to confirm:
- Where the Community Standing section ends (around the badges block)
- Where the wishlist section ends (if it exists)
- What API URL constant is used (`API_URL`)

- [ ] **Step 2: Add forumActivity state and fetch**

In `UserProfile.js`, add these state variables after the existing `profile`, `loading`, `error` states:

```javascript
const [forumActivity, setForumActivity] = useState(null);
```

Add a `useEffect` that runs after `profile` is loaded:

```javascript
useEffect(() => {
  if (!profile) return;
  fetch(`${API_URL}/forum/users/${username}/activity`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(data => setForumActivity(data))
    .catch(() => {});
}, [profile, username]);
```

- [ ] **Step 3: Update the existing reputation display**

In the Community Standing section, the current reputation display is:

```jsx
<div className="text-3xl font-bold text-white">{(profile.reputation || 3.0).toFixed(1)}</div>
<div className="flex gap-1">
  {[...Array(5)].map((_, i) => (
    <Star key={i} size={18} className={i < Math.round(profile.reputation || 3.0) ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'} />
  ))}
</div>
```

Replace with an integer display:

```jsx
<div className="text-3xl font-bold text-amber-400">⚡ {profile.reputation || 0}</div>
<div className="text-white/40 text-sm">reputation points</div>
```

- [ ] **Step 4: Add ForumActivitySection inline component**

Add this function before the `UserProfile` export (or as a named function inside the file, before `export default`):

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

function ForumActivitySection({ activity }) {
  const memberSince = activity.stats.memberSince
    ? new Date(activity.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-white mb-4">Forum Activity</h2>

      {/* Rep + badges */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
        {activity.reputation > 0 && (
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-400">⚡ {activity.reputation.toLocaleString()}</div>
            <div className="text-[10px] text-white/40 uppercase mt-1">Reputation</div>
          </div>
        )}
        {activity.badges && activity.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activity.badges.slice(0, 5).map((badge, i) => (
              <span
                key={i}
                className="text-xs bg-purple-900/30 border border-purple-700/30 text-purple-300 px-2 py-0.5 rounded-full"
                title={badge.description}
              >
                {BADGE_EMOJI[badge.name] || '🏅'} {badge.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Posts', value: activity.stats.postCount, color: 'text-white' },
          { label: 'Threads', value: activity.stats.threadCount, color: 'text-white' },
          { label: 'Upvotes', value: activity.stats.upvotesReceived, color: 'text-amber-400' },
          { label: 'Member since', value: memberSince, color: 'text-white', small: true }
        ].map(({ label, value, color, small }) => (
          <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
            <div className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent Posts */}
      {activity.recentPosts && activity.recentPosts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Recent Posts</h3>
          <div className="space-y-2">
            {activity.recentPosts.map(post => (
              <div key={post._id} className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <a
                    href={`/forum/threads/${post.threadId}`}
                    className="text-purple-400 hover:text-purple-300 text-sm truncate block transition"
                  >
                    {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                  </a>
                  <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                </div>
                <span className="text-white/30 text-xs whitespace-nowrap">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Posts */}
      {activity.topPosts && activity.topPosts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Top Posts</h3>
          <div className="space-y-2">
            {activity.topPosts.map(post => (
              <div key={post._id} className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <a
                    href={`/forum/threads/${post.threadId}`}
                    className="text-purple-400 hover:text-purple-300 text-sm truncate block transition"
                  >
                    {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                  </a>
                  <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                </div>
                <span className="text-amber-400 text-xs whitespace-nowrap font-semibold">
                  ⬆ {post.upvoteCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add conditional render in UserProfile JSX**

In the main `UserProfile` JSX, after the last existing profile section (find the closing `</div>` of the Activity & Contributions section or wishlist section), add:

```jsx
{forumActivity && <ForumActivitySection activity={forumActivity} />}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UserProfile.js
git commit -m "feat: add Forum Activity section to public user profiles; update reputation display to integer"
```

---

### Task 4: Add showForum toggle to Settings modal

**Files:**
- Modify: `frontend/src/components/GameRoom.js`

The Privacy & Sharing tab in the Settings modal has toggles for `showCollection`, `showDecks`, `showWishlist`. A `showForum` toggle needs to be added after `showWishlist`.

- [ ] **Step 1: Find the Privacy & Sharing tab in GameRoom.js**

The settings modal is in `GameRoom.js`. Search for the `showWishlist` toggle to find its exact code:

```bash
cd frontend && grep -n "showWishlist" src/components/GameRoom.js | head -10
```

Read the surrounding lines to understand the exact toggle component pattern used.

- [ ] **Step 2: Add showForum toggle**

After the `showWishlist` toggle block, add an identical block for `showForum`:

The exact code depends on the toggle pattern already in use. It will look like one of these patterns:

**Pattern A (if using a custom toggle component):**
```jsx
<PrivacyToggle
  label="Show forum activity"
  description="Show your reputation, badges, and recent posts on your public profile"
  checked={privacy.showForum || false}
  onChange={v => updatePrivacy({ showForum: v })}
/>
```

**Pattern B (if using inline toggle):**
```jsx
<div className="flex items-center justify-between py-2">
  <div>
    <div className="text-white text-sm font-medium">Show forum activity</div>
    <div className="text-white/40 text-xs">Show reputation, badges, and recent posts on your public profile</div>
  </div>
  <button
    type="button"
    onClick={() => updatePrivacy({ showForum: !privacy.showForum })}
    className={`relative w-10 h-5 rounded-full transition-colors ${privacy.showForum ? 'bg-purple-600' : 'bg-gray-700'}`}
  >
    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.showForum ? 'left-5' : 'left-0.5'}`} />
  </button>
</div>
```

Read the existing toggle code and replicate its exact pattern for consistency.

- [ ] **Step 3: Verify updatePrivacy handles showForum**

Find the `updatePrivacy` (or equivalent) function in GameRoom.js. It should do a PATCH/PUT to `/api/users/me` with `{ privacy: { showForum: value } }`. The server-side `PUT /api/users/me` handler already merges privacy sub-fields, so no backend change is needed. Confirm the existing handler supports arbitrary privacy sub-keys by reading `backend/routes/users.js` (or wherever `PUT /api/users/me` is handled).

If the handler explicitly whitelists fields, add `showForum` to the whitelist.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/GameRoom.js
git commit -m "feat: add showForum toggle to Settings Privacy & Sharing tab"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `User.privacy.showForum` field (default false) | Task 1 |
| GET /api/forum/users/:username/activity returns 404 for private/non-forum profiles | Task 2 |
| Activity response: reputation, badges, stats, recentPosts, topPosts | Task 2 |
| Flagged/shadow-hidden posts excluded from activity | Task 2 |
| Accurate postCount (not capped at 10) | Task 2 Step 4 |
| Forum Activity section on `/u/:username` | Task 3 |
| Rep + badges row | Task 3 |
| Stats grid (posts, threads, upvotes, member since) | Task 3 |
| Recent posts list (up to 10) with thread title links | Task 3 |
| Top posts list (up to 5) with upvote count | Task 3 |
| showForum toggle in Settings → Privacy & Sharing | Task 4 |
| Reputation display updated from stars to integer ⚡ | Task 3 |

**Out of scope confirmed:** Separate /u/:username/forum route, following users, activity subscriptions, private messaging from profile. None appear in this plan.

**Placeholder scan:** Task 4 Step 2 provides two patterns (A and B) because the exact toggle implementation in GameRoom.js cannot be predicted without reading the file at implementation time. The implementer reads the file first (Step 1) then uses the matching pattern. This is intentional, not a placeholder.

**Type consistency:** `forumActivity` is fetched from the API and consumed directly in `ForumActivitySection` — no type mismatch. `BADGE_EMOJI` is defined inline in `UserProfile.js`; it's also defined in `ForumThreadView.js` and `UserHoverCard.js` from the Gamification plan. This duplication is intentional (no shared utility module for 8 values).

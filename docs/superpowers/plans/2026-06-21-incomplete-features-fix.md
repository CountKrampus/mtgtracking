# Incomplete Features Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four incomplete implementations: dead `onNewThread` TODO, missing admin content moderation endpoints, missing global thread/post listing endpoints, and the fake interaction checker stub.

**Architecture:** Backend additions go into existing routers (`backend/routes/forum.js`, `backend/routes/admin.js`). The interaction checker stub in `backend/server.js` is replaced with real Scryfall API calls. The frontend `InteractionChecker.js` results display is rewritten to match the new response shape.

**Tech Stack:** Node.js/Express, Mongoose, axios (already used in backend), React, Tailwind CSS. Tests use Jest + MongoMemoryServer (same pattern as all existing backend tests).

---

## Task 1: Remove misleading `onNewThread` TODO

`ForumHome` already handles thread creation entirely internally — it has its own `showThreadComposer` state and opens `<ThreadComposer>` directly when the user clicks "New Thread". The `onNewThread` prop is accepted but never called inside `ForumHome`. The TODO comment in `App.js` implies the feature is broken; it is not.

**Files:**
- Modify: `frontend/src/App.js` (lines 5604–5606)

- [ ] **Step 1: Remove the TODO comment**

In `frontend/src/App.js`, replace:
```js
onNewThread={() => {
  // TODO: Open new thread modal
}}
```
with:
```js
onNewThread={() => {}}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/App.js
git commit -m "fix: remove misleading onNewThread TODO (ForumHome handles thread creation internally)"
```

---

## Task 2: Add `GET /api/forum/threads` — global thread listing

The admin content moderation panel (`RecentThreadsTab`) calls `GET /api/forum/threads?limit=50&sort=new`. Only the category-scoped route exists (`/categories/:categoryId/threads`). This route must be added **before** `/threads/:threadId` in `forum.js` to avoid Express matching the literal string `threads` as a `threadId` param.

**Files:**
- Modify: `backend/routes/forum.js` (before line 209, the `GET /threads/:threadId` route)
- Test: `backend/__tests__/forum-thread-listing.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/forum-thread-listing.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumThread = require('../models/ForumThread');
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

describe('Global thread listing — data layer', () => {
  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns threads sorted by createdAt desc with author and category populated', async () => {
    const user = await User.create({
      email: 'a@test.com', username: 'alice', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General discussion'
    });
    const older = await ForumThread.create({
      title: 'Older Thread', categoryId: cat._id, authorId: user._id,
      content: 'content', contentFormat: 'markdown',
      createdAt: new Date('2026-01-01')
    });
    const newer = await ForumThread.create({
      title: 'Newer Thread', categoryId: cat._id, authorId: user._id,
      content: 'content', contentFormat: 'markdown',
      createdAt: new Date('2026-06-01')
    });

    const threads = await ForumThread.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('authorId', 'username displayName avatarUrl')
      .populate('categoryId', 'name slug')
      .lean();

    expect(threads).toHaveLength(2);
    expect(threads[0].title).toBe('Newer Thread');
    expect(threads[1].title).toBe('Older Thread');
    expect(threads[0].authorId.username).toBe('alice');
    expect(threads[0].categoryId.name).toBe('General');
  });

  test('respects limit parameter', async () => {
    const user = await User.create({
      email: 'b@test.com', username: 'bob', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Test', slug: 'test', description: 'test'
    });
    for (let i = 0; i < 5; i++) {
      await ForumThread.create({
        title: `Thread ${i}`, categoryId: cat._id, authorId: user._id,
        content: 'c', contentFormat: 'markdown'
      });
    }

    const threads = await ForumThread.find({})
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    expect(threads).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (data layer test — no route yet)**
```bash
cd backend && npx jest __tests__/forum-thread-listing.test.js --no-coverage
```
Expected: PASS (these test the query logic, not the route)

- [ ] **Step 3: Add the route to `backend/routes/forum.js`**

Find the comment `// GET /api/forum/threads/:threadId` (around line 209) and insert the new route **directly above it**:

```js
// GET /api/forum/threads - list all threads across all categories (admin/moderation use)
router.get('/threads', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const sort = req.query.sort === 'top'
      ? { postCount: -1, createdAt: -1 }
      : { createdAt: -1 };

    const [threads, total] = await Promise.all([
      ForumThread.find({})
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('authorId', 'username displayName avatarUrl')
        .populate('categoryId', 'name slug')
        .lean(),
      ForumThread.countDocuments()
    ]);

    res.json({
      threads: threads.map(t => ({
        ...t,
        author: t.authorId,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List threads error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Verify with curl**
```bash
curl -s "http://localhost:5000/api/forum/threads?limit=5&sort=new" | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log('threads:', j.threads?.length, 'total:', j.total)"
```
Expected: prints `threads: <N> total: <N>` (even if 0)

- [ ] **Step 5: Commit**
```bash
git add backend/routes/forum.js backend/__tests__/forum-thread-listing.test.js
git commit -m "feat: add GET /api/forum/threads global thread listing endpoint"
```

---

## Task 3: Add `GET /api/forum/posts` — global post listing

`RecentPostsTab` calls `GET /api/forum/posts?limit=50&sort=new`. No such route exists. Each post needs its thread title included so the table can display it.

**Files:**
- Modify: `backend/routes/forum.js`
- Test: `backend/__tests__/forum-post-listing.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/forum-post-listing.test.js`:

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

describe('Global post listing — data layer', () => {
  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns posts with author and thread populated, sorted newest first', async () => {
    const user = await User.create({
      email: 'c@test.com', username: 'carol', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'x'
    });
    const thread = await ForumThread.create({
      title: 'My Thread', categoryId: cat._id, authorId: user._id,
      content: 'root', contentFormat: 'markdown'
    });
    const post = await ForumPost.create({
      threadId: thread._id, authorId: user._id,
      body: 'Hello world', depth: 1
    });

    const posts = await ForumPost.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('authorId', 'username displayName avatarUrl')
      .populate('threadId', 'title')
      .lean();

    expect(posts).toHaveLength(1);
    expect(posts[0].authorId.username).toBe('carol');
    expect(posts[0].threadId.title).toBe('My Thread');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**
```bash
cd backend && npx jest __tests__/forum-post-listing.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 3: Add the route to `backend/routes/forum.js`**

Add directly below the new `GET /threads` route from Task 2 (before `GET /threads/:threadId`):

```js
// GET /api/forum/posts - list all posts across all threads (admin/moderation use)
router.get('/posts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      ForumPost.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('authorId', 'username displayName avatarUrl')
        .populate('threadId', 'title')
        .lean(),
      ForumPost.countDocuments()
    ]);

    res.json({
      posts: posts.map(p => ({
        ...p,
        author: p.authorId,
        thread: p.threadId,
        content: p.body,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List posts error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Verify with curl**
```bash
curl -s "http://localhost:5000/api/forum/posts?limit=5" | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log('posts:', j.posts?.length, 'total:', j.total)"
```
Expected: `posts: <N> total: <N>`

- [ ] **Step 5: Commit**
```bash
git add backend/routes/forum.js backend/__tests__/forum-post-listing.test.js
git commit -m "feat: add GET /api/forum/posts global post listing endpoint"
```

---

## Task 4: Add admin content moderation endpoints

Three endpoints needed in `backend/routes/admin.js`:
- `GET /api/admin/forum-content?flagged=true` — returns hidden posts/threads for the flagged content tab
- `DELETE /api/admin/forum-posts/:id` — hard-deletes a post
- `DELETE /api/admin/forum-threads/:id` — hard-deletes a thread and all its posts

The admin router (`backend/routes/admin.js`) already imports the models it needs for user management. We need to add `ForumPost`, `ForumThread`, and `ForumCategory` imports.

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Check existing imports at top of `backend/routes/admin.js`**

Look at the first ~20 lines of `backend/routes/admin.js` to see which models are already imported. You will need to add any of these that are missing:
```js
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
```

Add them after the existing `require` statements near the top of the file.

- [ ] **Step 2: Add `GET /api/admin/forum-content`**

Add before `module.exports = router` at the bottom of `backend/routes/admin.js`:

```js
// GET /api/admin/forum-content - list hidden/flagged forum content
router.get('/forum-content', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const [hiddenPosts, hiddenThreads] = await Promise.all([
      ForumPost.find({ isHidden: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName')
        .populate('threadId', 'title')
        .lean(),
      ForumThread.find({ isHidden: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName')
        .lean()
    ]);

    const items = [
      ...hiddenPosts.map(p => ({
        _id: p._id,
        type: 'post',
        content: p.body,
        author: p.authorId,
        thread: p.threadId,
        createdAt: p.createdAt,
        flagReason: p.flagReason || null,
        flaggedAt: p.flaggedAt || p.updatedAt,
      })),
      ...hiddenThreads.map(t => ({
        _id: t._id,
        type: 'thread',
        content: t.content,
        title: t.title,
        author: t.authorId,
        createdAt: t.createdAt,
        flagReason: t.flagReason || null,
        flaggedAt: t.flaggedAt || t.updatedAt,
      }))
    ].sort((a, b) => new Date(b.flaggedAt) - new Date(a.flaggedAt));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Forum content moderation error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 3: Add `DELETE /api/admin/forum-posts/:id`**

Add directly after the route from Step 2:

```js
// DELETE /api/admin/forum-posts/:id - hard-delete a forum post
router.delete('/forum-posts/:id', requireAdmin, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    await ForumPost.findByIdAndDelete(req.params.id);

    await ForumThread.findByIdAndUpdate(post.threadId, {
      $inc: { postCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Add `DELETE /api/admin/forum-threads/:id`**

Add directly after the route from Step 3:

```js
// DELETE /api/admin/forum-threads/:id - hard-delete a thread and all its posts
router.delete('/forum-threads/:id', requireAdmin, async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    await ForumPost.deleteMany({ threadId: req.params.id });
    await ForumThread.findByIdAndDelete(req.params.id);

    await ForumCategory.findByIdAndUpdate(thread.categoryId, {
      $inc: { threadCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete thread error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 5: Restart backend and verify endpoints exist**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/admin/forum-content \
  -H "Authorization: Bearer REPLACE_WITH_ADMIN_TOKEN"
```
Expected: `200` (or `401` if token missing, not `404`)

- [ ] **Step 6: Commit**
```bash
git add backend/routes/admin.js
git commit -m "feat: add admin content moderation endpoints (forum-content, forum-posts/:id, forum-threads/:id)"
```

---

## Task 5: Replace interaction checker stub with real Scryfall data

Replace the hardcoded fake response in `backend/server.js` `POST /api/interactions/check` with real Scryfall API calls. Uses `axios` which is already a dependency.

**Files:**
- Modify: `backend/server.js` (around line 3028–3061)

- [ ] **Step 1: Check that axios is available**
```bash
cd backend && node -e "require('axios'); console.log('axios ok')"
```
Expected: `axios ok`

- [ ] **Step 2: Replace the stub**

In `backend/server.js`, replace the entire block from `// Check card interactions (placeholder...` through the closing `});` (lines ~3028–3061) with:

```js
// POST /api/interactions/check — fetch real card data and rulings from Scryfall
app.post('/api/interactions/check', async (req, res) => {
  try {
    const { card1, card2 } = req.body;

    if (!card1 || !card2) {
      return res.status(400).json({ message: 'Both card1 and card2 are required' });
    }

    const scryfallCard = async (name) => {
      const r = await axios.get('https://api.scryfall.com/cards/named', {
        params: { fuzzy: name },
        timeout: 8000
      });
      return r.data;
    };

    const scryfallRulings = async (cardId) => {
      const r = await axios.get(`https://api.scryfall.com/cards/${cardId}/rulings`, {
        timeout: 8000
      });
      return r.data.data || [];
    };

    const [c1, c2] = await Promise.all([scryfallCard(card1), scryfallCard(card2)]);
    const [rulings1, rulings2] = await Promise.all([
      scryfallRulings(c1.id),
      scryfallRulings(c2.id)
    ]);

    // Find shared keywords (case-insensitive)
    const kw1 = new Set((c1.keywords || []).map(k => k.toLowerCase()));
    const kw2 = new Set((c2.keywords || []).map(k => k.toLowerCase()));
    const sharedKeywords = [...kw1].filter(k => kw2.has(k));

    // Also scan oracle text for terms that appear in both
    const oracleWords = (text) =>
      (text || '').toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const words1 = new Set(oracleWords(c1.oracle_text));
    const words2 = new Set(oracleWords(c2.oracle_text));
    const MTG_TERMS = new Set([
      'flying','lifelink','deathtouch','vigilance','trample','haste','first strike',
      'double strike','hexproof','indestructible','menace','reach','flash','defender',
      'sacrifice','discard','counter','exile','destroy','enchant','equip','create',
      'token','trigger','activated','graveyard','library','battlefield','hand',
      'enters','leaves','dies','draw','search','shuffle','return','target','choose',
      'proliferate','convoke','delve','annihilator','infect','wither','undying','persist'
    ]);
    const sharedOracleTerms = [...words1]
      .filter(w => words2.has(w) && MTG_TERMS.has(w) && !sharedKeywords.includes(w));

    const allShared = [...new Set([...sharedKeywords, ...sharedOracleTerms])];

    res.json({
      card1: {
        name: c1.name,
        oracle_text: c1.oracle_text || '',
        keywords: c1.keywords || [],
        type_line: c1.type_line || '',
        image_uri: c1.image_uris?.normal || c1.card_faces?.[0]?.image_uris?.normal || null,
        mana_cost: c1.mana_cost || '',
      },
      card2: {
        name: c2.name,
        oracle_text: c2.oracle_text || '',
        keywords: c2.keywords || [],
        type_line: c2.type_line || '',
        image_uri: c2.image_uris?.normal || c2.card_faces?.[0]?.image_uris?.normal || null,
        mana_cost: c2.mana_cost || '',
      },
      rulings1,
      rulings2,
      sharedKeywords: allShared,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'One or both card names not found on Scryfall. Check spelling.' });
    }
    console.error('Interaction check error:', error.message);
    res.status(500).json({ message: 'Failed to fetch card data from Scryfall' });
  }
});
```

- [ ] **Step 3: Restart backend and smoke-test**
```bash
curl -s -X POST http://localhost:5000/api/interactions/check \
  -H "Content-Type: application/json" \
  -d '{"card1":"Lightning Bolt","card2":"Goblin Guide"}' \
  | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log('card1:', j.card1?.name, 'rulings1:', j.rulings1?.length, 'shared:', j.sharedKeywords)"
```
Expected: `card1: Lightning Bolt rulings1: <N> shared: [ ... ]`

- [ ] **Step 4: Commit**
```bash
git add backend/server.js
git commit -m "feat: replace interaction checker stub with real Scryfall card data and rulings"
```

---

## Task 6: Rewrite `InteractionChecker.js` results display

The frontend currently displays `how_they_interact`, `sequence_of_events`, and `notes` from the old stub response. Replace the results section with: side-by-side card oracle text (shared keywords bolded), then rulings for each card.

**Files:**
- Modify: `frontend/src/components/Learn/InteractionChecker.js`

- [ ] **Step 1: Replace the results section**

Replace the entire `{interactionResult && ( ... )}` block (lines 113–168) with:

```jsx
{interactionResult && (
  <div className="space-y-6">
    {/* Side-by-side card display */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { card: interactionResult.card1, rulings: interactionResult.rulings1 },
        { card: interactionResult.card2, rulings: interactionResult.rulings2 },
      ].map(({ card, rulings }, idx) => (
        <div key={idx} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
          <div className="flex gap-3 p-4 border-b border-white/10">
            {card.image_uri && (
              <img
                src={card.image_uri}
                alt={card.name}
                className="w-16 h-auto rounded shadow"
              />
            )}
            <div>
              <h3 className="text-white font-semibold">{card.name}</h3>
              <p className="text-gray-400 text-xs mt-0.5">{card.type_line}</p>
              {card.mana_cost && (
                <p className="text-gray-400 text-xs">{card.mana_cost}</p>
              )}
            </div>
          </div>

          <div className="p-4">
            <h4 className="text-purple-300 text-sm font-medium mb-2">Oracle Text</h4>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
              {highlightShared(card.oracle_text, interactionResult.sharedKeywords)}
            </p>

            {rulings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-purple-300 text-sm font-medium mb-2">
                  Official Rulings ({rulings.length})
                </h4>
                <ul className="space-y-2">
                  {rulings.map((r, i) => (
                    <li key={i} className="text-gray-300 text-xs border-l-2 border-purple-700 pl-3">
                      <span className="text-gray-500 block mb-0.5">{r.published_at}</span>
                      {r.comment}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>

    {interactionResult.sharedKeywords.length > 0 && (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="text-yellow-300 text-sm font-medium mb-2">Shared Mechanics</h4>
        <div className="flex flex-wrap gap-2">
          {interactionResult.sharedKeywords.map((kw, i) => (
            <span key={i} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-200 text-xs rounded capitalize">
              {kw}
            </span>
          ))}
        </div>
      </div>
    )}

    <p className="text-gray-500 text-xs flex items-center gap-1">
      <Info size={13} />
      Card data and rulings from Scryfall
    </p>
  </div>
)}
```

- [ ] **Step 2: Add `highlightShared` helper above the component**

Before `const InteractionChecker = () => {`, add:

```js
function highlightShared(text, shared) {
  if (!text || !shared || shared.length === 0) return text;
  const pattern = new RegExp(`\\b(${shared.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <strong key={i} className="text-yellow-300 font-semibold">{part}</strong>
      : part
  );
}
```

- [ ] **Step 3: Verify in browser**

Open the app, navigate to Learn → Interaction Checker, enter "Lightning Bolt" and "Goblin Guide". Confirm:
- Both cards show with oracle text and card image thumbnails
- Any shared terms (like "haste") appear highlighted in yellow
- Official rulings appear beneath each card's oracle text
- No "How They Interact" or "Sequence of Events" fake sections remain

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/Learn/InteractionChecker.js
git commit -m "feat: rewrite InteractionChecker to display real Scryfall card data, rulings, and shared mechanics"
```

---

## Self-Review Checklist

- [x] `onNewThread` TODO removed — ForumHome self-contained, no regression
- [x] `GET /api/forum/threads` added before `/threads/:threadId` — no route shadowing
- [x] `GET /api/forum/posts` added — `body` field mapped to `content` alias for frontend compat
- [x] Admin endpoints use `requireAdmin` middleware matching existing admin.js pattern
- [x] Model imports (`ForumPost`, `ForumThread`, `ForumCategory`) added to admin.js
- [x] `highlightShared` defined outside component body (memory feedback: never define component/helpers inside render)
- [x] Scryfall 404 returns user-friendly message, not 500
- [x] Double-faced card images handled via `card_faces?.[0]?.image_uris?.normal` fallback
- [x] Test files follow existing MongoMemoryServer pattern exactly

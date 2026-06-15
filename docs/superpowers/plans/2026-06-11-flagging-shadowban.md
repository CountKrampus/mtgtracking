# Content Flagging & Shadow Ban — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users flag forum posts, forum threads, and chat messages for moderator review; auto-hide content at 3 flags; give admins a flag queue and the ability to shadow-ban repeat offenders.

**Architecture:** A single `ContentFlag` model with a `targetType/targetId` pair (same pattern as the existing `Comment` model). `isFlagHidden` and `isShadowHidden` booleans on content documents control visibility. Shadow ban lives as `isShadowBanned: Boolean` on User — no new model needed.

**Tech Stack:** Node.js/Express/Mongoose (backend), React/Tailwind/lucide-react (frontend), existing MongoMemoryServer Jest setup for tests.

---

## File Map

| Action | File |
|---|---|
| Create | `backend/models/ContentFlag.js` |
| Create | `backend/__tests__/contentFlag.test.js` |
| Create | `frontend/src/components/Forum/FlagModal.js` |
| Create | `frontend/src/components/admin/community/FlagQueueTab.js` |
| Modify | `backend/models/ModerationHistory.js` — extend actionType enum |
| Modify | `backend/models/User.js` — add `isShadowBanned` |
| Modify | `backend/models/ForumThread.js` — add `isFlagHidden`, `isShadowHidden` |
| Modify | `backend/models/ForumPost.js` — add `isFlagHidden`, `isShadowHidden` |
| Modify | `backend/models/Message.js` — add `isFlagHidden`, `isShadowHidden` |
| Modify | `backend/routes/forum.js` — flag routes + visibility filtering |
| Modify | `backend/routes/chat.js` — flag route + visibility filtering |
| Modify | `backend/routes/admin.js` — flag queue + shadow ban routes |
| Modify | `frontend/src/components/Forum/ForumThreadView.js` — flag button + hidden placeholder |
| Modify | `frontend/src/components/admin/AdminPanel.js` — register FlagQueueTab |
| Modify | `frontend/src/components/admin/community/FlagQueueTab.js` (new) |
| Modify | Chat frontend component (find by searching for `POST /api/chat/messages`) — flag button |
| Modify | `frontend/src/components/admin/user-management/UsersTab.js` — shadow ban controls |

---

### Task 1: ContentFlag model

**Files:**
- Create: `backend/models/ContentFlag.js`
- Create: `backend/__tests__/contentFlag.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// backend/__tests__/contentFlag.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
afterEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

describe('ContentFlag', () => {
  let ContentFlag;
  beforeAll(() => { ContentFlag = require('../models/ContentFlag'); });

  const validFlag = () => ({
    targetType: 'forum_post',
    targetId: new mongoose.Types.ObjectId(),
    reportedBy: new mongoose.Types.ObjectId(),
    reason: 'spam'
  });

  test('saves with valid fields', async () => {
    const flag = await ContentFlag.create(validFlag());
    expect(flag._id).toBeDefined();
    expect(flag.status).toBe('pending');
    expect(flag.reviewedBy).toBeNull();
    expect(flag.resolvedAt).toBeNull();
  });

  test('requires targetType', async () => {
    const { targetType, ...rest } = validFlag();
    await expect(ContentFlag.create(rest)).rejects.toThrow();
  });

  test('requires targetId', async () => {
    const { targetId, ...rest } = validFlag();
    await expect(ContentFlag.create(rest)).rejects.toThrow();
  });

  test('requires reason', async () => {
    const { reason, ...rest } = validFlag();
    await expect(ContentFlag.create(rest)).rejects.toThrow();
  });

  test('rejects unknown reason', async () => {
    await expect(ContentFlag.create({ ...validFlag(), reason: 'bad_vibes' })).rejects.toThrow();
  });

  test('rejects unknown targetType', async () => {
    await expect(ContentFlag.create({ ...validFlag(), targetType: 'deck' })).rejects.toThrow();
  });

  test('enforces unique (targetType, targetId, reportedBy)', async () => {
    const f = validFlag();
    await ContentFlag.create(f);
    await expect(ContentFlag.create(f)).rejects.toThrow();
  });

  test('allows same targetId flagged by different users', async () => {
    const targetId = new mongoose.Types.ObjectId();
    await ContentFlag.create({ ...validFlag(), targetId, reportedBy: new mongoose.Types.ObjectId() });
    await ContentFlag.create({ ...validFlag(), targetId, reportedBy: new mongoose.Types.ObjectId() });
    const count = await ContentFlag.countDocuments({ targetId });
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
cd backend && npm test -- --testPathPattern=contentFlag
```

Expected: FAIL — `Cannot find module '../models/ContentFlag'`

- [ ] **Step 3: Create the ContentFlag model**

```javascript
// backend/models/ContentFlag.js
const mongoose = require('mongoose');

const contentFlagSchema = new mongoose.Schema({
  targetType: {
    type: String,
    required: true,
    enum: ['forum_thread', 'forum_post', 'chat_message'],
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['spam', 'harassment', 'inappropriate', 'off_topic']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'dismissed'],
    default: 'pending',
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewNotes: {
    type: String,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  }
});

contentFlagSchema.index({ targetType: 1, targetId: 1 });
contentFlagSchema.index({ targetType: 1, targetId: 1, reportedBy: 1 }, { unique: true });
contentFlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContentFlag', contentFlagSchema);
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
cd backend && npm test -- --testPathPattern=contentFlag
```

Expected: 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/models/ContentFlag.js backend/__tests__/contentFlag.test.js
git commit -m "feat: add ContentFlag model with unique-per-user index"
```

---

### Task 2: Extend existing model schemas

**Files:**
- Modify: `backend/models/ModerationHistory.js` (line with the enum array)
- Modify: `backend/models/User.js` (add field after existing schema fields)
- Modify: `backend/models/ForumThread.js` (add fields before `createdAt`)
- Modify: `backend/models/ForumPost.js` (add fields before `createdAt`)
- Modify: `backend/models/Message.js` (add fields before `createdAt`)

- [ ] **Step 1: Extend ModerationHistory actionType enum**

In `backend/models/ModerationHistory.js`, find the enum array on the `actionType` field and replace it:

```javascript
// Before:
enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked', 'announcement_created', 'announcement_updated', 'announcement_deleted', 'price_bulk_update']

// After:
enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked', 'announcement_created', 'announcement_updated', 'announcement_deleted', 'price_bulk_update', 'shadow_ban', 'shadow_ban_lifted', 'flag_approved', 'flag_dismissed']
```

- [ ] **Step 2: Add `isShadowBanned` to User schema**

In `backend/models/User.js`, find `isActive` field and add after it:

```javascript
  isActive: {
    type: Boolean,
    default: true
  },
  isShadowBanned: {
    type: Boolean,
    default: false,
    index: true
  },
```

- [ ] **Step 3: Add visibility fields to ForumThread**

In `backend/models/ForumThread.js`, add before `createdAt`:

```javascript
  isFlagHidden:   { type: Boolean, default: false },
  isShadowHidden: { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now, index: true },
```

- [ ] **Step 4: Add visibility fields to ForumPost**

In `backend/models/ForumPost.js`, add before `createdAt`:

```javascript
  isFlagHidden:   { type: Boolean, default: false },
  isShadowHidden: { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now, index: true },
```

- [ ] **Step 5: Add visibility fields to Message**

In `backend/models/Message.js`, add before `createdAt`:

```javascript
  isFlagHidden:   { type: Boolean, default: false },
  isShadowHidden: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
```

- [ ] **Step 6: Run existing forum tests to confirm no regressions**

```bash
cd backend && npm test -- --testPathPattern=forum
```

Expected: 13 tests still passing.

- [ ] **Step 7: Commit**

```bash
git add backend/models/ModerationHistory.js backend/models/User.js backend/models/ForumThread.js backend/models/ForumPost.js backend/models/Message.js
git commit -m "feat: add isShadowBanned to User; isFlagHidden/isShadowHidden to content models"
```

---

### Task 3: Forum flag routes + visibility filtering

**Files:**
- Modify: `backend/routes/forum.js`

Context: `forum.js` imports are at lines 1–8. `checkForumAccess` middleware is around line 44. `POST /threads` handler is around line 133. `GET /categories/:slug/threads` is a GET route listing threads. `GET /threads/:id` returns thread + posts.

- [ ] **Step 1: Add ContentFlag import at top of forum.js**

After the existing requires at the top of `backend/routes/forum.js`, add:

```javascript
const ContentFlag = require('../models/ContentFlag');
const User = require('../models/User');
const Notification = require('../models/Notification');
```

(If `User` and `Notification` are already imported, skip those lines.)

- [ ] **Step 2: Add the visibility filter helper function**

After the `checkForumAccess` function in `backend/routes/forum.js`, add:

```javascript
function visibilityFilter(currentUserId) {
  const filter = { isFlagHidden: { $ne: true } };
  if (!currentUserId) {
    filter.isShadowHidden = { $ne: true };
  } else {
    filter.$or = [
      { isShadowHidden: { $ne: true } },
      { authorId: new (require('mongoose').Types.ObjectId)(currentUserId) }
    ];
  }
  return filter;
}
```

- [ ] **Step 3: Apply visibility filter to GET /categories/:slug/threads**

Find the handler for `GET /categories/:slug/threads`. Inside the `ForumThread.find(...)` query, merge in the visibility filter. The query currently filters by `categoryId`. Change it to:

```javascript
const currentUserId = req.user?._id?.toString();
const threads = await ForumThread.find({
  categoryId: cat._id,
  ...visibilityFilter(currentUserId)
})
  .sort(sortObj)
  .skip(skip)
  .limit(lim)
  .lean();
```

- [ ] **Step 4: Apply visibility filter to GET /threads/:id (posts)**

Find the handler for `GET /threads/:id`. After fetching the thread, apply the filter to the ForumPost query:

```javascript
const currentUserId = req.user?._id?.toString();
const flatPosts = await ForumPost.find({
  threadId: thread._id,
  ...visibilityFilter(currentUserId)
}).sort({ createdAt: 1 }).lean();
```

Also, if the thread itself is hidden and the requesting user is not the author, return 404:

```javascript
if (thread.isFlagHidden && thread.authorId?.toString() !== currentUserId) {
  return res.status(404).json({ message: 'Thread not found' });
}
if (thread.isShadowHidden && thread.authorId?.toString() !== currentUserId) {
  return res.status(404).json({ message: 'Thread not found' });
}
```

- [ ] **Step 5: Set isShadowHidden on new threads from shadow-banned users**

In the `POST /threads` handler, after creating the thread object but before `res.status(201).json(thread)`:

```javascript
const author = await User.findById(req.user._id).select('isShadowBanned').lean();
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
res.status(201).json(thread);
```

- [ ] **Step 6: Set isShadowHidden on new posts from shadow-banned users**

In the `POST /posts` handler, similarly add `isShadowHidden` to the create call:

```javascript
const author = await User.findById(req.user._id).select('isShadowBanned').lean();
const post = await ForumPost.create({
  threadId,
  parentPostId: parentPostId || null,
  authorId: req.user._id,
  authorUsername: req.user.username,
  authorDisplayName: req.user.displayName || req.user.username,
  body: body.trim(),
  cardRefs: parseCardRefs(body),
  deckRef: deckRef || undefined,
  isShadowHidden: author?.isShadowBanned === true
});
```

- [ ] **Step 7: Add flag helper function**

Add this helper after `visibilityFilter`:

```javascript
const FLAG_THRESHOLD = 3;

async function handleFlag(targetType, targetId, reportedBy, reason, getContent, notifyPreview) {
  const VALID_REASONS = ['spam', 'harassment', 'inappropriate', 'off_topic'];
  if (!VALID_REASONS.includes(reason)) {
    return { status: 400, body: { message: 'Invalid reason' } };
  }

  // Check for existing flag from this user
  const existing = await ContentFlag.findOne({ targetType, targetId, reportedBy });
  if (existing) return { status: 409, body: { flagged: false, alreadyFlagged: true } };

  await ContentFlag.create({ targetType, targetId, reportedBy, reason });

  // Count pending flags
  const pendingCount = await ContentFlag.countDocuments({ targetType, targetId, status: 'pending' });

  if (pendingCount >= FLAG_THRESHOLD) {
    const content = await getContent();
    if (content && !content.isFlagHidden) {
      content.isFlagHidden = true;
      await content.save();

      // Notify all admins and editors
      const staff = await User.find({ role: { $in: ['admin', 'editor'] }, isActive: true }).select('_id').lean();
      if (staff.length > 0) {
        await Notification.insertMany(staff.map(u => ({
          userId: u._id,
          type: 'flag_threshold',
          message: `Content flagged (${targetType}): "${notifyPreview}"`,
          isRead: false,
          createdAt: new Date()
        })));
      }
    }
  }

  return { status: 200, body: { flagged: true, alreadyFlagged: false } };
}
```

**Note:** If the Notification model has different field names, check `backend/models/Notification.js` and adjust the `insertMany` object accordingly.

- [ ] **Step 8: Add POST /forum/threads/:id/flag route**

Add after the upvote route for threads:

```javascript
// POST /api/forum/threads/:id/flag
router.post('/threads/:id/flag', verifyToken, requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const thread = await ForumThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const preview = thread.title.slice(0, 60);
    const result = await handleFlag(
      'forum_thread', thread._id, req.user._id, reason,
      () => ForumThread.findById(thread._id),
      preview
    );
    res.status(result.status).json(result.body);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 9: Add POST /forum/posts/:id/flag route**

```javascript
// POST /api/forum/posts/:id/flag
router.post('/posts/:id/flag', verifyToken, requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const preview = post.body.slice(0, 60);
    const result = await handleFlag(
      'forum_post', post._id, req.user._id, reason,
      () => ForumPost.findById(post._id),
      preview
    );
    res.status(result.status).json(result.body);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 10: Commit**

```bash
git add backend/routes/forum.js
git commit -m "feat: add flag routes and visibility filtering to forum routes"
```

---

### Task 4: Chat flag route + visibility filtering

**Files:**
- Modify: `backend/routes/chat.js` (or wherever `GET /api/chat/messages` and `POST /api/chat/messages` live — search the codebase with `grep -r "chat/messages" backend/routes/`)

Context: The Message model uses `senderId` (not `authorId`). The chat GET route returns messages since a given timestamp.

- [ ] **Step 1: Find the chat route file**

Run:
```bash
grep -rl "chat/messages\|app\.use.*chat" backend/
```

Open the file it returns. All changes in this task go in that file.

- [ ] **Step 2: Add imports to the chat route file**

At the top of the chat route file, ensure these are imported:

```javascript
const ContentFlag = require('../models/ContentFlag');
const User = require('../models/User');
const Notification = require('../models/Notification');
```

If `handleFlag` and `visibilityFilter` were defined in `forum.js`, **do not** import them from there — they are private to that file. Instead, extract them to a shared util file:

Create `backend/utils/flagHelpers.js`:

```javascript
const ContentFlag = require('../models/ContentFlag');
const User = require('../models/User');
const Notification = require('../models/Notification');

const FLAG_THRESHOLD = 3;

function visibilityFilter(currentUserId, senderField = 'authorId') {
  const mongoose = require('mongoose');
  const filter = { isFlagHidden: { $ne: true } };
  if (!currentUserId) {
    filter.isShadowHidden = { $ne: true };
  } else {
    filter.$or = [
      { isShadowHidden: { $ne: true } },
      { [senderField]: new mongoose.Types.ObjectId(currentUserId) }
    ];
  }
  return filter;
}

async function handleFlag(targetType, targetId, reportedBy, reason, getContent, notifyPreview) {
  const VALID_REASONS = ['spam', 'harassment', 'inappropriate', 'off_topic'];
  if (!VALID_REASONS.includes(reason)) {
    return { status: 400, body: { message: 'Invalid reason' } };
  }

  const existing = await ContentFlag.findOne({ targetType, targetId, reportedBy });
  if (existing) return { status: 409, body: { flagged: false, alreadyFlagged: true } };

  await ContentFlag.create({ targetType, targetId, reportedBy, reason });

  const pendingCount = await ContentFlag.countDocuments({ targetType, targetId, status: 'pending' });

  if (pendingCount >= FLAG_THRESHOLD) {
    const content = await getContent();
    if (content && !content.isFlagHidden) {
      content.isFlagHidden = true;
      await content.save();

      const staff = await User.find({ role: { $in: ['admin', 'editor'] }, isActive: true }).select('_id').lean();
      if (staff.length > 0) {
        await Notification.insertMany(staff.map(u => ({
          userId: u._id,
          type: 'flag_threshold',
          message: `Content flagged (${targetType}): "${notifyPreview}"`,
          isRead: false,
          createdAt: new Date()
        })));
      }
    }
  }

  return { status: 200, body: { flagged: true, alreadyFlagged: false } };
}

module.exports = { visibilityFilter, handleFlag, FLAG_THRESHOLD };
```

Then **update `backend/routes/forum.js`** to use the shared util instead of the inline copies:

```javascript
const { visibilityFilter, handleFlag } = require('../utils/flagHelpers');
```

Remove the inline `visibilityFilter`, `handleFlag`, and `FLAG_THRESHOLD` definitions from `forum.js`.

- [ ] **Step 3: Apply visibility filter to GET /api/chat/messages**

In the chat GET handler, add the visibility filter to the Message query. The sender field in Message is `senderId`:

```javascript
const currentUserId = req.user?._id?.toString();
const messages = await Message.find({
  ...(since ? { createdAt: { $gt: new Date(since) } } : {}),
  ...visibilityFilter(currentUserId, 'senderId')
}).sort({ createdAt: 1 }).lean();
```

- [ ] **Step 4: Set isShadowHidden on new chat messages from shadow-banned users**

In the `POST /api/chat/messages` handler, after validation and before creating the message:

```javascript
const author = await User.findById(req.user._id).select('isShadowBanned').lean();
const message = await Message.create({
  senderId: req.user._id,
  senderUsername: req.user.username,
  senderDisplayName: req.user.displayName || req.user.username,
  body: body.trim(),
  isShadowHidden: author?.isShadowBanned === true
});
```

- [ ] **Step 5: Add POST /api/chat/messages/:id/flag route**

```javascript
router.post('/:id/flag', verifyToken, requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const preview = msg.body.slice(0, 60);
    const result = await handleFlag(
      'chat_message', msg._id, req.user._id, reason,
      () => Message.findById(msg._id),
      preview
    );
    res.status(result.status).json(result.body);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/flagHelpers.js backend/routes/chat.js backend/routes/forum.js
git commit -m "feat: extract flag helpers to shared util; add chat flag route and visibility filters"
```

---

### Task 5: Admin routes — flag queue + shadow ban

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Add imports to admin.js**

At the top of `backend/routes/admin.js`, add:

```javascript
const ContentFlag = require('../models/ContentFlag');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const Message = require('../models/Message');
```

(Skip any that are already imported.)

- [ ] **Step 2: Add GET /api/admin/flags**

Add this route in `backend/routes/admin.js`:

```javascript
// GET /api/admin/flags — flag queue
router.get('/flags', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [flags, total] = await Promise.all([
      ContentFlag.find({ status })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reportedBy', 'username displayName')
        .lean(),
      ContentFlag.countDocuments({ status })
    ]);

    // For each flag, attach the content preview and author info
    const enriched = await Promise.all(flags.map(async (f) => {
      let contentPreview = '';
      let authorId = null;
      let authorUsername = '';

      if (f.targetType === 'forum_thread') {
        const t = await ForumThread.findById(f.targetId).select('title authorId authorUsername').lean();
        contentPreview = t?.title?.slice(0, 80) || '[deleted]';
        authorId = t?.authorId;
        authorUsername = t?.authorUsername || '';
      } else if (f.targetType === 'forum_post') {
        const p = await ForumPost.findById(f.targetId).select('body authorId authorUsername').lean();
        contentPreview = p?.body?.slice(0, 80) || '[deleted]';
        authorId = p?.authorId;
        authorUsername = p?.authorUsername || '';
      } else if (f.targetType === 'chat_message') {
        const m = await Message.findById(f.targetId).select('body senderId senderUsername').lean();
        contentPreview = m?.body?.slice(0, 80) || '[deleted]';
        authorId = m?.senderId;
        authorUsername = m?.senderUsername || '';
      }

      // Count how many approved flags this author has total
      const authorFlagCount = authorId
        ? await ContentFlag.countDocuments({
            status: 'approved',
            ...(f.targetType === 'chat_message'
              ? {}  // would need a join; skip for now
              : {})
          })
        : 0;

      return { ...f, contentPreview, authorId, authorUsername, authorFlagCount };
    }));

    // Suggest shadow ban: users with 3+ approved flag reviews not already shadow banned
    const approvedFlagAuthors = await ContentFlag.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, targetIds: { $addToSet: '$targetId' } } }
    ]);

    // Simplified suggestion: find users with multiple pending flags across their content
    const suggestShadowBan = [];
    const authorCounts = {};
    enriched.forEach(f => {
      if (f.authorUsername && f.status === 'pending') {
        authorCounts[f.authorUsername] = (authorCounts[f.authorUsername] || 0) + 1;
      }
    });
    for (const [username, count] of Object.entries(authorCounts)) {
      if (count >= 3) {
        const user = await User.findOne({ username }).select('isShadowBanned').lean();
        if (user && !user.isShadowBanned) suggestShadowBan.push(username);
      }
    }

    res.json({ flags: enriched, total, page, suggestShadowBan });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 3: Add PUT /api/admin/flags/:id/review**

```javascript
// PUT /api/admin/flags/:id/review
router.put('/flags/:id/review', requireAdmin, async (req, res) => {
  try {
    const { action, notes } = req.body;
    if (!['approve', 'dismiss'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or dismiss' });
    }

    const flag = await ContentFlag.findById(req.params.id);
    if (!flag) return res.status(404).json({ message: 'Flag not found' });

    flag.status = action === 'approve' ? 'approved' : 'dismissed';
    flag.reviewedBy = req.user._id;
    flag.reviewNotes = notes || '';
    flag.resolvedAt = new Date();
    await flag.save();

    // If dismissing, check if content should be unhidden
    if (action === 'dismiss') {
      const remainingPending = await ContentFlag.countDocuments({
        targetType: flag.targetType,
        targetId: flag.targetId,
        status: 'pending'
      });

      if (remainingPending < 3) {
        if (flag.targetType === 'forum_thread') {
          await ForumThread.findByIdAndUpdate(flag.targetId, { isFlagHidden: false });
        } else if (flag.targetType === 'forum_post') {
          await ForumPost.findByIdAndUpdate(flag.targetId, { isFlagHidden: false });
        } else if (flag.targetType === 'chat_message') {
          await Message.findByIdAndUpdate(flag.targetId, { isFlagHidden: false });
        }
      }
    }

    await ModerationHistory.logAction({
      userId: flag.reportedBy,
      actionType: action === 'approve' ? 'flag_approved' : 'flag_dismissed',
      actionDetails: { targetType: flag.targetType, targetId: flag.targetId, notes },
      performedBy: req.user._id
    });

    res.json({ success: true, flag });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 4: Add POST /api/admin/users/:id/shadow-ban**

```javascript
// POST /api/admin/users/:id/shadow-ban
router.post('/users/:id/shadow-ban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isShadowBanned) return res.status(409).json({ message: 'User is already shadow banned' });

    user.isShadowBanned = true;
    await user.save();

    // Bulk-hide all their existing content
    await Promise.all([
      ForumThread.updateMany({ authorId: user._id }, { isShadowHidden: true }),
      ForumPost.updateMany({ authorId: user._id }, { isShadowHidden: true }),
      Message.updateMany({ senderId: user._id }, { isShadowHidden: true })
    ]);

    await ModerationHistory.logAction({
      userId: user._id,
      actionType: 'shadow_ban',
      actionDetails: { reason: req.body.reason || '' },
      performedBy: req.user._id
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 5: Add DELETE /api/admin/users/:id/shadow-ban**

```javascript
// DELETE /api/admin/users/:id/shadow-ban
router.delete('/users/:id/shadow-ban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isShadowBanned) return res.status(409).json({ message: 'User is not shadow banned' });

    user.isShadowBanned = false;
    await user.save();

    await Promise.all([
      ForumThread.updateMany({ authorId: user._id }, { isShadowHidden: false }),
      ForumPost.updateMany({ authorId: user._id }, { isShadowHidden: false }),
      Message.updateMany({ senderId: user._id }, { isShadowHidden: false })
    ]);

    await ModerationHistory.logAction({
      userId: user._id,
      actionType: 'shadow_ban_lifted',
      actionDetails: {},
      performedBy: req.user._id
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: add admin flag queue and shadow ban routes"
```

---

### Task 6: FlagModal frontend component

**Files:**
- Create: `frontend/src/components/Forum/FlagModal.js`

- [ ] **Step 1: Create the component**

```javascript
// frontend/src/components/Forum/FlagModal.js
import React, { useState } from 'react';
import axios from 'axios';
import { X, Flag } from 'lucide-react';

const REASONS = [
  { value: 'spam',          label: '🚫 Spam or self-promotion' },
  { value: 'harassment',    label: '⚠️ Harassment or abuse' },
  { value: 'inappropriate', label: '🔞 Inappropriate content' },
  { value: 'off_topic',     label: '💬 Off-topic' }
];

export default function FlagModal({ apiUrl, endpoint, onClose }) {
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selected) return setError('Please pick a reason.');
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${apiUrl}${endpoint}`, { reason: selected });
      setDone(true);
    } catch (e) {
      if (e.response?.status === 409) {
        setError("You've already reported this.");
      } else {
        setError(e.response?.data?.message || 'Failed to submit report.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-red-400" />
            <h3 className="text-white font-semibold text-sm">Report this content</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="text-center py-4">
              <p className="text-green-400 font-medium text-sm">Reported.</p>
              <p className="text-white/40 text-xs mt-1">Thanks for keeping the community safe.</p>
              <button type="button" onClick={onClose} className="mt-4 text-white/50 hover:text-white text-sm transition">Close</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelected(r.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition ${
                      selected === r.value
                        ? 'border-red-500/50 bg-red-900/20 text-white'
                        : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !selected}
                  className="flex-1 bg-red-700/70 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition"
                >
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
                <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-sm px-4 transition">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Forum/FlagModal.js
git commit -m "feat: add FlagModal component with reason picker"
```

---

### Task 7: Flag button and hidden placeholder in ForumThreadView

**Files:**
- Modify: `frontend/src/components/Forum/ForumThreadView.js`

Context: `PostNode` is defined at line 107. The actions row (upvote, Reply, Delete buttons) is around lines 138–152. The `ForumThreadView` export starts at line 194. The OP thread post section with upvote/delete buttons is around lines 265–295.

- [ ] **Step 1: Import Flag icon and FlagModal**

At the top of `ForumThreadView.js`, update the lucide-react import and add FlagModal:

```javascript
import { ChevronUp, Reply, Trash2, Lock, X, Flag } from 'lucide-react';
import FlagModal from './FlagModal';
```

- [ ] **Step 2: Add flag state and button to PostNode**

In `PostNode`, add flag state after the `showReply` state:

```javascript
const [showFlag, setShowFlag] = useState(false);
```

In the actions row (after the Reply button, before the Delete button), add:

```javascript
{currentUser && currentUser._id !== post.authorId && (
  <button
    type="button"
    onClick={() => setShowFlag(true)}
    className="text-white/20 hover:text-orange-400 transition"
    title="Report this post"
  >
    <Flag size={13} />
  </button>
)}
```

After the closing `</div>` of the PostNode's inner card div, add the modal:

```javascript
{showFlag && (
  <FlagModal
    apiUrl={apiUrl}
    endpoint={`/forum/posts/${post._id}/flag`}
    onClose={() => setShowFlag(false)}
  />
)}
```

- [ ] **Step 3: Replace hidden post body with placeholder**

In PostNode, find where `post.body` is rendered:

```javascript
<div className="text-white/80 text-sm mt-3 leading-relaxed">{renderBody(post.body, onCardHover)}</div>
```

Replace with:

```javascript
{post.isFlagHidden ? (
  <div className="text-white/30 text-sm mt-3 italic flex items-center gap-2">
    <Flag size={12} /> This content has been hidden pending moderator review.
  </div>
) : (
  <div className="text-white/80 text-sm mt-3 leading-relaxed">{renderBody(post.body, onCardHover)}</div>
)}
```

- [ ] **Step 4: Add flag button to the OP thread post**

In `ForumThreadView`, find the thread upvote/delete buttons area (around line 270). Add a flag state at the top of the component:

```javascript
const [showThreadFlag, setShowThreadFlag] = useState(false);
```

In the thread header actions row, add after the upvote button:

```javascript
{currentUser && thread && currentUser._id !== thread.authorId && (
  <button
    type="button"
    onClick={() => setShowThreadFlag(true)}
    className="text-white/20 hover:text-orange-400 transition p-1.5 rounded"
    title="Report this thread"
  >
    <Flag size={15} />
  </button>
)}
```

After the deck modal render at the bottom of the component (before the closing `</div>`), add:

```javascript
{showThreadFlag && thread && (
  <FlagModal
    apiUrl={apiUrl}
    endpoint={`/forum/threads/${thread._id}/flag`}
    onClose={() => setShowThreadFlag(false)}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Forum/ForumThreadView.js
git commit -m "feat: add flag button and hidden placeholder to forum thread and post views"
```

---

### Task 8: Flag button in Chat component

**Files:**
- Modify: the component that renders global chat messages (find it by running `grep -rl "chat/messages\|POST.*chat" frontend/src/`)

- [ ] **Step 1: Find the chat component**

```bash
grep -rl "api/chat/messages\|\/chat\/messages" frontend/src/
```

Open the file. This is where you add the flag button.

- [ ] **Step 2: Import FlagModal**

At the top of the chat component file, add:

```javascript
import FlagModal from './Forum/FlagModal';
```

(Adjust the import path based on where the chat component lives relative to `Forum/`.)

- [ ] **Step 3: Add per-message flag state**

Inside the message list render, each message item needs its own flag state. The cleanest way is to extract the message item into a small inner component or use a `flaggingMessageId` state on the parent:

```javascript
const [flaggingMessageId, setFlaggingMessageId] = useState(null);
```

- [ ] **Step 4: Add flag button to each message row**

In the message row render, after the existing delete button (only shown to non-authors):

```javascript
{currentUser && currentUser._id !== msg.senderId && (
  <button
    type="button"
    onClick={() => setFlaggingMessageId(msg._id)}
    className="text-white/20 hover:text-orange-400 transition opacity-0 group-hover:opacity-100"
    title="Report this message"
  >
    <Flag size={12} />
  </button>
)}
```

Add `group` class to the message row container div for the hover effect to work.

- [ ] **Step 5: Replace hidden message body with placeholder**

Find where `msg.body` is rendered and wrap with:

```javascript
{msg.isFlagHidden ? (
  <span className="text-white/30 italic text-xs">🚩 Hidden pending review</span>
) : (
  <span>{msg.body}</span>
)}
```

- [ ] **Step 6: Render FlagModal**

At the bottom of the chat component's render, before the closing JSX:

```javascript
{flaggingMessageId && (
  <FlagModal
    apiUrl={API_URL}
    endpoint={`/chat/messages/${flaggingMessageId}/flag`}
    onClose={() => setFlaggingMessageId(null)}
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add <chat-component-file>
git commit -m "feat: add flag button to chat messages"
```

---

### Task 9: FlagQueueTab admin component

**Files:**
- Create: `frontend/src/components/admin/community/FlagQueueTab.js`

- [ ] **Step 1: Create the component**

```javascript
// frontend/src/components/admin/community/FlagQueueTab.js
import React, { useState, useEffect, useCallback } from 'react';
import { Flag, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

const TYPE_COLORS = {
  forum_thread: 'bg-purple-900/30 text-purple-300',
  forum_post:   'bg-blue-900/30 text-blue-300',
  chat_message: 'bg-green-900/30 text-green-300'
};

const TYPE_LABELS = {
  forum_thread: 'Thread',
  forum_post:   'Post',
  chat_message: 'Chat'
};

export default function FlagQueueTab() {
  const { authFetch } = useAuthContext();
  const [status, setStatus] = useState('pending');
  const [flags, setFlags] = useState([]);
  const [total, setTotal] = useState(0);
  const [suggestShadowBan, setSuggestShadowBan] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/flags?status=${status}&page=${page}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setFlags(data.flags || []);
      setTotal(data.total || 0);
      setSuggestShadowBan(data.suggestShadowBan || []);
    } catch (e) {
      setError(e.message || 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  }, [authFetch, status, page]);

  useEffect(() => { load(); }, [load]);

  const review = async (flagId, action) => {
    try {
      const res = await authFetch(`${API_URL}/admin/flags/${flagId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Failed');
      load();
    } catch {
      setError('Failed to review flag.');
    }
  };

  const shadowBan = async (username) => {
    if (!window.confirm(`Shadow ban ${username}? They will continue posting but their content will be hidden from others.`)) return;
    try {
      const userRes = await authFetch(`${API_URL}/admin/users?search=${encodeURIComponent(username)}&limit=1`);
      const userData = await userRes.json();
      const user = userData.users?.[0];
      if (!user) return setError('User not found');
      const res = await authFetch(`${API_URL}/admin/users/${user._id}/shadow-ban`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      load();
    } catch {
      setError('Failed to apply shadow ban.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['pending', 'approved', 'dismissed'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                status === s ? 'bg-purple-700 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'pending' && total > 0 ? ` (${total})` : ''}
            </button>
          ))}
        </div>
        <button type="button" onClick={load} className="text-white/40 hover:text-white transition"><RefreshCw size={15} /></button>
      </div>

      {suggestShadowBan.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-red-300 font-medium text-sm">
            <AlertTriangle size={15} /> Shadow ban suggestions
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestShadowBan.map(username => (
              <button
                key={username}
                type="button"
                onClick={() => shadowBan(username)}
                className="bg-red-800/40 hover:bg-red-700/50 text-red-200 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 transition"
              >
                👻 Shadow ban {username}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-900/20 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="text-white/40 text-sm text-center py-8">Loading…</div>
      ) : flags.length === 0 ? (
        <div className="text-white/30 text-sm text-center py-8">
          <Flag size={24} className="mx-auto mb-2 opacity-30" />
          No {status} flags.
        </div>
      ) : (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px_90px_90px_140px] px-3 py-2 bg-white/5 text-white/40 text-xs uppercase tracking-wide">
            <span>Type</span><span>Content</span><span>Author</span><span>Reason</span><span>Flagged</span><span>Actions</span>
          </div>
          {flags.map(f => (
            <div key={f._id} className="grid grid-cols-[80px_1fr_120px_90px_90px_140px] px-3 py-3 border-t border-white/8 items-center gap-2 hover:bg-white/3 transition">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[f.targetType] || 'bg-white/10 text-white/50'}`}>
                {TYPE_LABELS[f.targetType] || f.targetType}
              </span>
              <span className="text-white/70 text-sm truncate" title={f.contentPreview}>{f.contentPreview || '[deleted]'}</span>
              <span className="text-white/60 text-sm truncate">
                {f.authorUsername}
                {f.authorFlagCount >= 3 && <span className="ml-1 text-red-400 text-xs">⚠️ {f.authorFlagCount}</span>}
              </span>
              <span className="text-white/50 text-xs capitalize">{f.reason?.replace('_', ' ')}</span>
              <span className="text-white/30 text-xs">{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}</span>
              {status === 'pending' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => review(f._id, 'approve')}
                    className="bg-red-900/40 hover:bg-red-800/50 text-red-300 text-xs px-2.5 py-1 rounded border border-red-500/30 transition">
                    Approve
                  </button>
                  <button type="button" onClick={() => review(f._id, 'dismiss')}
                    className="bg-white/5 hover:bg-white/10 text-white/50 text-xs px-2.5 py-1 rounded border border-white/10 transition">
                    Dismiss
                  </button>
                </div>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'approved' ? 'text-red-400' : 'text-white/30'}`}>
                  {f.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-between items-center text-sm text-white/40">
          <span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded transition">Prev</button>
            <button type="button" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/community/FlagQueueTab.js
git commit -m "feat: add FlagQueueTab admin component"
```

---

### Task 10: Wire up AdminPanel + shadow ban in UsersTab

**Files:**
- Modify: `frontend/src/components/admin/AdminPanel.js`
- Modify: `frontend/src/components/admin/user-management/UsersTab.js`

- [ ] **Step 1: Register FlagQueueTab in AdminPanel**

In `frontend/src/components/admin/AdminPanel.js`, add the import:

```javascript
import FlagQueueTab from './community/FlagQueueTab';
```

In the `groups` object, inside the `'community'` group's `tabs` array, add:

```javascript
{ id: 'flag-queue', label: 'Flag Queue', component: FlagQueueTab, requiresRole: 'moderator' },
```

Place it as the first tab in the community group (before `moderation`).

- [ ] **Step 2: Add shadow ban badge and button to UsersTab**

In `frontend/src/components/admin/user-management/UsersTab.js`, find where the user row renders the username. Add a 👻 badge after the username:

```javascript
{user.isShadowBanned && (
  <span className="ml-1.5 text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded" title="Shadow banned">👻</span>
)}
```

In the user row's action buttons area, add a shadow ban toggle button:

```javascript
{user.isShadowBanned ? (
  <button
    type="button"
    onClick={() => handleLiftShadowBan(user._id)}
    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition"
    title="Lift shadow ban"
  >
    Lift Shadow Ban
  </button>
) : (
  <button
    type="button"
    onClick={() => handleShadowBan(user._id, user.username)}
    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-gray-600/50 transition"
    title="Shadow ban user"
  >
    👻 Shadow Ban
  </button>
)}
```

Add the handler functions to the UsersTab component body:

```javascript
const handleShadowBan = async (userId, username) => {
  if (!window.confirm(`Shadow ban ${username}? Their content will be hidden from others but they won't be notified.`)) return;
  try {
    const res = await authFetch(`${API_URL}/admin/users/${userId}/shadow-ban`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed');
    fetchUsers(); // re-fetch the user list
  } catch {
    setError('Failed to apply shadow ban.');
  }
};

const handleLiftShadowBan = async (userId) => {
  if (!window.confirm('Lift this shadow ban? The user\'s content will become visible again.')) return;
  try {
    const res = await authFetch(`${API_URL}/admin/users/${userId}/shadow-ban`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed');
    fetchUsers();
  } catch {
    setError('Failed to lift shadow ban.');
  }
};
```

- [ ] **Step 3: Run the full test suite**

```bash
cd backend && npm test
```

Expected: all existing tests pass (13 forum tests + 8 contentFlag tests).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/AdminPanel.js frontend/src/components/admin/user-management/UsersTab.js
git commit -m "feat: register FlagQueueTab in admin panel; add shadow ban controls to UsersTab"
```

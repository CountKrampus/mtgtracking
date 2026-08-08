# Profile Pictures (Avatars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-uploadable profile pictures with in-browser crop and MTG-themed preset avatars (mana symbols + planeswalker silhouettes), displayed everywhere users appear: forum posts, leaderboard, hover cards, chat, and profile pages.

**Architecture:** `User.avatarUrl` stores either a file path (`/api/users/avatar/<uuid>.jpg`) or a preset identifier (`preset:mana-blue`). Uploaded files are stored on disk in `backend/user-avatars/`. A shared `<UserAvatar>` component handles all three render cases (upload, preset, colour-initial fallback). `authorAvatarUrl` is denormalized onto `ForumPost` and `Message` documents at creation time (same pattern as `authorUsername`) to avoid N+1 lookups.

**Tech Stack:** Node.js + Express + Mongoose, multer (already in project), React + Tailwind CSS, react-image-crop (new dependency)

Include the profile creation, along with a forum profile

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `backend/models/User.js` | Add `avatarUrl` field; add to `toSafeObject()` |
| Modify | `backend/models/ForumPost.js` | Add `authorAvatarUrl` denormalized field |
| Modify | `backend/models/Message.js` | Add `senderAvatarUrl` denormalized field |
| Modify | `backend/server.js` | Add AVATAR_DIR setup + static serving |
| Modify | `backend/routes/users.js` | POST/DELETE avatar routes; PUT /me accepts preset avatarUrl |
| Modify | `backend/routes/forum.js` | Pass `authorAvatarUrl` at post/thread creation; add to batch enrichment; add to activity route |
| Modify | `backend/routes/chat.js` | Pass `senderAvatarUrl` at message creation |
| Modify | `backend/.gitignore` | Add `user-avatars/` |
| Create | `frontend/src/components/avatars/presets.js` | 17 MTG avatar SVGs (7 mana + 10 planeswalkers) |
| Create | `frontend/src/components/avatars/UserAvatar.js` | Shared avatar component |
| Create | `frontend/src/components/avatars/AvatarPicker.js` | Upload+crop and preset picker modal |
| Modify | `frontend/src/components/auth/AccountSettings.js` | Add avatar section to Profile tab |
| Modify | `frontend/src/components/Forum/ForumThreadView.js` | Swap `getAvatarColor` → `<UserAvatar>` |
| Modify | `frontend/src/components/Forum/ForumLeaderboard.js` | Swap `getAvatarColor` → `<UserAvatar>` |
| Modify | `frontend/src/components/Forum/UserHoverCard.js` | Accept `avatarUrl` prop; swap `getAvatarColor` → `<UserAvatar>` |
| Modify | `frontend/src/components/Chat.js` | Swap `getColorFromUsername` → `<UserAvatar>` |
| Modify | `frontend/src/components/UserProfile.js` | Swap colour-initial div → `<UserAvatar size="lg">` |
| Create | `frontend/src/components/Forum/ForumProfile.js` | New `/forum/u/:username` page (hero + two-column) |
| Modify | `frontend/src/components/Forum/Forum.js` | Route `/forum/u/:username` to ForumProfile |

---

### Task 1: Data models + .gitignore

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/models/ForumPost.js`
- Modify: `backend/models/Message.js`
- Test: `backend/__tests__/avatar.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/avatar.test.js`:

```javascript
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

const User = require('../models/User');
const ForumPost = require('../models/ForumPost');
const Message = require('../models/Message');

test('User.avatarUrl defaults to empty string', async () => {
  const user = await User.create({ email: 'a@test.com', username: 'avtest1', passwordHash: 'x' });
  expect(user.avatarUrl).toBe('');
});

test('User.toSafeObject includes avatarUrl', async () => {
  const user = await User.create({ email: 'b@test.com', username: 'avtest2', passwordHash: 'x', avatarUrl: 'preset:mana-blue' });
  expect(user.toSafeObject().avatarUrl).toBe('preset:mana-blue');
});

test('ForumPost.authorAvatarUrl defaults to empty string', async () => {
  const user = await User.create({ email: 'c@test.com', username: 'avtest3', passwordHash: 'x' });
  const cat = await mongoose.model('ForumCategory').create({ name: 'Test', slug: 'test-av' });
  const thread = await mongoose.model('ForumThread').create({
    categoryId: cat._id, authorId: user._id, authorUsername: 'avtest3', title: 'T', body: 'B'
  });
  const post = await ForumPost.create({
    threadId: thread._id, authorId: user._id, authorUsername: 'avtest3', body: 'Hello'
  });
  expect(post.authorAvatarUrl).toBe('');
});

test('Message.senderAvatarUrl defaults to empty string', async () => {
  const user = await User.create({ email: 'd@test.com', username: 'avtest4', passwordHash: 'x' });
  const msg = await Message.create({ senderId: user._id, senderUsername: 'avtest4', body: 'Hi' });
  expect(msg.senderAvatarUrl).toBe('');
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `avatarUrl` fields don't exist yet.

- [ ] **Step 3: Add `avatarUrl` to User model**

In `backend/models/User.js`, add this field after the `badges` array (before `communityStats`):

```javascript
  avatarUrl: {
    type: String,
    default: ''
  },
```

Also update `toSafeObject()` — add `avatarUrl: this.avatarUrl,` after `badges: this.badges,`:

```javascript
userSchema.methods.toSafeObject = function() {
  return {
    _id: this._id,
    email: this.email,
    username: this.username,
    displayName: this.displayName,
    role: this.role,
    permissions: this.permissions,
    isActive: this.isActive,
    privacy: this.privacy,
    reputation: this.reputation,
    badges: this.badges,
    avatarUrl: this.avatarUrl,
    communityStats: this.communityStats,
    formats: this.formats,
    bannerCard: this.bannerCard,
    favoriteCards: this.favoriteCards,
    buystPercentage: this.buystPercentage ?? 50,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLoginAt: this.lastLoginAt,
    staffSince: this.staffSince
  };
};
```

- [ ] **Step 4: Add `authorAvatarUrl` to ForumPost model**

In `backend/models/ForumPost.js`, add after `authorDisplayName`:

```javascript
  authorAvatarUrl:   { type: String, default: '' },
```

- [ ] **Step 5: Add `senderAvatarUrl` to Message model**

In `backend/models/Message.js`, add after `senderDisplayName`:

```javascript
  senderAvatarUrl: {
    type: String,
    default: ''
  },
```

- [ ] **Step 6: Update .gitignore**

In `backend/.gitignore` (or root `.gitignore`, whichever controls the backend directory), add:

```
user-avatars/
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -10
```

Expected: 4 passing.

- [ ] **Step 8: Run full test suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: all tests passing.

- [ ] **Step 9: Commit**

```bash
git add backend/models/User.js backend/models/ForumPost.js backend/models/Message.js backend/__tests__/avatar.test.js .gitignore
git commit -m "feat: add avatarUrl to User, ForumPost, Message models"
```

---

### Task 2: Avatar file serving + upload/delete routes

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/routes/users.js`

The pattern for file storage exactly mirrors how `custom-arts` is handled in `server.js` (line 97–115). Study that code before making changes.

- [ ] **Step 1: Add tests for upload and delete routes**

Add to `backend/__tests__/avatar.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

function makeToken(userId, username) {
  return jwt.sign(
    { userId, username, type: 'access', issuer: 'mtg-tracker', audience: 'mtg-tracker-users' },
    'test-secret',
    { expiresIn: '1h' }
  );
}

function buildUsersApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/users'));
  return app;
}

// Minimal valid JPEG buffer (22 bytes)
const JPEG_BYTES = Buffer.from([
  0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
  0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9
]);

test('POST /api/users/me/avatar rejects non-image mimetype', async () => {
  const user = await User.create({ email: 'up1@test.com', username: 'uptest1', passwordHash: 'x' });
  const token = makeToken(user._id.toString(), 'uptest1');
  const app = buildUsersApp();
  const res = await request(app)
    .post('/api/users/me/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('image', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' });
  expect(res.status).toBe(400);
});

test('DELETE /api/users/me/avatar clears avatarUrl', async () => {
  const user = await User.create({
    email: 'del1@test.com', username: 'deltest1', passwordHash: 'x',
    avatarUrl: 'preset:mana-blue'
  });
  const token = makeToken(user._id.toString(), 'deltest1');
  const app = buildUsersApp();
  const res = await request(app)
    .delete('/api/users/me/avatar')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.avatarUrl).toBe('');
  const updated = await User.findById(user._id);
  expect(updated.avatarUrl).toBe('');
});
```

- [ ] **Step 2: Run new tests — expect failure**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Add AVATAR_DIR setup and static serving to server.js**

In `backend/server.js`, find the `CUSTOM_ART_DIR` block (around line 97). Add the avatar directory setup immediately after it:

```javascript
const AVATAR_DIR = path.join(__dirname, 'user-avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
app.use('/api/users/avatar', cors(), (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=31536000');
  next();
}, express.static(AVATAR_DIR));
```

- [ ] **Step 4: Add multer + upload/delete routes to users.js**

At the top of `backend/routes/users.js`, after the existing `require` statements, add:

```javascript
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'user-avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.jpg`),
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      return cb(new Error('Images only (JPEG, PNG, WebP)'));
    cb(null, true);
  },
});
```

Then, after the existing `GET /me` route and before `PUT /me`, add the upload and delete routes:

```javascript
/**
 * POST /api/users/me/avatar
 * Upload a new avatar image (multipart/form-data, field: image)
 */
router.post('/me/avatar', (req, res) => {
  uploadAvatar.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Delete old uploaded file from disk (not presets)
      if (user.avatarUrl && user.avatarUrl.startsWith('/api/users/avatar/')) {
        const oldFile = path.join(AVATAR_DIR, path.basename(user.avatarUrl));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      user.avatarUrl = `/api/users/avatar/${req.file.filename}`;
      await user.save();
      res.json({ avatarUrl: user.avatarUrl });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

/**
 * DELETE /api/users/me/avatar
 * Remove avatar and revert to colour-initial fallback
 */
router.delete('/me/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.avatarUrl && user.avatarUrl.startsWith('/api/users/avatar/')) {
      const oldFile = path.join(AVATAR_DIR, path.basename(user.avatarUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    user.avatarUrl = '';
    await user.save();
    res.json({ avatarUrl: '' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -10
```

Expected: 6 passing.

- [ ] **Step 6: Run full suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add backend/server.js backend/routes/users.js
git commit -m "feat: add avatar upload/delete routes and file serving"
```

---

### Task 3: Preset support + public routes

**Files:**
- Modify: `backend/routes/users.js` (PUT /me)
- Modify: `backend/server.js` (GET /api/users/profile/:username)
- Modify: `backend/routes/forum.js` (GET /api/forum/users/:username/activity)

- [ ] **Step 1: Add test for preset avatarUrl via PUT /me**

Add to `backend/__tests__/avatar.test.js`:

```javascript
test('PUT /api/users/me accepts preset avatarUrl', async () => {
  const user = await User.create({ email: 'pr1@test.com', username: 'prtest1', passwordHash: 'x' });
  const token = makeToken(user._id.toString(), 'prtest1');
  const app = buildUsersApp();
  const res = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ avatarUrl: 'preset:jace' });
  expect(res.status).toBe(200);
  expect(res.body.avatarUrl).toBe('preset:jace');
});

test('PUT /api/users/me rejects non-preset avatarUrl', async () => {
  const user = await User.create({ email: 'pr2@test.com', username: 'prtest2', passwordHash: 'x' });
  const token = makeToken(user._id.toString(), 'prtest2');
  const app = buildUsersApp();
  const res = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ avatarUrl: 'http://evil.com/hack.jpg' });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run new tests — expect failure**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — PUT /me doesn't accept avatarUrl yet.

- [ ] **Step 3: Update PUT /me to accept preset avatarUrl**

In `backend/routes/users.js`, find the `PUT /me` handler. In the destructure line (currently `const { displayName, email, privacy, favoriteCards, formats, bannerCard } = req.body;`), add `avatarUrl`:

```javascript
const { displayName, email, privacy, favoriteCards, formats, bannerCard, avatarUrl } = req.body;
```

Then, before `await user.save()`, add:

```javascript
    // Update avatarUrl only for preset identifiers (uploads use POST /me/avatar)
    if (avatarUrl !== undefined) {
      if (!String(avatarUrl).startsWith('preset:') && avatarUrl !== '') {
        return res.status(400).json({ message: 'avatarUrl must be a preset identifier (preset:...) or empty string' });
      }
      user.avatarUrl = avatarUrl;
    }
```

- [ ] **Step 4: Add avatarUrl to public profile response**

In `backend/server.js`, find `GET /api/users/profile/:username` (around line 3873). In the `profile` object construction (around line 3885), add `avatarUrl` after `bio`:

```javascript
    const profile = {
      username: user.username,
      displayName: user.displayName || user.username,
      bio: user.privacy?.bio || '',
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      // ... rest unchanged
    };
```

- [ ] **Step 5: Add avatarUrl to forum activity route**

In `backend/routes/forum.js`, find `GET /api/forum/users/:username/activity`. The `user` is fetched with `.select('privacy reputation badges createdAt')`. Add `avatarUrl` to the select:

```javascript
    const user = await User.findOne({ username: req.params.username })
      .select('privacy reputation badges createdAt avatarUrl').lean();
```

Then in the `res.json(...)` response, add `avatarUrl: user.avatarUrl || '',` at the top level:

```javascript
    res.json({
      avatarUrl: user.avatarUrl || '',
      reputation: user.reputation ?? 0,
      badges: user.badges || [],
      // ... rest unchanged
    });
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest __tests__/avatar.test.js --no-coverage 2>&1 | tail -10
```

Expected: 8 passing.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/users.js backend/server.js backend/routes/forum.js
git commit -m "feat: add preset avatarUrl support and avatarUrl to public routes"
```

---

### Task 4: Forum + chat route changes

**Files:**
- Modify: `backend/routes/forum.js`
- Modify: `backend/routes/chat.js`

`req.user` is populated by `user.toSafeObject()` in `backend/middleware/auth.js`. Since Task 1 added `avatarUrl` to `toSafeObject()`, `req.user.avatarUrl` is now available in all auth'd route handlers.

- [ ] **Step 1: Add authorAvatarUrl to thread creation**

In `backend/routes/forum.js`, find `POST /api/forum/threads` (the `ForumThread.create({...})` call). Add `authorAvatarUrl` alongside `authorDisplayName`:

```javascript
    const thread = await ForumThread.create({
      categoryId,
      authorId: req.user._id,
      authorUsername: req.user.username,
      authorDisplayName: req.user.displayName || req.user.username,
      authorAvatarUrl: req.user.avatarUrl || '',
      title: title.trim(),
      // ... rest unchanged
    });
```

Note: `ForumThread` does NOT have `authorAvatarUrl` in its schema — this is only for `ForumPost`. For threads, the avatar comes from the batch enrichment in `GET /threads/:id`. Skip adding to the thread create call.

- [ ] **Step 2: Add authorAvatarUrl to post creation**

In `backend/routes/forum.js`, find `POST /api/forum/posts` (the `ForumPost.create({...})` call). Add `authorAvatarUrl`:

```javascript
    const post = await ForumPost.create({
      threadId,
      parentPostId: parentPostId || null,
      authorId: req.user._id,
      authorUsername: req.user.username,
      authorDisplayName: req.user.displayName || req.user.username,
      authorAvatarUrl: req.user.avatarUrl || '',
      body: body.trim(),
      // ... rest unchanged
    });
```

- [ ] **Step 3: Add avatarUrl to batch author enrichment in GET /threads/:id**

Find the batch enrichment code in `GET /api/forum/threads/:id` (around line 218):

```javascript
    const authorDocs = await User.find({ _id: { $in: authorIds } })
      .select('reputation badges').lean();
```

Change to:

```javascript
    const authorDocs = await User.find({ _id: { $in: authorIds } })
      .select('reputation badges avatarUrl').lean();
```

Then in `postsWithMeta`, add `authorAvatarUrl` (using live value from User doc, falling back to stored value on post):

```javascript
    const postsWithMeta = flatPosts.map(p => {
      const authorData = authorMap[p.authorId?.toString()] || {};
      return {
        ...p,
        upvoteCount: p.upvotes.length,
        hasUpvoted: userId ? p.upvotes.some(id => id.toString() === userId) : false,
        upvotes: undefined,
        authorReputation: authorData.reputation ?? 0,
        authorBadges: (authorData.badges || []).slice(0, 5),
        authorAvatarUrl: authorData.avatarUrl || p.authorAvatarUrl || ''
      };
    });
```

Also update the thread author enrichment:

```javascript
    const threadAuthorData = authorMap[thread.authorId?.toString()] || {};
    res.json({
      thread: {
        ...thread,
        upvoteCount: thread.upvotes.length,
        hasUpvoted: userId ? thread.upvotes.some(id => id.toString() === userId) : false,
        upvotes: undefined,
        authorReputation: threadAuthorData.reputation ?? 0,
        authorBadges: (threadAuthorData.badges || []).slice(0, 5),
        authorAvatarUrl: threadAuthorData.avatarUrl || ''
      },
      posts: buildPostTree(postsWithMeta)
    });
```

- [ ] **Step 4: Add senderAvatarUrl to chat message creation**

In `backend/routes/chat.js`, find `POST /api/chat/messages`. In the `new Message({...})` call, add `senderAvatarUrl`:

```javascript
    const message = new Message({
      senderId: userId,
      senderUsername: req.user.username,
      senderDisplayName: req.user.displayName || req.user.username,
      senderAvatarUrl: req.user.avatarUrl || '',
      body: body.trim(),
      isShadowHidden: author?.isShadowBanned === true
    });
```

- [ ] **Step 5: Run full test suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/forum.js backend/routes/chat.js
git commit -m "feat: pass authorAvatarUrl/senderAvatarUrl at creation; enrich thread view with live avatarUrl"
```

---

### Task 5: Avatar preset SVGs

**Files:**
- Create: `frontend/src/components/avatars/presets.js`

- [ ] **Step 1: Create the avatars directory and presets file**

Create `frontend/src/components/avatars/presets.js` with the full content below. Each SVG is a self-contained string with `viewBox="0 0 64 64"`.

```javascript
export const AVATAR_PRESETS = [
  // ── Mana Symbols ──────────────────────────────────────────────────────────
  {
    id: 'mana-white',
    label: 'White Mana',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#f0e6c8" stroke="#d4a017" stroke-width="2"/>
  <text x="32" y="46" text-anchor="middle" fill="#5a4a00" font-family="Georgia,serif" font-weight="bold" font-size="36">W</text>
</svg>`
  },
  {
    id: 'mana-blue',
    label: 'Blue Mana',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#3b82f6"/>
  <text x="32" y="46" text-anchor="middle" fill="white" font-family="Georgia,serif" font-weight="bold" font-size="36">U</text>
</svg>`
  },
  {
    id: 'mana-black',
    label: 'Black Mana',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#1f2937"/>
  <text x="32" y="46" text-anchor="middle" fill="#d1d5db" font-family="Georgia,serif" font-weight="bold" font-size="36">B</text>
</svg>`
  },
  {
    id: 'mana-red',
    label: 'Red Mana',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#ef4444"/>
  <text x="32" y="46" text-anchor="middle" fill="white" font-family="Georgia,serif" font-weight="bold" font-size="36">R</text>
</svg>`
  },
  {
    id: 'mana-green',
    label: 'Green Mana',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#22c55e"/>
  <text x="32" y="46" text-anchor="middle" fill="white" font-family="Georgia,serif" font-weight="bold" font-size="36">G</text>
</svg>`
  },
  {
    id: 'mana-colorless',
    label: 'Colorless',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#6b7280"/>
  <text x="32" y="46" text-anchor="middle" fill="white" font-family="Georgia,serif" font-weight="bold" font-size="36">C</text>
</svg>`
  },
  {
    id: 'mana-multi',
    label: 'Multicolor',
    category: 'mana',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#eab308"/>
  <text x="32" y="46" text-anchor="middle" fill="#1a1000" font-family="Georgia,serif" font-weight="bold" font-size="36">M</text>
</svg>`
  },

  // ── Planeswalker Silhouettes ───────────────────────────────────────────────
  {
    id: 'jace',
    label: 'Jace',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#1e3a5f"/>
  <!-- Hood (large, covers head) -->
  <ellipse cx="32" cy="18" rx="14" ry="12" fill="white"/>
  <!-- Hood peak -->
  <polygon points="18,14 32,4 46,14" fill="white"/>
  <!-- Face (dark cutout) -->
  <ellipse cx="32" cy="20" rx="7" ry="6" fill="#1e3a5f"/>
  <!-- Robes -->
  <ellipse cx="32" cy="44" rx="11" ry="16" fill="white"/>
</svg>`
  },
  {
    id: 'liliana',
    label: 'Liliana',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#2d1b4e"/>
  <!-- Head -->
  <circle cx="32" cy="18" r="8" fill="white"/>
  <!-- Hair flowing up-left -->
  <path d="M24,14 Q12,4 14,18 Q16,22 24,20Z" fill="white"/>
  <!-- Hair flowing up-right -->
  <path d="M40,14 Q52,4 50,18 Q48,22 40,20Z" fill="white"/>
  <!-- Body/dress -->
  <path d="M22,28 Q18,50 32,56 Q46,50 42,28 Q37,24 32,26 Q27,24 22,28Z" fill="white"/>
  <!-- Arms outstretched -->
  <path d="M22,32 Q10,28 8,36 Q12,40 22,36Z" fill="white"/>
  <path d="M42,32 Q54,28 56,36 Q52,40 42,36Z" fill="white"/>
</svg>`
  },
  {
    id: 'chandra',
    label: 'Chandra',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#7f1d1d"/>
  <!-- Flame above head -->
  <path d="M32,2 Q26,8 28,14 Q24,10 26,16 Q22,12 26,18 Q28,16 32,14 Q36,16 38,18 Q42,12 38,16 Q40,10 36,14 Q38,8 32,2Z" fill="white"/>
  <!-- Head -->
  <circle cx="32" cy="24" r="8" fill="white"/>
  <!-- Body -->
  <path d="M22,34 Q20,50 32,56 Q44,50 42,34 Q37,30 32,32 Q27,30 22,34Z" fill="white"/>
</svg>`
  },
  {
    id: 'nissa',
    label: 'Nissa',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#14532d"/>
  <!-- Head (elf, slightly narrow) -->
  <ellipse cx="32" cy="18" rx="7" ry="8" fill="white"/>
  <!-- Pointed ears -->
  <polygon points="25,14 20,10 23,17" fill="white"/>
  <polygon points="39,14 44,10 41,17" fill="white"/>
  <!-- Slim body -->
  <ellipse cx="32" cy="42" rx="8" ry="14" fill="white"/>
  <!-- Staff -->
  <rect x="43" y="14" width="3" height="40" rx="1.5" fill="white"/>
  <!-- Leaf at staff top -->
  <ellipse cx="44.5" cy="12" rx="5" ry="3" fill="white" transform="rotate(-30 44.5 12)"/>
</svg>`
  },
  {
    id: 'gideon',
    label: 'Gideon',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#1e3a5f"/>
  <!-- Head -->
  <circle cx="32" cy="16" r="8" fill="white"/>
  <!-- Very wide shoulders (warrior) -->
  <rect x="12" y="26" width="40" height="6" rx="3" fill="white"/>
  <!-- Body (broad) -->
  <rect x="20" y="30" width="24" height="26" rx="4" fill="white"/>
  <!-- Legs -->
  <rect x="20" y="52" width="10" height="10" rx="2" fill="white"/>
  <rect x="34" y="52" width="10" height="10" rx="2" fill="white"/>
</svg>`
  },
  {
    id: 'ajani',
    label: 'Ajani',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#7f1d1d"/>
  <!-- Mane (large ring) -->
  <circle cx="32" cy="22" r="16" fill="white"/>
  <!-- Mane dark center -->
  <circle cx="32" cy="22" r="10" fill="#7f1d1d"/>
  <!-- Cat head -->
  <circle cx="32" cy="20" r="8" fill="white"/>
  <!-- Cat ears -->
  <polygon points="24,14 20,6 28,12" fill="white"/>
  <polygon points="40,14 44,6 36,12" fill="white"/>
  <!-- Body -->
  <ellipse cx="32" cy="46" rx="10" ry="14" fill="white"/>
</svg>`
  },
  {
    id: 'teferi',
    label: 'Teferi',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#1e3a5f"/>
  <!-- Bald head (smooth, no hair) -->
  <circle cx="32" cy="16" r="8" fill="white"/>
  <!-- Tall robes -->
  <ellipse cx="32" cy="44" rx="9" ry="16" fill="white"/>
  <!-- Staff (tall, crosses body) -->
  <rect x="44" y="6" width="3" height="52" rx="1.5" fill="white"/>
  <!-- Hourglass / time orb at staff top -->
  <circle cx="45.5" cy="8" r="5" fill="white"/>
  <circle cx="45.5" cy="8" r="2.5" fill="#1e3a5f"/>
</svg>`
  },
  {
    id: 'elspeth',
    label: 'Elspeth',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#1e3a5f"/>
  <!-- Head with helmet -->
  <circle cx="32" cy="16" r="8" fill="white"/>
  <!-- Helmet crest -->
  <rect x="29" y="6" width="6" height="4" rx="2" fill="white"/>
  <!-- Armoured body -->
  <rect x="22" y="26" width="20" height="22" rx="3" fill="white"/>
  <!-- Shield on left arm -->
  <path d="M10,28 Q8,40 16,46 Q20,42 20,28Z" fill="white"/>
  <!-- Sword raised right -->
  <rect x="44" y="8" width="3" height="30" rx="1.5" fill="white"/>
  <!-- Crossguard -->
  <rect x="40" y="22" width="11" height="3" rx="1.5" fill="white"/>
  <!-- Legs -->
  <rect x="22" y="46" width="8" height="12" rx="2" fill="white"/>
  <rect x="34" y="46" width="8" height="12" rx="2" fill="white"/>
</svg>`
  },
  {
    id: 'sorin',
    label: 'Sorin',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#0f0a1a"/>
  <!-- Cape (wide, dramatic) -->
  <path d="M32,26 Q8,30 6,56 Q20,52 32,58 Q44,52 58,56 Q56,30 32,26Z" fill="white"/>
  <!-- Cape inner shadow -->
  <path d="M32,28 Q14,32 12,54 Q22,50 32,54 Q42,50 52,54 Q50,32 32,28Z" fill="#0f0a1a"/>
  <!-- Head -->
  <circle cx="32" cy="16" r="8" fill="white"/>
  <!-- Collar/lapel peaks -->
  <polygon points="24,26 20,20 28,24" fill="white"/>
  <polygon points="40,26 44,20 36,24" fill="white"/>
</svg>`
  },
  {
    id: 'karn',
    label: 'Karn',
    category: 'planeswalker',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="32" fill="#374151"/>
  <!-- Integrated head+torso (golem, no neck) -->
  <rect x="18" y="10" width="28" height="20" rx="6" fill="white"/>
  <!-- Golem face (recessed, symmetric) -->
  <rect x="22" y="14" width="20" height="12" rx="3" fill="#374151"/>
  <!-- Eyes (glowing) -->
  <circle cx="27" cy="19" r="3" fill="white"/>
  <circle cx="37" cy="19" r="3" fill="white"/>
  <!-- Wide lower body -->
  <rect x="16" y="28" width="32" height="26" rx="4" fill="white"/>
  <!-- Chest plate details -->
  <rect x="24" y="32" width="16" height="8" rx="2" fill="#374151"/>
  <!-- Legs (short, wide) -->
  <rect x="16" y="50" width="12" height="12" rx="3" fill="white"/>
  <rect x="36" y="50" width="12" height="12" rx="3" fill="white"/>
</svg>`
  },
];

export const PRESET_MAP = Object.fromEntries(AVATAR_PRESETS.map(p => [p.id, p]));
```

- [ ] **Step 2: Verify the file renders correctly**

Open a browser and paste this test snippet in the console to verify SVGs render — or just proceed to Task 6 where UserAvatar will render them.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatars/presets.js
git commit -m "feat: add MTG avatar preset SVGs (7 mana + 10 planeswalkers)"
```

---

### Task 6: UserAvatar shared component

**Files:**
- Create: `frontend/src/components/avatars/UserAvatar.js`

- [ ] **Step 1: Create UserAvatar.js**

Create `frontend/src/components/avatars/UserAvatar.js`:

```javascript
import React from 'react';
import { PRESET_MAP } from './presets';

const SIZE_MAP = {
  sm: 28,
  md: 40,
  lg: 72,
};

const COLOR_PALETTE = [
  'bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
  'bg-pink-600', 'bg-yellow-600', 'bg-indigo-600', 'bg-teal-600',
];

function getAvatarColor(username) {
  let h = 0;
  for (const c of (username || 'x')) h = ((h << 5) - h) + c.charCodeAt(0);
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

export default function UserAvatar({ username = '', avatarUrl = '', size = 'md', className = '' }) {
  const px = SIZE_MAP[size] || SIZE_MAP.md;
  const style = { width: px, height: px, flexShrink: 0 };
  const baseClass = `rounded-full overflow-hidden flex items-center justify-center ${className}`;
  const fontSize = px <= 28 ? 'text-xs' : px <= 40 ? 'text-sm' : 'text-2xl';

  // Uploaded photo
  if (avatarUrl && avatarUrl.startsWith('/api/users/avatar/')) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        style={style}
        className={`${baseClass} object-cover`}
      />
    );
  }

  // Preset SVG
  if (avatarUrl && avatarUrl.startsWith('preset:')) {
    const presetId = avatarUrl.slice(7);
    const preset = PRESET_MAP[presetId];
    if (preset) {
      return (
        <div style={style} className={baseClass} dangerouslySetInnerHTML={{ __html: preset.svg }} />
      );
    }
  }

  // Colour-initial fallback
  return (
    <div style={style} className={`${baseClass} ${getAvatarColor(username)} font-bold text-white ${fontSize}`}>
      {(username[0] || '?').toUpperCase()}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component logic is correct**

Read through the component and verify:
- `size="sm"` → 28×28px
- `size="md"` → 40×40px
- `size="lg"` → 72×72px
- Uploaded path → `<img>`
- Preset path → inline SVG via `dangerouslySetInnerHTML`
- Empty/unknown path → colour initial div

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatars/UserAvatar.js
git commit -m "feat: add UserAvatar shared component"
```

---

### Task 7: AvatarPicker modal

**Files:**
- Modify: `frontend/package.json` (add react-image-crop)
- Create: `frontend/src/components/avatars/AvatarPicker.js`

- [ ] **Step 1: Install react-image-crop**

```bash
cd "d:\Card Tracker\mtg-tracker\frontend" && npm install react-image-crop
```

Expected: react-image-crop appears in package.json dependencies.

- [ ] **Step 2: Create AvatarPicker.js**

Create `frontend/src/components/avatars/AvatarPicker.js`:

```javascript
import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Upload, Image } from 'lucide-react';
import { AVATAR_PRESETS } from './presets';
import UserAvatar from './UserAvatar';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
const ACCESS_TOKEN_KEY = 'mtg_access_token';

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}` };
}

export default function AvatarPicker({ currentAvatarUrl, username, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const imgRef = useRef(null);

  const MAX_BYTES = 2 * 1024 * 1024;

  function onFileSelect(e) {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
  }

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const c = centerCrop(makeAspectCrop({ unit: '%', width: 80 }, 1, width, height), width, height);
    setCrop(c);
  }

  async function getCroppedBlob() {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    ctx.drawImage(
      image,
      completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, 200, 200
    );
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }

  async function handleUploadSave() {
    setError('');
    const blob = await getCroppedBlob();
    if (!blob) { setError('Please select and crop an image first'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', blob, 'avatar.jpg');
      const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'POST', headers: authHeader(), body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      onSave(data.avatarUrl);
      onClose();
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handlePresetSelect(presetId) {
    setError('');
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: `preset:${presetId}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to select preset');
      onSave(`preset:${presetId}`);
      onClose();
    } catch (e) { setError(e.message); }
  }

  async function handleRemove() {
    setError('');
    try {
      const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'DELETE', headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove');
      onSave('');
      onClose();
    } catch (e) { setError(e.message); }
  }

  const manaPresets = AVATAR_PRESETS.filter(p => p.category === 'mana');
  const pwPresets = AVATAR_PRESETS.filter(p => p.category === 'planeswalker');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <UserAvatar username={username} avatarUrl={currentAvatarUrl} size="sm" />
            <h2 className="text-white font-bold">Change Avatar</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[['upload', 'Upload Photo', Upload], ['presets', 'Presets', Image]].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                activeTab === id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Upload tab */}
          {activeTab === 'upload' && (
            <div>
              {!imgSrc ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition">
                  <Upload size={28} className="text-white/30 mb-2" />
                  <span className="text-white/50 text-sm">Click to choose a photo</span>
                  <span className="text-white/30 text-xs mt-1">JPEG, PNG, WebP · max 2 MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                </label>
              ) : (
                <div>
                  <div className="flex justify-center mb-3">
                    <ReactCrop
                      crop={crop}
                      onChange={setCrop}
                      onComplete={setCompletedCrop}
                      aspect={1}
                      circularCrop
                      minWidth={100}
                    >
                      <img
                        ref={imgRef}
                        src={imgSrc}
                        onLoad={onImageLoad}
                        style={{ maxHeight: 280, maxWidth: '100%' }}
                        alt="crop preview"
                      />
                    </ReactCrop>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setImgSrc(''); setCrop(undefined); setCompletedCrop(undefined); }}
                      className="flex-1 py-1.5 text-sm text-white/50 hover:text-white border border-white/10 rounded-lg transition"
                    >
                      Choose different
                    </button>
                    <button
                      onClick={handleUploadSave}
                      disabled={uploading || !completedCrop}
                      className="flex-1 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition font-medium"
                    >
                      {uploading ? 'Saving…' : 'Save Photo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Presets tab */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Mana Symbols</div>
                <div className="flex flex-wrap gap-2">
                  {manaPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      title={preset.label}
                      className={`rounded-full border-2 transition ${
                        currentAvatarUrl === `preset:${preset.id}`
                          ? 'border-purple-500 shadow-lg shadow-purple-500/30'
                          : 'border-transparent hover:border-purple-500/50'
                      }`}
                    >
                      <UserAvatar username="" avatarUrl={`preset:${preset.id}`} size="md" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Planeswalkers</div>
                <div className="flex flex-wrap gap-2">
                  {pwPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      title={preset.label}
                      className={`rounded-full border-2 transition ${
                        currentAvatarUrl === `preset:${preset.id}`
                          ? 'border-purple-500 shadow-lg shadow-purple-500/30'
                          : 'border-transparent hover:border-purple-500/50'
                      }`}
                    >
                      <UserAvatar username="" avatarUrl={`preset:${preset.id}`} size="md" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Remove link */}
          {currentAvatarUrl && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <button
                onClick={handleRemove}
                className="text-xs text-red-400/70 hover:text-red-400 transition"
              >
                Remove photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatars/AvatarPicker.js frontend/package.json frontend/package-lock.json
git commit -m "feat: add AvatarPicker modal with upload/crop and preset tabs"
```

---

### Task 8: AccountSettings integration

**Files:**
- Modify: `frontend/src/components/auth/AccountSettings.js`

- [ ] **Step 1: Add avatar section to AccountSettings Profile tab**

In `frontend/src/components/auth/AccountSettings.js`:

1. Add imports at the top:

```javascript
import UserAvatar from '../avatars/UserAvatar';
import AvatarPicker from '../avatars/AvatarPicker';
```

2. Add state after the existing profile state declarations (after `profileMessage`):

```javascript
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(user?.avatarUrl || '');
```

3. In the Profile tab JSX (inside `{activeTab === 'profile' && ...}`), add an avatar section at the very top, before the Username field:

```jsx
              {/* Avatar section */}
              <div className="flex items-center gap-4 mb-2">
                <UserAvatar username={user?.username || ''} avatarUrl={localAvatarUrl} size="lg" />
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(true)}
                    className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    Change photo
                  </button>
                  {localAvatarUrl && (
                    <div className="text-xs text-gray-400 mt-1">
                      {localAvatarUrl.startsWith('preset:') ? `Preset: ${localAvatarUrl.slice(7)}` : 'Custom photo'}
                    </div>
                  )}
                </div>
              </div>
```

4. After the closing `</div>` of the modal (just before `return (` ends), render the picker:

```jsx
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatarUrl={localAvatarUrl}
          username={user?.username || ''}
          onClose={() => setShowAvatarPicker(false)}
          onSave={(newUrl) => {
            setLocalAvatarUrl(newUrl);
            // Update the auth context user so the rest of the UI refreshes
            updateProfile({ avatarUrl: newUrl === '' ? '' : undefined })
              .catch(() => {});
          }}
        />
      )}
```

> **Note on `onSave`:** When a photo is uploaded, the server already updated `user.avatarUrl` via `POST /api/users/me/avatar`. When a preset is selected, the server already updated it via `PUT /api/users/me`. Calling `updateProfile({})` re-fetches the user from the server and updates the auth context. The `localAvatarUrl` state handles the immediate UI update.

- [ ] **Step 2: Verify**

Manually test by opening Account Settings → Profile tab. You should see:
- Avatar circle at top with "Change photo" button
- Clicking "Change photo" opens the AvatarPicker modal
- Upload tab shows file picker → crop tool → save
- Presets tab shows mana symbols and planeswalker grid
- Selected preset gets a purple ring
- "Remove photo" link appears if avatar is set

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/AccountSettings.js
git commit -m "feat: add avatar section to AccountSettings profile tab"
```

---

### Task 9: Swap getAvatarColor in forum components

**Files:**
- Modify: `frontend/src/components/Forum/ForumThreadView.js`
- Modify: `frontend/src/components/Forum/ForumLeaderboard.js`
- Modify: `frontend/src/components/Forum/UserHoverCard.js`

In `ForumThreadView.js`, the API response for `GET /api/forum/threads/:id` now returns `authorAvatarUrl` on each post (from Task 4's batch enrichment) and on the thread object.

The `UserHoverCard` receives props from `ForumThreadView`. The hover state in `ForumThreadView` needs to include `avatarUrl`.

- [ ] **Step 1: Update ForumThreadView.js**

Read `frontend/src/components/Forum/ForumThreadView.js` lines 1–60 to confirm the exact `hoverPos` state shape and `UserHoverCard` usage.

Then make these changes:

**a)** Add `UserAvatar` import at top:
```javascript
import UserAvatar from '../avatars/UserAvatar';
```

**b)** Delete the `getAvatarColor` function (the one defined at line ~31 — the whole function block).

**c)** Find where `hoverPos` state is set for author username hover. It will look something like:
```javascript
const [hoverPos, setHoverPos] = useState(null);
// and on mouseEnter:
setHoverPos({ pos: ..., username: ..., displayName: ..., reputation: ..., badges: ... })
```
Add `avatarUrl: post.authorAvatarUrl || ''` to that state object.

**d)** Replace each `getAvatarColor` div in `PostNode` with `<UserAvatar>`:

The post author row (size `sm`, 28px):
```jsx
// BEFORE:
<div className={`w-8 h-8 rounded-full ${getAvatarColor(post.authorUsername)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
  {post.authorUsername[0].toUpperCase()}
</div>
// AFTER:
<UserAvatar username={post.authorUsername} avatarUrl={post.authorAvatarUrl || ''} size="sm" />
```

The thread OP section (size `sm`, 28px — uses `thread.authorUsername`):
```jsx
// BEFORE:
<div className={`w-6 h-6 rounded-full ${getAvatarColor(thread.authorUsername)} ...`}>
// AFTER:
<UserAvatar username={thread.authorUsername} avatarUrl={thread.authorAvatarUrl || ''} size="sm" />
```

The best-answer card (size `sm`):
```jsx
// BEFORE:
<div className={`w-7 h-7 rounded-full ${getAvatarColor(bestAnswerPost.authorUsername)} ...`}>
// AFTER:
<UserAvatar username={bestAnswerPost.authorUsername} avatarUrl={bestAnswerPost.authorAvatarUrl || ''} size="sm" />
```

**e)** Update the `UserHoverCard` render call to pass `avatarUrl`:
```jsx
<UserHoverCard
  pos={hoverPos.pos}
  username={hoverPos.username}
  displayName={hoverPos.displayName}
  reputation={hoverPos.reputation}
  badges={hoverPos.badges}
  avatarUrl={hoverPos.avatarUrl || ''}
  onClose={() => setHoverPos(null)}
/>
```

- [ ] **Step 2: Update UserHoverCard.js**

In `frontend/src/components/Forum/UserHoverCard.js`:

**a)** Add import:
```javascript
import UserAvatar from '../avatars/UserAvatar';
```

**b)** Delete the `getAvatarColor` function.

**c)** Update the component signature to accept `avatarUrl`:
```javascript
export default function UserHoverCard({ pos, username, displayName, reputation, badges, avatarUrl = '', onClose }) {
```

**d)** Replace the colour-initial div with `<UserAvatar>`:
```jsx
// BEFORE:
<div className={`w-8 h-8 rounded-full ${getAvatarColor(username)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
  {username[0].toUpperCase()}
</div>
// AFTER:
<UserAvatar username={username} avatarUrl={avatarUrl} size="sm" />
```

- [ ] **Step 3: Update ForumLeaderboard.js**

In `frontend/src/components/Forum/ForumLeaderboard.js`:

**a)** Add import:
```javascript
import UserAvatar from '../avatars/UserAvatar';
```

**b)** Delete the `getAvatarColor` function.

**c)** The leaderboard fetches `GET /api/forum/leaderboard`. Check what fields are returned. The leaderboard route returns `{ username, displayName, reputation, badges }`. Add `avatarUrl` to the leaderboard route in `backend/routes/forum.js`:

Find `GET /api/forum/leaderboard` and update the `.select()`:
```javascript
.select('username displayName reputation badges avatarUrl')
```

**d)** Replace the colour-initial div in ForumLeaderboard with `<UserAvatar size="md">`:
```jsx
// BEFORE:
<div className={`w-10 h-10 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
  {user.username[0].toUpperCase()}
</div>
// AFTER:
<UserAvatar username={user.username} avatarUrl={user.avatarUrl || ''} size="md" />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Forum/ForumThreadView.js frontend/src/components/Forum/UserHoverCard.js frontend/src/components/Forum/ForumLeaderboard.js backend/routes/forum.js
git commit -m "feat: use UserAvatar in forum thread view, leaderboard, and hover card"
```

---

### Task 10: Swap avatar in Chat and UserProfile

**Files:**
- Modify: `frontend/src/components/Chat.js`
- Modify: `frontend/src/components/UserProfile.js`

- [ ] **Step 1: Update Chat.js**

In `frontend/src/components/Chat.js`:

**a)** Add import:
```javascript
import UserAvatar from './avatars/UserAvatar';
```

**b)** Delete the `getColorFromUsername` function (lines 9+).

**c)** The chat API returns messages with `senderAvatarUrl` (added in Task 4). Replace the colour-initial div:
```jsx
// BEFORE:
<div className={`w-8 h-8 rounded-full ${getColorFromUsername(msg.senderUsername)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
  {msg.senderUsername.charAt(0).toUpperCase()}
</div>
// AFTER:
<UserAvatar username={msg.senderUsername} avatarUrl={msg.senderAvatarUrl || ''} size="sm" />
```

- [ ] **Step 2: Update UserProfile.js**

In `frontend/src/components/UserProfile.js`:

**a)** Add import:
```javascript
import UserAvatar from './avatars/UserAvatar';
```

**b)** Find the hero section that shows the colour-initial avatar (likely something like `<div className="w-20 h-20 rounded-full bg-purple-600 ..."`). Replace with:
```jsx
<UserAvatar username={profile.username} avatarUrl={profile.avatarUrl || ''} size="lg" />
```

The `profile` object comes from `GET /api/users/profile/:username` which now includes `avatarUrl` (added in Task 3).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat.js frontend/src/components/UserProfile.js
git commit -m "feat: use UserAvatar in chat messages and main user profile"
```

---

### Task 11: ForumProfile page (hero + two-column layout)

**Files:**
- Create: `frontend/src/components/Forum/ForumProfile.js`
- Modify: `frontend/src/components/Forum/Forum.js`

The ForumProfile page lives at `/forum/u/:username`. It fetches `GET /api/forum/users/:username/activity`. The layout is **hero + two-column**: big hero card (avatar, username, rep, badges) at top; left sidebar (stats + badges list); right column (top posts card + recent posts card).

- [ ] **Step 1: Create ForumProfile.js**

Create `frontend/src/components/Forum/ForumProfile.js`:

```javascript
import React, { useState, useEffect } from 'react';
import UserAvatar from '../avatars/UserAvatar';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

const BADGE_EMOJI = {
  'First Post': '📝', 'Century': '💬', 'Thread Starter': '🧵',
  'Deck Builder': '🃏', 'Collector': '📦', 'Veteran': '🗓️', 'Engaged Member': '🌟'
};

export default function ForumProfile({ username }) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/forum/users/${username}/activity`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Forum profile not available' : 'Failed to load');
        return r.json();
      })
      .then(data => { setActivity(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [username]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/40">Loading forum profile…</div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto mt-16 text-center">
      <div className="text-white/40 text-lg mb-2">{error}</div>
      <a href="/forum" className="text-purple-400 hover:text-purple-300 text-sm">← Back to Forum</a>
    </div>
  );

  const { avatarUrl = '', reputation = 0, badges = [], stats = {}, recentPosts = [], topPosts = [] } = activity;
  const memberSince = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <a href="/forum" className="inline-flex items-center gap-1 text-sm text-white/30 hover:text-white/60 transition mb-6">
        ← Back to Forum
      </a>

      {/* Hero */}
      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6"
           style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.25), rgba(30,27,75,0.4))' }}>
        <div className="flex items-center gap-5">
          <UserAvatar username={username} avatarUrl={avatarUrl} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-2xl font-bold text-white">{username}</span>
              {reputation > 0 && (
                <span className="text-amber-400 font-bold text-xl">⚡ {reputation.toLocaleString()}</span>
              )}
            </div>
            <div className="text-white/35 text-sm mb-3">Member since {memberSince}</div>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((badge, i) => (
                  <span key={i} className="text-xs bg-purple-900/30 border border-purple-700/30 text-purple-300 px-2 py-0.5 rounded-full"
                        title={badge.description}>
                    {BADGE_EMOJI[badge.name] || '🏅'} {badge.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <a href={`/u/${username}`} className="text-xs text-white/30 hover:text-white/60 transition whitespace-nowrap self-start">
            Main profile →
          </a>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Stats</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Posts', value: stats.postCount ?? 0, color: 'text-white' },
                { label: 'Threads', value: stats.threadCount ?? 0, color: 'text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded-lg p-2.5 text-center">
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
                </div>
              ))}
              <div className="col-span-2 bg-white/5 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-amber-400">{stats.upvotesReceived ?? 0}</div>
                <div className="text-[10px] text-white/35 mt-0.5">Upvotes received</div>
              </div>
            </div>
          </div>

          {/* All badges */}
          {badges.length > 0 && (
            <div className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Badges</div>
              <div className="space-y-1.5">
                {badges.map((badge, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{BADGE_EMOJI[badge.name] || '🏅'}</span>
                    <span className="text-purple-300">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Top posts */}
          {topPosts.length > 0 && (
            <div className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Top Posts</div>
              <div className="space-y-0">
                {topPosts.map(post => (
                  <div key={post._id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <div className="min-w-[44px] text-center py-1 bg-amber-400/10 rounded text-amber-400 font-bold text-sm flex-shrink-0">
                      ⬆ {post.upvoteCount}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a href={`/forum/threads/${post.threadId}`}
                         className="text-purple-400 hover:text-purple-300 text-sm transition block truncate">
                        {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                      </a>
                      <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent posts */}
          {recentPosts.length > 0 && (
            <div className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Recent Posts</div>
              <div className="space-y-0">
                {recentPosts.map(post => (
                  <div key={post._id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <a href={`/forum/threads/${post.threadId}`}
                         className="text-purple-400 hover:text-purple-300 text-sm transition block truncate">
                        {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                      </a>
                      <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                    </div>
                    <span className="text-white/25 text-xs whitespace-nowrap flex-shrink-0 mt-0.5">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topPosts.length === 0 && recentPosts.length === 0 && (
            <div className="text-center text-white/30 py-12">No forum activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to Forum.js**

In `frontend/src/components/Forum/Forum.js`, read the file to find how routing works (path matching). It uses `window.location.pathname` matching or a `path` prop. Add a `/forum/u/:username` route **before** the thread route check.

Find the block that looks like:
```javascript
const threadMatch = path.match(/^\/forum\/threads\/(.+)/);
```

Add before it:
```javascript
const profileMatch = path.match(/^\/forum\/u\/([^/]+)/);
if (profileMatch) {
  const ForumProfile = React.lazy(() => import('./ForumProfile'));
  return (
    <React.Suspense fallback={<div className="text-white/40 p-8">Loading…</div>}>
      <ForumProfile username={profileMatch[1]} />
    </React.Suspense>
  );
}
```

- [ ] **Step 3: Run full backend test suite**

```bash
cd "d:\Card Tracker\mtg-tracker\backend" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Forum/ForumProfile.js frontend/src/components/Forum/Forum.js
git commit -m "feat: add ForumProfile page at /forum/u/:username (hero + two-column layout)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `User.avatarUrl` field, default `''` | Task 1 |
| `ForumPost.authorAvatarUrl` denormalized field | Task 1 |
| `Message.senderAvatarUrl` denormalized field | Task 1 |
| `toSafeObject()` includes `avatarUrl` | Task 1 |
| `user-avatars/` added to `.gitignore` | Task 1 |
| `POST /api/users/me/avatar` — upload, validate mimetype/size, delete old file | Task 2 |
| `DELETE /api/users/me/avatar` — clear avatarUrl, delete file | Task 2 |
| `GET /api/users/avatar/:filename` — public static serve, 1-year cache | Task 2 |
| `PUT /api/users/me` accepts preset identifiers | Task 3 |
| Rejects non-preset avatarUrl strings | Task 3 |
| `GET /api/users/profile/:username` includes `avatarUrl` | Task 3 |
| `GET /api/forum/users/:username/activity` includes `avatarUrl` | Task 3 |
| `authorAvatarUrl` set on post creation | Task 4 |
| Batch enrichment overrides with live `avatarUrl` from User | Task 4 |
| `senderAvatarUrl` set on chat message creation | Task 4 |
| `presets.js` — 7 mana + 10 planeswalker SVGs | Task 5 |
| `UserAvatar` — handles upload path, preset path, fallback | Task 6 |
| `AvatarPicker` — upload tab with react-image-crop | Task 7 |
| `AvatarPicker` — presets tab with grid + selected indicator | Task 7 |
| "Remove photo" link | Task 7 |
| AccountSettings Profile tab shows avatar preview + Change button | Task 8 |
| `ForumThreadView` uses `UserAvatar` (sm for posts, sm for OP, sm for best-answer) | Task 9 |
| `UserHoverCard` accepts `avatarUrl` prop, uses `UserAvatar` | Task 9 |
| `ForumLeaderboard` uses `UserAvatar` + leaderboard route returns `avatarUrl` | Task 9 |
| `Chat.js` uses `UserAvatar` with `senderAvatarUrl` | Task 10 |
| `UserProfile.js` hero uses `UserAvatar size="lg"` | Task 10 |
| `ForumProfile.js` — `/forum/u/:username` — hero + two-column layout | Task 11 |
| `Forum.js` routes `/forum/u/:username` to ForumProfile | Task 11 |
| `react-image-crop` installed | Task 7 |

**Placeholder scan:** No TBDs or TODOs. All SVG content is complete actual code. All test assertions use real fields.

**Type consistency:**
- `avatarUrl` is a string everywhere — `''`, `'/api/users/avatar/uuid.jpg'`, or `'preset:id'`.
- `size` prop on `UserAvatar` is always `'sm'` | `'md'` | `'lg'` — consistent across all 11 usage sites.
- `authorAvatarUrl` used consistently between `ForumPost` schema, post creation, batch enrichment, and `ForumThreadView` render.

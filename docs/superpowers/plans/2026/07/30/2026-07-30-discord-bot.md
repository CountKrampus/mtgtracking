# Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full two-way Discord bot for MTG Tracker — account linking, collection/wishlist/deck commands, and price-alert notifications — per `docs/superpowers/specs/2026-07-09-discord-bot-design.md`.

**Architecture:** A standalone `discord-bot/` Node process (discord.js) with zero direct database access, calling the existing Express API over HTTP. It authenticates as itself with a shared service token (`DISCORD_BOT_SERVICE_TOKEN`) and names the acting user via an `X-Discord-User-Id` header; the backend's `verifyToken` middleware resolves that to a real account via a new `DiscordLink` collection and populates `req.user` exactly as it does for a normal session — so every existing route (`/api/cards`, `/api/wishlist`, `/api/decks`, ...) works for the bot completely unchanged.

**Tech Stack:** Node.js, Express, Mongoose (backend, already in place); `discord.js` v14, `axios`, `dotenv` (new `discord-bot/` process).

---

## Backend: linking infrastructure

### Task 1: `DiscordLink` model

**Files:**
- Create: `backend/models/DiscordLink.js`
- Test: `backend/__tests__/discordLink-model.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/discordLink-model.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DiscordLink = require('../models/DiscordLink');
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
  await DiscordLink.deleteMany({});
  await User.deleteMany({});
});

test('creates a link with userId and discordUserId', async () => {
  const user = await User.create({ email: 'a@test.com', username: 'a1', passwordHash: 'x', role: 'editor' });
  const link = await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  expect(link.discordUserId).toBe('discord-1');
  expect(link.linkedAt).toBeInstanceOf(Date);
});

test('rejects a second link for the same userId', async () => {
  const user = await User.create({ email: 'b@test.com', username: 'b1', passwordHash: 'x', role: 'editor' });
  await DiscordLink.create({ userId: user._id, discordUserId: 'discord-2' });
  await expect(DiscordLink.create({ userId: user._id, discordUserId: 'discord-3' })).rejects.toThrow();
});

test('rejects a second link for the same discordUserId', async () => {
  const user1 = await User.create({ email: 'c@test.com', username: 'c1', passwordHash: 'x', role: 'editor' });
  const user2 = await User.create({ email: 'd@test.com', username: 'd1', passwordHash: 'x', role: 'editor' });
  await DiscordLink.create({ userId: user1._id, discordUserId: 'discord-4' });
  await expect(DiscordLink.create({ userId: user2._id, discordUserId: 'discord-4' })).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discordLink-model -v`
Expected: FAIL with "Cannot find module '../models/DiscordLink'"

- [ ] **Step 3: Write the model**

```js
// backend/models/DiscordLink.js
const mongoose = require('mongoose');

const discordLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  discordUserId: {
    type: String,
    required: true,
    unique: true
  },
  linkedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DiscordLink', discordLinkSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discordLink-model -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/DiscordLink.js backend/__tests__/discordLink-model.test.js
git commit -m "feat: add DiscordLink model for Discord account linking"
```

---

### Task 2: `LinkCode` model

**Files:**
- Create: `backend/models/LinkCode.js`
- Test: `backend/__tests__/linkCode-model.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/linkCode-model.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const LinkCode = require('../models/LinkCode');
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
  await LinkCode.deleteMany({});
  await User.deleteMany({});
});

test('generateForUser creates a 6-character uppercase-hex code expiring in ~10 minutes', async () => {
  const user = await User.create({ email: 'a@test.com', username: 'a1', passwordHash: 'x', role: 'editor' });
  const linkCode = await LinkCode.generateForUser(user._id);

  expect(linkCode.code).toMatch(/^[0-9A-F]{6}$/);
  const msUntilExpiry = linkCode.expiresAt.getTime() - Date.now();
  expect(msUntilExpiry).toBeGreaterThan(9 * 60 * 1000);
  expect(msUntilExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
});

test('generateForUser removes any previous unused code for that user', async () => {
  const user = await User.create({ email: 'b@test.com', username: 'b1', passwordHash: 'x', role: 'editor' });
  const first = await LinkCode.generateForUser(user._id);
  const second = await LinkCode.generateForUser(user._id);

  expect(await LinkCode.findById(first._id)).toBeNull();
  expect(await LinkCode.findById(second._id)).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest linkCode-model -v`
Expected: FAIL with "Cannot find module '../models/LinkCode'"

- [ ] **Step 3: Write the model**

```js
// backend/models/LinkCode.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const linkCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - document deleted when expiresAt is reached
  }
});

// Static method to generate a fresh 10-minute code for a user, removing any
// previous unused code first so only one is ever active per user.
linkCodeSchema.statics.generateForUser = async function(userId) {
  await this.deleteMany({ userId });
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return this.create({ code, userId, expiresAt });
};

module.exports = mongoose.model('LinkCode', linkCodeSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest linkCode-model -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/LinkCode.js backend/__tests__/linkCode-model.test.js
git commit -m "feat: add LinkCode model for Discord account-link codes"
```

---

### Task 3: Extend `verifyToken` to accept bot auth

**Files:**
- Modify: `backend/middleware/auth.js:1-64` (imports and `verifyToken`)
- Test: `backend/__tests__/verifyToken-bot-auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/verifyToken-bot-auth.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-bot-token';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');
const { verifyToken, requireAuth } = require('../middleware/auth');

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
  await User.deleteMany({});
  await DiscordLink.deleteMany({});
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.get('/whoami', requireAuth, (req, res) => res.json({ userId: req.user._id.toString() }));
  return app;
}

describe('verifyToken bot auth path', () => {
  test('resolves a linked Discord user to the real account', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'a1', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-123' });

    const app = buildApp();
    const res = await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-123')
      .expect(200);

    expect(res.body.userId).toBe(user._id.toString());
  });

  test('401s for an unlinked Discord user', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-unknown')
      .expect(401);
  });

  test('401s when the bearer token matches the service token but no X-Discord-User-Id header is sent', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .expect(401);
  });

  test('does not treat a random invalid token as a normal JWT failure differently from bot auth failure (still 401)', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer not-the-service-token-and-not-a-jwt')
      .expect(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest verifyToken-bot-auth -v`
Expected: FAIL — the first two tests fail because there's no bot-auth branch yet (both currently 401 for the wrong reason / or the linked-user case 401s instead of 200).

- [ ] **Step 3: Read the current middleware**

Open `backend/middleware/auth.js` and confirm lines 1-64 match:

```js
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { hasPermission } = require('../utils/permissions');
```//... followed by `verifyToken` as read earlier in this session. If the file has diverged, adapt the following edit to the actual current content rather than assuming line numbers.

- [ ] **Step 4: Add the bot-auth branch**

Add the import:

```js
const DiscordLink = require('../models/DiscordLink');
```

Modify `verifyToken` — insert the bot-auth branch after extracting `token` and before the existing `try { const decoded = verifyAccessToken(token); ... }` block:

```js
const verifyToken = async (req, res, next) => {
  // Skip if multi-user is not enabled
  if (!isMultiUserEnabled()) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without user
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Bot auth path: the Discord bot authenticates with a shared service token
  // instead of a per-user JWT, and names the acting user via a header
  // instead of embedding it in the token. This lets every existing
  // requireAuth-gated route work for the bot unchanged.
  const botServiceToken = process.env.DISCORD_BOT_SERVICE_TOKEN;
  if (botServiceToken && token === botServiceToken) {
    const discordUserId = req.headers['x-discord-user-id'];
    if (!discordUserId) {
      req.user = null;
      return next();
    }
    try {
      const link = await DiscordLink.findOne({ discordUserId });
      if (!link) {
        req.user = null;
        req.notLinked = true;
        return next();
      }
      const user = await User.findById(link.userId);
      if (!user || !user.isActive) {
        req.user = null;
        return next();
      }
      req.user = user.toSafeObject();
      return next();
    } catch (error) {
      console.error('Bot auth error:', error.message);
      req.user = null;
      return next();
    }
  }

  try {
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      req.user = null;
      return next();
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      req.user = null;
      return next();
    }

    // Attach user to request
    req.user = user.toSafeObject();
    req.tokenPayload = decoded;

    // Fire-and-forget lastSeenAt update (non-blocking)
    User.findByIdAndUpdate(decoded.userId, { lastSeenAt: new Date() }).catch(() => {});

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    req.user = null;
    next();
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest verifyToken-bot-auth -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest`
Expected: all suites still pass (this change is purely additive — the new branch only activates when `DISCORD_BOT_SERVICE_TOKEN` is set AND the bearer token matches it, which no existing test does)

- [ ] **Step 7: Commit**

```bash
git add backend/middleware/auth.js backend/__tests__/verifyToken-bot-auth.test.js
git commit -m "feat: let verifyToken authenticate the Discord bot via a shared service token"
```

---

### Task 4: `/api/discord/*` routes

**Files:**
- Create: `backend/routes/discord.js`
- Test: `backend/__tests__/discord-routes.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/discord-routes.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-bot-token';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');
const LinkCode = require('../models/LinkCode');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');

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
  await User.deleteMany({});
  await DiscordLink.deleteMany({});
  await LinkCode.deleteMany({});
  await Notification.deleteMany({});
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/discord', require('../routes/discord'));
  return app;
}

describe('POST /api/discord/link-code', () => {
  test('issues a code for the logged-in user', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'a1', passwordHash: 'x', role: 'editor' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/discord/link-code')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(201);

    expect(res.body.code).toMatch(/^[0-9A-F]{6}$/);
    const stored = await LinkCode.findOne({ userId: user._id });
    expect(stored.code).toBe(res.body.code);
  });

  test('401s without a session', async () => {
    const app = buildApp();
    await request(app).post('/api/discord/link-code').expect(401);
  });
});

describe('POST /api/discord/exchange', () => {
  test('links a valid, unexpired code and consumes it', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'b1', passwordHash: 'x', role: 'editor' });
    const linkCode = await LinkCode.generateForUser(user._id);

    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .set('Authorization', 'Bearer test-bot-token')
      .send({ code: linkCode.code, discordUserId: 'discord-999' })
      .expect(201);

    const link = await DiscordLink.findOne({ discordUserId: 'discord-999' });
    expect(link.userId.toString()).toBe(user._id.toString());
    expect(await LinkCode.findById(linkCode._id)).toBeNull();
  });

  test('rejects an expired code', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'c1', passwordHash: 'x', role: 'editor' });
    const linkCode = await LinkCode.create({ code: 'STALE1', userId: user._id, expiresAt: new Date(Date.now() - 1000) });

    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .set('Authorization', 'Bearer test-bot-token')
      .send({ code: linkCode.code, discordUserId: 'discord-888' })
      .expect(400);
  });

  test('rejects a missing/invalid service token', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .send({ code: 'ABCDEF', discordUserId: 'discord-777' })
      .expect(401);
  });
});

describe('DELETE /api/discord/link', () => {
  test('unlinks via a normal web session', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'd1', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-111' });

    const app = buildApp();
    await request(app)
      .delete('/api/discord/link')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(await DiscordLink.findOne({ userId: user._id })).toBeNull();
  });

  test('unlinks via the bot (X-Discord-User-Id)', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'e1', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-222' });

    const app = buildApp();
    await request(app)
      .delete('/api/discord/link')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-222')
      .expect(200);

    expect(await DiscordLink.findOne({ discordUserId: 'discord-222' })).toBeNull();
  });
});

describe('GET /api/discord/notifications/pending', () => {
  test('returns price_alert notifications for linked users created after since', async () => {
    const user = await User.create({ email: 'f@test.com', username: 'f1', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-333' });

    await Notification.create({
      userId: user._id, type: 'price_alert', content: 'old alert',
      createdAt: new Date(Date.now() - 60000)
    });
    await Notification.create({ userId: user._id, type: 'price_alert', content: 'new alert' });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/discord/notifications/pending?since=${new Date(Date.now() - 30000).toISOString()}`)
      .set('Authorization', 'Bearer test-bot-token')
      .expect(200);

    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].discordUserId).toBe('discord-333');
    expect(res.body.notifications[0].content).toBe('new alert');
  });

  test('rejects without the service token', async () => {
    const app = buildApp();
    await request(app).get('/api/discord/notifications/pending').expect(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-routes -v`
Expected: FAIL with "Cannot find module '../routes/discord'"

- [ ] **Step 3: Write the routes**

```js
// backend/routes/discord.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const DiscordLink = require('../models/DiscordLink');
const LinkCode = require('../models/LinkCode');
const Notification = require('../models/Notification');

// Guards the routes the bot calls as *itself* (not as a resolved user) -
// establishing a link and polling notifications across all linked users
// happen before/outside the per-user req.user resolution in verifyToken.
function requireBotServiceToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expected = process.env.DISCORD_BOT_SERVICE_TOKEN;
  if (!expected || !token || token !== expected) {
    return res.status(401).json({ message: 'Invalid bot service token' });
  }
  next();
}

// POST /api/discord/link-code - normal authenticated web session generates
// a short code the user then enters into the Discord bot via /link.
router.post('/link-code', requireAuth, async (req, res) => {
  try {
    const linkCode = await LinkCode.generateForUser(req.user._id);
    res.status(201).json({ code: linkCode.code, expiresAt: linkCode.expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/discord/exchange - bot-only. Exchanges a valid link code for a
// DiscordLink record. Uses requireBotServiceToken directly (not requireAuth)
// since no DiscordLink exists yet for this Discord user at this point.
router.post('/exchange', requireBotServiceToken, async (req, res) => {
  try {
    const { code, discordUserId } = req.body;
    if (!code || !discordUserId) {
      return res.status(400).json({ message: 'code and discordUserId are required' });
    }

    const linkCode = await LinkCode.findOne({
      code: code.toUpperCase(),
      expiresAt: { $gt: new Date() }
    });
    if (!linkCode) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // Clear out any prior link involving either side before creating the new one.
    await DiscordLink.deleteMany({ $or: [{ userId: linkCode.userId }, { discordUserId }] });
    const link = await DiscordLink.create({ userId: linkCode.userId, discordUserId });
    await LinkCode.deleteOne({ _id: linkCode._id });

    res.status(201).json({ linked: true, userId: link.userId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/discord/link - unlink. Works for both a normal web session
// (req.user resolved from a JWT) and the bot's /unlink command (req.user
// resolved via DiscordLink in verifyToken's bot-auth branch) - either way
// req.user._id is the real account to unlink.
router.delete('/link', requireAuth, async (req, res) => {
  try {
    await DiscordLink.deleteOne({ userId: req.user._id });
    res.json({ unlinked: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/discord/notifications/pending - bot-only. Polled on an interval;
// returns price_alert Notifications for ALL linked users created after
// ?since, mapped to their discordUserId so the bot can DM each one.
router.get('/notifications/pending', requireBotServiceToken, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const links = await DiscordLink.find({});
    const discordIdByUserId = new Map(links.map(l => [l.userId.toString(), l.discordUserId]));
    const userIds = links.map(l => l.userId);

    const notifications = await Notification.find({
      userId: { $in: userIds },
      type: 'price_alert',
      createdAt: { $gt: since }
    }).sort({ createdAt: 1 }).lean();

    const results = notifications.map(n => ({
      discordUserId: discordIdByUserId.get(n.userId.toString()),
      content: n.content,
      cardId: n.cardId,
      createdAt: n.createdAt
    }));

    res.json({ notifications: results, polledAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-routes -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add /api/discord routes for linking and notification polling"
```

---

### Task 5: Mount the routes and add env vars

**Files:**
- Modify: `backend/server.js` (near the other `app.use('/api/...')` mounts, e.g. after line 186)
- Modify: `backend/.env.example`
- Modify: `backend/.env` (local dev value only - never commit real secrets, but this file is gitignored)

- [ ] **Step 1: Mount the router**

In `backend/server.js`, find:

```js
app.use('/api/cards', require('./routes/priceFlags'));
```

Add immediately after it:

```js
app.use('/api/discord', require('./routes/discord'));
```

- [ ] **Step 2: Add the env var template**

In `backend/.env.example`, append:

```
# Discord bot integration (see discord-bot/.env.example)
# A long random secret shared between this backend and the discord-bot
# process - generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# DISCORD_BOT_SERVICE_TOKEN=
```

- [ ] **Step 3: Generate and set a real value in local `.env`**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Copy the output and add to `backend/.env`:

```
DISCORD_BOT_SERVICE_TOKEN=<paste generated value here>
```

- [ ] **Step 4: Restart the backend and smoke-test the mount**

Since `nodemon` watches `server.js`, saving it auto-restarts. Confirm with:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/discord/link-code
```

Expected: `401` (no session provided - confirms the route is mounted and reachable, not a 404)

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
git add backend/server.js backend/.env.example
git commit -m "feat: mount /api/discord routes and document DISCORD_BOT_SERVICE_TOKEN"
```

(`.env` itself is gitignored and won't be included in this commit - verify with `git status` that only `server.js` and `.env.example` are staged.)

---

## Discord bot process

### Task 6: Scaffold the `discord-bot/` process

**Files:**
- Create: `discord-bot/package.json`
- Create: `discord-bot/.env.example`
- Create: `discord-bot/src/apiClient.js`
- Create: `discord-bot/src/lib/notLinked.js`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "mtg-tracker-discord-bot",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "register-commands": "node src/registerCommands.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
```

Save as `discord-bot/package.json`.

- [ ] **Step 2: Install dependencies**

Run: `cd discord-bot && npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors

- [ ] **Step 3: Create the env template**

```
# Discord application credentials (from https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
# Guild (server) ID to register commands to for fast iteration during
# development. Switch to global command registration later if the bot
# needs to serve multiple servers.
DISCORD_GUILD_ID=

# Must match DISCORD_BOT_SERVICE_TOKEN in backend/.env exactly
DISCORD_BOT_SERVICE_TOKEN=

# Where the backend API is reachable from this process
API_BASE_URL=http://localhost:5000/api

# Where card images are reachable from the public internet (Discord's
# servers fetch embed images directly - localhost URLs won't render).
# Only needed if PUBLIC_ASSET_BASE_URL differs from API_BASE_URL's origin.
PUBLIC_ASSET_BASE_URL=https://mtgtracker.store
```

Save as `discord-bot/.env.example`. Copy it to `discord-bot/.env` and fill in real values before running the bot (this file is gitignored).

- [ ] **Step 4: Create the API client**

```js
// discord-bot/src/apiClient.js
require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const SERVICE_TOKEN = process.env.DISCORD_BOT_SERVICE_TOKEN;

// Returns an axios instance authenticated as the bot, optionally acting on
// behalf of a specific Discord user. validateStatus always returns true so
// callers can branch on res.status (401 = not linked, etc.) without
// try/catch on every call.
function client(discordUserId) {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      ...(discordUserId ? { 'X-Discord-User-Id': discordUserId } : {})
    },
    validateStatus: () => true
  });
}

// Resolves a card's imageUrl (which may be an absolute Scryfall CDN URL, or
// a relative /api/images/:id path from the backend's local cache) into an
// absolute URL Discord's servers can actually fetch for an embed image.
function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  const base = process.env.PUBLIC_ASSET_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${imageUrl}`;
}

module.exports = { client, resolveImageUrl };
```

- [ ] **Step 5: Create the not-linked helper**

```js
// discord-bot/src/lib/notLinked.js
const NOT_LINKED_MESSAGE =
  "You haven't linked your account yet — run `/link <code>` first. " +
  "Get a code from Settings in the MTG Tracker web app.";

function replyNotLinked(interaction) {
  return interaction.reply({ content: NOT_LINKED_MESSAGE, ephemeral: true });
}

module.exports = { NOT_LINKED_MESSAGE, replyNotLinked };
```

- [ ] **Step 6: Commit**

```bash
git add discord-bot/package.json discord-bot/package-lock.json discord-bot/.env.example discord-bot/src/apiClient.js discord-bot/src/lib/notLinked.js
git commit -m "feat: scaffold discord-bot process (package, API client, helpers)"
```

---

### Task 7: `resolveCard` helper (name lookup + disambiguation)

**Files:**
- Create: `discord-bot/src/lib/resolveCard.js`
- Test: `discord-bot/__tests__/resolveCard.test.js`
- Modify: `discord-bot/package.json` (add `jest` devDependency + `test` script)

- [ ] **Step 1: Add a test runner to the bot package**

In `discord-bot/package.json`, add a `test` script and `jest` devDependency:

```json
{
  "name": "mtg-tracker-discord-bot",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "register-commands": "node src/registerCommands.js",
    "test": "jest"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

Run: `cd discord-bot && npm install`

- [ ] **Step 2: Write the failing test**

```js
// discord-bot/__tests__/resolveCard.test.js
const { resolveCard } = require('../src/lib/resolveCard');

function mockApi(cards, status = 200) {
  return { get: jest.fn().mockResolvedValue({ status, data: cards }) };
}

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    followUp: jest.fn().mockResolvedValue(undefined),
    channel: { awaitMessageComponent: jest.fn() }
  };
}

describe('resolveCard', () => {
  test('returns not_linked on a 401', async () => {
    const api = mockApi([], 401);
    const result = await resolveCard(mockInteraction(), api, 'Sol Ring');
    expect(result.status).toBe('not_linked');
  });

  test('returns no_match when nothing matches', async () => {
    const api = mockApi([{ _id: '1', name: 'Lightning Bolt', set: 'M10', condition: 'NM' }]);
    const result = await resolveCard(mockInteraction(), api, 'Sol Ring');
    expect(result.status).toBe('no_match');
  });

  test('returns the single match directly without prompting', async () => {
    const api = mockApi([{ _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' }]);
    const interaction = mockInteraction();
    const result = await resolveCard(interaction, api, 'sol ring');
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('1');
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  test('is case-insensitive and matches substrings', async () => {
    const api = mockApi([{ _id: '1', name: "Urza's Saga", set: 'MH2', condition: 'NM' }]);
    const result = await resolveCard(mockInteraction(), api, 'urza');
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('1');
  });

  test('prompts for disambiguation with multiple matches and returns the picked card', async () => {
    const cards = [
      { _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' },
      { _id: '2', name: 'Sol Ring', set: 'CMR', condition: 'LP' }
    ];
    const api = mockApi(cards);
    const interaction = mockInteraction();
    interaction.channel.awaitMessageComponent.mockResolvedValue({
      values: ['2'],
      update: jest.fn().mockResolvedValue(undefined)
    });

    const result = await resolveCard(interaction, api, 'Sol Ring');
    expect(interaction.followUp).toHaveBeenCalled();
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('2');
  });

  test('returns timed_out if the user never picks', async () => {
    const cards = [
      { _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' },
      { _id: '2', name: 'Sol Ring', set: 'CMR', condition: 'LP' }
    ];
    const api = mockApi(cards);
    const interaction = mockInteraction();
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    const result = await resolveCard(interaction, api, 'Sol Ring');
    expect(result.status).toBe('timed_out');
  });
});
```

Run: `cd discord-bot && npx jest resolveCard -v`
Expected: FAIL with "Cannot find module '../src/lib/resolveCard'"

- [ ] **Step 3: Write the helper**

```js
// discord-bot/src/lib/resolveCard.js
const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

// Finds the calling user's owned card(s) matching `searchName` (case-
// insensitive substring against GET /api/cards, since that route has no
// server-side search param - filtering happens here, same as the web
// frontend's client-side filtering).
//
// Returns one of:
//   { status: 'not_linked' }
//   { status: 'error', httpStatus }
//   { status: 'no_match' }
//   { status: 'found', card }
//   { status: 'timed_out' }   (user didn't pick from the disambiguation menu)
async function resolveCard(interaction, api, searchName) {
  const res = await api.get('/cards');
  if (res.status === 401) return { status: 'not_linked' };
  if (res.status !== 200) return { status: 'error', httpStatus: res.status };

  const needle = searchName.trim().toLowerCase();
  const matches = res.data.filter(c => c.name.toLowerCase().includes(needle));

  if (matches.length === 0) return { status: 'no_match' };
  if (matches.length === 1) return { status: 'found', card: matches[0] };

  const options = matches.slice(0, 25).map(c => ({
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
    value: c._id
  }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('resolve-card-select')
      .setPlaceholder('Multiple cards match — pick one')
      .addOptions(options)
  );

  await interaction.followUp({
    content: `Found ${matches.length} matches for "${searchName}":`,
    components: [row],
    ephemeral: true
  });

  try {
    const selectInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: i => i.customId === 'resolve-card-select' && i.user.id === interaction.user.id,
      time: 30000
    });
    const chosen = matches.find(c => c._id === selectInteraction.values[0]);
    await selectInteraction.update({ content: `Selected: ${chosen.name}`, components: [] });
    return { status: 'found', card: chosen };
  } catch {
    return { status: 'timed_out' };
  }
}

module.exports = { resolveCard };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd discord-bot && npx jest resolveCard -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add discord-bot/package.json discord-bot/package-lock.json discord-bot/src/lib/resolveCard.js discord-bot/__tests__/resolveCard.test.js
git commit -m "feat: add card name resolution/disambiguation helper for the Discord bot"
```

---

### Task 8: `/link` and `/unlink` commands

**Files:**
- Create: `discord-bot/src/commands/link.js`
- Create: `discord-bot/src/commands/unlink.js`

- [ ] **Step 1: Write `/link`**

```js
// discord-bot/src/commands/link.js
const { client } = require('../apiClient');

module.exports = {
  name: 'link',
  async execute(interaction) {
    const code = interaction.options.getString('code', true);
    const api = client();
    const res = await api.post('/discord/exchange', { code, discordUserId: interaction.user.id });

    if (res.status === 201) {
      return interaction.reply({
        content: '✅ Linked! Your Discord account is now connected to MTG Tracker.',
        ephemeral: true
      });
    }
    if (res.status === 400) {
      return interaction.reply({
        content: '❌ That code is invalid or expired. Generate a new one in Settings.',
        ephemeral: true
      });
    }
    return interaction.reply({ content: `❌ Something went wrong (${res.status}). Try again later.`, ephemeral: true });
  }
};
```

- [ ] **Step 2: Write `/unlink`**

```js
// discord-bot/src/commands/unlink.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'unlink',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.delete('/discord/link');

    if (res.status === 200) {
      return interaction.reply({ content: '✅ Unlinked your MTG Tracker account.', ephemeral: true });
    }
    if (res.status === 401) {
      return replyNotLinked(interaction);
    }
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add discord-bot/src/commands/link.js discord-bot/src/commands/unlink.js
git commit -m "feat: add /link and /unlink Discord commands"
```

---

### Task 9: `/card` command

**Files:**
- Create: `discord-bot/src/commands/card.js`

- [ ] **Step 1: Write the command**

```js
// discord-bot/src/commands/card.js
const { client, resolveImageUrl } = require('../apiClient');

module.exports = {
  name: 'card',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(); // no linking required - pure Scryfall passthrough
    const res = await api.get('/scryfall/search', { params: { name } });

    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Couldn't find a card named "${name}".`, ephemeral: true });
    }

    const card = res.data;
    const imageUrl = resolveImageUrl(card.imageUrl);

    return interaction.reply({
      embeds: [{
        title: card.name,
        description: card.oracleText || '',
        fields: [
          { name: 'Set', value: card.set || 'Unknown', inline: true },
          { name: 'Price (USD)', value: card.prices?.usd ? `$${card.prices.usd}` : 'N/A', inline: true },
          { name: 'Rarity', value: card.rarity || 'N/A', inline: true }
        ],
        image: imageUrl ? { url: imageUrl } : undefined
      }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add discord-bot/src/commands/card.js
git commit -m "feat: add /card lookup command to the Discord bot"
```

---

### Task 10: `/collection` command

**Files:**
- Create: `discord-bot/src/commands/collection.js`

- [ ] **Step 1: Write the command**

```js
// discord-bot/src/commands/collection.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'collection',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'stats') {
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }

    const api = client(interaction.user.id);
    const res = await api.get('/stats');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const stats = res.data;
    return interaction.reply({
      embeds: [{
        title: 'Collection Stats',
        fields: [
          { name: 'Total Cards', value: String(stats.totalCards ?? 0), inline: true },
          { name: 'Total Value', value: `$${(stats.totalValue ?? 0).toFixed(2)}`, inline: true }
        ]
      }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add discord-bot/src/commands/collection.js
git commit -m "feat: add /collection stats command to the Discord bot"
```

---

### Task 11: `/add`, `/remove`, `/update`, `/price` commands

**Files:**
- Create: `discord-bot/src/commands/add.js`
- Create: `discord-bot/src/commands/remove.js`
- Create: `discord-bot/src/commands/update.js`
- Create: `discord-bot/src/commands/price.js`

- [ ] **Step 1: Write `/add`**

```js
// discord-bot/src/commands/add.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'add',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);

    const api = client(interaction.user.id);
    const res = await api.post('/cards', { name, quantity, condition: 'NM' });

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200 && res.status !== 201) {
      return interaction.reply({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
    }

    const card = res.data;
    const message = card.merged
      ? `✅ Merged with your existing "${name}". New quantity: ${card.quantity}.`
      : `✅ Added ${quantity}x "${card.name}" to your collection.`;
    return interaction.reply({ content: message, ephemeral: true });
  }
};
```

- [ ] **Step 2: Write `/remove`**

```js
// discord-bot/src/commands/remove.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

module.exports = {
  name: 'remove',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const resolved = await resolveCard(interaction, api, name);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.reply({ content: `❌ No card matching "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: 'No selection made in time.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.reply({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const remaining = card.quantity - quantity;

    if (remaining <= 0) {
      const delRes = await api.delete(`/cards/${card._id}`);
      if (delRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't remove "${card.name}" (${delRes.status}).`, ephemeral: true });
      }
      return interaction.followUp({ content: `✅ Removed "${card.name}" from your collection.`, ephemeral: true });
    }

    const putRes = await api.put(`/cards/${card._id}`, { quantity: remaining });
    if (putRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't update "${card.name}" (${putRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ "${card.name}" quantity is now ${remaining}.`, ephemeral: true });
  }
};
```

- [ ] **Step 3: Write `/update`**

```js
// discord-bot/src/commands/update.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

module.exports = {
  name: 'update',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const field = interaction.options.getString('field', true); // 'condition' | 'quantity' | 'location'
    const rawValue = interaction.options.getString('value', true);
    const api = client(interaction.user.id);

    const resolved = await resolveCard(interaction, api, name);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.reply({ content: `❌ No card matching "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: 'No selection made in time.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.reply({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const value = field === 'quantity' ? parseInt(rawValue, 10) : rawValue;
    const putRes = await api.put(`/cards/${card._id}`, { [field]: value });

    if (putRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't update "${card.name}" (${putRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ Updated "${card.name}" — ${field} is now ${value}.`, ephemeral: true });
  }
};
```

- [ ] **Step 4: Write `/price`**

```js
// discord-bot/src/commands/price.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

module.exports = {
  name: 'price',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const resolved = await resolveCard(interaction, api, name);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.reply({ content: `❌ No card matching "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: 'No selection made in time.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.reply({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const updateRes = await api.post(`/cards/${card._id}/update-price?force=true`);
    if (updateRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't refresh price for "${card.name}" (${updateRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ "${card.name}" price refreshed: $${updateRes.data.price}.`, ephemeral: true });
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add discord-bot/src/commands/add.js discord-bot/src/commands/remove.js discord-bot/src/commands/update.js discord-bot/src/commands/price.js
git commit -m "feat: add /add /remove /update /price collection commands to the Discord bot"
```

---

### Task 12: `/wishlist` command (list/add/remove subcommands)

**Files:**
- Create: `discord-bot/src/commands/wishlist.js`

- [ ] **Step 1: Write the command**

```js
// discord-bot/src/commands/wishlist.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'wishlist',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'list') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }
      if (res.data.length === 0) {
        return interaction.reply({ content: 'Your wishlist is empty.', ephemeral: true });
      }
      const lines = res.data.slice(0, 20).map(item => `• ${item.name} (${item.priority})`);
      return interaction.reply({
        embeds: [{ title: 'Wishlist', description: lines.join('\n') }],
        ephemeral: true
      });
    }

    if (sub === 'add') {
      const name = interaction.options.getString('name', true);
      const res = await api.post('/wishlist', { name, priority: 'medium' });
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 201) {
        return interaction.reply({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
      }
      return interaction.reply({ content: `✅ Added "${name}" to your wishlist.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name', true);
      const listRes = await api.get('/wishlist');
      if (listRes.status === 401) return replyNotLinked(interaction);
      if (listRes.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
      }
      const match = listRes.data.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!match) {
        return interaction.reply({ content: `❌ "${name}" isn't on your wishlist.`, ephemeral: true });
      }
      const delRes = await api.delete(`/wishlist/${match._id}`);
      if (delRes.status !== 200) {
        return interaction.reply({ content: `❌ Couldn't remove "${name}" (${delRes.status}).`, ephemeral: true });
      }
      return interaction.reply({ content: `✅ Removed "${name}" from your wishlist.`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add discord-bot/src/commands/wishlist.js
git commit -m "feat: add /wishlist list/add/remove command to the Discord bot"
```

---

### Task 13: `/decks` and `/deck` commands

**Files:**
- Create: `discord-bot/src/commands/decks.js`
- Create: `discord-bot/src/commands/deck.js`

- [ ] **Step 1: Write `/decks`**

```js
// discord-bot/src/commands/decks.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'decks',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/decks');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }
    if (res.data.length === 0) {
      return interaction.reply({ content: 'You have no decks yet.', ephemeral: true });
    }
    const lines = res.data.slice(0, 20).map(d => `• ${d.name}`);
    return interaction.reply({
      embeds: [{ title: 'Your Decks', description: lines.join('\n') }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 2: Write `/deck`**

```js
// discord-bot/src/commands/deck.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deck',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.reply({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const deckRes = await api.get(`/decks/${match._id}`);
    if (deckRes.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${deckRes.status}).`, ephemeral: true });
    }
    const deck = deckRes.data;
    return interaction.reply({
      embeds: [{
        title: deck.name,
        fields: [
          { name: 'Format', value: deck.format || 'N/A', inline: true },
          { name: 'Cards', value: String(deck.cards?.length ?? 0), inline: true }
        ]
      }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add discord-bot/src/commands/decks.js discord-bot/src/commands/deck.js
git commit -m "feat: add /decks and /deck commands to the Discord bot"
```

---

### Task 14: Command registration script

**Files:**
- Create: `discord-bot/src/registerCommands.js`

- [ ] **Step 1: Write the script**

```js
// discord-bot/src/registerCommands.js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('link').setDescription('Link your MTG Tracker account')
    .addStringOption(o => o.setName('code').setDescription('The code shown in MTG Tracker Settings').setRequired(true)),

  new SlashCommandBuilder().setName('unlink').setDescription('Unlink your MTG Tracker account'),

  new SlashCommandBuilder().setName('card').setDescription('Look up a card (no linking required)')
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('collection').setDescription('Collection commands')
    .addSubcommand(sub => sub.setName('stats').setDescription('Show your collection stats')),

  new SlashCommandBuilder().setName('add').setDescription('Add a card to your collection')
    .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('remove').setDescription('Remove a card from your collection')
    .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('update').setDescription('Update a card in your collection')
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true))
    .addStringOption(o => o.setName('field').setDescription('Field to update').setRequired(true)
      .addChoices(
        { name: 'condition', value: 'condition' },
        { name: 'quantity', value: 'quantity' },
        { name: 'location', value: 'location' }
      ))
    .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true)),

  new SlashCommandBuilder().setName('price').setDescription("Refresh a card's price")
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('wishlist').setDescription('Wishlist commands')
    .addSubcommand(sub => sub.setName('list').setDescription('Show your wishlist'))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a card to your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a card from your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true))),

  new SlashCommandBuilder().setName('decks').setDescription('List your decks'),

  new SlashCommandBuilder().setName('deck').setDescription('View a deck')
    .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log(`Registered ${commands.length} slash commands to guild ${process.env.DISCORD_GUILD_ID}.`);
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add discord-bot/src/registerCommands.js
git commit -m "feat: add slash command registration script for the Discord bot"
```

(Running this script requires a real Discord application - see Task 16's manual smoke test for the one-time setup steps.)

---

### Task 15: Bot entry point (client, dispatch, notification poller)

**Files:**
- Create: `discord-bot/src/index.js`

- [ ] **Step 1: Write the entry point**

```js
// discord-bot/src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { client: apiClient, resolveImageUrl } = require('./apiClient');

const commands = new Map([
  require('./commands/link'),
  require('./commands/unlink'),
  require('./commands/card'),
  require('./commands/collection'),
  require('./commands/add'),
  require('./commands/remove'),
  require('./commands/update'),
  require('./commands/price'),
  require('./commands/wishlist'),
  require('./commands/decks'),
  require('./commands/deck'),
].map(cmd => [cmd.name, cmd]));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
  startNotificationPoller();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: '❌ Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

// Polls for price-alert notifications across all linked users and DMs each
// one. Keeps `since` in memory only - on a bot restart it resets to "now",
// so at most it silently skips alerts that fired during the downtime rather
// than replaying old ones.
let since = new Date();

async function startNotificationPoller() {
  setInterval(async () => {
    try {
      const api = apiClient();
      const res = await api.get('/discord/notifications/pending', { params: { since: since.toISOString() } });
      if (res.status !== 200) return;

      for (const notif of res.data.notifications) {
        try {
          const user = await client.users.fetch(notif.discordUserId);
          await user.send({ content: `📉 Price Alert: ${notif.content}` });
        } catch (dmError) {
          console.error(`Failed to DM ${notif.discordUserId}:`, dmError.message);
        }
      }

      if (res.data.notifications.length > 0) {
        since = new Date(res.data.notifications[res.data.notifications.length - 1].createdAt);
      }
    } catch (error) {
      console.error('Notification poll failed:', error.message);
    }
  }, 30000);
}

client.login(process.env.DISCORD_BOT_TOKEN);
```

- [ ] **Step 2: Commit**

```bash
git add discord-bot/src/index.js
git commit -m "feat: add Discord bot entry point with command dispatch and notification polling"
```

---

### Task 16: Wire into `start-both-servers.bat`

**Files:**
- Modify: `start-both-servers.bat`

- [ ] **Step 1: Add the bot as a third window**

Current content:

```bat
@echo off
echo Starting MTG Tracker - Backend and Frontend
echo.

REM Start backend in background
cd backend
start "MTG Tracker Backend" cmd /k "npm run dev"
cd ..

REM Small delay to ensure backend starts
timeout /t 2 /nobreak >nul

REM Start frontend in background
cd frontend
start "MTG Tracker Frontend" cmd /k "npm start"
cd ..

REM Start Caddy
start "Caddy" cmd /k "caddy_windows_amd64.exe run"

echo All servers started.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo Site: https://mtgtracker.store
echo.
echo Press any key to exit...
pause >nul
```

Replace with:

```bat
@echo off
echo Starting MTG Tracker - Backend, Frontend, and Discord Bot
echo.

REM Start backend in background
cd backend
start "MTG Tracker Backend" cmd /k "npm run dev"
cd ..

REM Small delay to ensure backend starts
timeout /t 2 /nobreak >nul

REM Start frontend in background
cd frontend
start "MTG Tracker Frontend" cmd /k "npm start"
cd ..

REM Start Discord bot (skips itself if discord-bot\.env doesn't exist yet,
REM so this script still works before the bot has been configured)
if exist discord-bot\.env (
  cd discord-bot
  start "MTG Tracker Discord Bot" cmd /k "npm start"
  cd ..
) else (
  echo Skipping Discord bot - discord-bot\.env not found. Copy discord-bot\.env.example to set it up.
)

REM Start Caddy
start "Caddy" cmd /k "caddy_windows_amd64.exe run"

echo All servers started.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo Site: https://mtgtracker.store
echo.
echo Press any key to exit...
pause >nul
```

- [ ] **Step 2: Commit**

```bash
git add start-both-servers.bat
git commit -m "feat: start the Discord bot alongside backend/frontend when configured"
```

---

### Task 17: Manual end-to-end smoke test

This task has no automated test — it's the one-time real-Discord verification called for in the spec's Testing section, plus the actual Discord application setup that can't be scripted.

- [ ] **Step 1: Create a Discord application**

Go to https://discord.com/developers/applications → New Application. Under **Bot**, reset/copy the token into `discord-bot/.env` as `DISCORD_BOT_TOKEN`. Under **OAuth2 → General**, copy the Client ID into `DISCORD_CLIENT_ID`.

- [ ] **Step 2: Invite the bot to a test server**

Under **OAuth2 → URL Generator**, select scope `bot` and `applications.commands`, permissions `Send Messages`, `Use Slash Commands`. Open the generated URL and add the bot to a test Discord server you own. Copy that server's ID (enable Developer Mode in Discord settings, right-click the server icon → Copy Server ID) into `DISCORD_GUILD_ID`.

- [ ] **Step 3: Fill in the remaining env values**

In `discord-bot/.env`, set `DISCORD_BOT_SERVICE_TOKEN` to the exact same value as `backend/.env`'s `DISCORD_BOT_SERVICE_TOKEN`, and confirm `API_BASE_URL=http://localhost:5000/api`.

- [ ] **Step 4: Register commands and start the bot**

```bash
cd discord-bot
npm run register-commands
npm start
```

Expected: "Registered 11 slash commands..." then "Discord bot logged in as ...".

- [ ] **Step 5: Walk the full command set in the test server**

- [ ] `/card Sol Ring` — shows an embed with price/set/oracle text, no linking required.
- [ ] `/add 2 Lightning Bolt` before linking — replies with the not-linked message.
- [ ] In the web app, click "Link Discord Account" in Settings (or, if that UI hasn't been built yet, call `POST /api/discord/link-code` directly with your session cookie/token to get a code).
- [ ] `/link <code>` — replies "✅ Linked!".
- [ ] `/add 2 Lightning Bolt` — adds the card; check the web app collection to confirm it appears.
- [ ] `/add 2 Lightning Bolt` again — replies with the merge message and doubled quantity.
- [ ] `/remove 1 Lightning Bolt` — quantity drops by 1.
- [ ] `/update Lightning Bolt condition LP` — condition changes; confirm in the web app.
- [ ] `/price Lightning Bolt` — price refreshes.
- [ ] `/collection stats` — shows real totals matching the web app's stats.
- [ ] `/wishlist add Sol Ring`, `/wishlist list`, `/wishlist remove Sol Ring` — each works and reflects in the web app.
- [ ] `/decks list` and `/deck <name>` (using a real deck you already have) — shows correct info.
- [ ] Add a card with two different conditions in the web app (e.g. two "Sol Ring" entries, NM and LP), then `/price Sol Ring` in Discord — confirm the disambiguation select menu appears and picking one works.
- [ ] Set a wishlist/price-alert target below a card's current tracked price (or wait for the daily snapshot job) and confirm a DM notification arrives within ~30 seconds of the alert firing.
- [ ] `/unlink` — replies "✅ Unlinked". Confirm `/collection stats` afterward shows the not-linked message again.

- [ ] **Step 6: Note any real-world deviations**

If any step behaves differently than expected, fix the relevant command file and re-test that single step — no need to re-run the whole walkthrough for a one-line fix.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "docs: confirm Discord bot manual smoke test passed"
```

(Only if there's something to commit — e.g. a fix made during Step 6. If Steps 1-5 passed with no code changes, there's nothing to commit here.)

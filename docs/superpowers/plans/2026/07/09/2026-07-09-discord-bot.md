# Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** This feature is DEFERRED per the design spec (`docs/superpowers/specs/2026-07-09-discord-bot-design.md`). Do not start this plan until explicitly requested. It is written now so it is immediately actionable whenever that happens.

**Goal:** Build an account-linked Discord bot that lets a user link their Discord account to their MTG Tracker site account, then query and manage their own collection (`/collection`, `/card`, `/add`, `/wishlist`) from Discord via ephemeral replies, with linking/unlinking handled by `/link`, `/unlink`, and a web Settings "Disconnect Discord" button.

**Architecture:** A new bot-authenticated API surface (`/api/discord/*`) is added to the existing Express backend (`backend/server.js`), guarded by a new `requireBotAuth` middleware that trusts a single shared service token instead of a per-user JWT — it then resolves the acting user server-side from the Discord user ID via a new `DiscordLink` model, and forges a normal `req.user` object so all existing user-scoped helpers (`buildUserQuery`, `getUserId`, `requireEditor`) work unmodified. A second new model, `DiscordLinkCode`, holds the short-lived 6-character linking code (mirrors the existing `PasswordResetToken` pattern). The bot itself is a wholly separate Node process (`backend/discord-bot/`) with its own `package.json`/`node_modules`, talking to the backend purely over HTTP via `axios` — it never touches MongoDB or a user JWT directly. Command logic is split into small, gateway-independent modules so it can be unit-tested with a mocked API client.

**Tech Stack:** Express, Mongoose, JWT (existing backend) + `discord.js` v14, `axios`, `dotenv` (new bot process) + Jest/Supertest/mongodb-memory-server (existing test stack, reused).

---

## Spec vs. codebase — corrections applied in this plan

The approved spec (`docs/superpowers/specs/2026-07-09-discord-bot-design.md`) was verified line-by-line against the real codebase before writing tasks. Two things were underspecified and are resolved concretely below (not punted):

1. **"Backend resolves [discordUserId] to the corresponding userId server-side" — spec doesn't say how.** Verified that every existing card/wishlist query helper (`buildUserQuery`, `getUserId` in `backend/middleware/multiUser.js`) reads `req.user._id` / `req.user.role`, which is normally populated by `verifyToken` decoding a JWT (`backend/middleware/auth.js:18-63`). Since the bot never sends a JWT, this plan adds a `resolveDiscordUser` middleware (Task 4) that looks up `DiscordLink` by `discordUserId` and sets `req.user = user.toSafeObject()` itself — so every downstream route can reuse the existing helpers verbatim. This was not stated in the spec; it's the load-bearing design decision that makes "reuses the existing auto-merge POST /api/cards logic" (spec line 35) actually work.
2. **The spec's "Data model changes" section (line 41-44) says only one new model, `DiscordLink`, and "No changes to existing models."** That's correct for `DiscordLink` itself, but the spec's own linking flow (line 23: "reuse the pattern already used for password-reset tokens") requires storing the *pending* linking code somewhere before a `discordUserId` even exists to key `DiscordLink` on. `PasswordResetToken` (`backend/models/PasswordResetToken.js`) is exactly that pattern for passwords, so this plan adds a second, analogous model: `DiscordLinkCode` (Task 3). This is an omission in the spec's data-model section, not a contradiction — flagged here so it isn't missed.

No other factual claims in the spec were found to be wrong: `POST /api/cards` auto-merge logic really is inline in `backend/server.js:1167-1208` (not a separate router), `/api/wishlist` really is at `backend/server.js:2051-2059`, and the `Card`/`WishlistItem` Mongoose models really are defined inline in `server.js` (not `backend/models/`) and must be accessed elsewhere via the lazy `mongoose.model('Card')` pattern already used in `backend/routes/admin.js:492` — this plan's new route file follows that same pattern rather than trying to `require()` a model file that doesn't exist.

One additional latent bug was found and deliberately **not** propagated: the existing `GET /api/wishlist` (`backend/server.js:2054`) sorts `.sort({ priority: -1, name: 1 })`, which sorts the *string* `'high'/'medium'/'low'` alphabetically descending — giving `medium, low, high` order, not true priority order. The new `/api/discord/wishlist` route (Task 10) instead ranks priority explicitly (`high` < `medium` < `low`) since the spec requires "top wishlist items by priority" to be correct. Fixing the existing bug in `/api/wishlist` is out of scope for this plan.

---

## File Structure

**New backend files:**
- `backend/models/DiscordLink.js` — completed link record (userId ↔ discordUserId)
- `backend/models/DiscordLinkCode.js` — short-lived linking code (mirrors `PasswordResetToken`)
- `backend/middleware/discordAuth.js` — `requireBotAuth` + `resolveDiscordUser`
- `backend/routes/discord.js` — all `/api/discord/*` endpoints
- `backend/__tests__/discord-link-code.test.js` — linking-code generation/validation/expiry
- `backend/__tests__/discord-bot-auth-middleware.test.js` — `requireBotAuth` unit tests
- `backend/__tests__/discord-routes.test.js` — supertest integration tests for `/api/discord/*`

**New bot process (own `package.json`/`node_modules` — see Task 1):**
- `backend/discord-bot/package.json`
- `backend/discord-bot/.env.example`
- `backend/discord-bot/apiClient.js` — thin axios wrapper carrying the service token
- `backend/discord-bot/commands/link.js`, `unlink.js`, `collection.js`, `card.js`, `add.js`, `wishlist.js`
- `backend/discord-bot/commands/index.js` — command registry
- `backend/discord-bot/index.js` — discord.js Client bootstrap + slash-command registration + interaction dispatch
- `backend/discord-bot/__tests__/commands.test.js` — command handlers tested against a mocked `apiClient`, no gateway connection

**Modified files:**
- `backend/server.js` — mount `/api/discord` router (after line 167, `app.use(checkMaintenanceMode)`)
- `backend/.env.local`, `backend/.env.cloud` — add `DISCORD_BOT_SERVICE_TOKEN` template var
- `start-both-servers.bat` — add a third `start` window for the bot process
- `package.json` (root) — add `start:bot` script for consistency with `start:backend`/`start:frontend`
- `frontend/src/components/auth/AccountSettings.js` — new "Discord" tab: generate/display linking code, show link status, disconnect button

---

## Task 1: Verify discord.js dependency placement (research + decision, no product code yet)

This resolves the spec's open question ("own package.json or folder-scoped dependencies... decide based on whether discord.js conflicts with anything already installed") by actually checking, not by guessing.

**Files:** none yet — this task only runs commands and records the decision that Task 12 implements.

- [ ] **Step 1: Confirm there's nothing in the current backend dependency tree that `discord.js` would collide with**

Run (from `backend/`):
```bash
npm ls ws undici node-fetch 2>&1 | cat
```
Expected (verified during planning by reading `backend/package-lock.json`): no matches — the current backend dependency tree (`axios, bcrypt, compression, cors, dotenv, express, express-rate-limit, jsonwebtoken, mongoose, node-cache, node-cron, nodemailer, sharp`) has neither `ws`, `undici`, nor `node-fetch` at any version, so there is nothing for discord.js's own dependencies on those packages to conflict with even if installed into a shared tree.

- [ ] **Step 2: Do a real trial install in an isolated scratch folder (not the backend tree) to check for peer-dependency or engine errors**

```bash
mkdir -p /tmp/discord-js-check && cd /tmp/discord-js-check
npm init -y
npm install discord.js
npm ls discord.js
node -e "console.log(require('discord.js').version)"
```
Expected: install completes with no `ERESOLVE` errors, and prints a `14.x` version string.

- [ ] **Step 3: Apply the decision rule**

- **If Step 2 succeeds cleanly (expected outcome):** give the bot its own `backend/discord-bot/package.json` with its own `node_modules`, isolated from `backend/node_modules`. This is the recommended default because (a) the bot process needs no backend dependency at all — no `mongoose`, no `express` — it only ever talks to the backend over HTTP with `axios`, so there's no code-sharing reason to share a `node_modules` tree; (b) it matches the existing project convention that `backend/` and `frontend/` are already fully separate installable packages (per root `package.json`'s `install:all` script); (c) it keeps a `discord.js` version bump from ever being able to break the main API's dependency resolution, which directly serves the spec's stated goal ("Keeps a Discord outage or bot crash from affecting the main API").
- **If Step 2 fails** (peer conflict or Node engine mismatch): record the exact conflicting package/version from the npm error output, and fall back to installing `discord.js` directly into `backend/node_modules` via `backend/package.json`, dropping the separate `backend/discord-bot/package.json` (the bot's files still live under `backend/discord-bot/`, they just `require()` from the shared `backend/node_modules`). Re-read this decision rule's Step 3 language back into Task 12 before implementing it, since Task 12's file content below assumes the first (recommended) branch.

- [ ] **Step 4: Clean up the scratch install**

```bash
rm -rf /tmp/discord-js-check
```

---

## Task 2: `DiscordLink` model

**Files:**
- Create: `backend/models/DiscordLink.js`
- Test: `backend/__tests__/discord-link.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// backend/__tests__/discord-link.test.js
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
  await mongoose.connection.dropDatabase();
});

describe('DiscordLink model', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  test('creates a link with userId, discordUserId, and a default linkedAt', async () => {
    const link = await DiscordLink.create({ userId: user._id, discordUserId: '123456789012345678' });
    expect(link.userId.toString()).toBe(user._id.toString());
    expect(link.discordUserId).toBe('123456789012345678');
    expect(link.linkedAt).toBeInstanceOf(Date);
  });

  test('rejects a second link for the same userId', async () => {
    await DiscordLink.create({ userId: user._id, discordUserId: '111' });
    await expect(
      DiscordLink.create({ userId: user._id, discordUserId: '222' })
    ).rejects.toThrow();
  });

  test('rejects a second link for the same discordUserId', async () => {
    const user2 = await User.create({
      email: 'test2@test.com',
      username: 'testuser2',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: '999' });
    await expect(
      DiscordLink.create({ userId: user2._id, discordUserId: '999' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-link.test.js`
Expected: FAIL with `Cannot find module '../models/DiscordLink'`

- [ ] **Step 3: Write the model**

```javascript
// backend/models/DiscordLink.js
const mongoose = require('mongoose');

const discordLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // one Discord account per site account
  },
  discordUserId: {
    type: String,
    required: true,
    unique: true // one site account per Discord account
  },
  discordUsername: {
    type: String,
    default: '' // best-effort display label (e.g. "someuser"), not used for lookups
  },
  linkedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DiscordLink', discordLinkSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-link.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/DiscordLink.js backend/__tests__/discord-link.test.js
git commit -m "feat: add DiscordLink model for account linking"
```

---

## Task 3: `DiscordLinkCode` model (short-lived linking code)

**Files:**
- Create: `backend/models/DiscordLinkCode.js`
- Test: `backend/__tests__/discord-link-code.test.js`

This mirrors `backend/models/PasswordResetToken.js:34-51` (create/find-valid/mark-used pattern), swapped from a 32-byte hex token to a human-typeable 6-character code with a 10-minute expiry, per spec line 23.

- [ ] **Step 1: Write the failing test**

```javascript
// backend/__tests__/discord-link-code.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DiscordLinkCode = require('../models/DiscordLinkCode');
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

describe('DiscordLinkCode', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  test('createCode generates a 6-character code expiring ~10 minutes out', async () => {
    const before = Date.now();
    const doc = await DiscordLinkCode.createCode(user._id);
    expect(doc.code).toHaveLength(6);
    expect(doc.used).toBe(false);
    const expiresInMs = doc.expiresAt.getTime() - before;
    expect(expiresInMs).toBeGreaterThan(9 * 60 * 1000);
    expect(expiresInMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });

  test('createCode removes any previous unused code for the same user', async () => {
    const first = await DiscordLinkCode.createCode(user._id);
    const second = await DiscordLinkCode.createCode(user._id);
    expect(first.code).not.toBe(second.code);
    const stale = await DiscordLinkCode.findOne({ code: first.code });
    expect(stale).toBeNull();
  });

  test('findValidCode returns the doc for a fresh, unused code (case-insensitive)', async () => {
    const doc = await DiscordLinkCode.createCode(user._id);
    const found = await DiscordLinkCode.findValidCode(doc.code.toLowerCase());
    expect(found).not.toBeNull();
    expect(found.userId._id.toString()).toBe(user._id.toString());
  });

  test('findValidCode returns null for an unknown code', async () => {
    const found = await DiscordLinkCode.findValidCode('ZZZZZZ');
    expect(found).toBeNull();
  });

  test('findValidCode returns null once the code has expired', async () => {
    const doc = await DiscordLinkCode.createCode(user._id);
    doc.expiresAt = new Date(Date.now() - 1000);
    await doc.save();
    const found = await DiscordLinkCode.findValidCode(doc.code);
    expect(found).toBeNull();
  });

  test('findValidCode returns null once the code has been used', async () => {
    const doc = await DiscordLinkCode.createCode(user._id);
    await doc.markAsUsed();
    const found = await DiscordLinkCode.findValidCode(doc.code);
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-link-code.test.js`
Expected: FAIL with `Cannot find module '../models/DiscordLinkCode'`

- [ ] **Step 3: Write the model**

```javascript
// backend/models/DiscordLinkCode.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const discordLinkCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

discordLinkCodeSchema.index({ code: 1 });
discordLinkCodeSchema.index({ expiresAt: 1 });

// Excludes visually ambiguous characters (0/O, 1/I/L) since this code gets typed by hand into Discord.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET.charAt(crypto.randomInt(CODE_ALPHABET.length));
  }
  return code;
}

// Static method to create a new linking code for a user
discordLinkCodeSchema.statics.createCode = async function(userId) {
  // Remove any existing unused codes for this user (mirrors PasswordResetToken.createToken)
  await this.deleteMany({ userId, used: false });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const linkCode = new this({ userId, code, expiresAt });
  return await linkCode.save();
};

// Static method to find and validate a code (case-insensitive)
discordLinkCodeSchema.statics.findValidCode = async function(code) {
  return this.findOne({
    code: code.toUpperCase(),
    expiresAt: { $gt: new Date() },
    used: false
  }).populate('userId');
};

// Instance method to mark a code as used
discordLinkCodeSchema.methods.markAsUsed = async function() {
  this.used = true;
  return await this.save();
};

module.exports = mongoose.model('DiscordLinkCode', discordLinkCodeSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-link-code.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/DiscordLinkCode.js backend/__tests__/discord-link-code.test.js
git commit -m "feat: add DiscordLinkCode model for short-lived Discord linking codes"
```

---

## Task 4: `requireBotAuth` and `resolveDiscordUser` middleware

**Files:**
- Create: `backend/middleware/discordAuth.js`
- Test: `backend/__tests__/discord-bot-auth-middleware.test.js`

`requireBotAuth` mirrors the shape of the other guard functions in `backend/middleware/auth.js` (e.g. `requireAuth` at line 69, `requireRole` at line 90): a function that reads `req`, either calls `next()` or writes a JSON error response. It validates a single shared secret from `process.env.DISCORD_BOT_SERVICE_TOKEN` using a constant-time comparison (`crypto.timingSafeEqual`) so response timing can't leak whether a guessed token is "close."

`resolveDiscordUser` is the piece that makes "the backend resolves [discordUserId] to the corresponding userId server-side" (spec line 29) concrete: it looks up `DiscordLink` by `discordUserId` (read from `req.body.discordUserId` or `req.query.discordUserId`) and sets `req.user = user.toSafeObject()`, so every downstream route can keep using `buildUserQuery`/`getUserId`/`requireEditor` exactly as the web routes do.

- [ ] **Step 1: Write the failing test**

```javascript
// backend/__tests__/discord-bot-auth-middleware.test.js
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-service-token-abc123';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { requireBotAuth, resolveDiscordUser } = require('../middleware/discordAuth');
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
  await mongoose.connection.dropDatabase();
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireBotAuth', () => {
  test('rejects a request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireBotAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rejects an invalid service token', async () => {
    const req = { headers: { authorization: 'Bearer wrong-token' } };
    const res = mockRes();
    const next = jest.fn();

    await requireBotAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('accepts the correct service token', async () => {
    const req = { headers: { authorization: 'Bearer test-service-token-abc123' } };
    const res = mockRes();
    const next = jest.fn();

    await requireBotAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('resolveDiscordUser', () => {
  test('returns 400 when discordUserId is missing', async () => {
    const req = { body: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await resolveDiscordUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 404 when the Discord account is not linked', async () => {
    const req = { body: { discordUserId: 'unlinked-id' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await resolveDiscordUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test('sets req.user from the linked site account and calls next()', async () => {
    const user = await User.create({
      email: 'linked@test.com',
      username: 'linkeduser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-123' });

    const req = { body: { discordUserId: 'discord-123' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await resolveDiscordUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user._id.toString()).toBe(user._id.toString());
    expect(req.user.role).toBe('editor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-bot-auth-middleware.test.js`
Expected: FAIL with `Cannot find module '../middleware/discordAuth'`

- [ ] **Step 3: Write the middleware**

```javascript
// backend/middleware/discordAuth.js
const crypto = require('crypto');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');

/**
 * Require the shared Discord bot service token.
 * The bot never holds a real user's JWT — this is a single long-lived
 * secret shared between the backend (.env DISCORD_BOT_SERVICE_TOKEN) and
 * the bot process's own .env of the same name.
 */
const requireBotAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Bot service token required',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.substring(7);
  const expected = process.env.DISCORD_BOT_SERVICE_TOKEN;

  if (!expected) {
    console.error('DISCORD_BOT_SERVICE_TOKEN is not configured on the backend');
    return res.status(503).json({
      message: 'Discord bot integration is not configured',
      code: 'BOT_AUTH_UNCONFIGURED'
    });
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  const isValid =
    tokenBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(tokenBuf, expectedBuf);

  if (!isValid) {
    return res.status(401).json({
      message: 'Invalid bot service token',
      code: 'INVALID_BOT_TOKEN'
    });
  }

  next();
};

/**
 * Resolve the acting user from a Discord user ID and populate req.user
 * in the same shape verifyToken would (user.toSafeObject()), so every
 * downstream route can keep using buildUserQuery/getUserId/requireEditor
 * unmodified. Must run after requireBotAuth. Reads discordUserId from
 * either the request body (POST) or query string (GET).
 */
const resolveDiscordUser = async (req, res, next) => {
  const discordUserId = req.body?.discordUserId || req.query?.discordUserId;

  if (!discordUserId) {
    return res.status(400).json({
      message: 'discordUserId is required',
      code: 'MISSING_DISCORD_USER_ID'
    });
  }

  try {
    const link = await DiscordLink.findOne({ discordUserId });
    if (!link) {
      return res.status(404).json({
        message: 'This Discord account is not linked to a site account',
        code: 'NOT_LINKED'
      });
    }

    const user = await User.findById(link.userId);
    if (!user || !user.isActive) {
      return res.status(404).json({
        message: 'The linked site account was not found or is deactivated',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = user.toSafeObject();
    next();
  } catch (error) {
    console.error('resolveDiscordUser error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { requireBotAuth, resolveDiscordUser };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-bot-auth-middleware.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/discordAuth.js backend/__tests__/discord-bot-auth-middleware.test.js
git commit -m "feat: add requireBotAuth and resolveDiscordUser middleware"
```

---

## Task 5: `routes/discord.js` skeleton + linking endpoints (`/link/start`, `/link/complete`, `/unlink`, `/link` DELETE, `/link/status`)

**Files:**
- Create: `backend/routes/discord.js`
- Test: `backend/__tests__/discord-routes.test.js`

This test file follows the exact pattern used in `backend/__tests__/achievements.test.js:31-41` — build a minimal Express app that manually mounts `verifyToken` before the router under test, since in production `server.js:136` mounts `verifyToken` globally before any router, and the router itself never re-mounts it (confirmed by reading `backend/routes/achievements.js`).

- [ ] **Step 1: Write the failing tests for the linking endpoints**

```javascript
// backend/__tests__/discord-routes.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-service-token-abc123';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');
const DiscordLinkCode = require('../models/DiscordLinkCode');

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

function makeToken(userId, role = 'editor') {
  return jwt.sign({ userId: userId.toString(), role, type: 'access' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  app.use('/api/discord', require('../routes/discord'));
  return app;
}

const BOT_AUTH = { Authorization: 'Bearer test-service-token-abc123' };

describe('POST /api/discord/link/start', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  it('requires web authentication', async () => {
    await request(app).post('/api/discord/link/start').expect(401);
  });

  it('generates a 6-character code for the logged-in user', async () => {
    const res = await request(app)
      .post('/api/discord/link/start')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.code).toHaveLength(6);
    expect(res.body.expiresAt).toBeDefined();
  });

  it('rejects starting a link when the user already has one', async () => {
    await DiscordLink.create({ userId: user._id, discordUserId: 'existing-discord-id' });

    const res = await request(app)
      .post('/api/discord/link/start')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(400);

    expect(res.body.code).toBe('ALREADY_LINKED');
  });
});

describe('POST /api/discord/link/complete', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  it('rejects requests without a valid bot service token', async () => {
    await request(app)
      .post('/api/discord/link/complete')
      .send({ code: 'ABC123', discordUserId: 'discord-1' })
      .expect(401);
  });

  it('rejects an invalid or expired code', async () => {
    const res = await request(app)
      .post('/api/discord/link/complete')
      .set(BOT_AUTH)
      .send({ code: 'ZZZZZZ', discordUserId: 'discord-1' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_CODE');
  });

  it('completes the link for a valid code and creates a DiscordLink', async () => {
    const linkCode = await DiscordLinkCode.createCode(user._id);

    await request(app)
      .post('/api/discord/link/complete')
      .set(BOT_AUTH)
      .send({ code: linkCode.code, discordUserId: 'discord-1', discordUsername: 'someuser' })
      .expect(201);

    const link = await DiscordLink.findOne({ discordUserId: 'discord-1' });
    expect(link).not.toBeNull();
    expect(link.userId.toString()).toBe(user._id.toString());

    const usedCode = await DiscordLinkCode.findOne({ code: linkCode.code });
    expect(usedCode.used).toBe(true);
  });

  it('rejects a discordUserId that is already linked to a different account', async () => {
    const otherUser = await User.create({
      email: 'other@test.com',
      username: 'otheruser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: otherUser._id, discordUserId: 'discord-1' });
    const linkCode = await DiscordLinkCode.createCode(user._id);

    const res = await request(app)
      .post('/api/discord/link/complete')
      .set(BOT_AUTH)
      .send({ code: linkCode.code, discordUserId: 'discord-1' })
      .expect(400);

    expect(res.body.code).toBe('DISCORD_ALREADY_LINKED');
  });
});

describe('POST /api/discord/unlink and DELETE /api/discord/link', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  it('POST /unlink (bot-initiated) removes the link by discordUserId', async () => {
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });

    await request(app)
      .post('/api/discord/unlink')
      .set(BOT_AUTH)
      .send({ discordUserId: 'discord-1' })
      .expect(200);

    expect(await DiscordLink.findOne({ discordUserId: 'discord-1' })).toBeNull();
  });

  it('POST /unlink returns 404 when not linked', async () => {
    const res = await request(app)
      .post('/api/discord/unlink')
      .set(BOT_AUTH)
      .send({ discordUserId: 'never-linked' })
      .expect(404);
    expect(res.body.code).toBe('NOT_LINKED');
  });

  it('DELETE /link (web-initiated) removes the link for the logged-in user', async () => {
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });

    await request(app)
      .delete('/api/discord/link')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(await DiscordLink.findOne({ userId: user._id })).toBeNull();
  });
});

describe('GET /api/discord/link/status', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  it('reports linked: false when there is no link', async () => {
    const res = await request(app)
      .get('/api/discord/link/status')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);
    expect(res.body.linked).toBe(false);
  });

  it('reports linked: true with the discord username when linked', async () => {
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1', discordUsername: 'someuser' });

    const res = await request(app)
      .get('/api/discord/link/status')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.linked).toBe(true);
    expect(res.body.discordUsername).toBe('someuser');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest discord-routes.test.js`
Expected: FAIL with `Cannot find module '../routes/discord'`

- [ ] **Step 3: Write the route file (linking endpoints only for now)**

```javascript
// backend/routes/discord.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const DiscordLink = require('../models/DiscordLink');
const DiscordLinkCode = require('../models/DiscordLinkCode');
const { requireAuth, requireEditor, isMultiUserEnabled } = require('../middleware/auth');
const { requireBotAuth, resolveDiscordUser } = require('../middleware/discordAuth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');

/**
 * POST /api/discord/link/start
 * Authenticated web session. Generates a short-lived linking code the
 * user then types into Discord via /link <code>.
 */
router.post('/link/start', requireAuth, async (req, res) => {
  try {
    if (!isMultiUserEnabled()) {
      return res.status(400).json({
        message: 'Multi-user mode is not enabled',
        code: 'MULTI_USER_DISABLED'
      });
    }

    const existingLink = await DiscordLink.findOne({ userId: req.user._id });
    if (existingLink) {
      return res.status(400).json({
        message: 'Your account is already linked to a Discord account. Unlink it first.',
        code: 'ALREADY_LINKED'
      });
    }

    const linkCode = await DiscordLinkCode.createCode(req.user._id);
    res.json({ code: linkCode.code, expiresAt: linkCode.expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/discord/link/complete
 * Bot-authenticated. Called when the user runs /link <code> in Discord.
 */
router.post('/link/complete', requireBotAuth, async (req, res) => {
  try {
    const { code, discordUserId, discordUsername } = req.body;

    if (!code || !discordUserId) {
      return res.status(400).json({
        message: 'code and discordUserId are required',
        code: 'MISSING_FIELDS'
      });
    }

    const linkCodeDoc = await DiscordLinkCode.findValidCode(code);
    if (!linkCodeDoc) {
      return res.status(400).json({
        message: 'Invalid or expired linking code',
        code: 'INVALID_CODE'
      });
    }

    const existingByDiscordId = await DiscordLink.findOne({ discordUserId });
    if (existingByDiscordId) {
      return res.status(400).json({
        message: 'This Discord account is already linked to a different site account',
        code: 'DISCORD_ALREADY_LINKED'
      });
    }

    const existingByUser = await DiscordLink.findOne({ userId: linkCodeDoc.userId._id });
    if (existingByUser) {
      return res.status(400).json({
        message: 'That site account is already linked to a Discord account',
        code: 'USER_ALREADY_LINKED'
      });
    }

    await DiscordLink.create({
      userId: linkCodeDoc.userId._id,
      discordUserId,
      discordUsername: discordUsername || ''
    });

    await linkCodeDoc.markAsUsed();

    res.status(201).json({
      message: 'Discord account linked successfully',
      username: linkCodeDoc.userId.username
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This Discord account is already linked', code: 'DUPLICATE_LINK' });
    }
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/discord/unlink
 * Bot-authenticated. Called when the user runs /unlink in Discord.
 */
router.post('/unlink', requireBotAuth, async (req, res) => {
  try {
    const { discordUserId } = req.body;
    if (!discordUserId) {
      return res.status(400).json({ message: 'discordUserId is required', code: 'MISSING_DISCORD_USER_ID' });
    }

    const result = await DiscordLink.findOneAndDelete({ discordUserId });
    if (!result) {
      return res.status(404).json({
        message: 'This Discord account is not linked to any site account',
        code: 'NOT_LINKED'
      });
    }

    res.json({ message: 'Discord account unlinked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/discord/link
 * Authenticated web session. "Disconnect Discord" button in Settings.
 */
router.delete('/link', requireAuth, async (req, res) => {
  try {
    const result = await DiscordLink.findOneAndDelete({ userId: req.user._id });
    if (!result) {
      return res.status(404).json({ message: 'No linked Discord account found', code: 'NOT_LINKED' });
    }
    res.json({ message: 'Discord account disconnected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/discord/link/status
 * Authenticated web session. Lets Settings show current link state.
 */
router.get('/link/status', requireAuth, async (req, res) => {
  try {
    const link = await DiscordLink.findOne({ userId: req.user._id });
    res.json({
      linked: !!link,
      discordUsername: link?.discordUsername || null,
      linkedAt: link?.linkedAt || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest discord-routes.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add Discord account linking endpoints"
```

---

## Task 6: `GET /api/discord/collection`

**Files:**
- Modify: `backend/routes/discord.js`
- Modify: `backend/__tests__/discord-routes.test.js`

Returns total cards, total value, and last-updated timestamp for the linked user — mirrors the aggregation done in `backend/server.js:1360-1399` (`GET /api/stats`) but scoped down to just what `/collection` needs.

- [ ] **Step 1: Add the failing test**

Append to `backend/__tests__/discord-routes.test.js`:

```javascript
describe('GET /api/discord/collection', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  });

  it('rejects requests without bot auth', async () => {
    await request(app).get('/api/discord/collection?discordUserId=discord-1').expect(401);
  });

  it('rejects an unlinked discordUserId', async () => {
    const res = await request(app)
      .get('/api/discord/collection?discordUserId=never-linked')
      .set(BOT_AUTH)
      .expect(404);
    expect(res.body.code).toBe('NOT_LINKED');
  });

  it('returns total cards, total value, and last updated for the linked user', async () => {
    const Card = mongoose.model('Card');
    await Card.create({ userId: user._id, name: 'Sol Ring', set: 'C21', condition: 'NM', quantity: 2, price: 1.5 });
    await Card.create({ userId: user._id, name: 'Lightning Bolt', set: 'M10', condition: 'NM', quantity: 3, price: 0.5 });

    const res = await request(app)
      .get('/api/discord/collection?discordUserId=discord-1')
      .set(BOT_AUTH)
      .expect(200);

    expect(res.body.totalCards).toBe(5);
    expect(res.body.totalValue).toBe(4.5); // (2*1.5) + (3*0.5)
    expect(res.body.lastUpdated).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-routes.test.js -t "collection"`
Expected: FAIL — route doesn't exist yet (404 with default Express handler, not the expected JSON shape)

- [ ] **Step 3: Add the route**

Add to `backend/routes/discord.js`, before `module.exports = router;`:

```javascript
/**
 * GET /api/discord/collection?discordUserId=...
 * Bot-authenticated. Quick stats: total cards, total value, last updated.
 */
router.get('/collection', requireBotAuth, resolveDiscordUser, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query).select('quantity price updatedAt').lean();

    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
    const totalValue = cards.reduce((sum, c) => sum + c.price * c.quantity, 0);
    const lastUpdated = cards.reduce(
      (latest, c) => (!latest || c.updatedAt > latest ? c.updatedAt : latest),
      null
    );

    res.json({
      totalCards,
      totalValue: Math.round(totalValue * 100) / 100,
      lastUpdated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-routes.test.js -t "collection"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add GET /api/discord/collection"
```

---

## Task 7: `GET /api/discord/card`

**Files:**
- Modify: `backend/routes/discord.js`
- Modify: `backend/__tests__/discord-routes.test.js`

- [ ] **Step 1: Add the failing test**

Append to `backend/__tests__/discord-routes.test.js`:

```javascript
describe('GET /api/discord/card', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  });

  it('returns found: false when the card is not in the collection', async () => {
    const res = await request(app)
      .get('/api/discord/card?discordUserId=discord-1&name=Black Lotus')
      .set(BOT_AUTH)
      .expect(200);
    expect(res.body.found).toBe(false);
  });

  it('returns quantity, condition, and price for a matching card (case-insensitive)', async () => {
    const Card = mongoose.model('Card');
    await Card.create({ userId: user._id, name: 'Sol Ring', set: 'C21', condition: 'NM', quantity: 2, price: 1.5 });

    const res = await request(app)
      .get('/api/discord/card?discordUserId=discord-1&name=sol ring')
      .set(BOT_AUTH)
      .expect(200);

    expect(res.body.found).toBe(true);
    expect(res.body.printings).toHaveLength(1);
    expect(res.body.printings[0]).toMatchObject({ set: 'C21', condition: 'NM', quantity: 2, price: 1.5 });
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .get('/api/discord/card?discordUserId=discord-1')
      .set(BOT_AUTH)
      .expect(400);
    expect(res.body.code).toBe('MISSING_NAME');
  });

  it('does not treat regex special characters in the name as regex syntax', async () => {
    const Card = mongoose.model('Card');
    await Card.create({ userId: user._id, name: "Urza's Tower", set: 'ATQ', condition: 'NM', quantity: 1, price: 0.25 });

    const res = await request(app)
      .get(`/api/discord/card?discordUserId=discord-1&name=${encodeURIComponent("Urza's Tower")}`)
      .set(BOT_AUTH)
      .expect(200);

    expect(res.body.found).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-routes.test.js -t "GET /api/discord/card"`
Expected: FAIL — route not found

- [ ] **Step 3: Add the route**

Add to `backend/routes/discord.js`, before `module.exports = router;`:

```javascript
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/discord/card?discordUserId=...&name=...
 * Bot-authenticated. Is this card in the collection? Quantity, condition, price.
 */
router.get('/card', requireBotAuth, resolveDiscordUser, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: 'name query parameter is required', code: 'MISSING_NAME' });
    }

    const Card = mongoose.model('Card');
    const query = buildUserQuery(
      { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      req
    );
    const cards = await Card.find(query).select('set condition quantity price isFoil').lean();

    if (cards.length === 0) {
      return res.json({ found: false, name });
    }

    res.json({
      found: true,
      name,
      printings: cards.map((c) => ({
        set: c.set,
        condition: c.condition,
        quantity: c.quantity,
        price: c.price,
        isFoil: c.isFoil
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-routes.test.js -t "GET /api/discord/card"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add GET /api/discord/card"
```

---

## Task 8: `POST /api/discord/cards` (the `/add` command's backend, auto-merge)

**Files:**
- Modify: `backend/routes/discord.js`
- Modify: `backend/__tests__/discord-routes.test.js`

This duplicates the auto-merge logic in `backend/server.js:1167-1208` (`POST /api/cards`) rather than extracting a shared function, since that logic is inline in the single-file `server.js` and refactoring it out is unrelated scope for this feature. The behavior is intentionally identical: same-name/set/condition/foil match increments quantity; otherwise a new `Card` is created. `requireEditor` is reused as-is (it reads `req.user.role`, which `resolveDiscordUser` populates), so a linked account with the legacy `viewer` role (`collection:view` only, per `backend/utils/permissions.js:35`) is correctly blocked from adding cards, matching web behavior.

- [ ] **Step 1: Add the failing tests**

Append to `backend/__tests__/discord-routes.test.js`:

```javascript
describe('POST /api/discord/cards', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  });

  it('creates a new card with defaults when quantity/condition/set are omitted', async () => {
    const res = await request(app)
      .post('/api/discord/cards')
      .set(BOT_AUTH)
      .send({ discordUserId: 'discord-1', name: 'Lightning Bolt' })
      .expect(201);

    expect(res.body.name).toBe('Lightning Bolt');
    expect(res.body.quantity).toBe(1);
    expect(res.body.condition).toBe('NM');
    expect(res.body.set).toBe('Unknown');
  });

  it('merges quantity into an existing matching card', async () => {
    const Card = mongoose.model('Card');
    await Card.create({ userId: user._id, name: 'Sol Ring', set: 'C21', condition: 'NM', quantity: 2, price: 1.5 });

    const res = await request(app)
      .post('/api/discord/cards')
      .set(BOT_AUTH)
      .send({ discordUserId: 'discord-1', name: 'Sol Ring', set: 'C21', condition: 'NM', quantity: 3 })
      .expect(200);

    expect(res.body.merged).toBe(true);
    expect(res.body.quantity).toBe(5);
  });

  it('rejects a request with no name', async () => {
    const res = await request(app)
      .post('/api/discord/cards')
      .set(BOT_AUTH)
      .send({ discordUserId: 'discord-1' })
      .expect(400);
    expect(res.body.code).toBe('MISSING_NAME');
  });

  it('blocks a linked account with the legacy viewer role', async () => {
    const viewerUser = await User.create({
      email: 'viewer@test.com',
      username: 'vieweruser',
      passwordHash: 'hashedpass123',
      role: 'viewer'
    });
    await DiscordLink.create({ userId: viewerUser._id, discordUserId: 'discord-viewer' });

    await request(app)
      .post('/api/discord/cards')
      .set(BOT_AUTH)
      .send({ discordUserId: 'discord-viewer', name: 'Lightning Bolt' })
      .expect(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-routes.test.js -t "POST /api/discord/cards"`
Expected: FAIL — route not found

- [ ] **Step 3: Add the route**

Add to `backend/routes/discord.js`, before `module.exports = router;`:

```javascript
/**
 * POST /api/discord/cards
 * Bot-authenticated. Backs the /add command. Mirrors the auto-merge
 * logic in POST /api/cards (backend/server.js:1167-1208).
 */
router.post('/cards', requireBotAuth, resolveDiscordUser, requireEditor, async (req, res) => {
  try {
    const { name, quantity, condition, set, isFoil } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'name is required', code: 'MISSING_NAME' });
    }

    const Card = mongoose.model('Card');
    const cardCondition = condition || 'NM';
    const cardSet = set || 'Unknown';
    const cardQuantity = quantity || 1;
    const cardIsFoil = isFoil || false;

    const existingQuery = buildUserQuery(
      { name, set: cardSet, condition: cardCondition, isFoil: cardIsFoil },
      req
    );
    const existingCard = await Card.findOne(existingQuery);

    if (existingCard) {
      existingCard.quantity += cardQuantity;
      const updatedCard = await existingCard.save();

      const userId = getUserId(req);
      if (userId) {
        const { checkCollectionMilestones } = require('../utils/milestoneAwards');
        checkCollectionMilestones(userId, Card).catch(() => {});
      }

      return res.status(200).json({
        ...updatedCard.toObject(),
        merged: true,
        message: `Merged with existing card. New quantity: ${updatedCard.quantity}`
      });
    }

    const userId = getUserId(req);
    const card = new Card({
      name,
      set: cardSet,
      condition: cardCondition,
      quantity: cardQuantity,
      isFoil: cardIsFoil,
      userId
    });
    const newCard = await card.save();

    if (newCard.userId) {
      const { checkCollectionMilestones } = require('../utils/milestoneAwards');
      checkCollectionMilestones(newCard.userId, Card).catch(() => {});
    }

    res.status(201).json(newCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-routes.test.js -t "POST /api/discord/cards"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add POST /api/discord/cards for the /add command"
```

---

## Task 9: `GET /api/discord/wishlist`

**Files:**
- Modify: `backend/routes/discord.js`
- Modify: `backend/__tests__/discord-routes.test.js`

As noted in "Spec vs. codebase" above, this deliberately does **not** copy the sort used by the existing `GET /api/wishlist` (`backend/server.js:2054`, `.sort({ priority: -1, name: 1 })`), because that sorts the priority string alphabetically (`medium, low, high`), not by actual importance. This route ranks `high` before `medium` before `low` explicitly.

- [ ] **Step 1: Add the failing tests**

Append to `backend/__tests__/discord-routes.test.js`:

```javascript
describe('GET /api/discord/wishlist', () => {
  let app, user;

  beforeEach(async () => {
    app = buildApp();
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  });

  it('returns items sorted by actual priority rank (high, then medium, then low)', async () => {
    const WishlistItem = mongoose.model('WishlistItem');
    await WishlistItem.create({ userId: user._id, name: 'Low Item', priority: 'low', targetPrice: 1, currentPrice: 1 });
    await WishlistItem.create({ userId: user._id, name: 'High Item', priority: 'high', targetPrice: 2, currentPrice: 2 });
    await WishlistItem.create({ userId: user._id, name: 'Medium Item', priority: 'medium', targetPrice: 3, currentPrice: 3 });

    const res = await request(app)
      .get('/api/discord/wishlist?discordUserId=discord-1')
      .set(BOT_AUTH)
      .expect(200);

    expect(res.body.items.map((i) => i.name)).toEqual(['High Item', 'Medium Item', 'Low Item']);
  });

  it('caps the result at 10 items', async () => {
    const WishlistItem = mongoose.model('WishlistItem');
    for (let i = 0; i < 15; i++) {
      await WishlistItem.create({ userId: user._id, name: `Card ${i}`, priority: 'medium' });
    }

    const res = await request(app)
      .get('/api/discord/wishlist?discordUserId=discord-1')
      .set(BOT_AUTH)
      .expect(200);

    expect(res.body.items).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest discord-routes.test.js -t "GET /api/discord/wishlist"`
Expected: FAIL — route not found

- [ ] **Step 3: Add the route**

Add to `backend/routes/discord.js`, before `module.exports = router;`:

```javascript
/**
 * GET /api/discord/wishlist?discordUserId=...
 * Bot-authenticated. Top wishlist items by actual priority (not the
 * alphabetical priority sort used by GET /api/wishlist).
 */
router.get('/wishlist', requireBotAuth, resolveDiscordUser, async (req, res) => {
  try {
    const WishlistItem = mongoose.model('WishlistItem');
    const query = buildUserQuery({}, req);
    const items = await WishlistItem.find(query).sort({ name: 1 }).lean();

    const priorityRank = { high: 0, medium: 1, low: 2 };
    const topItems = [...items]
      .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1))
      .slice(0, 10);

    res.json({
      items: topItems.map((i) => ({
        name: i.name,
        priority: i.priority,
        targetPrice: i.targetPrice,
        currentPrice: i.currentPrice
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest discord-routes.test.js -t "GET /api/discord/wishlist"`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full discord-routes test file once to confirm nothing regressed**

Run: `cd backend && npx jest discord-routes.test.js`
Expected: PASS (all tests across Tasks 5-9)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/discord.js backend/__tests__/discord-routes.test.js
git commit -m "feat: add GET /api/discord/wishlist with correct priority ranking"
```

---

## Task 10: Mount the router in `server.js` and add env var templates

**Files:**
- Modify: `backend/server.js:167` (right after `app.use(checkMaintenanceMode);`)
- Modify: `backend/.env.local`
- Modify: `backend/.env.cloud`

Mounting after `checkMaintenanceMode` (rather than alongside `forum`/`messages`/`trades`/`achievements`, which are all mounted *before* it at lines 150-164) is a deliberate choice: it makes `/api/discord/*` respect maintenance mode the same way the inline `/api/cards`/`/api/wishlist` routes already do (both blocks of routes touch the same `Card`/`WishlistItem` data), so a maintenance window pauses bot writes too. This is safe regardless of exact position because `mongoose.model('Card')` inside the route handlers (Task 6-9) is resolved lazily at request time, not at file-load time — the `Card` model doesn't even exist yet when `server.js` starts executing top-to-bottom (it's defined at line 386), so mounting this router earlier in the file would still work correctly at request time. This was verified by reading `backend/routes/admin.js:492`, which does the same lazy `mongoose.model('Card')` lookup inside its own route handlers despite being `require()`'d at the very top of `server.js` (line 9), long before the `Card` schema is registered.

- [ ] **Step 1: Mount the router**

In `backend/server.js`, change:
```javascript
// Check maintenance mode for all other routes
app.use(checkMaintenanceMode);
```
to:
```javascript
// Check maintenance mode for all other routes
app.use(checkMaintenanceMode);

// Mount Discord bot integration routes (account linking + bot-authenticated
// collection actions). Deliberately mounted after checkMaintenanceMode so a
// maintenance window pauses bot writes the same way it pauses /api/cards.
app.use('/api/discord', require('./routes/discord'));
```

- [ ] **Step 2: Add the shared service token to both env templates**

Append to `backend/.env.local` (after the existing `DAILY_API_KEY=` line):
```
# Discord bot integration (see backend/discord-bot/)
# Shared secret between this backend and backend/discord-bot/.env — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DISCORD_BOT_SERVICE_TOKEN=
```

Do the same in `backend/.env.cloud` (read the file first to match its exact existing trailing content before appending, since it may differ slightly from `.env.local`).

- [ ] **Step 3: Manually verify the server still boots**

Run: `cd backend && node -e "require('./server.js')"` (Ctrl+C after seeing "MongoDB connected successfully" / listen message — or just run `npm run dev` briefly)
Expected: no `Cannot find module` or route-mounting errors. `DISCORD_BOT_SERVICE_TOKEN` will be empty in a dev `.env` at this point — that's fine, `requireBotAuth` already handles the empty-secret case with a `503 BOT_AUTH_UNCONFIGURED` (Task 4) rather than crashing.

- [ ] **Step 4: Run the full existing backend test suite to confirm no regressions from the new mount point**

Run: `cd backend && npx jest`
Expected: PASS (all existing + new discord test files)

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/.env.local backend/.env.cloud
git commit -m "feat: mount /api/discord routes and document DISCORD_BOT_SERVICE_TOKEN"
```

---

## Task 11: Bot process scaffold — `package.json` and `apiClient.js`

**Files:**
- Create: `backend/discord-bot/package.json`
- Create: `backend/discord-bot/.env.example`
- Create: `backend/discord-bot/apiClient.js`
- Test: `backend/discord-bot/__tests__/apiClient.test.js`

This assumes Task 1's recommended outcome (separate `package.json`/`node_modules`). If Task 1's Step 3 instead found a real conflict, skip creating `backend/discord-bot/package.json` here and instead add `discord.js` to `backend/package.json`'s `dependencies` — every other file path and piece of code in this and later tasks is unaffected by that choice.

- [ ] **Step 1: Create the bot's own package.json**

```json
{
  "name": "mtg-tracker-discord-bot",
  "version": "1.0.0",
  "description": "Discord bot for MTG Tracker — account-linked collection commands",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "register-commands": "node register-commands.js",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^30.4.2"
  }
}
```

- [ ] **Step 2: Install into the isolated tree**

```bash
cd backend/discord-bot
npm install
```
Expected: creates `backend/discord-bot/node_modules` and `backend/discord-bot/package-lock.json` with no errors (per Task 1's verification).

- [ ] **Step 3: Create the env template**

```
# backend/discord-bot/.env.example
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
# Optional: set to a test server's guild ID during development for instant
# command registration (guild commands update immediately; global commands
# can take up to an hour to propagate). Leave blank to register globally.
DISCORD_GUILD_ID=
BACKEND_API_URL=http://localhost:5000/api
# Must exactly match DISCORD_BOT_SERVICE_TOKEN in backend/.env
DISCORD_BOT_SERVICE_TOKEN=
```

- [ ] **Step 4: Write the failing test for apiClient**

```javascript
// backend/discord-bot/__tests__/apiClient.test.js
const { createApiClient } = require('../apiClient');

describe('createApiClient', () => {
  test('sets baseURL and Authorization header from config', () => {
    const client = createApiClient({
      baseURL: 'http://localhost:5000/api',
      serviceToken: 'test-token-123'
    });

    expect(client.defaults.baseURL).toBe('http://localhost:5000/api');
    expect(client.defaults.headers.Authorization).toBe('Bearer test-token-123');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd backend/discord-bot && npx jest apiClient.test.js`
Expected: FAIL with `Cannot find module '../apiClient'`

- [ ] **Step 6: Write apiClient.js**

```javascript
// backend/discord-bot/apiClient.js
const axios = require('axios');

/**
 * Thin axios wrapper carrying the shared bot service token. Every call
 * into the backend authenticates with this token, never a user JWT — the
 * backend resolves the acting user from the Discord user ID passed in
 * each request's body/query (see backend/middleware/discordAuth.js).
 */
function createApiClient({ baseURL, serviceToken }) {
  return axios.create({
    baseURL,
    headers: { Authorization: `Bearer ${serviceToken}` },
    timeout: 10000
  });
}

module.exports = { createApiClient };
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend/discord-bot && npx jest apiClient.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/discord-bot/package.json backend/discord-bot/.env.example backend/discord-bot/apiClient.js backend/discord-bot/__tests__/apiClient.test.js
git commit -m "feat: scaffold Discord bot process with its own package.json"
```

Note: if Task 1 fell back to installing `discord.js` into `backend/node_modules` instead, also add `backend/discord-bot/` to `.gitignore`'s existing `node_modules/` rule is already sufficient (it's a blanket `node_modules/` ignore at `.gitignore:2`) — no `.gitignore` change is needed either way, since `backend/discord-bot/node_modules/` and `backend/discord-bot/package-lock.json`... actually the lockfile is not covered by the blanket rule and should be committed (consistent with `backend/package-lock.json` and `frontend/package-lock.json` both being tracked in this repo — confirm with `git status backend/package-lock.json` before assuming, but do commit `backend/discord-bot/package-lock.json`).

---

## Task 12: Command handlers — `collection`, `card`, `wishlist` (read-only commands)

**Files:**
- Create: `backend/discord-bot/commands/collection.js`
- Create: `backend/discord-bot/commands/card.js`
- Create: `backend/discord-bot/commands/wishlist.js`
- Test: `backend/discord-bot/__tests__/commands.test.js`

Each command module is a plain object `{ data, execute(interaction, apiClient) }` with no dependency on a live Discord gateway connection — `execute` only needs an `interaction`-shaped object with `.user.id`, `.options.getString(...)`, and a mock `.reply(...)` jest function, plus a mocked `apiClient` (`{ get: jest.fn(), post: jest.fn() }`). This satisfies the spec's testing requirement (line 49): "Command handlers tested against a mocked backend API client (no real Discord gateway connection needed for logic tests)."

- [ ] **Step 1: Write the failing tests**

```javascript
// backend/discord-bot/__tests__/commands.test.js
const collectionCommand = require('../commands/collection');
const cardCommand = require('../commands/card');
const wishlistCommand = require('../commands/wishlist');

function mockInteraction({ options = {} } = {}) {
  return {
    user: { id: 'discord-1' },
    options: {
      getString: (name) => options[name] ?? null
    },
    reply: jest.fn().mockResolvedValue(undefined)
  };
}

function mockApiClient() {
  return { get: jest.fn(), post: jest.fn() };
}

describe('collection command', () => {
  test('replies with total cards, total value, and last updated', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockResolvedValue({
      data: { totalCards: 42, totalValue: 123.45, lastUpdated: '2026-07-01T00:00:00.000Z' }
    });
    const interaction = mockInteraction();

    await collectionCommand.execute(interaction, apiClient);

    expect(apiClient.get).toHaveBeenCalledWith('/discord/collection', {
      params: { discordUserId: 'discord-1' }
    });
    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.ephemeral).toBe(true);
    expect(reply.content).toContain('42');
    expect(reply.content).toContain('123.45');
  });

  test('replies with a link prompt when the account is not linked', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockRejectedValue({ response: { status: 404, data: { code: 'NOT_LINKED' } } });
    const interaction = mockInteraction();

    await collectionCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/\/link/);
    expect(reply.ephemeral).toBe(true);
  });
});

describe('card command', () => {
  test('replies with printing details when found', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockResolvedValue({
      data: {
        found: true,
        name: 'Sol Ring',
        printings: [{ set: 'C21', condition: 'NM', quantity: 2, price: 1.5, isFoil: false }]
      }
    });
    const interaction = mockInteraction({ options: { name: 'Sol Ring' } });

    await cardCommand.execute(interaction, apiClient);

    expect(apiClient.get).toHaveBeenCalledWith('/discord/card', {
      params: { discordUserId: 'discord-1', name: 'Sol Ring' }
    });
    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toContain('Sol Ring');
    expect(reply.content).toContain('C21');
    expect(reply.content).toContain('2');
  });

  test('replies that the card is not in the collection when not found', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockResolvedValue({ data: { found: false, name: 'Black Lotus' } });
    const interaction = mockInteraction({ options: { name: 'Black Lotus' } });

    await cardCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/not in your collection/i);
  });
});

describe('wishlist command', () => {
  test('replies with a formatted list of top wishlist items', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockResolvedValue({
      data: {
        items: [
          { name: 'Mana Crypt', priority: 'high', targetPrice: 150, currentPrice: 180 },
          { name: 'Rhystic Study', priority: 'medium', targetPrice: 40, currentPrice: 45 }
        ]
      }
    });
    const interaction = mockInteraction();

    await wishlistCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toContain('Mana Crypt');
    expect(reply.content).toContain('Rhystic Study');
    expect(reply.ephemeral).toBe(true);
  });

  test('replies with a friendly message when the wishlist is empty', async () => {
    const apiClient = mockApiClient();
    apiClient.get.mockResolvedValue({ data: { items: [] } });
    const interaction = mockInteraction();

    await wishlistCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/empty/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/discord-bot && npx jest commands.test.js`
Expected: FAIL with `Cannot find module '../commands/collection'`

- [ ] **Step 3: Write the command modules**

```javascript
// backend/discord-bot/commands/collection.js
const { SlashCommandBuilder } = require('discord.js');

function formatError(error) {
  if (error.response?.status === 404 && error.response.data?.code === 'NOT_LINKED') {
    return 'Your Discord account is not linked. Use `/link <code>` first (generate a code in Settings on the site).';
  }
  return 'Something went wrong talking to the backend. Please try again later.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('Show quick stats about your collection'),

  async execute(interaction, apiClient) {
    try {
      const { data } = await apiClient.get('/discord/collection', {
        params: { discordUserId: interaction.user.id }
      });
      const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : 'never';
      await interaction.reply({
        content: `**Your Collection**\nTotal cards: ${data.totalCards}\nTotal value: $${data.totalValue.toFixed(2)}\nLast updated: ${lastUpdated}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: formatError(error), ephemeral: true });
    }
  },

  formatError
};
```

```javascript
// backend/discord-bot/commands/card.js
const { SlashCommandBuilder } = require('discord.js');
const { formatError } = require('./collection');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Check if a card is in your collection')
    .addStringOption((option) =>
      option.setName('name').setDescription('Card name').setRequired(true)
    ),

  async execute(interaction, apiClient) {
    const name = interaction.options.getString('name');
    try {
      const { data } = await apiClient.get('/discord/card', {
        params: { discordUserId: interaction.user.id, name }
      });

      if (!data.found) {
        await interaction.reply({ content: `**${name}** is not in your collection.`, ephemeral: true });
        return;
      }

      const lines = data.printings.map(
        (p) => `${p.set} — ${p.condition}${p.isFoil ? ' (foil)' : ''} — qty ${p.quantity} — $${p.price.toFixed(2)}`
      );
      await interaction.reply({
        content: `**${data.name}**\n${lines.join('\n')}`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: formatError(error), ephemeral: true });
    }
  }
};
```

```javascript
// backend/discord-bot/commands/wishlist.js
const { SlashCommandBuilder } = require('discord.js');
const { formatError } = require('./collection');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Show your top wishlist items by priority'),

  async execute(interaction, apiClient) {
    try {
      const { data } = await apiClient.get('/discord/wishlist', {
        params: { discordUserId: interaction.user.id }
      });

      if (data.items.length === 0) {
        await interaction.reply({ content: 'Your wishlist is empty.', ephemeral: true });
        return;
      }

      const lines = data.items.map(
        (i) => `**${i.name}** (${i.priority}) — target $${i.targetPrice.toFixed(2)}, current $${i.currentPrice.toFixed(2)}`
      );
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: formatError(error), ephemeral: true });
    }
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/discord-bot && npx jest commands.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/discord-bot/commands/collection.js backend/discord-bot/commands/card.js backend/discord-bot/commands/wishlist.js backend/discord-bot/__tests__/commands.test.js
git commit -m "feat: add /collection, /card, /wishlist Discord command handlers"
```

---

## Task 13: Command handlers — `add`, `link`, `unlink` (mutating/linking commands)

**Files:**
- Create: `backend/discord-bot/commands/add.js`
- Create: `backend/discord-bot/commands/link.js`
- Create: `backend/discord-bot/commands/unlink.js`
- Modify: `backend/discord-bot/__tests__/commands.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `backend/discord-bot/__tests__/commands.test.js`:

```javascript
const addCommand = require('../commands/add');
const linkCommand = require('../commands/link');
const unlinkCommand = require('../commands/unlink');

describe('add command', () => {
  test('sends name/quantity/condition and reports the resulting quantity', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockResolvedValue({ data: { name: 'Lightning Bolt', quantity: 4, merged: false } });
    const interaction = mockInteraction({ options: { name: 'Lightning Bolt', quantity: '4', condition: 'NM' } });
    interaction.options.getInteger = (name) => (name === 'quantity' ? 4 : null);

    await addCommand.execute(interaction, apiClient);

    expect(apiClient.post).toHaveBeenCalledWith('/discord/cards', {
      discordUserId: 'discord-1',
      name: 'Lightning Bolt',
      quantity: 4,
      condition: 'NM'
    });
    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toContain('Lightning Bolt');
    expect(reply.content).toContain('4');
  });

  test('reports a permission error for a viewer-role account', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockRejectedValue({ response: { status: 403, data: { code: 'FORBIDDEN' } } });
    const interaction = mockInteraction({ options: { name: 'Sol Ring' } });
    interaction.options.getInteger = () => null;

    await addCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/permission/i);
  });
});

describe('link command', () => {
  test('sends the code and reports success', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockResolvedValue({ data: { message: 'Discord account linked successfully', username: 'testuser' } });
    const interaction = mockInteraction({ options: { code: 'AB3XQ9' } });
    interaction.user.username = 'discorduser';

    await linkCommand.execute(interaction, apiClient);

    expect(apiClient.post).toHaveBeenCalledWith('/discord/link/complete', {
      code: 'AB3XQ9',
      discordUserId: 'discord-1',
      discordUsername: 'discorduser'
    });
    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/linked/i);
  });

  test('reports an invalid/expired code', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockRejectedValue({ response: { status: 400, data: { code: 'INVALID_CODE' } } });
    const interaction = mockInteraction({ options: { code: 'ZZZZZZ' } });

    await linkCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/invalid|expired/i);
  });
});

describe('unlink command', () => {
  test('reports success when unlinked', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockResolvedValue({ data: { message: 'Discord account unlinked successfully' } });
    const interaction = mockInteraction();

    await unlinkCommand.execute(interaction, apiClient);

    expect(apiClient.post).toHaveBeenCalledWith('/discord/unlink', { discordUserId: 'discord-1' });
    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/unlinked/i);
  });

  test('reports when there was nothing to unlink', async () => {
    const apiClient = mockApiClient();
    apiClient.post.mockRejectedValue({ response: { status: 404, data: { code: 'NOT_LINKED' } } });
    const interaction = mockInteraction();

    await unlinkCommand.execute(interaction, apiClient);

    const reply = interaction.reply.mock.calls[0][0];
    expect(reply.content).toMatch(/not linked/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/discord-bot && npx jest commands.test.js`
Expected: FAIL with `Cannot find module '../commands/add'`

- [ ] **Step 3: Write the command modules**

```javascript
// backend/discord-bot/commands/add.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a card to your collection')
    .addStringOption((option) => option.setName('name').setDescription('Card name').setRequired(true))
    .addIntegerOption((option) => option.setName('quantity').setDescription('Quantity (default 1)').setRequired(false))
    .addStringOption((option) =>
      option
        .setName('condition')
        .setDescription('Condition (default NM)')
        .setRequired(false)
        .addChoices(
          { name: 'NM', value: 'NM' },
          { name: 'LP', value: 'LP' },
          { name: 'MP', value: 'MP' },
          { name: 'HP', value: 'HP' },
          { name: 'DMG', value: 'DMG' }
        )
    ),

  async execute(interaction, apiClient) {
    const name = interaction.options.getString('name');
    const quantity = interaction.options.getInteger('quantity');
    const condition = interaction.options.getString('condition');

    const payload = { discordUserId: interaction.user.id, name };
    if (quantity) payload.quantity = quantity;
    if (condition) payload.condition = condition;

    try {
      const { data } = await apiClient.post('/discord/cards', payload);
      const verb = data.merged ? 'Updated' : 'Added';
      await interaction.reply({
        content: `${verb} **${data.name}** — you now have ${data.quantity}.`,
        ephemeral: true
      });
    } catch (error) {
      if (error.response?.status === 403) {
        await interaction.reply({ content: "You don't have permission to add cards.", ephemeral: true });
        return;
      }
      if (error.response?.status === 404 && error.response.data?.code === 'NOT_LINKED') {
        await interaction.reply({ content: 'Your Discord account is not linked. Use `/link <code>` first.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: 'Something went wrong adding that card. Please try again later.', ephemeral: true });
    }
  }
};
```

```javascript
// backend/discord-bot/commands/link.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your MTG Tracker account')
    .addStringOption((option) =>
      option.setName('code').setDescription('The code shown in your site Settings').setRequired(true)
    ),

  async execute(interaction, apiClient) {
    const code = interaction.options.getString('code');

    try {
      await apiClient.post('/discord/link/complete', {
        code,
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.username
      });
      await interaction.reply({
        content: 'Your Discord account is now linked! Try `/collection` to see your stats.',
        ephemeral: true
      });
    } catch (error) {
      const code_ = error.response?.data?.code;
      if (code_ === 'INVALID_CODE') {
        await interaction.reply({ content: 'That code is invalid or has expired. Generate a new one in Settings.', ephemeral: true });
      } else if (code_ === 'DISCORD_ALREADY_LINKED' || code_ === 'USER_ALREADY_LINKED') {
        await interaction.reply({ content: 'That account is already linked. Use `/unlink` first if you want to relink.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Something went wrong linking your account. Please try again later.', ephemeral: true });
      }
    }
  }
};
```

```javascript
// backend/discord-bot/commands/unlink.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from your MTG Tracker account'),

  async execute(interaction, apiClient) {
    try {
      await apiClient.post('/discord/unlink', { discordUserId: interaction.user.id });
      await interaction.reply({ content: 'Your Discord account has been unlinked.', ephemeral: true });
    } catch (error) {
      if (error.response?.status === 404) {
        await interaction.reply({ content: 'Your Discord account is not linked to anything.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: 'Something went wrong unlinking your account. Please try again later.', ephemeral: true });
    }
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/discord-bot && npx jest commands.test.js`
Expected: PASS (all 12 tests across Tasks 12-13)

- [ ] **Step 5: Commit**

```bash
git add backend/discord-bot/commands/add.js backend/discord-bot/commands/link.js backend/discord-bot/commands/unlink.js backend/discord-bot/__tests__/commands.test.js
git commit -m "feat: add /add, /link, /unlink Discord command handlers"
```

---

## Task 14: Command registry, gateway bootstrap, and slash-command registration script

**Files:**
- Create: `backend/discord-bot/commands/index.js`
- Create: `backend/discord-bot/register-commands.js`
- Create: `backend/discord-bot/index.js`

These three files are not unit-tested (per spec line 49, only a manual smoke test with a real bot token/server exercises them) — `commands/index.js` is a trivial static map and `index.js`/`register-commands.js` are thin wiring around `discord.js`'s own `Client`/`REST` classes, whose behavior is discord.js's responsibility, not this codebase's. All actual decision logic already has unit test coverage from Tasks 12-13.

- [ ] **Step 1: Write the command registry**

```javascript
// backend/discord-bot/commands/index.js
const collection = require('./collection');
const card = require('./card');
const wishlist = require('./wishlist');
const add = require('./add');
const link = require('./link');
const unlink = require('./unlink');

const commands = [collection, card, wishlist, add, link, unlink];

const commandsByName = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

module.exports = { commands, commandsByName };
```

- [ ] **Step 2: Write the command registration script**

```javascript
// backend/discord-bot/register-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set in backend/discord-bot/.env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = commands.map((cmd) => cmd.data.toJSON());

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  console.log(`Registering ${body.length} commands ${guildId ? `to guild ${guildId}` : 'globally'}...`);
  await rest.put(route, { body });
  console.log('Done.');
}

main().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
```

- [ ] **Step 3: Write the bot entry point**

```javascript
// backend/discord-bot/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { createApiClient } = require('./apiClient');
const { commandsByName } = require('./commands');

const token = process.env.DISCORD_BOT_TOKEN;
const backendApiUrl = process.env.BACKEND_API_URL;
const serviceToken = process.env.DISCORD_BOT_SERVICE_TOKEN;

if (!token || !backendApiUrl || !serviceToken) {
  console.error('DISCORD_BOT_TOKEN, BACKEND_API_URL, and DISCORD_BOT_SERVICE_TOKEN must all be set in backend/discord-bot/.env');
  process.exit(1);
}

const apiClient = createApiClient({ baseURL: backendApiUrl, serviceToken });

// Guilds is enough to receive slash-command interactions in both servers and
// DMs; this bot never reads message content, so no message-content intent is
// requested. Partials.Channel lets DM interaction payloads resolve correctly.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandsByName.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction, apiClient);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

client.login(token);
```

- [ ] **Step 4: Commit**

```bash
git add backend/discord-bot/commands/index.js backend/discord-bot/register-commands.js backend/discord-bot/index.js
git commit -m "feat: add Discord bot gateway bootstrap and command registration"
```

**Manual setup note (not automatable, do this once before the smoke test in Task 17):** in the Discord Developer Portal, the application needs the "applications.commands" and "bot" OAuth2 scopes when generating its invite URL, and — for `/link`/`/unlink` to work in a DM rather than only in a server — the bot's installation must allow user-installable / DM-context commands (Developer Portal → your application → Installation → enable "User Install" or ensure the bot is invited to at least one shared server, since Discord requires a mutual server or app-install context before a user can DM a bot). This is an external Discord configuration step, not something any file in this repo controls.

---

## Task 15: `start-both-servers.bat` and root `package.json` — add the bot as a third process

**Files:**
- Modify: `start-both-servers.bat`
- Modify: `package.json` (root)

Per the user's standing preference (`feedback_start_servers.md`), `start-both-servers.bat` must remain the single entry point that starts everything together — this task adds the bot as a third window rather than something started separately.

- [ ] **Step 1: Add a third window to start-both-servers.bat**

Current `start-both-servers.bat` (full file, for reference):
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

Replace it with:
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

REM Start Discord bot (only if configured — skips silently if .env is missing)
if exist "backend\discord-bot\.env" (
  cd backend\discord-bot
  start "MTG Tracker Discord Bot" cmd /k "npm start"
  cd ..\..
) else (
  echo Discord bot skipped: backend\discord-bot\.env not found.
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

The `if exist backend\discord-bot\.env` guard matters because this feature is opt-in/deferred: most local dev setups won't have a Discord bot token configured, and the bot process would otherwise crash-loop on missing env vars (Task 14, Step 3's guard clause calls `process.exit(1)`), spamming a fourth window that immediately closes. Skipping when `.env` is absent keeps `start-both-servers.bat` usable for everyone, per the standing "always use start-both-servers.bat" preference — it shouldn't newly require Discord configuration for people who don't use the bot.

- [ ] **Step 2: Add a matching root package.json script for parity with existing start:backend/start:frontend**

In `package.json` (root), change:
```json
  "scripts": {
    "start": "concurrently \"npm run start:backend\" \"npm run start:frontend\"",
    "start:backend": "cd backend && npm run dev",
    "start:frontend": "cd frontend && npm start",
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install"
  },
```
to:
```json
  "scripts": {
    "start": "concurrently \"npm run start:backend\" \"npm run start:frontend\"",
    "start:backend": "cd backend && npm run dev",
    "start:frontend": "cd frontend && npm start",
    "start:bot": "cd backend/discord-bot && npm start",
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install && cd ../backend/discord-bot && npm install"
  },
```
`start:bot` is intentionally left out of the default `npm run start` concurrently line (same reasoning as Step 1 — it's opt-in), but is available to run explicitly (`npm run start:bot`) and keeps `install:all` able to set up everyone's `node_modules` in one command once the bot folder exists.

- [ ] **Step 3: Manually verify the .bat file's guard clause**

Since `backend/discord-bot/.env` won't exist yet in a typical checkout, run `start-both-servers.bat` once and confirm the console prints "Discord bot skipped: backend\discord-bot\.env not found." and does not open a fourth window. Then create a dummy `backend/discord-bot/.env` (empty file) and re-run to confirm a third window does attempt to open (it will immediately exit with the Task 14 Step 3 error message about missing env vars, which is expected without real Discord credentials).

- [ ] **Step 4: Commit**

```bash
git add start-both-servers.bat package.json
git commit -m "feat: add optional Discord bot window to start-both-servers.bat"
```

---

## Task 16: Frontend — "Discord" tab in Account Settings

**Files:**
- Modify: `frontend/src/components/auth/AccountSettings.js`

There is no existing frontend automated test setup in this repo (`frontend/package.json` has `react-scripts test` wired up, but zero `*.test.js` files exist anywhere under `frontend/src`) — this task follows that existing convention and relies on manual verification rather than introducing a new testing pattern unilaterally for one component.

- [ ] **Step 1: Add Discord link state and a fetch-on-open effect**

In `frontend/src/components/auth/AccountSettings.js`, add near the top of the component (after the existing `avatarUrl` state block at line 42-44):

```javascript
  // Discord link state
  const [discordLink, setDiscordLink] = useState({ linked: false, discordUsername: null });
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordCode, setDiscordCode] = useState(null);
  const [discordCodeExpiresAt, setDiscordCodeExpiresAt] = useState(null);
  const [discordMessage, setDiscordMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${API_URL}/discord/link/status`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDiscordLink(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const handleGenerateDiscordCode = async () => {
    setDiscordLoading(true);
    setDiscordMessage(null);
    try {
      const response = await authFetch(`${API_URL}/discord/link/start`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setDiscordCode(data.code);
        setDiscordCodeExpiresAt(data.expiresAt);
      } else {
        setDiscordMessage({ type: 'error', text: data.message || 'Failed to generate a linking code' });
      }
    } catch (err) {
      setDiscordMessage({ type: 'error', text: 'Failed to generate a linking code' });
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleDisconnectDiscord = async () => {
    setDiscordLoading(true);
    setDiscordMessage(null);
    try {
      const response = await authFetch(`${API_URL}/discord/link`, { method: 'DELETE' });
      if (response.ok) {
        setDiscordLink({ linked: false, discordUsername: null });
        setDiscordCode(null);
        setDiscordMessage({ type: 'success', text: 'Discord account disconnected' });
      } else {
        const data = await response.json();
        setDiscordMessage({ type: 'error', text: data.message || 'Failed to disconnect Discord' });
      }
    } catch (err) {
      setDiscordMessage({ type: 'error', text: 'Failed to disconnect Discord' });
    } finally {
      setDiscordLoading(false);
    }
  };
```

Add `useEffect` to the existing `import React, { useState } from 'react';` at line 1, changing it to:
```javascript
import React, { useState, useEffect } from 'react';
```

- [ ] **Step 2: Add 'discord' to the tab list**

Change (line 160):
```javascript
          {['profile', 'password', 'privacy', 'sessions', 'danger'].map((tab) => (
```
to:
```javascript
          {['profile', 'password', 'privacy', 'sessions', 'discord', 'danger'].map((tab) => (
```

And update the tab label logic (line 170) from:
```javascript
              {tab === 'danger' ? 'Danger Zone' : tab === 'privacy' ? 'Privacy & Sharing' : tab.charAt(0).toUpperCase() + tab.slice(1)}
```
to:
```javascript
              {tab === 'danger' ? 'Danger Zone' : tab === 'privacy' ? 'Privacy & Sharing' : tab === 'discord' ? 'Discord' : tab.charAt(0).toUpperCase() + tab.slice(1)}
```

- [ ] **Step 3: Add the Discord tab panel**

Insert a new block right before the `{activeTab === 'danger' && (` block (line 423):

```javascript
          {activeTab === 'discord' && (
            <div className="space-y-4">
              {discordMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  discordMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {discordMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{discordMessage.text}</span>
                </div>
              )}

              {discordLink.linked ? (
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                  <p className="text-white text-sm">
                    Linked to Discord as <span className="font-semibold">{discordLink.discordUsername || 'a Discord account'}</span>.
                  </p>
                  <button
                    onClick={handleDisconnectDiscord}
                    disabled={discordLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {discordLoading ? 'Disconnecting...' : 'Disconnect Discord'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                  <p className="text-gray-300 text-sm">
                    Link your Discord account to check your collection and add cards from Discord.
                  </p>
                  {discordCode ? (
                    <div className="space-y-2">
                      <p className="text-white text-sm">
                        In a DM with the bot, run: <code className="bg-gray-900 px-2 py-1 rounded">/link {discordCode}</code>
                      </p>
                      <p className="text-gray-400 text-xs">
                        Expires at {discordCodeExpiresAt ? new Date(discordCodeExpiresAt).toLocaleTimeString() : 'soon'}.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateDiscordCode}
                      disabled={discordLoading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {discordLoading ? 'Generating...' : 'Generate Linking Code'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

```

- [ ] **Step 4: Manually verify in the browser**

With the backend running (`MULTI_USER_ENABLED=true`) and `/api/discord/link/status`/`/link/start`/`link` DELETE routes live (Tasks 5 and 10):
1. Log in, open Account Settings, click the "Discord" tab. Confirm it shows "Generate Linking Code" (not yet linked).
2. Click it, confirm a 6-character code and expiry time render.
3. In a REST client (or `curl`) simulate the bot completing the link: `POST /api/discord/link/complete` with `Authorization: Bearer <DISCORD_BOT_SERVICE_TOKEN>` and body `{"code": "<the displayed code>", "discordUserId": "test-123", "discordUsername": "tester"}`.
4. Reload Account Settings → Discord tab. Confirm it now shows "Linked to Discord as tester" and a "Disconnect Discord" button.
5. Click "Disconnect Discord", confirm it flips back to the unlinked state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/AccountSettings.js
git commit -m "feat: add Discord account linking UI to Account Settings"
```

---

## Task 17: End-to-end manual smoke test (requires a real Discord bot token/server)

**Files:** none — this is a verification checklist, not code. Per the spec (line 49), this is the one piece that genuinely cannot be automated: it requires a live Discord application, a bot token, and a Discord server (or DM channel) to drive.

- [ ] **Step 1: Create a Discord application and bot**
  - In the Discord Developer Portal, create a new application, add a Bot user, copy the bot token into `backend/discord-bot/.env` as `DISCORD_BOT_TOKEN`, and copy the Application ID into `DISCORD_CLIENT_ID`.
  - Generate a shared secret and put the same value in both `backend/.env`'s `DISCORD_BOT_SERVICE_TOKEN` and `backend/discord-bot/.env`'s `DISCORD_BOT_SERVICE_TOKEN`:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
  - Set `backend/discord-bot/.env`'s `BACKEND_API_URL` to the running backend's API URL (e.g. `http://localhost:5000/api`).
  - Set `DISCORD_GUILD_ID` to a test server's ID for instant command registration during this smoke test.

- [ ] **Step 2: Register commands and start everything**
  ```bash
  cd backend/discord-bot
  npm run register-commands
  ```
  Expected: console prints "Registering 6 commands to guild <id>..." then "Done."

  Then run `start-both-servers.bat` from the repo root (with `backend/discord-bot/.env` now present, the bot window should open and log in).

- [ ] **Step 3: Walk through the full command set in Discord**
  - In the test server (or a DM with the bot, once mutually reachable — see Task 14's manual setup note): run `/collection`. Expected: an ephemeral reply saying the account isn't linked yet.
  - In the web app's Account Settings → Discord tab, generate a code.
  - Run `/link <code>`. Expected: ephemeral confirmation of a successful link.
  - Run `/collection` again. Expected: real stats from the linked account's collection.
  - Run `/card <name of a card already in the collection>`. Expected: set/condition/quantity/price.
  - Run `/card <name of a card NOT in the collection>`. Expected: "not in your collection."
  - Run `/add <name> [quantity] [condition]` for a new card. Expected: confirmation with the new quantity; verify in the web app's Collection view that the card appears.
  - Run `/add` again for the same card/set/condition. Expected: "Updated" wording and quantity increased (merge).
  - Add a wishlist item on the web app, then run `/wishlist` in Discord. Expected: it appears, sorted by real priority (add a high, medium, and low priority item and confirm the high one is listed first).
  - Run `/unlink`. Expected: ephemeral confirmation. Then run `/collection` again. Expected: "not linked" message, same as before Step 3's linking.
  - In Account Settings → Discord tab, generate a new code and re-link via `/link <code>` to confirm relinking works cleanly after an unlink.

- [ ] **Step 4: Confirm all replies were ephemeral**
  Every reply above should only be visible to the command's sender (the small "Only you can see this" marker in the Discord client) — this was set via `ephemeral: true` in every command module (Tasks 12-13). If any reply was visible to the whole channel, find the missing `ephemeral: true` and fix it before considering this feature done.

---

## Self-Review

**1. Spec coverage** — every spec section has a corresponding task:
- Hosting as a separate process with its own `npm run bot`-equivalent script and third `start-both-servers.bat` window → Tasks 1, 11, 15.
- `DiscordLink` model → Task 2. Linking code generation/validation/expiry (mirroring password-reset pattern) → Task 3.
- `POST /api/discord/link/start` → Task 5. `/link <code>` in DM → Task 5 (`link/complete`) + Task 13 (`/link` command).
- `/unlink` in Discord + "Disconnect Discord" button in Settings → Task 5 (`unlink`, `link` DELETE) + Task 13 (`/unlink` command) + Task 16 (UI button).
- Bot auth via shared service token, never a user JWT, resolved server-side from `discordUserId` → Task 4.
- `/collection`, `/card`, `/add`, `/wishlist` commands → Tasks 6-9 (backend), 12-13 (bot commands).
- Ephemeral replies by default → every command module in Tasks 12-13 passes `ephemeral: true`; verified end-to-end in Task 17 Step 4.
- No new changes to existing models beyond what's stated (Card/WishlistItem untouched, confirmed by reading `server.js`) — only `DiscordLink` (spec) + `DiscordLinkCode` (spec gap, documented above).
- Testing section: linking-code unit tests → Task 3; command handlers against a mocked API client, no gateway → Tasks 12-13; `requireBotAuth` middleware test → Task 4. All three explicitly satisfied.

**2. Placeholder scan** — every step has real code, real file paths, and real assertions; no "TBD"/"add validation"/"similar to Task N" language appears. The one open-ended item (Task 1's dependency check) is resolved with an explicit decision rule for both possible outcomes, not left dangling.

**3. Type/name consistency across tasks** — checked that:
- `DiscordLink` fields (`userId`, `discordUserId`, `discordUsername`, `linkedAt`) introduced in Task 2 are used identically in Tasks 4, 5, 16.
- `DiscordLinkCode` fields/methods (`createCode`, `findValidCode`, `markAsUsed`, `.code`, `.expiresAt`, `.used`) introduced in Task 3 match usage in Task 5.
- `requireBotAuth`/`resolveDiscordUser` names and signatures from Task 4 match every `require('../middleware/discordAuth')` call in Tasks 5-9.
- Route response shapes (`{found, name, printings}` from Task 7; `{totalCards, totalValue, lastUpdated}` from Task 6; `{items: [...]}` from Task 9; `{merged, quantity, name}` from Task 8; `{code, expiresAt}` from Task 5) are consumed with matching field names in the Task 12-13 command modules and the Task 16 frontend code.
- `apiClient.get`/`apiClient.post` call signatures in Tasks 12-13's tests match the real `apiClient` created in Task 11.

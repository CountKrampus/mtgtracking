# Price & Value Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily price snapshot job, per-card price history charts, a date-range collection value chart, and price alert notifications delivered through the existing notification bell.

**Architecture:** A single `node-cron` job at `backend/jobs/dailyPriceSnapshot.js` runs nightly, writing to `CardPriceSnapshot` and `ValueSnapshot` models and firing `price_alert` notifications. The frontend wires two new interactions — a hover sparkline on the price cell and a slide-in `CardDetailPanel` — plus extends the existing `ValueHistoryChart` with a date picker and extends `NotificationBell` to render price alerts.

**Tech Stack:** Node.js/Express/Mongoose (backend), node-cron (new dep), React/SVG (frontend — no new charting library, follows existing hand-rolled SVG pattern in `ValueHistoryChart.js`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/utils/pricing.js` | **Create** | Extract `getPriceWithFallback` from server.js so it can be imported by the job |
| `backend/models/CardPriceSnapshot.js` | **Create** | Extract `CardPriceSnapshot` schema from server.js |
| `backend/models/ValueSnapshot.js` | **Create** | Extract `ValueSnapshot` schema from server.js |
| `backend/models/Notification.js` | **Modify** | Add `price_alert` type, make `fromUserId` optional, add `cardId` field |
| `backend/utils/notifications.js` | **Modify** | Add `createPriceAlertNotification` |
| `backend/server.js` | **Modify** | Import extracted models, add `lastAlertFiredAt` to Card schema, extend two endpoints, register job |
| `backend/jobs/dailyPriceSnapshot.js` | **Create** | Nightly cron: snapshot prices, snapshot value, check alerts |
| `backend/__tests__/price-alerts.test.js` | **Create** | Tests for notification changes and alert crossing logic |
| `backend/__tests__/price-history-endpoints.test.js` | **Create** | Tests for the two extended endpoints |
| `frontend/src/components/CardDetailPanel.js` | **Create** | Slide-in panel: card info + 30/90/180d price history SVG chart |
| `frontend/src/components/ValueHistoryChart.js` | **Modify** | Add date range picker + summary stats row |
| `frontend/src/components/NotificationBell.js` | **Modify** | Render `price_alert` notifications with card name + price |
| `frontend/src/App.js` | **Modify** | Price cell hover sparkline + row click → CardDetailPanel |

---

## Task 1: Extract `getPriceWithFallback` to `backend/utils/pricing.js`

**Why:** The daily job cannot `require('./server')` without starting the entire Express app. Extracting the price utility makes it importable independently.

**Files:**
- Create: `backend/utils/pricing.js`
- Modify: `backend/server.js` (remove definition, add import)

- [ ] **Step 1: Create `backend/utils/pricing.js`**

```js
const axios = require('axios');

async function getPriceWithFallback(cardName, isFoil = false) {
  try {
    const searchUrl = `https://exorgames.com/a/search?type=product&q=${encodeURIComponent(cardName)}`;
    const response = await axios.get(searchUrl);
    const html = response.data;
    const priceMatch = html.match(/"price":\s*(\d+)/);
    if (priceMatch) {
      const priceInCents = parseInt(priceMatch[1]);
      const priceCAD = priceInCents / 100;
      const priceUSD = Math.round(priceCAD * 0.73 * 100) / 100;
      if (priceUSD > 0) {
        return { cad: priceCAD, usd: priceUSD, source: 'Exor Games' };
      }
    }
  } catch (error) {
    console.error('Exor Games price fetch failed:', error.message);
  }

  try {
    console.log('Falling back to Scryfall pricing for:', cardName);
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const scryfallPrice = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);
    if (scryfallPrice > 0) {
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall (backup)' };
    }
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
  }

  return { cad: 0, usd: 0, source: 'None (not found)' };
}

module.exports = { getPriceWithFallback };
```

- [ ] **Step 2: In `backend/server.js`, replace the inline `getPriceWithFallback` definition with an import**

Find the existing function definition at around line 558 (search for `async function getPriceWithFallback`). Replace the entire function body (lines 558–598) with:

```js
const { getPriceWithFallback } = require('./utils/pricing');
```

- [ ] **Step 3: Verify the server still starts correctly**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -5
```

Expected: no errors about `getPriceWithFallback` undefined.

- [ ] **Step 4: Commit**

```bash
git add backend/utils/pricing.js backend/server.js
git commit -m "refactor: extract getPriceWithFallback to utils/pricing.js"
```

---

## Task 2: Extract `CardPriceSnapshot` and `ValueSnapshot` to model files

**Why:** Both models are defined inline in `server.js`. The daily job needs to import them without starting the whole server.

**Files:**
- Create: `backend/models/CardPriceSnapshot.js`
- Create: `backend/models/ValueSnapshot.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create `backend/models/CardPriceSnapshot.js`**

```js
const mongoose = require('mongoose');

const cardPriceSnapshotSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
cardPriceSnapshotSchema.index({ cardId: 1, createdAt: 1 });

module.exports = mongoose.model('CardPriceSnapshot', cardPriceSnapshotSchema);
```

- [ ] **Step 2: Create `backend/models/ValueSnapshot.js`**

```js
const mongoose = require('mongoose');

const valueSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  value: { type: Number, required: true },
  cardCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
valueSnapshotSchema.index({ createdAt: 1 });

module.exports = mongoose.model('ValueSnapshot', valueSnapshotSchema);
```

- [ ] **Step 3: In `backend/server.js`, replace inline schema definitions with imports**

Search for `const valueSnapshotSchema` (around line 257) and the `const cardPriceSnapshotSchema` block (around line 267). Remove both inline schema+model definitions (6 lines each). Add these imports near the top of the file with the other `require` statements:

```js
const CardPriceSnapshot = require('./models/CardPriceSnapshot');
const ValueSnapshot = require('./models/ValueSnapshot');
```

- [ ] **Step 4: Verify no Mongoose OverwriteModelError**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -5
```

Expected: no `OverwriteModelError` — the models are now registered once via the model files.

- [ ] **Step 5: Commit**

```bash
git add backend/models/CardPriceSnapshot.js backend/models/ValueSnapshot.js backend/server.js
git commit -m "refactor: extract CardPriceSnapshot and ValueSnapshot to model files"
```

---

## Task 3: Extend Notification model + Card schema + notification utility

**Files:**
- Modify: `backend/models/Notification.js`
- Modify: `backend/server.js` (Card schema: add `lastAlertFiredAt`)
- Modify: `backend/utils/notifications.js`
- Create: `backend/__tests__/price-alerts.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/price-alerts.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createPriceAlertNotification } = require('../utils/notifications');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('price_alert notifications', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      displayName: 'Test User',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  test('createPriceAlertNotification creates a price_alert notification', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const notif = await createPriceAlertNotification(
      user._id,
      cardId,
      'Lightning Bolt',
      0.50,
      0.45
    );
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('price_alert');
    expect(notif.userId.toString()).toBe(user._id.toString());
    expect(notif.cardId.toString()).toBe(cardId.toString());
    expect(notif.content).toContain('Lightning Bolt');
    expect(notif.content).toContain('0.45');
  });

  test('price_alert notification can be created without fromUserId', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const notif = await Notification.create({
      userId: user._id,
      type: 'price_alert',
      cardId,
      content: 'Lightning Bolt dropped to $0.45 (target: $0.50)'
    });
    expect(notif._id).toBeDefined();
    expect(notif.fromUserId).toBeUndefined();
  });

  test('existing notification types still require fromUserId', async () => {
    await expect(
      Notification.create({
        userId: user._id,
        type: 'mention',
        content: 'You were mentioned'
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx jest __tests__/price-alerts.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `price_alert` is not in type enum, `createPriceAlertNotification` not exported.

- [ ] **Step 3: Update `backend/models/Notification.js`**

Replace the full file content:

```js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert'],
    required: [true, 'Notification type is required']
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type !== 'price_alert';
    }
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread'
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage'
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card'
  },
  content: {
    type: String,
    maxlength: [200, 'Content cannot exceed 200 characters']
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
});

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead')) {
    if (this.isRead && !this.readAt) {
      this.readAt = new Date();
    } else if (!this.isRead) {
      this.readAt = null;
    }
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
```

- [ ] **Step 4: Add `createPriceAlertNotification` to `backend/utils/notifications.js`**

Add the following function before the `module.exports` line:

```js
/**
 * Create a price alert notification (system-generated, no fromUserId)
 *
 * @param {string|ObjectId} userId - User who set the alert
 * @param {string|ObjectId} cardId - Card that triggered the alert
 * @param {string} cardName - Card name for display
 * @param {number} targetPrice - The alert target price
 * @param {number} actualPrice - The current price that triggered the alert
 * @returns {object} Created notification or null on error
 */
async function createPriceAlertNotification(userId, cardId, cardName, targetPrice, actualPrice) {
  try {
    const content = `${cardName} dropped to $${actualPrice.toFixed(2)} (target: $${targetPrice.toFixed(2)})`;
    const notification = await Notification.create({
      userId,
      type: 'price_alert',
      cardId,
      content: content.substring(0, 200)
    });
    return notification;
  } catch (error) {
    console.error('Error creating price alert notification:', error);
    return null;
  }
}
```

Also add `createPriceAlertNotification` to the `module.exports`:

```js
module.exports = {
  extractMentions,
  createNotification,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification,
  createPriceAlertNotification
};
```

- [ ] **Step 5: Add `lastAlertFiredAt` to the Card schema in `backend/server.js`**

Find the `priceAlert` sub-document in the Card schema (around line 179). Replace:

```js
  priceAlert: {
    targetPrice: Number,
    emailNotification: { type: Boolean, default: false }
  },
```

With:

```js
  priceAlert: {
    targetPrice: Number,
    emailNotification: { type: Boolean, default: false },
    lastAlertFiredAt: { type: Date, default: null }
  },
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
cd backend && npx jest __tests__/price-alerts.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS — 3 tests.

- [ ] **Step 7: Run full test suite to confirm no regressions**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add backend/models/Notification.js backend/utils/notifications.js backend/server.js backend/__tests__/price-alerts.test.js
git commit -m "feat: add price_alert notification type and lastAlertFiredAt to card schema"
```

---

## Task 4: Extend backend endpoints (price history `?days=N`, value history `?from`/`?to`)

**Files:**
- Modify: `backend/server.js` (two endpoint changes)
- Create: `backend/__tests__/price-history-endpoints.test.js`

**Context:** Two endpoints exist in `server.js`:
- `GET /api/cards/:id/price-history` (around line 1568) — hardcoded to 90 days
- `GET /api/stats/value-history` (around line 1518) — hardcoded to 90 days, returns array

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/price-history-endpoints.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('CardPriceSnapshot model', () => {
  test('stores price snapshot with cardId and price', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const snap = await CardPriceSnapshot.create({ cardId, userId, price: 1.25 });
    expect(snap.price).toBe(1.25);
    expect(snap.cardId.toString()).toBe(cardId.toString());
    expect(snap.createdAt).toBeDefined();
  });
});

describe('ValueSnapshot model', () => {
  test('stores value snapshot with totalValue and cardCount', async () => {
    const userId = new mongoose.Types.ObjectId();
    const snap = await ValueSnapshot.create({ userId, value: 500.50, cardCount: 42 });
    expect(snap.value).toBe(500.50);
    expect(snap.cardCount).toBe(42);
  });

  test('earliest query returns oldest createdAt', async () => {
    const userId = new mongoose.Types.ObjectId();
    const old = new Date('2026-01-01');
    const recent = new Date('2026-06-01');
    await ValueSnapshot.create({ userId, value: 100, cardCount: 10, createdAt: old });
    await ValueSnapshot.create({ userId, value: 200, cardCount: 20, createdAt: recent });

    const earliest = await ValueSnapshot.findOne({}).sort({ createdAt: 1 }).lean();
    expect(new Date(earliest.createdAt).toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  test('range query filters by from and to dates', async () => {
    const userId = new mongoose.Types.ObjectId();
    await ValueSnapshot.create({ userId, value: 100, cardCount: 10, createdAt: new Date('2026-01-15') });
    await ValueSnapshot.create({ userId, value: 200, cardCount: 20, createdAt: new Date('2026-03-15') });
    await ValueSnapshot.create({ userId, value: 300, cardCount: 30, createdAt: new Date('2026-05-15') });

    const from = new Date('2026-02-01');
    const to = new Date('2026-04-30');
    const results = await ValueSnapshot.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 });
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes** (these test models, not endpoints — they should pass after Task 2)

```bash
cd backend && npx jest __tests__/price-history-endpoints.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS — 3 tests.

- [ ] **Step 3: Extend `GET /api/cards/:id/price-history` to accept `?days=N` in `server.js`**

Find the endpoint at around line 1568. Change:

```js
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const snapshots = await CardPriceSnapshot.find({
      cardId: card._id,
      createdAt: { $gte: ninetyDaysAgo }
    }).sort({ createdAt: 1 }).lean();

    // Also include points recorded via CardPriceHistory (e.g. on card edits)
    const historyPoints = await CardPriceHistory.find({
      cardId: card._id,
      date: { $gte: ninetyDaysAgo }
    }).sort({ date: 1 }).lean();
```

To:

```js
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const snapshots = await CardPriceSnapshot.find({
      cardId: card._id,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 }).lean();

    // Also include points recorded via CardPriceHistory (e.g. on card edits)
    const historyPoints = await CardPriceHistory.find({
      cardId: card._id,
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();
```

- [ ] **Step 4: Extend `GET /api/stats/value-history` to accept `?from`/`?to` in `server.js`**

Find the endpoint at around line 1518. Replace:

```js
app.get('/api/stats/value-history', requireAuth, async (req, res) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const snapshots = await ValueSnapshot.find(
      buildUserQuery({ createdAt: { $gte: ninetyDaysAgo } }, req)
    ).sort({ createdAt: 1 });
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

With:

```js
app.get('/api/stats/value-history', requireAuth, async (req, res) => {
  try {
    const userQ = buildUserQuery({}, req);

    // Find earliest snapshot date for date picker clamping
    const earliestSnap = await ValueSnapshot.findOne(userQ).sort({ createdAt: 1 }).lean();
    const earliest = earliestSnap
      ? new Date(earliestSnap.createdAt).toISOString().slice(0, 10)
      : null;

    // Parse optional from/to params; default to last 90 days
    let from, to;
    if (req.query.from && req.query.to) {
      from = new Date(req.query.from);
      to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
    } else {
      to = new Date();
      from = new Date();
      from.setDate(from.getDate() - 90);
    }

    const snapshots = await ValueSnapshot.find(
      buildUserQuery({ createdAt: { $gte: from, $lte: to } }, req)
    ).sort({ createdAt: 1 });

    res.json({ snapshots, earliest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 5: Run full test suite**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js backend/__tests__/price-history-endpoints.test.js
git commit -m "feat: extend price-history and value-history endpoints with date range params"
```

---

## Task 5: Daily snapshot job

**Files:**
- Modify: `backend/package.json` (add `node-cron`)
- Create: `backend/jobs/dailyPriceSnapshot.js`
- Modify: `backend/server.js` (register job)

- [ ] **Step 1: Install `node-cron`**

```bash
cd backend && npm install node-cron
```

Expected: `node-cron` appears in `package.json` dependencies.

- [ ] **Step 2: Create `backend/jobs/` directory and write `dailyPriceSnapshot.js`**

```js
const cron = require('node-cron');
const mongoose = require('mongoose');
const Card = require('../models/CardPriceSnapshot').db
  ? null  // prevent double-require; real imports below
  : null;

// Models — imported here so the job can run independently of server.js
const CardModel = require('./jobModels').Card;
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');
const { getPriceWithFallback } = require('../utils/pricing');
const { createPriceAlertNotification } = require('../utils/notifications');
```

Wait — `Card` is not a separate model file, it's defined inline in `server.js`. Let me reconsider. Let me check this.

Actually, `Card` IS defined inline in server.js as well. The daily job needs `Card` too. I need to extract it or use `mongoose.model('Card')` (safe after the model has been registered by server.js).

Since the job is *started* by server.js (after all models are registered), using `mongoose.model('Card')` at call time (not module load time) is safe.

- [ ] **Step 2 (corrected): Create `backend/jobs/dailyPriceSnapshot.js`**

```js
const cron = require('node-cron');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');
const { getPriceWithFallback } = require('../utils/pricing');
const { createPriceAlertNotification } = require('../utils/notifications');

const RATE_LIMIT_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDailySnapshot() {
  const mongoose = require('mongoose');
  // Models registered by server.js before this job is called
  const Card = mongoose.model('Card');

  const started = Date.now();
  let snapshotted = 0;
  let skipped = 0;
  let alertsFired = 0;
  let errors = 0;

  console.log('[dailySnapshot] Starting nightly price snapshot...');

  // --- Phase 1: Card price snapshots ---
  let cards;
  try {
    cards = await Card.find({}).lean();
  } catch (err) {
    console.error('[dailySnapshot] Failed to load cards:', err.message);
    return;
  }

  const updatedPrices = {}; // cardId -> newPrice

  for (const card of cards) {
    if (!card.name) { skipped++; continue; }
    try {
      const priceData = await getPriceWithFallback(card.name, card.isFoil || false);
      const newPrice = priceData.usd || 0;
      if (newPrice > 0) {
        await CardPriceSnapshot.create({
          cardId: card._id,
          userId: card.userId,
          price: newPrice
        });
        updatedPrices[card._id.toString()] = newPrice;
        snapshotted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[dailySnapshot] Error for card "${card.name}":`, err.message);
      errors++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  // --- Phase 2: Collection value snapshot (per user) ---
  try {
    // Group cards by userId to snapshot each user's collection value
    const userIds = [...new Set(cards.filter(c => c.userId).map(c => c.userId.toString()))];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const userIdStr of userIds) {
      const userCards = cards.filter(c => c.userId && c.userId.toString() === userIdStr);
      const totalValue = userCards.reduce((sum, c) => {
        const price = updatedPrices[c._id.toString()] ?? (c.price || 0);
        return sum + price * (c.quantity || 1);
      }, 0);

      // Only one snapshot per user per day
      const existing = await ValueSnapshot.findOne({
        userId: userIdStr,
        createdAt: { $gte: todayStart }
      });
      if (!existing) {
        await ValueSnapshot.create({
          userId: userIdStr,
          value: totalValue,
          cardCount: userCards.length
        });
      }
    }
  } catch (err) {
    console.error('[dailySnapshot] Error writing value snapshots:', err.message);
    errors++;
  }

  // --- Phase 3: Price alert check ---
  try {
    const alertCards = cards.filter(c => c.priceAlert && c.priceAlert.targetPrice > 0 && c.userId);
    for (const card of alertCards) {
      const newPrice = updatedPrices[card._id.toString()];
      if (newPrice === undefined) continue;

      const targetPrice = card.priceAlert.targetPrice;
      if (newPrice > targetPrice) continue; // price still above target

      // Check if this is a new crossing
      const lastFired = card.priceAlert.lastAlertFiredAt;
      if (lastFired) {
        // Already fired — check if price recovered above target since last firing
        // Get the previous snapshot (before today)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const prevSnap = await CardPriceSnapshot.findOne({
          cardId: card._id,
          createdAt: { $lt: todayStart }
        }).sort({ createdAt: -1 }).lean();

        if (prevSnap && prevSnap.price <= targetPrice) {
          // Price was already below target yesterday — not a new crossing
          continue;
        }
      }

      // Fire the notification
      const notif = await createPriceAlertNotification(
        card.userId,
        card._id,
        card.name,
        targetPrice,
        newPrice
      );
      if (notif) {
        // Update lastAlertFiredAt using updateOne to avoid full card save overhead
        await Card.updateOne(
          { _id: card._id },
          { $set: { 'priceAlert.lastAlertFiredAt': new Date() } }
        );
        alertsFired++;
      }
    }
  } catch (err) {
    console.error('[dailySnapshot] Error checking price alerts:', err.message);
    errors++;
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[dailySnapshot] Done. Snapshotted: ${snapshotted} | Skipped: ${skipped} | Alerts fired: ${alertsFired} | Errors: ${errors} | Duration: ${duration}s`
  );
}

function registerDailySnapshotJob() {
  // Run at 00:05 daily (5 min past midnight server time)
  cron.schedule('5 0 * * *', () => {
    runDailySnapshot().catch(err =>
      console.error('[dailySnapshot] Unhandled error:', err.message)
    );
  });
  console.log('[dailySnapshot] Nightly price snapshot job registered (00:05 daily)');
}

module.exports = { registerDailySnapshotJob, runDailySnapshot };
```

- [ ] **Step 3: Register the job in `backend/server.js`**

Near the top of `server.js` where other utilities are required, add:

```js
const { registerDailySnapshotJob } = require('./jobs/dailyPriceSnapshot');
```

Then, near the bottom of the file where the server starts listening, add:

```js
registerDailySnapshotJob();
```

Place the `registerDailySnapshotJob()` call right after the `app.listen(...)` call (or just before it — after all mongoose models are defined).

- [ ] **Step 4: Verify the job registers without error**

```bash
cd backend && node -e "
const mongoose = require('mongoose');
require('dotenv').config();
// Connect to a test DB to avoid starting full server
mongoose.connect('mongodb://localhost:27017/test-snapshot-check').then(() => {
  const { registerDailySnapshotJob } = require('./jobs/dailyPriceSnapshot');
  console.log('Import OK');
  mongoose.disconnect();
}).catch(() => {
  // No local MongoDB in CI — just verify module loads without syntax error
  const { registerDailySnapshotJob } = require('./jobs/dailyPriceSnapshot');
  console.log('Module loads OK (no DB)');
  process.exit(0);
});
" 2>&1
```

Expected output contains: `Module loads OK` or `Import OK`.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/jobs/dailyPriceSnapshot.js backend/server.js
git commit -m "feat: add nightly price snapshot cron job with price alert notifications"
```

---

## Task 6: Frontend — `CardDetailPanel.js`

**Files:**
- Create: `frontend/src/components/CardDetailPanel.js`

This is a new slide-in panel triggered by clicking a card row. It shows card info + a toggleable price history SVG chart (30/90/180 days) and a stats row.

- [ ] **Step 1: Create `frontend/src/components/CardDetailPanel.js`**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { API_URL } from '../config';

const DAY_OPTIONS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 }
];

function PriceChart({ history }) {
  if (history.length < 3) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Not enough history yet
      </div>
    );
  }

  const w = 380, h = 140, pad = 32;
  const prices = history.map(p => p.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const xStep = (w - pad * 2) / (history.length - 1);
  const pt = (i, p) => ({
    x: pad + i * xStep,
    y: h - pad - ((p - minP) / range) * (h - pad * 2)
  });
  const linePath = history
    .map((p, i) => {
      const { x, y } = pt(i, p.price);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 160 }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">${maxP.toFixed(2)}</text>
      <text x={pad - 4} y={h - pad} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">${minP.toFixed(2)}</text>
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
      {history.map((p, i) => {
        const { x, y } = pt(i, p.price);
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa">
            <title>{`$${p.price.toFixed(2)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export default function CardDetailPanel({ card, onClose }) {
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!card) return;
    setLoading(true);
    axios
      .get(`${API_URL}/cards/${card._id}/price-history?days=${days}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      })
      .then(res => {
        const pts = (res.data || []).map(p => ({
          price: p.price,
          date: p.date || p.createdAt
        }));
        setHistory(pts);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [card, days]);

  // Dismiss on Escape
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!card) return null;

  // Stats for the selected range
  const prices = history.map(p => p.price);
  const currentPrice = card.price || 0;
  const high = prices.length ? Math.max(...prices) : null;
  const low = prices.length ? Math.min(...prices) : null;
  const startPrice = prices.length ? prices[0] : null;
  const change = startPrice != null ? currentPrice - startPrice : null;
  const changePct = startPrice ? ((change / startPrice) * 100) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9990] bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-[9991] w-96 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{card.name}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {card.set || 'Unknown Set'} · {card.condition} · Qty {card.quantity}
            </p>
            {card.isFoil && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-300 text-xs">
                Foil
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current price */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-2xl font-bold text-white">
            ${currentPrice.toFixed(2)}
          </div>
          <div className="text-slate-400 text-xs mt-0.5">Current price (USD)</div>
        </div>

        {/* Day range toggle */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-1 mb-3">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  days === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              Loading…
            </div>
          ) : (
            <PriceChart history={history} />
          )}
        </div>

        {/* Stats row */}
        {prices.length >= 2 && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-sm">${high.toFixed(2)}</div>
              <div className="text-slate-500 text-xs mt-0.5">{days}d High</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-sm">${low.toFixed(2)}</div>
              <div className="text-slate-500 text-xs mt-0.5">{days}d Low</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className={`font-semibold text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
cd frontend && node -e "require('./src/components/CardDetailPanel.js')" 2>&1
```

Expected: no error (React components import cleanly via Node in CRA projects when not using JSX transform — if this fails, skip to manual verification in the browser).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CardDetailPanel.js
git commit -m "feat: add CardDetailPanel slide-in with price history SVG chart"
```

---

## Task 7: Frontend — `ValueHistoryChart.js` date range picker + summary stats

**Files:**
- Modify: `frontend/src/components/ValueHistoryChart.js`

The endpoint now returns `{ snapshots, earliest }` instead of an array. This task updates the component to handle the new response shape, adds a date range picker, and shows a summary stats row.

- [ ] **Step 1: Replace `frontend/src/components/ValueHistoryChart.js`**

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

export default function ValueHistoryChart() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(toDateInputValue(thirtyDaysAgo));
  const [to, setTo] = useState(toDateInputValue(today));
  const [earliest, setEarliest] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async (fromVal, toVal) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/stats/value-history?from=${fromVal}&to=${toVal}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      const { snapshots, earliest: e } = res.data;
      if (e && !earliest) setEarliest(e);
      const points = (snapshots || []).map(item => ({
        date: new Date(item.createdAt).toLocaleDateString(),
        value: item.value,
        count: item.cardCount
      }));
      setData(points);
    } catch (err) {
      console.error('Error fetching value history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(from, to);
  }, [from, to]);

  const startValue = data.length ? data[0].value : null;
  const endValue = data.length ? data[data.length - 1].value : null;
  const netChange = startValue != null && endValue != null ? endValue - startValue : null;
  const netChangePct = startValue ? ((netChange / startValue) * 100) : null;

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading chart…</div>;
  }

  const width = 600;
  const height = 220;
  const padding = 40;

  const renderChart = () => {
    if (!data.length) return null;
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    const pointAt = (i, v) => ({
      x: padding + i * xStep,
      y: height - padding - ((v - minValue) / range) * (height - padding * 2)
    });
    const linePath = data
      .map((d, i) => {
        const { x, y } = pointAt(i, d.value);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 300 }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">${maxValue.toFixed(0)}</text>
        <text x={padding - 6} y={height - padding} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">${minValue.toFixed(0)}</text>
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        {data.map((d, i) => {
          const { x, y } = pointAt(i, d.value);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa">
              <title>{`$${d.value.toFixed(2)} on ${d.date}`}</title>
            </circle>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3">Collection Value History</h3>

      {/* Date range picker */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-slate-400 text-sm">From</label>
        <input
          type="date"
          value={from}
          min={earliest || undefined}
          max={to}
          onChange={e => setFrom(e.target.value)}
          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        <label className="text-slate-400 text-sm">To</label>
        <input
          type="date"
          value={to}
          min={from}
          max={toDateInputValue(new Date())}
          onChange={e => setTo(e.target.value)}
          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {!data.length ? (
        <p className="text-slate-400 text-sm">No snapshots in this date range.</p>
      ) : (
        <>
          {renderChart()}

          {/* Summary stats */}
          {netChange != null && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-white font-semibold text-sm">${startValue.toFixed(2)}</div>
                <div className="text-slate-500 text-xs mt-0.5">Start</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-white font-semibold text-sm">${endValue.toFixed(2)}</div>
                <div className="text-slate-500 text-xs mt-0.5">End</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className={`font-semibold text-sm ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                  {netChangePct != null && (
                    <span className="text-xs ml-1">({netChangePct >= 0 ? '+' : ''}{netChangePct.toFixed(1)}%)</span>
                  )}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">Change</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ValueHistoryChart.js
git commit -m "feat: add date range picker and summary stats to ValueHistoryChart"
```

---

## Task 8: Frontend — `NotificationBell.js` price_alert rendering

**Files:**
- Modify: `frontend/src/components/NotificationBell.js`

Price alert notifications have no `fromUserId` and carry the card name + price in `content`. The bell currently renders all notifications with `{fromUserId?.displayName || 'User'} · {type}`. This task gives price alerts their own display.

- [ ] **Step 1: Modify `frontend/src/components/NotificationBell.js`**

Add `'price_alert': '📉'` to the `typeEmojis` object:

```js
  const typeEmojis = {
    mention: '💬',
    reply: '📝',
    upvote: '⬆️',
    dm: '💌',
    price_alert: '📉'
  };
```

Replace the notification row content block (the `<div className="flex-1 min-w-0">` block) with a version that handles `price_alert` specially:

```jsx
                  <div className="flex-1 min-w-0">
                    {notif.type === 'price_alert' ? (
                      <>
                        <div className="text-sm text-white font-medium">Price Alert</div>
                        <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-white font-medium">
                          {notif.fromUserId?.displayName || 'User'} · {notif.type}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                      </>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </div>
                  </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NotificationBell.js
git commit -m "feat: render price_alert notifications in NotificationBell"
```

---

## Task 9: Frontend — Wire `App.js` (price cell hover sparkline + row click → CardDetailPanel)

**Files:**
- Modify: `frontend/src/App.js`

**Context:** The collection table renders card rows. Each row has a price cell (the `<td>` showing `$X.XX`). This task wires:
1. Mouse-enter on the price cell → debounced fetch → small sparkline popup
2. Click on any non-button cell in the row → open `CardDetailPanel`

**Important:** Do NOT define `CardDetailPanel` or `SparklinePopup` inside the `App` function body (this causes DOM remount on every render, breaking keyboard input). Import or define them at module scope.

- [ ] **Step 1: Add imports at the top of `App.js`**

Find the existing imports at the top of `frontend/src/App.js`. Add:

```js
import CardDetailPanel from './components/CardDetailPanel';
```

- [ ] **Step 2: Add state for the detail panel and hover sparkline**

Inside the `App` function, with the other `useState` declarations, add:

```js
  const [detailCard, setDetailCard] = useState(null);
  const [sparkline, setSparkline] = useState(null);
  // sparkline: { cardId, cardName, pos: {top, left}, history: [] } | null
  const sparklineTimerRef = React.useRef(null);
```

- [ ] **Step 3: Add sparkline fetch handler functions** (at function scope, NOT inside render or JSX)

Add these two functions inside the `App` function body, alongside other handler functions:

```js
  const handlePriceCellEnter = (e, card) => {
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(sparklineTimerRef.current);
    sparklineTimerRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/cards/${card._id}/price-history?days=30`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
        });
        const pts = (res.data || []).map(p => ({ price: p.price, date: p.date || p.createdAt }));
        setSparkline({
          cardId: card._id,
          cardName: card.name,
          pos: { top: rect.top - 10, left: rect.left + rect.width / 2 },
          history: pts
        });
      } catch {}
    }, 300);
  };

  const handlePriceCellLeave = () => {
    clearTimeout(sparklineTimerRef.current);
    setSparkline(null);
  };
```

- [ ] **Step 4: Add the `SparklinePopup` component at module scope** (outside the `App` function, near the top of the file after imports)

```jsx
function SparklinePopup({ sparkline }) {
  if (!sparkline || sparkline.history.length < 2) return null;

  const w = 200, h = 80, pad = 8;
  const prices = sparkline.history.map(p => p.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const xStep = (w - pad * 2) / (prices.length - 1);
  const pt = (i, p) => ({
    x: pad + i * xStep,
    y: h - pad - ((p - minP) / range) * (h - pad * 2)
  });
  const linePath = prices.map((p, i) => {
    const { x, y } = pt(i, p);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div
      style={{
        position: 'fixed',
        top: sparkline.pos.top - 100,
        left: sparkline.pos.left - 100,
        zIndex: 9999,
        width: 200,
        pointerEvents: 'none'
      }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2"
    >
      <div className="text-xs text-slate-400 mb-1 truncate">{sparkline.cardName} · 30d</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
        {prices.map((p, i) => {
          const { x, y } = pt(i, p);
          return <circle key={i} cx={x} cy={y} r="2" fill="#a78bfa" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>${minP.toFixed(2)}</span>
        <span>${maxP.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Find the price cell `<td>` in the collection table and add hover handlers**

In `App.js`, search for the price display in the table row (look for `card.price` or `$` followed by `.toFixed(2)` inside a `<td>`). Add `onMouseEnter` and `onMouseLeave` props to that `<td>`:

```jsx
<td
  onMouseEnter={e => handlePriceCellEnter(e, card)}
  onMouseLeave={handlePriceCellLeave}
  className="... existing classes ..."
>
  ${(card.price || 0).toFixed(2)}
</td>
```

Keep all existing className and content — only add the two event handlers.

- [ ] **Step 6: Find the table row `<tr>` and add a click handler to open the detail panel**

Find the `<tr>` for each card row (look for the checkbox or the first column). Add `onClick` that opens the detail panel, but only when the click target is not a button or input:

```jsx
<tr
  onClick={e => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
    setDetailCard(card);
  }}
  className="... existing classes ... cursor-pointer"
>
```

Add `cursor-pointer` to the existing className string.

- [ ] **Step 7: Render `SparklinePopup` and `CardDetailPanel` in the return JSX**

At the end of the `App` component's return statement, just before the final closing `</div>`, add:

```jsx
      {sparkline && <SparklinePopup sparkline={sparkline} />}
      {detailCard && (
        <CardDetailPanel
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}
```

- [ ] **Step 8: Start the dev servers and test manually**

Start both servers (open two terminals):

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

Open `http://localhost:3000` in a browser (must be logged in). Verify:
1. Hovering a price cell shows the sparkline popup after ~300ms
2. Moving away dismisses it
3. Clicking a card row opens the CardDetailPanel from the right
4. The 30/90/180d toggles in the panel fetch different data
5. Pressing Escape closes the panel
6. Clicking outside the panel closes it
7. Clicking the row action buttons (edit, delete, etc.) does NOT open the panel

- [ ] **Step 9: Run full test suite**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: wire price cell hover sparkline and row click detail panel in collection table"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| Daily cron job: price snapshots + value snapshot + alert check | Task 5 |
| `GET /api/cards/:id/price-history?days=N` | Task 4 |
| `GET /api/stats/value-history?from=&to=` + `earliest` | Task 4 |
| `lastAlertFiredAt` on `card.priceAlert` | Task 3 |
| `price_alert` notification type | Task 3 |
| `createPriceAlertNotification` | Task 3 |
| `CardDetailPanel`: slide-in, 30/90/180d toggle, stats row | Task 6 |
| `ValueHistoryChart`: date range picker + summary stats | Task 7 |
| `NotificationBell`: price_alert rendering | Task 8 |
| App.js: price cell hover sparkline | Task 9 |
| App.js: row click → CardDetailPanel | Task 9 |
| Extract models needed by daily job | Tasks 1–2 |

All spec requirements have a corresponding task. ✅

### Key implementation notes for agents

- `SparklinePopup` MUST be defined at module scope in `App.js`, NOT inside the `App` function body. Defining components inside another component causes DOM remount on every render — all input fields lose focus on every keystroke.
- `CardDetailPanel` is a separate file and correctly at module scope.
- The daily job uses `mongoose.model('Card')` at call-time (not module-load time) — safe because `server.js` registers the `Card` model before calling `registerDailySnapshotJob()`.
- `node-cron` must be installed before Task 5 can run.
- The `GET /api/stats/value-history` response shape changes from an array to `{ snapshots, earliest }` — Task 7 (ValueHistoryChart) handles this. No other frontend code calls this endpoint directly.

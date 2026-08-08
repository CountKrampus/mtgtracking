# Collection Health Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in weekly "Collection Health Report" — condition breakdown, week-over-week value change, and a "worth a look" list (poor-condition cards + owned cards with a meaningful price drop) — delivered as an in-app notification linking to a dedicated report page.

**Architecture:** A new `CollectionHealthReport` model stores one snapshot document per generation run. A pure computation module (`backend/utils/healthReport.js`) does condition/value/upgrade-suggestion math with no DB access, wrapped by an orchestration function that queries the existing `Card`, `ValueSnapshot`, and `CardPriceSnapshot` data. A `node-cron` job (mirroring `backend/jobs/dailyPriceSnapshot.js`) runs the orchestration weekly for opted-in users and fires a new `collection_health_report` notification type; an admin-only route reuses the exact same function on demand. The opt-in lives on the `User` model next to the existing `privacy` sub-object, edited through the existing `PUT /api/users/me` merge pattern. The frontend adds one new route/page and a settings toggle, following existing `WishlistView`/`AccountSettings`/`Dashboard` patterns.

**Tech Stack:** Node.js/Express/Mongoose (backend), node-cron, Jest + mongodb-memory-server + supertest (backend tests), React + react-router-dom + Tailwind + lucide-react (frontend, no existing frontend test infra to extend).

---

## Important context for the engineer (read first)

- **Card is not a standalone model file.** It's defined inline in `backend/server.js` (`const Card = mongoose.model('Card', cardSchema);` at server.js:386). Runtime code (jobs, admin routes) gets it lazily via `mongoose.model('Card')` *after* server.js has booted — see `backend/jobs/dailyPriceSnapshot.js:14-16` and `backend/routes/admin.js:1607` for the existing pattern. Tests can't `require` it, so they register a **minimal local schema** under the same registered name. This plan follows the exact same two patterns already used elsewhere in this repo:
  - `backend/utils/milestoneAwards.js` takes the Card model as an explicit function parameter (dependency injection) — used for the **pure/orchestration function tests** (register a `TestCard` model under a different name, per `backend/__tests__/milestones.test.js:24-31`).
  - `backend/jobs/dailyPriceSnapshot.js` calls `mongoose.model('Card')` lazily inside the job function — used for the **job-level and route-level tests** (register a minimal schema under the literal name `'Card'`, since the code under test looks it up by that name).
- **No unique index on `{userId, weekOf}`.** The admin `run-now` endpoint is explicitly for repeated manual testing ("reuses the same generation function for testing without waiting a week" — design spec). A unique constraint would make the second manual run of the week fail. Every run just creates a fresh report; `GET /api/health-report` always returns the most recent one by `createdAt`.
- **The design spec's claim that "other notification types already deep-link" is not accurate for this codebase.** `frontend/src/components/NotificationBell.js` currently has no click-to-navigate on any notification (only mark-read/delete buttons). Task 15 builds this deep-link from scratch for the new type only — it does not retrofit `price_alert`, which stays out of scope.
- **`SettingsView.js` is not the right home for the opt-in toggle.** It's a client-only, `localStorage`-backed settings panel (see `frontend/src/hooks/useSettings.js`) with no backend persistence — useless for a per-user preference a backend cron job needs to read. The existing per-user, backend-persisted preference toggle pattern lives in `frontend/src/components/auth/AccountSettings.js` (the "Privacy & Sharing" tab, backed by `User.privacy` and `PUT /api/users/me`). This plan adds a new "Notifications" tab there, following that exact pattern.
- **No frontend test infrastructure exists in this repo** (`frontend/src/**/*.test.js` — zero matches). Frontend tasks in this plan are implementation + manual verification, matching the codebase's actual (backend-only) testing convention. Backend tasks are full TDD.
- Run all backend test commands from the `backend/` directory (`d:\Card Tracker\mtg-tracker\backend`). The project uses Jest with `mongodb-memory-server` for DB-backed tests (see `backend/__tests__/price-alerts.test.js`, `backend/__tests__/public-profile.test.js` for the exact conventions this plan follows) and `jest.setup.js` sets `MULTI_USER_ENABLED=true` and `JWT_SECRET=test-secret` globally.

---

## File Structure

**New files:**
- `backend/models/CollectionHealthReport.js` — new model
- `backend/utils/healthReport.js` — pure computation functions + `generateHealthReportForUser` orchestration
- `backend/jobs/weeklyHealthReport.js` — cron registration + `runWeeklyHealthReport` (mirrors `dailyPriceSnapshot.js`)
- `backend/routes/healthReport.js` — `GET /api/health-report` (current user's latest report)
- `backend/__tests__/health-report-model.test.js`
- `backend/__tests__/health-report-computation.test.js`
- `backend/__tests__/health-report-generation.test.js`
- `backend/__tests__/health-report-job.test.js`
- `backend/__tests__/health-report-routes.test.js`
- `backend/__tests__/user-notification-preferences.test.js`
- `frontend/src/components/CollectionHealthReportView.js` — report page

**Modified files:**
- `backend/models/Notification.js` — add `collection_health_report` type + `healthReportId` field
- `backend/utils/notifications.js` — add `createHealthReportNotification`
- `backend/models/User.js` — add `notificationPreferences.healthReportEnabled`, include it in `toSafeObject()`
- `backend/routes/users.js` — merge `notificationPreferences` in `PUT /me`
- `backend/routes/admin.js` — add `POST /health-reports/run-now`
- `backend/server.js` — register the weekly job, mount the new route
- `frontend/src/App.js` — lazy import + `/health-report` route
- `frontend/src/components/auth/AccountSettings.js` — new "Notifications" tab with the opt-in toggle
- `frontend/src/components/NotificationBell.js` — emoji + click-to-navigate for the new type

---

### Task 1: `CollectionHealthReport` model

**Files:**
- Create: `backend/models/CollectionHealthReport.js`
- Test: `backend/__tests__/health-report-model.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/health-report-model.test.js`:

```js
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

const CollectionHealthReport = require('../models/CollectionHealthReport');

afterEach(async () => {
  await CollectionHealthReport.deleteMany({});
});

describe('CollectionHealthReport model', () => {
  test('stores condition breakdown, value change, and upgrade suggestions', async () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();

    const report = await CollectionHealthReport.create({
      userId,
      weekOf: new Date('2026-07-06'),
      conditionBreakdown: { NM: 10, LP: 2, MP: 1, HP: 1, DMG: 0 },
      valueChange: { from: 100, to: 120, delta: 20, deltaPercent: 20 },
      upgradeSuggestions: [
        { cardId, name: 'Sol Ring', reason: 'poor_condition', detail: 'Condition: HP' }
      ]
    });

    expect(report._id).toBeDefined();
    expect(report.conditionBreakdown.NM).toBe(10);
    expect(report.valueChange.delta).toBe(20);
    expect(report.upgradeSuggestions).toHaveLength(1);
    expect(report.upgradeSuggestions[0].reason).toBe('poor_condition');
    expect(report.createdAt).toBeDefined();
  });

  test('rejects an upgradeSuggestions reason outside the enum', async () => {
    const userId = new mongoose.Types.ObjectId();
    await expect(
      CollectionHealthReport.create({
        userId,
        weekOf: new Date(),
        conditionBreakdown: { NM: 1, LP: 0, MP: 0, HP: 0, DMG: 0 },
        valueChange: { from: 0, to: 0, delta: 0, deltaPercent: 0 },
        upgradeSuggestions: [{ name: 'Bad', reason: 'not_a_real_reason', detail: 'x' }]
      })
    ).rejects.toThrow();
  });

  test('requires userId and weekOf', async () => {
    await expect(
      CollectionHealthReport.create({
        conditionBreakdown: { NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 },
        valueChange: { from: 0, to: 0, delta: 0, deltaPercent: 0 },
        upgradeSuggestions: []
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js`
Expected: FAIL with `Cannot find module '../models/CollectionHealthReport'`

- [ ] **Step 3: Write the model**

Create `backend/models/CollectionHealthReport.js`:

```js
const mongoose = require('mongoose');

// One document per generation run (not unique per user/week — the admin
// run-now endpoint is meant to be triggered repeatedly for testing, and each
// run should produce a fresh report rather than fail on a duplicate-key error).
// GET /api/health-report always serves the most recent document by createdAt.
const collectionHealthReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  weekOf: {
    type: Date,
    required: true
  },
  conditionBreakdown: {
    NM: { type: Number, default: 0 },
    LP: { type: Number, default: 0 },
    MP: { type: Number, default: 0 },
    HP: { type: Number, default: 0 },
    DMG: { type: Number, default: 0 }
  },
  valueChange: {
    from: { type: Number, default: 0 },
    to: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    deltaPercent: { type: Number, default: 0 }
  },
  upgradeSuggestions: [
    {
      _id: false,
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
      name: String,
      reason: { type: String, enum: ['poor_condition', 'price_drop'], required: true },
      detail: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

collectionHealthReportSchema.index({ userId: 1, createdAt: -1 });
collectionHealthReportSchema.index({ userId: 1, weekOf: -1 });

module.exports = mongoose.model('CollectionHealthReport', collectionHealthReportSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/CollectionHealthReport.js backend/__tests__/health-report-model.test.js
git commit -m "feat: add CollectionHealthReport model"
```

---

### Task 2: Extend `Notification` model with the `collection_health_report` type

**Files:**
- Modify: `backend/models/Notification.js:12` (type enum), `backend/models/Notification.js:15-21` (fromUserId required), `backend/models/Notification.js:34-37` (new field after `cardId`)
- Test: `backend/__tests__/health-report-model.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/__tests__/health-report-model.test.js` (add the require near the top, alongside the `CollectionHealthReport` require, and a new `describe` block at the bottom):

```js
const Notification = require('../models/Notification');
```

```js
describe('Notification: collection_health_report type', () => {
  afterEach(async () => {
    await Notification.deleteMany({});
  });

  test('can be created without fromUserId (system-generated)', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await Notification.create({
      userId,
      type: 'collection_health_report',
      healthReportId: reportId,
      content: 'Your weekly collection health report is ready'
    });

    expect(notif._id).toBeDefined();
    expect(notif.fromUserId).toBeUndefined();
    expect(notif.healthReportId.toString()).toBe(reportId.toString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js -t "collection_health_report type"`
Expected: FAIL — Mongoose validation error, either `type` not in enum or `fromUserId` required.

- [ ] **Step 3: Extend the Notification schema**

In `backend/models/Notification.js`, change the `type` enum at line 12:

```js
    enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected', 'trade_countered', 'collection_health_report'],
```

Change the `fromUserId.required` function at lines 15-21:

```js
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type !== 'price_alert' && this.type !== 'collection_health_report';
    }
  },
```

Insert a new field right after the existing `cardId` block (currently lines 34-37):

```js
  healthReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionHealthReport'
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/models/Notification.js backend/__tests__/health-report-model.test.js
git commit -m "feat: add collection_health_report notification type"
```

---

### Task 3: `createHealthReportNotification` util

**Files:**
- Modify: `backend/utils/notifications.js` (add function + export)
- Test: `backend/__tests__/health-report-model.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/__tests__/health-report-model.test.js`:

```js
const { createHealthReportNotification } = require('../utils/notifications');
```

```js
describe('createHealthReportNotification', () => {
  afterEach(async () => {
    await Notification.deleteMany({});
  });

  test('creates a collection_health_report notification referencing the report and summarizing the value delta', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await createHealthReportNotification(userId, reportId, { delta: 12.5, deltaPercent: 8.2 });

    expect(notif).not.toBeNull();
    expect(notif.type).toBe('collection_health_report');
    expect(notif.userId.toString()).toBe(userId.toString());
    expect(notif.healthReportId.toString()).toBe(reportId.toString());
    expect(notif.content).toContain('+$12.50');
  });

  test('formats a negative value delta with a minus sign', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await createHealthReportNotification(userId, reportId, { delta: -7, deltaPercent: -3.1 });

    expect(notif.content).toContain('-$7.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js -t "createHealthReportNotification"`
Expected: FAIL — `createHealthReportNotification is not a function`

- [ ] **Step 3: Implement the function**

In `backend/utils/notifications.js`, add after `createPriceAlertNotification` (after its closing `}` and before `module.exports`):

```js
/**
 * Create a collection health report notification (system-generated, no fromUserId required)
 *
 * @param {string|ObjectId} userId - User the report belongs to
 * @param {string|ObjectId} reportId - CollectionHealthReport document ID
 * @param {object} valueChange - { delta, deltaPercent } from the generated report
 * @returns {object} Created notification or null on error
 */
async function createHealthReportNotification(userId, reportId, valueChange) {
  try {
    const delta = valueChange?.delta || 0;
    const sign = delta >= 0 ? '+' : '-';
    const content = `Your weekly collection health report is ready (value ${sign}$${Math.abs(delta).toFixed(2)} this week)`;
    const notification = await Notification.create({
      userId,
      type: 'collection_health_report',
      healthReportId: reportId,
      content: content.substring(0, 200)
    });
    return notification;
  } catch (error) {
    console.error('Error creating collection health report notification:', error);
    return null;
  }
}
```

Update `module.exports` at the bottom of the file to include it:

```js
module.exports = {
  extractMentions,
  createNotification,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification,
  createPriceAlertNotification,
  createHealthReportNotification
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-model.test.js`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/notifications.js backend/__tests__/health-report-model.test.js
git commit -m "feat: add createHealthReportNotification helper"
```

---

### Task 4: Pure report-computation functions

**Files:**
- Create: `backend/utils/healthReport.js` (functions only — orchestration added in Task 5)
- Test: `backend/__tests__/health-report-computation.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/health-report-computation.test.js`:

```js
const {
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek
} = require('../utils/healthReport');

describe('computeConditionBreakdown', () => {
  test('counts cards by condition, weighted by quantity', () => {
    const cards = [
      { condition: 'NM', quantity: 3 },
      { condition: 'NM', quantity: 1 },
      { condition: 'HP', quantity: 2 },
      { condition: 'DMG', quantity: 1 }
    ];
    expect(computeConditionBreakdown(cards)).toEqual({ NM: 4, LP: 0, MP: 0, HP: 2, DMG: 1 });
  });

  test('returns all-zero breakdown for an empty collection', () => {
    expect(computeConditionBreakdown([])).toEqual({ NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 });
  });

  test('defaults missing quantity to 1', () => {
    expect(computeConditionBreakdown([{ condition: 'LP' }])).toEqual({ NM: 0, LP: 1, MP: 0, HP: 0, DMG: 0 });
  });
});

describe('computeValueChange', () => {
  test('computes delta and percent for an increase', () => {
    expect(computeValueChange(100, 120)).toEqual({ from: 100, to: 120, delta: 20, deltaPercent: 20 });
  });

  test('computes delta and percent for a decrease', () => {
    expect(computeValueChange(200, 150)).toEqual({ from: 200, to: 150, delta: -50, deltaPercent: -25 });
  });

  test('treats a missing "from" value as zero without dividing by zero', () => {
    expect(computeValueChange(undefined, 50)).toEqual({ from: 0, to: 50, delta: 50, deltaPercent: 0 });
  });

  test('treats a missing "to" value as zero', () => {
    expect(computeValueChange(80, undefined)).toEqual({ from: 80, to: 0, delta: -80, deltaPercent: -100 });
  });
});

describe('computeUpgradeSuggestions', () => {
  test('flags HP and DMG cards as poor_condition', () => {
    const cards = [
      { _id: 'card-hp', name: 'Underground Sea', condition: 'HP', price: 300 },
      { _id: 'card-dmg', name: 'Bayou', condition: 'DMG', price: 150 },
      { _id: 'card-nm', name: 'Sol Ring', condition: 'NM', price: 2 }
    ];
    const suggestions = computeUpgradeSuggestions(cards, new Map());

    expect(suggestions).toEqual([
      { cardId: 'card-hp', name: 'Underground Sea', reason: 'poor_condition', detail: 'Condition: HP' },
      { cardId: 'card-dmg', name: 'Bayou', reason: 'poor_condition', detail: 'Condition: DMG' }
    ]);
  });

  test('flags a card whose price dropped 20% or more since last week', () => {
    const cards = [{ _id: 'card-1', name: 'Mana Crypt', condition: 'NM', price: 40 }];
    const priceWeekAgo = new Map([['card-1', 50]]); // 40 is exactly a 20% drop from 50

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([
      { cardId: 'card-1', name: 'Mana Crypt', reason: 'price_drop', detail: 'Price dropped 20% to $40.00' }
    ]);
  });

  test('does not flag a price drop below the 20% threshold', () => {
    const cards = [{ _id: 'card-2', name: 'Command Tower', condition: 'NM', price: 2 }];
    const priceWeekAgo = new Map([['card-2', 2.2]]); // ~9% drop

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([]);
  });

  test('ignores price drops on cards under the $1 current-price floor to avoid noise', () => {
    const cards = [{ _id: 'card-3', name: 'Swamp', condition: 'NM', price: 0.1 }];
    const priceWeekAgo = new Map([['card-3', 1]]); // 90% drop, but current price is under $1

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([]);
  });

  test('a card in poor condition with a price drop produces two separate suggestions', () => {
    const cards = [{ _id: 'card-4', name: 'Time Walk', condition: 'HP', price: 800 }];
    const priceWeekAgo = new Map([['card-4', 1000]]); // 20% drop

    const suggestions = computeUpgradeSuggestions(cards, priceWeekAgo);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map(s => s.reason).sort()).toEqual(['poor_condition', 'price_drop']);
  });
});

describe('startOfISOWeek', () => {
  test('returns the Monday of the same week for a mid-week date', () => {
    const thursday = new Date(2026, 6, 9); // July 9, 2026 is a Thursday
    const result = startOfISOWeek(thursday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(6);
    expect(result.getDay()).toBe(1); // Monday
  });

  test('a Sunday belongs to the Monday that started its own week', () => {
    const sunday = new Date(2026, 6, 12); // July 12, 2026 is a Sunday
    const result = startOfISOWeek(sunday);
    expect(result.getDate()).toBe(6);
    expect(result.getDay()).toBe(1);
  });

  test('a Monday maps to itself with the time zeroed', () => {
    const monday = new Date(2026, 6, 6, 15, 30);
    const result = startOfISOWeek(monday);
    expect(result.getDate()).toBe(6);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-computation.test.js`
Expected: FAIL with `Cannot find module '../utils/healthReport'`

- [ ] **Step 3: Implement the pure functions**

Create `backend/utils/healthReport.js`:

```js
const PRICE_DROP_THRESHOLD_PCT = 0.20; // 20% drop triggers a "worth a look" suggestion
const PRICE_DROP_MIN_PRICE = 1; // floor: ignore drops on cards currently under $1 (noise)

const EMPTY_BREAKDOWN = { NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 };

function computeConditionBreakdown(cards) {
  const breakdown = { ...EMPTY_BREAKDOWN };
  for (const card of cards) {
    if (Object.prototype.hasOwnProperty.call(breakdown, card.condition)) {
      breakdown[card.condition] += card.quantity || 1;
    }
  }
  return breakdown;
}

function computeValueChange(fromValue, toValue) {
  const from = fromValue || 0;
  const to = toValue || 0;
  const delta = to - from;
  const deltaPercent = from > 0 ? (delta / from) * 100 : 0;
  return { from, to, delta, deltaPercent };
}

function computeUpgradeSuggestions(cards, priceWeekAgoByCardId) {
  const suggestions = [];
  for (const card of cards) {
    if (card.condition === 'HP' || card.condition === 'DMG') {
      suggestions.push({
        cardId: card._id,
        name: card.name,
        reason: 'poor_condition',
        detail: `Condition: ${card.condition}`
      });
    }

    const oldPrice = priceWeekAgoByCardId.get(card._id.toString());
    if (oldPrice && oldPrice > 0 && card.price >= PRICE_DROP_MIN_PRICE) {
      const dropPct = (oldPrice - card.price) / oldPrice;
      if (dropPct >= PRICE_DROP_THRESHOLD_PCT) {
        suggestions.push({
          cardId: card._id,
          name: card.name,
          reason: 'price_drop',
          detail: `Price dropped ${(dropPct * 100).toFixed(0)}% to $${card.price.toFixed(2)}`
        });
      }
    }
  }
  return suggestions;
}

// Start of the ISO week (Monday, 00:00 local time) containing the given date.
function startOfISOWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  PRICE_DROP_THRESHOLD_PCT,
  PRICE_DROP_MIN_PRICE,
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-computation.test.js`
Expected: PASS (13 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/healthReport.js backend/__tests__/health-report-computation.test.js
git commit -m "feat: add pure collection health report computation functions"
```

---

### Task 5: `generateHealthReportForUser` orchestration

**Files:**
- Modify: `backend/utils/healthReport.js` (add orchestration function + export)
- Test: `backend/__tests__/health-report-generation.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/health-report-generation.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ValueSnapshot = require('../models/ValueSnapshot');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { generateHealthReportForUser } = require('../utils/healthReport');

// Minimal in-memory Card model for generation tests, registered under a distinct
// name so it doesn't collide with the real 'Card' schema registered elsewhere.
// Mirrors the TestCard pattern in __tests__/milestones.test.js. generateHealthReportForUser
// takes the Card model as an explicit parameter (like utils/milestoneAwards.js does),
// so injecting this test double requires no changes to the function under test.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const TestCard = mongoose.models.TestCard || mongoose.model('TestCard', cardSchema);

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
  await TestCard.deleteMany({});
  await ValueSnapshot.deleteMany({});
  await CardPriceSnapshot.deleteMany({});
  await CollectionHealthReport.deleteMany({});
});

describe('generateHealthReportForUser', () => {
  it('saves a CollectionHealthReport combining condition breakdown, value change, and upgrade suggestions', async () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const bolt = await TestCard.create({ userId, name: 'Lightning Bolt', condition: 'NM', price: 5, quantity: 1 });
    const ring = await TestCard.create({ userId, name: 'Sol Ring', condition: 'DMG', price: 2, quantity: 1 });

    // Value snapshots: 100 eight days ago, 120 now
    await ValueSnapshot.create({ userId, value: 100, cardCount: 2, createdAt: eightDaysAgo });
    await ValueSnapshot.create({ userId, value: 120, cardCount: 2, createdAt: now });

    // Price snapshot for Lightning Bolt eight days ago at $10 -> now $5 = 50% drop
    await CardPriceSnapshot.create({ cardId: bolt._id, userId, price: 10, createdAt: eightDaysAgo });

    const report = await generateHealthReportForUser(userId, {
      Card: TestCard, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
    });

    expect(report.conditionBreakdown.toObject()).toEqual({ NM: 1, LP: 0, MP: 0, HP: 0, DMG: 1 });
    expect(report.valueChange.toObject()).toEqual({ from: 100, to: 120, delta: 20, deltaPercent: 20 });

    const reasons = report.upgradeSuggestions.map(s => s.reason).sort();
    expect(reasons).toEqual(['poor_condition', 'price_drop']);

    const dmgSuggestion = report.upgradeSuggestions.find(s => s.cardId.toString() === ring._id.toString());
    expect(dmgSuggestion.detail).toBe('Condition: DMG');

    const dropSuggestion = report.upgradeSuggestions.find(s => s.cardId.toString() === bolt._id.toString());
    expect(dropSuggestion.detail).toContain('50%');

    const saved = await CollectionHealthReport.findById(report._id);
    expect(saved).not.toBeNull();
  });

  it('handles a user with no snapshots yet (first week) gracefully', async () => {
    const userId = new mongoose.Types.ObjectId();
    await TestCard.create({ userId, name: 'Forest', condition: 'NM', price: 0.1, quantity: 10 });

    const report = await generateHealthReportForUser(userId, {
      Card: TestCard, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
    });

    expect(report.valueChange.toObject()).toEqual({ from: 0, to: 0, delta: 0, deltaPercent: 0 });
    expect(report.upgradeSuggestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-generation.test.js`
Expected: FAIL — `generateHealthReportForUser is not a function`

- [ ] **Step 3: Implement the orchestration function**

Append to `backend/utils/healthReport.js`, before `module.exports`:

```js
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Orchestrates one report for one user. Models are passed in explicitly (Card, ValueSnapshot,
// CardPriceSnapshot, CollectionHealthReport) rather than required at the top of this module,
// because Card is registered dynamically by server.js at runtime (see backend/server.js:386)
// and isn't a requirable file — callers (the weekly job, the admin run-now route, and tests)
// each resolve/construct the Card model themselves and pass it in.
async function generateHealthReportForUser(userId, models) {
  const { Card, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport } = models;

  const cards = await Card.find({ userId }).lean();
  const conditionBreakdown = computeConditionBreakdown(cards);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const latestSnapshot = await ValueSnapshot.findOne({ userId }).sort({ createdAt: -1 }).lean();
  const weekAgoSnapshot = await ValueSnapshot.findOne({
    userId,
    createdAt: { $lte: weekAgo }
  }).sort({ createdAt: -1 }).lean();

  const valueChange = computeValueChange(weekAgoSnapshot?.value, latestSnapshot?.value);

  const priceWeekAgoByCardId = new Map();
  for (const card of cards) {
    const snap = await CardPriceSnapshot.findOne({
      cardId: card._id,
      createdAt: { $lte: weekAgo }
    }).sort({ createdAt: -1 }).lean();
    if (snap) {
      priceWeekAgoByCardId.set(card._id.toString(), snap.price);
    }
  }

  const upgradeSuggestions = computeUpgradeSuggestions(cards, priceWeekAgoByCardId);

  return CollectionHealthReport.create({
    userId,
    weekOf: startOfISOWeek(now),
    conditionBreakdown,
    valueChange,
    upgradeSuggestions
  });
}
```

Update `module.exports` at the bottom of the file:

```js
module.exports = {
  PRICE_DROP_THRESHOLD_PCT,
  PRICE_DROP_MIN_PRICE,
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek,
  generateHealthReportForUser
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-generation.test.js`
Expected: PASS (2 tests). Note: `report.conditionBreakdown` and `report.valueChange` are Mongoose subdocuments on the returned document — `.toObject()` is used in assertions to compare plain values.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/healthReport.js backend/__tests__/health-report-generation.test.js
git commit -m "feat: add generateHealthReportForUser orchestration"
```

---

### Task 6: `User.notificationPreferences.healthReportEnabled`

**Files:**
- Modify: `backend/models/User.js:70-77` (insert new field after `privacy`), `backend/models/User.js:125-143` (`toSafeObject`)
- Test: `backend/__tests__/user-notification-preferences.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/user-notification-preferences.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
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

describe('User.notificationPreferences', () => {
  test('healthReportEnabled defaults to false', async () => {
    const user = await User.create({
      email: 'defaults@test.com',
      username: 'defaultsuser',
      passwordHash: 'hash',
      role: 'user'
    });
    expect(user.notificationPreferences.healthReportEnabled).toBe(false);
  });

  test('toSafeObject includes notificationPreferences', async () => {
    const user = await User.create({
      email: 'safeobj@test.com',
      username: 'safeobjuser',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    const safe = user.toSafeObject();
    expect(safe.notificationPreferences.healthReportEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest user-notification-preferences.test.js`
Expected: FAIL — `expect(received).toBe(false)` receives `undefined` (first test), then second test fails the same way since `toSafeObject()` doesn't include the field.

- [ ] **Step 3: Extend the User schema and toSafeObject**

In `backend/models/User.js`, insert a new field immediately after the `privacy` block (which currently ends at line 77 with `},`), before the `reputation` field:

```js
  notificationPreferences: {
    healthReportEnabled: { type: Boolean, default: false }
  },
```

In `toSafeObject()` (lines 125-143), add the field after `badges: this.badges,`:

```js
    badges: this.badges,
    notificationPreferences: this.notificationPreferences,
    avatarUrl: this.avatarUrl
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest user-notification-preferences.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/User.js backend/__tests__/user-notification-preferences.test.js
git commit -m "feat: add User.notificationPreferences.healthReportEnabled"
```

---

### Task 7: `PUT /api/users/me` merges `notificationPreferences`

**Files:**
- Modify: `backend/routes/users.js:62` (destructure), `backend/routes/users.js:100-108` (merge, insert after)
- Test: `backend/__tests__/user-notification-preferences.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/__tests__/user-notification-preferences.test.js` (add these requires near the top, alongside the existing `User` require):

```js
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

// Mirrors the App builder in __tests__/public-profile.test.js: public users routes
// first, then the auth-protected users router, matching server.js's mount order.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/usersPublic'));
  app.use('/api/users', require('../routes/users'));
  return app;
}
```

Add a new `describe` block:

```js
describe('PUT /api/users/me — notificationPreferences', () => {
  it('merges notificationPreferences.healthReportEnabled without touching other fields', async () => {
    const user = await User.create({
      email: 'merge@test.com',
      username: 'mergeuser',
      passwordHash: 'hash',
      role: 'user',
      displayName: 'Original Name'
    });

    const app = buildApp();
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ notificationPreferences: { healthReportEnabled: true } });

    expect(res.status).toBe(200);
    expect(res.body.notificationPreferences.healthReportEnabled).toBe(true);
    expect(res.body.displayName).toBe('Original Name');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest user-notification-preferences.test.js -t "PUT /api/users/me"`
Expected: FAIL — `res.body.notificationPreferences.healthReportEnabled` is `false` (the route ignores the field, so it stays at its schema default).

- [ ] **Step 3: Merge `notificationPreferences` in the route**

In `backend/routes/users.js`, update the destructure at line 62:

```js
    const { displayName, email, privacy, avatarUrl, notificationPreferences } = req.body;
```

Insert a new merge block right after the existing privacy merge block (currently lines 100-108, ending `}` before `await user.save();`):

```js
    // Update notificationPreferences sub-fields if provided (merge, don't replace)
    if (notificationPreferences && typeof notificationPreferences === 'object') {
      const allowedNotifPrefs = ['healthReportEnabled'];
      for (const key of allowedNotifPrefs) {
        if (key in notificationPreferences) {
          user.notificationPreferences[key] = notificationPreferences[key];
        }
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest user-notification-preferences.test.js`
Expected: PASS (3 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/users.js backend/__tests__/user-notification-preferences.test.js
git commit -m "feat: allow notificationPreferences updates via PUT /api/users/me"
```

---

### Task 8: `backend/jobs/weeklyHealthReport.js`

**Files:**
- Create: `backend/jobs/weeklyHealthReport.js`
- Test: `backend/__tests__/health-report-job.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/health-report-job.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const Notification = require('../models/Notification');

// runWeeklyHealthReport() resolves Card via mongoose.model('Card') lazily at call time,
// mirroring backend/jobs/dailyPriceSnapshot.js's runDailySnapshot() (which does the same
// because Card is registered dynamically by server.js, not a requirable file). We register
// a minimal schema under the literal name 'Card' so that lookup succeeds in this test file.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

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
  await Card.deleteMany({});
  await User.deleteMany({});
  await CollectionHealthReport.deleteMany({});
  await Notification.deleteMany({});
});

const { runWeeklyHealthReport } = require('../jobs/weeklyHealthReport');

describe('runWeeklyHealthReport', () => {
  it('skips users with the preference off entirely: no report doc, no notification', async () => {
    const optedOut = await User.create({
      email: 'optedout2@test.com',
      username: 'optedout2',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: false }
    });
    await Card.create({ userId: optedOut._id, name: 'Forest', condition: 'NM', price: 0.1, quantity: 4 });

    const result = await runWeeklyHealthReport();

    expect(result.usersProcessed).toBe(0);
    expect(result.reportsCreated).toBe(0);

    const report = await CollectionHealthReport.findOne({ userId: optedOut._id });
    expect(report).toBeNull();

    const notif = await Notification.findOne({ userId: optedOut._id });
    expect(notif).toBeNull();
  });

  it('generates a report and notification for an opted-in user', async () => {
    const user = await User.create({
      email: 'optedin2@test.com',
      username: 'optedin2',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    await Card.create({ userId: user._id, name: 'Sol Ring', condition: 'DMG', price: 2, quantity: 1 });

    const result = await runWeeklyHealthReport();

    expect(result.usersProcessed).toBe(1);
    expect(result.reportsCreated).toBe(1);

    const report = await CollectionHealthReport.findOne({ userId: user._id });
    expect(report).not.toBeNull();
    expect(report.conditionBreakdown.DMG).toBe(1);
    expect(report.upgradeSuggestions.some(s => s.reason === 'poor_condition')).toBe(true);

    const notif = await Notification.findOne({ userId: user._id, type: 'collection_health_report' });
    expect(notif).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-job.test.js`
Expected: FAIL with `Cannot find module '../jobs/weeklyHealthReport'`

- [ ] **Step 3: Implement the job**

Create `backend/jobs/weeklyHealthReport.js`:

```js
const cron = require('node-cron');
const User = require('../models/User');
const ValueSnapshot = require('../models/ValueSnapshot');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { generateHealthReportForUser } = require('../utils/healthReport');
const { createHealthReportNotification } = require('../utils/notifications');

async function runWeeklyHealthReport() {
  const mongoose = require('mongoose');
  // Card model is registered by server.js before this job runs
  const Card = mongoose.model('Card');

  const started = Date.now();
  let usersProcessed = 0;
  let reportsCreated = 0;
  let errors = 0;

  console.log('[weeklyHealthReport] Starting weekly collection health report generation...');

  let users;
  try {
    users = await User.find({ 'notificationPreferences.healthReportEnabled': true }).select('_id').lean();
  } catch (err) {
    console.error('[weeklyHealthReport] Failed to load opted-in users:', err.message);
    return { usersProcessed: 0, reportsCreated: 0, errors: 1 };
  }

  for (const user of users) {
    usersProcessed++;
    try {
      const report = await generateHealthReportForUser(user._id, {
        Card, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
      });
      await createHealthReportNotification(user._id, report._id, report.valueChange);
      reportsCreated++;
    } catch (err) {
      console.error(`[weeklyHealthReport] Error for user ${user._id}:`, err.message);
      errors++;
    }
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[weeklyHealthReport] Done. Users processed: ${usersProcessed} | Reports created: ${reportsCreated} | Errors: ${errors} | Duration: ${duration}s`
  );

  return { usersProcessed, reportsCreated, errors };
}

function registerWeeklyHealthReportJob() {
  // Run at 00:10 every Sunday — offset from the existing daily price snapshot job's
  // 00:05 slot (backend/jobs/dailyPriceSnapshot.js) to avoid contention.
  cron.schedule('10 0 * * 0', () => {
    runWeeklyHealthReport().catch(err =>
      console.error('[weeklyHealthReport] Unhandled error:', err.message)
    );
  });
  console.log('[weeklyHealthReport] Weekly collection health report job registered (00:10 Sundays)');
}

module.exports = { registerWeeklyHealthReportJob, runWeeklyHealthReport };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-job.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/jobs/weeklyHealthReport.js backend/__tests__/health-report-job.test.js
git commit -m "feat: add weekly collection health report cron job"
```

---

### Task 9: `GET /api/health-report`

**Files:**
- Create: `backend/routes/healthReport.js`
- Test: `backend/__tests__/health-report-routes.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/health-report-routes.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const Notification = require('../models/Notification');

// Minimal 'Card' model registered under the real name — POST /api/admin/health-reports/run-now
// (added in Task 10) requires ../jobs/weeklyHealthReport, which resolves Card lazily via
// mongoose.model('Card'), mirroring backend/jobs/dailyPriceSnapshot.js's pattern.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health-report', require('../routes/healthReport'));
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

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
  await Card.deleteMany({});
  await User.deleteMany({});
  await CollectionHealthReport.deleteMany({});
  await Notification.deleteMany({});
});

describe('GET /api/health-report', () => {
  it('returns 404 when the user has no report yet', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'hash', role: 'user' });
    const app = buildApp();
    const res = await request(app)
      .get('/api/health-report')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);
    expect(res.status).toBe(404);
  });

  it('returns the most recent report for the authenticated user', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'hash', role: 'user' });
    await CollectionHealthReport.create({
      userId: user._id,
      weekOf: new Date('2026-06-29'),
      conditionBreakdown: { NM: 1, LP: 0, MP: 0, HP: 0, DMG: 0 },
      valueChange: { from: 100, to: 90, delta: -10, deltaPercent: -10 },
      upgradeSuggestions: []
    });
    const recent = await CollectionHealthReport.create({
      userId: user._id,
      weekOf: new Date('2026-07-06'),
      conditionBreakdown: { NM: 2, LP: 0, MP: 0, HP: 0, DMG: 0 },
      valueChange: { from: 90, to: 95, delta: 5, deltaPercent: 5.5 },
      upgradeSuggestions: []
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/health-report')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(recent._id.toString());
    expect(res.body.conditionBreakdown.NM).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-routes.test.js -t "GET /api/health-report"`
Expected: FAIL with `Cannot find module '../routes/healthReport'`

- [ ] **Step 3: Implement the route**

Create `backend/routes/healthReport.js`:

```js
const express = require('express');
const router = express.Router();
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { verifyToken, requireAuth } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireAuth);

// GET /api/health-report - fetch the current user's most recent collection health report
router.get('/', async (req, res) => {
  try {
    const report = await CollectionHealthReport.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!report) {
      return res.status(404).json({ message: 'No collection health report yet' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get health report error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-routes.test.js -t "GET /api/health-report"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/healthReport.js backend/__tests__/health-report-routes.test.js
git commit -m "feat: add GET /api/health-report endpoint"
```

---

### Task 10: `POST /api/admin/health-reports/run-now`

**Files:**
- Modify: `backend/routes/admin.js` (insert new route before `module.exports = router;` at line 2175)
- Test: `backend/__tests__/health-report-routes.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/__tests__/health-report-routes.test.js`:

```js
describe('POST /api/admin/health-reports/run-now', () => {
  it('rejects non-admin users with 403', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'hash', role: 'user' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/health-reports/run-now')
      .set('Authorization', `Bearer ${makeToken(user._id, 'user')}`);
    expect(res.status).toBe(403);
  });

  it('generates a report only for opted-in users and creates a notification, skipping opted-out users entirely', async () => {
    const optedIn = await User.create({
      email: 'optedin@test.com', username: 'optedin', passwordHash: 'hash', role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    const optedOut = await User.create({
      email: 'optedout@test.com', username: 'optedout', passwordHash: 'hash', role: 'user',
      notificationPreferences: { healthReportEnabled: false }
    });
    const admin = await User.create({ email: 'admin@test.com', username: 'admin', passwordHash: 'hash', role: 'admin' });

    await Card.create({ userId: optedIn._id, name: 'Sol Ring', condition: 'HP', price: 2, quantity: 1 });
    await Card.create({ userId: optedOut._id, name: 'Lightning Bolt', condition: 'NM', price: 1, quantity: 1 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/health-reports/run-now')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.usersProcessed).toBe(1);
    expect(res.body.reportsCreated).toBe(1);

    const optedInReport = await CollectionHealthReport.findOne({ userId: optedIn._id });
    expect(optedInReport).not.toBeNull();
    expect(optedInReport.conditionBreakdown.HP).toBe(1);

    const optedOutReport = await CollectionHealthReport.findOne({ userId: optedOut._id });
    expect(optedOutReport).toBeNull();

    const notif = await Notification.findOne({ userId: optedIn._id, type: 'collection_health_report' });
    expect(notif).not.toBeNull();

    const optedOutNotif = await Notification.findOne({ userId: optedOut._id, type: 'collection_health_report' });
    expect(optedOutNotif).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-routes.test.js -t "run-now"`
Expected: FAIL with 404 (no matching route registered)

- [ ] **Step 3: Implement the route**

In `backend/routes/admin.js`, insert immediately before `module.exports = router;` (currently the last line, 2175):

```js
/**
 * POST /api/admin/health-reports/run-now - Manually trigger weekly collection health report generation
 * Reuses the same generation function as the scheduled Sunday job (backend/jobs/weeklyHealthReport.js),
 * so admins can test the feature without waiting a week. Runs synchronously and returns the summary —
 * unlike /force-price-update above, this makes no external HTTP calls, so it's fast enough to await.
 */
router.post('/health-reports/run-now', requireAdmin, async (req, res) => {
  try {
    const { runWeeklyHealthReport } = require('../jobs/weeklyHealthReport');
    const result = await runWeeklyHealthReport();
    res.json({ message: 'Health reports generated', ...result });
  } catch (error) {
    console.error('Run health reports now error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
```

(Replace the standalone `module.exports = router;` line with the block above — the route is added just before it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest health-report-routes.test.js`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/health-report-routes.test.js
git commit -m "feat: add admin endpoint to manually trigger health report generation"
```

---

### Task 11: Wire the job and route into `server.js`

**Files:**
- Modify: `backend/server.js:20` (require), `backend/server.js:157` (mount route), `backend/server.js:3198` (register job)

This task has no new automated test — `server.js` itself has no existing test coverage in this repo (job registration for `dailyPriceSnapshot` isn't unit tested either), so this task is pure wiring with a syntax-check + manual verification step.

- [ ] **Step 1: Add the require**

In `backend/server.js`, after line 20 (`const { registerDailySnapshotJob } = require('./jobs/dailyPriceSnapshot');`), add:

```js
const { registerWeeklyHealthReportJob } = require('./jobs/weeklyHealthReport');
```

- [ ] **Step 2: Mount the route**

In `backend/server.js`, after the messages router mount (currently lines 156-157):

```js
// Mount messages routes
app.use('/api/messages', messagesRouter);
```

add:

```js

// Mount health report routes
app.use('/api/health-report', require('./routes/healthReport'));
```

- [ ] **Step 3: Register the job at startup**

In `backend/server.js`, at the end of the file (currently line 3198, right after `registerDailySnapshotJob();`), add:

```js
registerWeeklyHealthReportJob();
```

- [ ] **Step 4: Syntax-check the file**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && node --check server.js`
Expected: no output (exit code 0 — syntax is valid). This does not require a running MongoDB.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd "d:\Card Tracker\mtg-tracker\backend" && npx jest`
Expected: all suites PASS, including every `health-report-*` and `user-notification-preferences` test file from Tasks 1-10, plus all pre-existing suites (unaffected by these changes).

- [ ] **Step 6: Manual smoke test (requires a running MongoDB and the dev server)**

Start the app the way this project always does (per project convention: `start-both-servers.bat` from the repo root, or `npm run dev` inside `backend/` if you only need the API). Then, with an admin JWT (`Authorization: Bearer <token>`):

```bash
curl -X POST http://localhost:5000/api/admin/health-reports/run-now -H "Authorization: Bearer <admin-token>"
curl http://localhost:5000/api/health-report -H "Authorization: Bearer <user-token>"
```

Expected: the first call returns `{ message, usersProcessed, reportsCreated, errors }`; the second returns the generated report JSON for any user who had `notificationPreferences.healthReportEnabled: true` at the time of the run (404 otherwise). Confirm the server log shows `[weeklyHealthReport] Weekly collection health report job registered (00:10 Sundays)` on boot.

- [ ] **Step 7: Commit**

```bash
git add backend/server.js
git commit -m "feat: register weekly health report job and mount its route"
```

---

### Task 12: Frontend — `CollectionHealthReportView.js`

**Files:**
- Create: `frontend/src/components/CollectionHealthReportView.js`

No automated frontend tests exist in this repo (`frontend/src/**/*.test.js` — zero matches); this task ends with a manual verification step instead of a test run.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/CollectionHealthReportView.js`:

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, TrendingUp, TrendingDown, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import useSettings from '../hooks/useSettings';
import { API_URL } from '../config';

const CONDITION_COLORS = {
  NM: 'bg-green-500',
  LP: 'bg-lime-500',
  MP: 'bg-yellow-500',
  HP: 'bg-orange-500',
  DMG: 'bg-red-500'
};

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

function ConditionBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-12 text-white/70 flex-shrink-0">{label}</div>
      <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
        <div className={`h-4 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-14 text-white/80 text-right flex-shrink-0">{value}</div>
      <div className="w-10 text-white/40 text-right flex-shrink-0 text-xs">{pct.toFixed(0)}%</div>
    </div>
  );
}

export default function CollectionHealthReportView() {
  const navigate = useNavigate();
  const { authFetch } = useAuthContext();
  const { settings } = useSettings();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatPrice = (priceUSD) => {
    if (priceUSD == null || isNaN(priceUSD)) priceUSD = 0;
    if (settings.displayCurrency === 'CAD') return `C$${(priceUSD / settings.cadToUsdRate).toFixed(2)}`;
    if (settings.displayCurrency === 'EUR') return `€${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
    return `$${priceUSD.toFixed(2)}`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/health-report`);
        if (res.status === 404) {
          if (!cancelled) { setReport(null); setLoading(false); }
          return;
        }
        if (!res.ok) throw new Error('Failed to load collection health report');
        const data = await res.json();
        if (!cancelled) { setReport(data); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  if (loading) {
    return <div className="text-white/60 p-6">Loading collection health report...</div>;
  }

  if (error) {
    return <div className="text-red-400 p-6">{error}</div>;
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HeartPulse size={24} /> Collection Health Report
        </h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-white/70">
          No report yet. Enable "Weekly collection health report" under Account Settings → Notifications
          to receive one, or check back after the next weekly run.
        </div>
      </div>
    );
  }

  const { conditionBreakdown, valueChange, upgradeSuggestions } = report;
  const totalCards = CONDITIONS.reduce((sum, c) => sum + (conditionBreakdown[c] || 0), 0);
  const deltaPositive = valueChange.delta >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HeartPulse size={24} /> Collection Health Report
        </h1>
        <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
      <div className="text-white/50 text-sm">Week of {new Date(report.weekOf).toLocaleDateString()}</div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          {deltaPositive ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
          Value Change This Week
        </h2>
        <div className="flex items-baseline gap-3">
          <span className={`text-2xl font-bold ${deltaPositive ? 'text-green-400' : 'text-red-400'}`}>
            {deltaPositive ? '+' : ''}{formatPrice(valueChange.delta)}
          </span>
          <span className={`text-sm ${deltaPositive ? 'text-green-400' : 'text-red-400'}`}>
            ({deltaPositive ? '+' : ''}{valueChange.deltaPercent.toFixed(1)}%)
          </span>
        </div>
        <div className="text-white/40 text-xs mt-1">
          {formatPrice(valueChange.from)} → {formatPrice(valueChange.to)}
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Condition Breakdown</h2>
        <div className="space-y-2">
          {CONDITIONS.map(cond => (
            <ConditionBar
              key={cond}
              label={cond}
              value={conditionBreakdown[cond] || 0}
              total={totalCards}
              color={CONDITION_COLORS[cond]}
            />
          ))}
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" /> Worth a Look ({upgradeSuggestions.length})
        </h2>
        {upgradeSuggestions.length === 0 ? (
          <p className="text-white/50 text-sm">Nothing needs attention this week.</p>
        ) : (
          <div className="space-y-2">
            {upgradeSuggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${
                  s.reason === 'price_drop' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {s.reason === 'price_drop' ? 'Price Drop' : 'Poor Condition'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{s.name}</div>
                  <div className="text-white/40 text-xs">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CollectionHealthReportView.js
git commit -m "feat: add CollectionHealthReportView"
```

---

### Task 13: Frontend — wire the `/health-report` route into `App.js`

**Files:**
- Modify: `frontend/src/App.js:65` (lazy import, insert after), `frontend/src/App.js:875-879` (route, insert after)

- [ ] **Step 1: Add the lazy import**

In `frontend/src/App.js`, after line 65 (`const WishlistView = React.lazy(() => import('./components/WishlistView'));`), add:

```js
const CollectionHealthReportView = React.lazy(() => import('./components/CollectionHealthReportView'));
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.js`, after the `/wishlist` route block (currently lines 875-879):

```jsx
            <Route path="/wishlist" element={
              <Suspense fallback={<LoadingFallback />}>
                <WishlistView />
              </Suspense>
            } />
```

add:

```jsx

            <Route path="/health-report" element={
              <Suspense fallback={<LoadingFallback />}>
                <CollectionHealthReportView />
              </Suspense>
            } />
```

- [ ] **Step 3: Manual verification**

Run: `cd "d:\Card Tracker\mtg-tracker\frontend" && npm run build`
Expected: build succeeds (no import errors, no unused-var lint failures from `CollectionHealthReportView`). This confirms the route and lazy import compile; exercising the actual page requires a running backend with a seeded report (covered in Task 11's manual smoke test) plus visiting `http://localhost:3000/health-report` in a browser.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add /health-report route"
```

---

### Task 14: Frontend — opt-in toggle in `AccountSettings.js`

**Files:**
- Modify: `frontend/src/components/auth/AccountSettings.js`

- [ ] **Step 1: Add state**

In `frontend/src/components/auth/AccountSettings.js`, after the existing privacy state block (currently lines 13-22, ending with `const [privacyMessage, setPrivacyMessage] = useState(null);`), add:

```jsx
  // Notification preferences state — initialise from current user object
  const [notifPrefs, setNotifPrefs] = useState({
    healthReportEnabled: user?.notificationPreferences?.healthReportEnabled ?? false
  });
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
  const [notifPrefsMessage, setNotifPrefsMessage] = useState(null);
```

- [ ] **Step 2: Add the update handler**

After the existing `updatePrivacy` function (currently lines 132-147), add:

```jsx
  const updateNotifPrefs = async (changes) => {
    const next = { ...notifPrefs, ...changes };
    setNotifPrefs(next);
    setNotifPrefsLoading(true);
    setNotifPrefsMessage(null);

    const result = await updateProfile({ notificationPreferences: next });

    if (result.success) {
      setNotifPrefsMessage({ type: 'success', text: 'Notification preferences saved' });
    } else {
      setNotifPrefsMessage({ type: 'error', text: result.error || 'Failed to save notification preferences' });
    }

    setNotifPrefsLoading(false);
  };
```

- [ ] **Step 3: Add the tab**

In the tabs array (currently `{['profile', 'password', 'privacy', 'sessions', 'danger'].map((tab) => (`), add `'notifications'` after `'privacy'`:

```jsx
          {['profile', 'password', 'privacy', 'notifications', 'sessions', 'danger'].map((tab) => (
```

(The existing label logic — `{tab === 'danger' ? 'Danger Zone' : tab === 'privacy' ? 'Privacy & Sharing' : tab.charAt(0).toUpperCase() + tab.slice(1)}` — needs no change: `'notifications'` falls through to the default branch and renders as "Notifications".)

- [ ] **Step 4: Add the tab content**

After the closing `)}` of the `activeTab === 'privacy'` block (currently ending at line 417, right before `{activeTab === 'sessions' && (`), add:

```jsx
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {notifPrefsMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  notifPrefsMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {notifPrefsMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{notifPrefsMessage.text}</span>
                </div>
              )}

              <div className="p-4 bg-gray-700/50 rounded-lg space-y-1">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={14} /> Reports
                </h3>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white text-sm font-medium">Weekly collection health report</div>
                    <div className="text-white/40 text-xs">
                      Get a weekly notification summarizing condition breakdown, value change, and cards worth a look
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateNotifPrefs({ healthReportEnabled: !notifPrefs.healthReportEnabled })}
                    disabled={notifPrefsLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${notifPrefs.healthReportEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${notifPrefs.healthReportEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {notifPrefsLoading && (
                <p className="text-white/40 text-xs text-center">Saving…</p>
              )}
            </div>
          )}

```

(This reuses the `Shield`, `CheckCircle`, `AlertCircle` icons already imported at the top of the file for the `privacy` tab — no new imports needed.)

- [ ] **Step 5: Manual verification**

Run: `cd "d:\Card Tracker\mtg-tracker\frontend" && npm run build`
Expected: build succeeds. Manually verify by logging in, opening Account Settings, clicking the new "Notifications" tab, toggling the switch, and confirming (via the Network tab or backend logs) that `PUT /api/users/me` is called with `{ notificationPreferences: { healthReportEnabled: true } }` and the toggle stays on after a page refresh.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/auth/AccountSettings.js
git commit -m "feat: add weekly health report opt-in toggle to Account Settings"
```

---

### Task 15: Frontend — notification emoji + deep-link in `NotificationBell.js`

**Files:**
- Modify: `frontend/src/components/NotificationBell.js`

**Note:** No notification type currently deep-links anywhere in this codebase — `NotificationBell.js` only has mark-read and delete actions on each item today. This task adds click-to-navigate for the new `collection_health_report` type only; it does not add it for `price_alert` or other existing types (out of scope for this plan).

- [ ] **Step 1: Add the import and hook**

In `frontend/src/components/NotificationBell.js`, add to the imports at the top (line 1-3):

```jsx
import { useNavigate } from 'react-router-dom';
```

Inside the component function, after `const isOpen = openPanel === 'notifications';` (line 12), add:

```jsx
  const navigate = useNavigate();
```

- [ ] **Step 2: Add the emoji**

In the `typeEmojis` map (currently lines 14-20), add a new entry:

```jsx
  const typeEmojis = {
    mention: '💬',
    reply: '📝',
    upvote: '⬆️',
    dm: '💌',
    price_alert: '📉',
    collection_health_report: '📊'
  };
```

- [ ] **Step 3: Add the click-to-navigate branch**

In the notification list rendering, the current structure branches only on `notif.type === 'price_alert'` (lines 147-159):

```jsx
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
```

Add a new branch for `collection_health_report` between them:

```jsx
                    {notif.type === 'price_alert' ? (
                      <>
                        <div className="text-sm text-white font-medium">Price Alert</div>
                        <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                      </>
                    ) : notif.type === 'collection_health_report' ? (
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          if (!notif.isRead) handleMarkAsRead(notif._id);
                          setOpenPanel(null);
                          navigate('/health-report');
                        }}
                      >
                        <div className="text-sm text-white font-medium">Collection Health Report</div>
                        <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-white font-medium">
                          {notif.fromUserId?.displayName || 'User'} · {notif.type}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                      </>
                    )}
```

- [ ] **Step 4: Manual verification**

Run: `cd "d:\Card Tracker\mtg-tracker\frontend" && npm run build`
Expected: build succeeds. Manually verify: trigger `POST /api/admin/health-reports/run-now` for a user opted in, log in as that user, open the notification bell, confirm the `📊` entry reads "Collection Health Report", click it, and confirm it navigates to `/health-report`, marks the notification read, and closes the panel.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NotificationBell.js
git commit -m "feat: deep-link collection health report notifications to the report page"
```

---

## Summary of new/changed API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health-report` | any authenticated user | Fetch the caller's most recent `CollectionHealthReport` (404 if none) |
| POST | `/api/admin/health-reports/run-now` | admin only | Synchronously run `runWeeklyHealthReport()` for all opted-in users |
| PUT | `/api/users/me` | any authenticated user (existing route, extended) | Now also accepts `notificationPreferences: { healthReportEnabled }` |

## Summary of new Notification type

`collection_health_report` — system-generated (no `fromUserId`), carries `healthReportId`, links to `/health-report` on click.

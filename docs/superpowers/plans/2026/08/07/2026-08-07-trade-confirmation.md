# Trade Shipped/Received Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once a trade offer is accepted, both parties can confirm they shipped their cards and received the other side's — closing the trust gap where accepting a trade today immediately marks it "completed" with no tracking of whether cards actually changed hands.

**Architecture:** 4 new booleans on `TradeOffer` (`fromUserShipped`, `fromUserReceived`, `toUserShipped`, `toUserReceived`), one new backend route enforcing who can toggle which field, and a new "Shipping Status" section in `OfferCard` (`TradingBoard.js`) that's interactive for the viewer's own two fields and read-only for the other party's.

**Tech Stack:** Node/Express/Mongoose backend with Jest tests (this repo's only tested layer); React frontend with no test infrastructure (verified via `npm run build` + manual click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-trade-confirmation-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `PUT /api/trades/offers/:offerId/accept` (`backend/routes/trades.js:194-219`) is the existing pattern to follow for auth/lookup structure (`TradeOffer.findById`, check `toUserId`/`fromUserId` against `req.user._id`, `res.status(...).json(...)` error shape).
- `Notification` model's `type` enum (`backend/models/Notification.js:12`) must be extended with `'trade_fully_confirmed'` — Mongoose will reject `Notification.create()` with an unlisted enum value.
- `TradesContext.js`'s `respondToOffer(offerId, action, data)` (line 108-116) is a **generic** PUT-to-`/trades/offers/:offerId/:action` helper already used for `accept`/`reject`/`counter`/`cancel`. The new shipping-toggle route fits this exact same shape — call it as `respondToOffer(offerId, 'shipping', { field })`, no new context function needed.
- `OfferCard` is wired from two call sites in `TradingBoard.js` (lines 606-609 for `mode="received"`, lines 622-624 for `mode="sent"`) — both need a new `onUpdateShipping` prop added alongside the existing `onAccept`/`onReject`/`onCounter`/`onCancel` props.
- Backend test convention: `backend/__tests__/admin-badges-permissions.test.js` (or similar) for permission-boundary style tests — this repo's Jest suite is the only tested layer, run via `cd backend && npm test`.
- Mobile-audit convention: multi-control rows must use `flex flex-wrap`, never horizontal scroll.

---

## Task 1: Backend — schema, notification type, and the shipping route

**Files:**
- Modify: `backend/models/TradeOffer.js`
- Modify: `backend/models/Notification.js`
- Modify: `backend/routes/trades.js`
- Test: `backend/__tests__/tradeShipping.test.js` (new)

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/tradeShipping.test.js`, matching the exact boilerplate already used by `backend/__tests__/trades-matches.test.js` (same `mongodb-memory-server`/`supertest`/`buildApp()`/`makeToken()` pattern):

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TradeListing = require('../models/TradeListing');
const TradeOffer = require('../models/TradeOffer');
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
  await mongoose.connection.dropDatabase();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/trades', require('../routes/trades'));
  return app;
}

describe('PUT /api/trades/offers/:offerId/shipping', () => {
  let app, fromUser, toUser, listing;

  beforeEach(async () => {
    app = buildApp();
    fromUser = await User.create({ email: 'from@test.com', username: 'fromuser', passwordHash: 'x', role: 'user' });
    toUser = await User.create({ email: 'to@test.com', username: 'touser', passwordHash: 'x', role: 'user' });
    listing = await TradeListing.create({
      userId: toUser._id, username: 'touser', type: 'have', cardName: 'Sol Ring', status: 'completed',
    });
  });

  async function makeOffer(status) {
    return TradeOffer.create({
      listingId: listing._id,
      fromUserId: fromUser._id, fromUsername: 'fromuser',
      toUserId: toUser._id, toUsername: 'touser',
      offeredCards: [{ cardName: 'Lightning Bolt', condition: 'NM', quantity: 1 }],
      status,
    });
  }

  test('404 for a nonexistent offer', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .put(`/api/trades/offers/${fakeId}/shipping`)
      .set('Authorization', `Bearer ${makeToken(fromUser)}`)
      .send({ field: 'fromUserShipped' })
      .expect(404);
  });

  test('400 if the offer is not accepted', async () => {
    const offer = await makeOffer('pending');
    await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(fromUser)}`)
      .send({ field: 'fromUserShipped' })
      .expect(400);
  });

  test('403 if fromUser tries to toggle a toUser field', async () => {
    const offer = await makeOffer('accepted');
    await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(fromUser)}`)
      .send({ field: 'toUserShipped' })
      .expect(403);
  });

  test('403 if toUser tries to toggle a fromUser field', async () => {
    const offer = await makeOffer('accepted');
    await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(toUser)}`)
      .send({ field: 'fromUserShipped' })
      .expect(403);
  });

  test('sets the requested field to true for the authorized user', async () => {
    const offer = await makeOffer('accepted');
    const res = await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(fromUser)}`)
      .send({ field: 'fromUserShipped' })
      .expect(200);

    expect(res.body.fromUserShipped).toBe(true);
    expect(res.body.fromUserReceived).toBe(false);
    expect(res.body.toUserShipped).toBe(false);
    expect(res.body.toUserReceived).toBe(false);
  });

  test('creates one trade_fully_confirmed notification for each party when all four fields become true', async () => {
    const offer = await makeOffer('accepted');
    offer.fromUserShipped = true;
    offer.toUserReceived = true;
    offer.toUserShipped = true;
    await offer.save();

    await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(fromUser)}`)
      .send({ field: 'fromUserReceived' })
      .expect(200);

    const notifications = await Notification.find({ type: 'trade_fully_confirmed' });
    expect(notifications).toHaveLength(2);
    const toUserNotif = notifications.find(n => n.userId.toString() === toUser._id.toString());
    const fromUserNotif = notifications.find(n => n.userId.toString() === fromUser._id.toString());
    expect(toUserNotif.fromUserId.toString()).toBe(fromUser._id.toString());
    expect(fromUserNotif.fromUserId.toString()).toBe(toUser._id.toString());
  });

  test('does not create a trade_fully_confirmed notification when fewer than four fields are true', async () => {
    const offer = await makeOffer('accepted');
    offer.fromUserShipped = true;
    await offer.save();

    await request(app)
      .put(`/api/trades/offers/${offer._id}/shipping`)
      .set('Authorization', `Bearer ${makeToken(toUser)}`)
      .send({ field: 'toUserShipped' })
      .expect(200);

    const notifications = await Notification.find({ type: 'trade_fully_confirmed' });
    expect(notifications).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- tradeShipping`
Expected: FAIL — route doesn't exist yet (404s where other statuses were expected, or import/route-not-found errors).

- [ ] **Step 3: Add the four fields to `TradeOffer`**

In `backend/models/TradeOffer.js`, add alongside the existing `status`/`counterOffer` fields (after the `status` field definition, before `counterOffer`):
```js
  fromUserShipped: { type: Boolean, default: false },
  fromUserReceived: { type: Boolean, default: false },
  toUserShipped: { type: Boolean, default: false },
  toUserReceived: { type: Boolean, default: false },
```

- [ ] **Step 4: Add the new notification type**

In `backend/models/Notification.js`, change:
```js
    enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected', 'trade_countered', 'collection_health_report'],
```
to:
```js
    enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected', 'trade_countered', 'collection_health_report', 'trade_fully_confirmed'],
```

- [ ] **Step 5: Add the route**

In `backend/routes/trades.js`, add after the existing `/offers/:offerId/reject` route:

```js
const SHIPPING_FIELDS = ['fromUserShipped', 'fromUserReceived', 'toUserShipped', 'toUserReceived'];

// PUT /api/trades/offers/:offerId/shipping
router.put('/offers/:offerId/shipping', requireAuth, async (req, res) => {
  try {
    const { field } = req.body;
    if (!SHIPPING_FIELDS.includes(field)) {
      return res.status(400).json({ message: 'Invalid shipping field' });
    }

    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.status !== 'accepted') return res.status(400).json({ message: 'Offer must be accepted before confirming shipping status' });

    const isFromUser = offer.fromUserId.toString() === req.user._id.toString();
    const isToUser = offer.toUserId.toString() === req.user._id.toString();
    const isFromField = field.startsWith('fromUser');

    if ((isFromField && !isFromUser) || (!isFromField && !isToUser)) {
      return res.status(403).json({ message: 'Not authorized to confirm this field' });
    }

    offer[field] = true;
    await offer.save();

    const allConfirmed = SHIPPING_FIELDS.every(f => offer[f] === true);
    if (allConfirmed) {
      await Notification.create({
        userId: offer.toUserId,
        type: 'trade_fully_confirmed',
        fromUserId: offer.fromUserId,
        tradeOfferId: offer._id,
        content: 'Your trade has been fully confirmed by both sides!',
      });
      await Notification.create({
        userId: offer.fromUserId,
        type: 'trade_fully_confirmed',
        fromUserId: offer.toUserId,
        tradeOfferId: offer._id,
        content: 'Your trade has been fully confirmed by both sides!',
      });
    }

    res.json(offer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

Note: `isFromUser`/`isToUser` are not mutually exclusive checks against separate roles that could both be true for the same request — a given `req.user` is never both `fromUserId` and `toUserId` on the same offer (the accept/offer-creation routes already prevent offering on your own listing), so this authorization logic is safe as written.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npm test -- tradeShipping`
Expected: PASS, all 7 tests.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, no regressions (should be 603 + 7 = 610 tests, adjust expectation if the actual pre-existing count has changed since this plan was written).

- [ ] **Step 8: Commit**

```bash
git add backend/models/TradeOffer.js backend/models/Notification.js backend/routes/trades.js backend/__tests__/tradeShipping.test.js
git commit -m "feat: add trade shipped/received confirmation backend"
```

---

## Task 2: Frontend — Shipping Status section in `OfferCard`

**Files:**
- Modify: `frontend/src/components/TradingBoard.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Add the `onUpdateShipping` prop to `OfferCard`**

Change the function signature:
```js
function OfferCard({ offer, mode, onAccept, onReject, onCounter, onCancel }) {
```
to:
```js
function OfferCard({ offer, mode, onAccept, onReject, onCounter, onCancel, onUpdateShipping }) {
```

- [ ] **Step 2: Add the Shipping Status section**

Add this JSX right after the `{offer.status === 'countered' && offer.counterOffer && (...)}` block and before the `{mode === 'received' && offer.status === 'pending' && (...)}` block:

```jsx
      {offer.status === 'accepted' && (() => {
        const allConfirmed = offer.fromUserShipped && offer.fromUserReceived && offer.toUserShipped && offer.toUserReceived;
        if (allConfirmed) {
          return (
            <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs font-semibold text-center">
              ✓ Trade fully confirmed
            </div>
          );
        }
        const isSentMode = mode === 'sent';
        const fields = [
          { key: 'fromUserShipped', label: isSentMode ? 'You shipped your cards' : 'They shipped their cards', interactive: isSentMode },
          { key: 'toUserReceived', label: isSentMode ? 'They received your cards' : 'You received their cards', interactive: !isSentMode },
          { key: 'toUserShipped', label: isSentMode ? 'They shipped their cards' : 'You shipped your cards', interactive: !isSentMode },
          { key: 'fromUserReceived', label: isSentMode ? 'You received their cards' : 'They received your cards', interactive: isSentMode },
        ];
        return (
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
            <p className="text-white/60 text-xs font-semibold mb-1">Shipping Status</p>
            <div className="flex flex-wrap gap-2">
              {fields.map(({ key, label, interactive }) => (
                <label
                  key={key}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                    offer[key] ? 'bg-green-500/10 text-green-300' : 'bg-white/5 text-white/50'
                  } ${interactive && !offer[key] ? 'cursor-pointer hover:bg-white/10' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!!offer[key]}
                    disabled={!interactive || offer[key]}
                    onChange={() => onUpdateShipping(offer._id, key)}
                    className="w-3.5 h-3.5"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        );
      })()}
```

- [ ] **Step 3: Wire `onUpdateShipping` at both `OfferCard` call sites**

Change:
```jsx
              <OfferCard key={o._id} offer={o} mode="received"
                onAccept={id => respondToOffer(id, 'accept')}
                onReject={id => respondToOffer(id, 'reject')}
                onCounter={(id, data) => respondToOffer(id, 'counter', data)}
```
to:
```jsx
              <OfferCard key={o._id} offer={o} mode="received"
                onAccept={id => respondToOffer(id, 'accept')}
                onReject={id => respondToOffer(id, 'reject')}
                onCounter={(id, data) => respondToOffer(id, 'counter', data)}
                onUpdateShipping={(id, field) => respondToOffer(id, 'shipping', { field })}
```

And change:
```jsx
              <OfferCard key={o._id} offer={o} mode="sent"
                onAccept={null} onReject={null} onCounter={null}
                onCancel={id => respondToOffer(id, 'cancel')} />
```
to:
```jsx
              <OfferCard key={o._id} offer={o} mode="sent"
                onAccept={null} onReject={null} onCounter={null}
                onCancel={id => respondToOffer(id, 'cancel')}
                onUpdateShipping={(id, field) => respondToOffer(id, 'shipping', { field })} />
```

Note: `respondToOffer`'s existing implementation already refetches `offersReceived`/`offersSent` (via `fetchOffers()`) after every call, so the checkbox correctly reflects server state on the next render rather than being optimistically toggled client-side — matching the spec's explicit requirement not to optimistically flip the checkbox before the server confirms.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke test**

With the dev server running and backend from Task 1 deployed:
- Accept a trade offer (or use an already-accepted one), confirm the Shipping Status section appears with all 4 fields shown, only 2 interactive per viewer.
- In "Offers Sent" mode: check "You shipped your cards" — confirm it becomes checked/green and disabled (can't uncheck), and the other party's fields remain as before.
- Switch to viewing the same offer in "Offers Received" mode (the other party's view, or the same account's mirrored perspective if testing with one account) — confirm "They shipped their cards" now shows checked/green (reflecting the update), and the two received/shipped fields for that side are interactive.
- Check all 4 fields across both views — confirm the section collapses to the single green "✓ Trade fully confirmed" badge.
- Confirm a still-`pending`/`rejected`/`cancelled`/`countered` offer shows no Shipping Status section at all.
- At 375px width: confirm the 4-field row wraps via `flex-wrap` rather than clipping or overflowing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TradingBoard.js
git commit -m "feat: add trade shipping status UI to Trading Board offer cards"
```

---

## Task 3: Final verification

- [ ] **Step 1: Full backend test suite**

Run: `cd backend && npm test`
Expected: all pass, no regressions.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 3: End-to-end manual smoke test**

Full click-through at both mobile (375px) and desktop (1280px) widths, covering the complete flow: post a listing → make an offer → accept it → confirm shipping status from both sides → verify the fully-confirmed notification appears for both parties (check the Notifications bell for each account).

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

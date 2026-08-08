# Price & Value Features — Design Spec
**Date:** 2026-06-22

## Overview

Four related improvements to the pricing and collection value experience:

1. **Daily snapshot job** — automated nightly background job that powers everything else
2. **Card price history** — hover tooltip sparkline + click-through detail panel per card
3. **Collection value history chart** — date range picker wired to existing chart and model
4. **Price alert notifications** — existing price alerts delivered through the notification bell

All changes are confined to the backend jobs layer, two existing backend routes, and the frontend collection UI. No new data models are needed beyond a `lastAlertFiredAt` field added to the embedded `priceAlert` sub-document on the `Card` schema.

---

## Part 1: Daily Snapshot Job

**File:** `backend/jobs/dailyPriceSnapshot.js` (new)  
**Registration:** imported and started in `backend/server.js` on app startup

Uses `node-cron` (add to dependencies). Runs at **00:05 server time** daily (5 minutes past midnight to avoid contention with any other midnight jobs).

### Job sequence

Three phases run in order:

**Phase 1 — Card price snapshots**
- Fetch all cards in the collection
- For each card with a name, fetch current price from Exor Games (with Scryfall fallback) — same logic as existing `updatePrice` helper
- Write a `CardPriceHistory` record: `{ cardId, price, date }`
- Rate-limited at 500ms between cards (matching existing bulk update delay)
- Skip cards with price = 0 after fetch attempt; log skip count

**Phase 2 — Collection value snapshot**
- Sum `price × quantity` across all cards using the freshly-updated prices
- Write a `ValueSnapshot` record: `{ totalValue, cardCount, date }`
- This reuses existing snapshot logic already triggered on manual price updates

**Phase 3 — Price alert check**
- For each card snapshotted in Phase 1, query for active price alerts targeting that card
- If `currentPrice <= alert.targetPrice` AND (`alert.lastAlertFiredAt` is null OR the card's price was above target yesterday):
  - Create a `Notification` record: `{ userId: alert.userId, type: 'price_alert', cardId, cardName, targetPrice, actualPrice }`
  - Set `alert.lastAlertFiredAt = now`
- One notification per card per crossing — no spam if price stays below target for multiple days

### Logging

Console output on completion:
```
[dailySnapshot] Cards snapshotted: 142 | Skipped: 3 | Value: $1,204.50 | Alerts fired: 2 | Errors: 0 | Duration: 71.2s
```

### Error handling

- If Phase 1 fails partway through, Phase 2 uses whatever prices were already updated; job does not abort
- Individual card fetch errors are caught and counted, not thrown
- Phase 3 failure does not block Phase 1 or 2

---

## Part 2: Card Price History

### Backend

**Endpoint:** `GET /api/cards/:id/price-history?days=N`

- Queries `CardPriceHistory` for records matching `cardId` within the last `N` days
- `N` defaults to 30 if omitted; capped at 365
- Returns `{ history: [{ date: "YYYY-MM-DD", price: 1.23 }, ...] }` sorted ascending by date
- If fewer than 3 data points exist, still returns them (frontend decides whether to render)

### Frontend — Hover tooltip

Triggered by hovering the **price cell** (`<td>`) in the collection table.

- Debounced 300ms before fetch fires
- Fetches `GET /api/cards/:id/price-history?days=30`
- Renders a small popup (200×100px) above the cell:
  - Line chart of last 30 days (Recharts `<LineChart>` — already used in `ManaCurveChart`)
  - If < 3 data points: "Not enough history yet" text instead of chart
- Dismissed on mouse-leave
- Positioned with `fixed` + JS coordinates to stay inside viewport (same pattern as existing card image hover)

### Frontend — Card detail panel

Triggered by clicking anywhere on a card row (except the action buttons: $, edit, layers, zap, trash).

**File:** `frontend/src/components/CardDetailPanel.js` (new)

Slides in from the right as a fixed panel (width: 380px). Contains:

- Card name, set, condition, quantity, foil status
- Price history chart (Recharts `<LineChart>`) with 30 / 90 / 180 day toggle buttons
- Stats row: Current · 30d High · 30d Low · 30d Δ ($ and %)
- "Close" button (×) in top-right corner; clicking outside the panel also closes it

The panel fetches history fresh on open (not shared with the hover tooltip cache). Uses `days=30/90/180` based on the active toggle.

**No new route** — uses the same `GET /api/cards/:id/price-history?days=N` endpoint.

---

## Part 3: Collection Value History Chart

### Backend

Two value-history endpoints already exist: `GET /api/stats/value-history` (hardcoded 90 days, uses `ValueSnapshot`) and `GET /api/value-history` (accepts `?days=N`, uses `CardValueSnapshot`). Extend `GET /api/stats/value-history` to accept `from` and `to` query params:

**Endpoint:** `GET /api/stats/value-history?from=YYYY-MM-DD&to=YYYY-MM-DD`

- When `from`/`to` are provided, queries between those dates (inclusive); falls back to last 90 days if omitted
- `from` is clamped to the earliest `ValueSnapshot` date in the database
- Returns `{ snapshots: [{ date, totalValue, cardCount }], earliest: "YYYY-MM-DD" }`
- The `earliest` field lets the frontend disable date selection before the first available record

### Frontend

**File:** `frontend/src/components/ValueHistoryChart.js` (modify existing)

Add above the existing chart:

```
[From: ____] [To: ____]   (date inputs, defaults: 30 days ago → today)
```

- `From` input: min = `earliest` from API, max = `to` value
- `To` input: min = `from` value, max = today
- Changing either date re-fetches with new range
- Gaps in data (days before the job existed) are rendered as gaps in the line — `connectNulls={false}` in Recharts

**Below the chart — summary stats:**

| Start value | End value | Net change |
|---|---|---|
| $980.00 | $1,204.50 | +$224.50 (+22.9%) |

Net change text: green if positive, red if negative, gray if zero.

---

## Part 4: Price Alert Notifications

### Data change

The `priceAlert` sub-document is embedded directly in the `Card` schema (fields: `targetPrice`, `emailNotification`). Add one new field:

```js
priceAlert: {
  targetPrice: Number,
  emailNotification: { type: Boolean, default: false },
  lastAlertFiredAt: { type: Date, default: null }   // ← new
}
```

`lastAlertFiredAt` tracks when the bell notification last fired for this alert, enabling crossing detection. The existing `emailNotification` field and any email delivery logic are left unchanged — we're adding notification bell delivery alongside it.

### New notification type

Add `'price_alert'` to the `Notification` model's `type` enum.

Notification document shape:
```js
{
  userId,
  type: 'price_alert',
  read: false,
  data: {
    cardId,
    cardName,
    targetPrice,
    actualPrice,
  }
}
```

### Notification bell display

In the existing notification dropdown, `price_alert` notifications render as:

> **"Lightning Bolt dropped to $0.45"**  
> Your target was $0.50 · *View card*

"View card" navigates to the collection with a filter/highlight on that card (pass `?highlight=:cardId` as a query param; the collection page reads it on mount and scrolls to / highlights the row).

### Crossing logic

An alert fires when:
- `currentPrice <= targetPrice` **AND**
- `lastAlertFiredAt` is null (never fired) OR the previous day's price was > `targetPrice` (new crossing)

"Previous day's price" = the most recent `CardPriceHistory` record before today's snapshot.

This means: alert fires once when price first drops below target. If price recovers above target and drops again, it fires again. If price stays below target for 30 days, it fires exactly once.

---

## Files Changed

| File | Action | Summary |
|---|---|---|
| `backend/jobs/dailyPriceSnapshot.js` | **Create** | Nightly cron job: price snapshots, value snapshot, alert check |
| `backend/server.js` | **Modify** | Register daily job on startup; add `price_alert` to notification type enum if defined there |
| `backend/server.js` | **Modify** | Add `GET /api/cards/:id/price-history` endpoint; extend `GET /api/stats/value-history` to accept `from`/`to` params and return `earliest`; add `lastAlertFiredAt` to Card schema |
| `frontend/src/components/CardDetailPanel.js` | **Create** | Slide-in panel with price history chart and stats |
| `frontend/src/components/ValueHistoryChart.js` | **Modify** | Add date range picker, summary stats row, gap-aware line |
| `frontend/src/App.js` (or collection table) | **Modify** | Wire price cell hover tooltip; wire row click → CardDetailPanel |

---

## Out of Scope

- Mobile/responsive layout for CardDetailPanel (desktop-first)
- Price history for wishlist items
- Comparing two cards' price history
- Exporting price history data
- Alerts for price *increases* (only drops supported)
- Per-user collection value history in multi-user mode (single-user scope)

# Price-Source Health Dashboard — Design

## Summary

Track which pricing source (Scryfall, MTGGoldfish backup, or not-found) each price fetch actually resolved to, and surface it as a rolling 30-day dashboard in the admin panel — giving visibility into how often the backup source is needed and how often pricing fails outright.

## Current State (confirmed by reading the code)

- `getPriceWithFallback(cardName, isFoil)` (`backend/utils/pricing.js:80-101`) already returns `{ cad, usd, source }`, where `source` is one of `'Scryfall'`, `'MTGGoldfish (backup)'`, or `'None (not found)'`.
- Every price-fetching call site in `backend/routes/cards.js` (individual update, bulk update, import, etc.) already routes through this single function — confirmed via `grep` showing 8 call sites, all calling `getPriceWithFallback`, none calling the underlying Scryfall/MTGGoldfish logic directly.
- **The `source` value is currently discarded everywhere** — used only to decide `card.price = priceData.usd > 0 ? priceData.usd : card.price`, never persisted to the `Card` model (no `priceSource` field exists) or logged anywhere. There is zero historical data to build a dashboard from today.
- `PricingAdminTab.js` (`frontend/src/components/admin/data-pricing/`) already has an established two-section layout ("Force Price Update", "Recent Price Jobs") — this feature adds a third section in the same tab rather than a new admin tab, since it's the same pricing-operations surface.
- No existing TTL index precedent in this codebase (`grep -r expireAfterSeconds` found nothing) — this will be the first use of MongoDB's native document-expiry mechanism here, chosen because it needs no cron job or manual pruning logic to keep the log bounded.

## Data Model

New `backend/models/PriceSourceLog.js`:
```js
{
  source: { type: String, enum: ['Scryfall', 'MTGGoldfish (backup)', 'None (not found)'], required: true },
  createdAt: { type: Date, default: Date.now },
}
```
with a TTL index on `createdAt` set to 30 days (`{ expireAfterSeconds: 60 * 60 * 24 * 30 }`) — MongoDB automatically deletes documents older than 30 days on its own background sweep, keeping the collection self-pruning with no application-level cleanup job.

## Instrumentation

`getPriceWithFallback` gets one addition right before each of its three `return` statements: a fire-and-forget `PriceSourceLog.create({ source })` call (not awaited, errors caught and swallowed rather than propagated) — logging failures must never break an actual price fetch, since the log is purely observational.

## Backend Aggregation

New route: `GET /api/admin/price-source-health` (admin-only, matching this codebase's existing `requirePermission`/`requireRole` convention for other admin routes in this file group).

Returns:
```json
{
  "totalFetches": 1240,
  "bySource": {
    "Scryfall": { "count": 1100, "percentage": 88.7 },
    "MTGGoldfish (backup)": { "count": 120, "percentage": 9.7 },
    "None (not found)": { "count": 20, "percentage": 1.6 }
  },
  "dailyTrend": [
    { "date": "2026-07-09", "Scryfall": 40, "MTGGoldfish (backup)": 3, "None (not found)": 1 },
    ...
  ]
}
```
`dailyTrend` is built via a Mongo aggregation grouping by day (using `createdAt`) and by `source`, covering the full 30-day TTL window (days with zero fetches simply don't appear — the frontend fills gaps for chart continuity, not the backend).

## Frontend

New "Price Source Health" section in `PricingAdminTab.js`, after the existing "Recent Price Jobs" section:
- A stat row: total fetches (30d), and one stat per source showing count + percentage, color-coded (Scryfall = healthy/primary color, MTGGoldfish backup = a "fallback was needed" warning tone, not-found = an actual failure-red tone).
- A simple day-by-day chart (bar or line, matching whatever charting approach — inline SVG bars, following this codebase's existing convention of hand-rolled chart components rather than a charting library, e.g. `ManaCurveChart.js`/`PieChart` in `DeckDetail.js`) showing the three sources stacked or layered per day.
- Empty state: if `totalFetches === 0` (expected immediately after this ships, before any new price fetches happen), show a plain "No price fetches recorded in the last 30 days yet — this fills in as prices are updated" message instead of an empty/broken-looking chart.

## Testing

Backend: `backend/__tests__/pricing.test.js` already exists and mocks `axios` entirely with **no live database connection** (no `mongodb-memory-server` in that file). The new fire-and-forget `PriceSourceLog.create(...)` call inside `getPriceWithFallback` must not throw or produce unhandled-rejection noise when Mongoose isn't connected — this is exactly why the design specifies catching and swallowing logging errors rather than propagating them, and the implementation must verify the existing `pricing.test.js` suite still passes unmodified with this instrumentation added. New tests: a separate test file (with `mongodb-memory-server`, matching this codebase's DB-backed test convention) covering the aggregation route's percentage math and empty-state (zero logs) response shape.

Frontend: no test infrastructure in this repo — verified via `npm run build` + manual click-through, including deliberately checking the empty state (fresh deploy, zero logs) renders sensibly rather than a blank/broken chart, and mobile-width (375px) layout of the stat row and chart.

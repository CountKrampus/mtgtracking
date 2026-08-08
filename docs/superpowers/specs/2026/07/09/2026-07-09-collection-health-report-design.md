# Collection Health Report — Design

## Problem

Users have no proactive weekly summary of their collection: condition breakdown, how total value has moved, or which owned cards are worth paying attention to (poor condition, or a price drop worth acting on). Everything today is on-demand (Dashboard stats, Set Completion, etc.) — nothing pushes a periodic digest.

## Goals

- Weekly, opt-in digest per user covering: condition breakdown, value change since last week, and "worth a look" cards.
- Delivered as an in-app notification linking to a dedicated report page (not email — avoids new deliverability/template surface, richer than an email allows).
- "Worth a look" combines two signals: cards in HP/DMG condition (the user's own signal they'd want a better copy), and owned cards whose price has dropped meaningfully since the last snapshot (a good time to grab a better-condition copy cheap).
- Off by default; enabled per-user in Settings.

## Non-goals

- No email delivery in v1 (matches decision above — can be added later without changing the report-generation logic, since it's a separate delivery step).
- No cross-user comparison or leaderboard — purely personal.
- No "buy it now" links or marketplace integration — the report tells you what to look at, not where to buy it.

## Design

### Data sources (all already exist)

- **Condition breakdown**: aggregate `Card.find({userId})` grouped by `condition` (NM/LP/MP/HP/DMG) — no new storage needed, computed at generation time.
- **Value change**: `ValueSnapshot` already stores daily `{userId, value, cardCount, createdAt}` (see `backend/models/ValueSnapshot.js`, populated by the existing `dailyPriceSnapshot` job). Week-over-week diff = latest snapshot value − snapshot from ~7 days ago.
- **Price-drop signal**: `CardPriceSnapshot` already stores per-card daily prices. For each owned card, compare current `price` to its snapshot from ~7 days ago; flag if it dropped more than a threshold (e.g. 20%, floor of $1 minimum current price to avoid noise on sub-dollar cards — exact threshold is a tuning knob, not a hard requirement).
- **HP/DMG condition cards**: direct `Card.find({userId, condition: {$in: ['HP','DMG']}})`.

### New model: `CollectionHealthReport`

One document per user per week, so the report page can show the current one and (later) history without recomputing:

```js
{
  userId: ObjectId,
  weekOf: Date,               // start of the ISO week this report covers
  conditionBreakdown: { NM: Number, LP: Number, MP: Number, HP: Number, DMG: Number },
  valueChange: { from: Number, to: Number, delta: Number, deltaPercent: Number },
  upgradeSuggestions: [{
    cardId: ObjectId, name: String, reason: String,  // 'poor_condition' | 'price_drop'
    detail: String,           // e.g. "Price dropped 32% to $4.10" or "Condition: DMG"
  }],
  createdAt: Date,
}
```

### Generation job

New `backend/jobs/weeklyHealthReport.js`, following the existing `dailyPriceSnapshot.js` pattern (a `register...Job()` function called from `server.js` at startup, scheduling itself — check what scheduling mechanism `dailyPriceSnapshot` uses, e.g. `setInterval`/`node-cron`, and match it). Runs weekly (e.g. Sunday 00:10, offset from the existing daily snapshot job's 00:05 slot to avoid contention):

1. Find all users with the health-report preference enabled (see below).
2. For each, compute the four sections above and save a `CollectionHealthReport`.
3. Create an in-app `Notification` (new type `collection_health_report`, added to the `Notification` model's `type` enum) linking to the report.

A manual trigger (`POST /api/admin/health-reports/run-now`, admin-only) reuses the same generation function for testing without waiting a week.

### Opt-in preference

Reuses the existing per-user preferences pattern (like `UserColumnPreferences`): add a `healthReportEnabled: Boolean` field, default `false`. Simplest home for it: a new field on the existing `SystemSettings`-adjacent per-user settings if one already exists for user-level toggles, otherwise a small new `UserNotificationPreferences` model (check at implementation time whether a general "user preferences" doc already exists beyond `UserColumnPreferences` before creating a new collection — reuse if so). Exposed as a toggle in the frontend Settings view.

### Frontend

- New `CollectionHealthReportView.js`: condition breakdown (reuse existing chart component patterns from Dashboard), a value-change stat card (green/red delta), and a list of upgrade suggestions with reason badges.
- Settings toggle: "Weekly collection health report" checkbox, calling the preference-update endpoint.
- Notification click routes to the report view (matching how other notification types already deep-link, e.g. `price_alert` → card).

## Testing

- Unit tests for the report-computation function (condition breakdown counts, value delta math, price-drop threshold logic) with a seeded card set — no job/scheduling involved.
- Route test for the manual trigger endpoint.
- Test that users with the preference off are skipped entirely (no report doc, no notification created).

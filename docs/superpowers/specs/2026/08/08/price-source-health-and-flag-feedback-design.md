# Price-Source Health Dashboard & Price-Flag Feedback Design

## Overview

Two small, independent admin/feedback improvements that close visible gaps in the pricing pipeline's observability and user communication.

---

## Feature 1: Price-Source Health Dashboard (#56)

### Goal

Give admins a tab in the Admin Panel showing how the pricing pipeline is performing: what share of fetches hit Scryfall vs. fell back to MTGGoldfish vs. returned nothing, and how that has trended day-by-day over the last 30 days.

### What Already Exists

- `backend/models/PriceSourceLog.js` — captures every price fetch with `source` enum (`Scryfall` | `MTGGoldfish (backup)` | `None (not found)`) and `createdAt`. 30-day TTL index auto-purges old records.
- `backend/utils/pricing.js` — calls `logPriceSource(source)` after every `getPriceWithFallback()` call.
- `GET /api/admin/price-source-health` (in `backend/routes/admin.js`) — aggregates logs and returns:
  ```json
  {
    "totalFetches": 1247,
    "bySource": {
      "Scryfall":              { "count": 1100, "percentage": 88.2 },
      "MTGGoldfish (backup)":  { "count": 130,  "percentage": 10.4 },
      "None (not found)":      { "count": 17,   "percentage": 1.4  }
    },
    "dailyTrend": [
      { "date": "2026-07-10", "Scryfall": 45, "MTGGoldfish (backup)": 5, "None (not found)": 0 },
      ...
    ]
  }
  ```
- Tests in `backend/__tests__/priceSourceHealth.test.js`.
- Protected by `requirePermission('prices:force-update')`.

### What Needs Building

**`frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js`** — new component:

**Stat cards row (top):**
| Card | Value | Color |
|------|-------|-------|
| Total Fetches (30d) | `totalFetches` | purple |
| Scryfall Hit Rate | `bySource.Scryfall.percentage`% | green |
| MTGGoldfish Fallback Rate | `bySource['MTGGoldfish (backup)'].percentage`% | yellow |
| Not Found Rate | `bySource['None (not found)'].percentage`% | red if > 5%, amber if > 2%, gray otherwise |

**Daily trend table (below stat cards):**
- Columns: Date | Scryfall | MTGGoldfish | Not Found
- Rows sorted newest-first (reverse the `dailyTrend` array)
- Maximum 30 rows (backend already caps at 30 days via TTL)
- Stripe alternating rows for readability
- "Not Found" cells highlight amber when count > 0

**Wire-up in `frontend/src/components/admin/AdminPanel.js`:**
- Import `PriceSourceHealthTab`
- Add nav item `{ id: 'priceSourceHealth', label: 'Price Sources', icon: TrendingUp, requiresRole: 'moderator' }` to the Data & Pricing section
- Add `case 'priceSourceHealth': return <PriceSourceHealthTab />;` to the render switch

---

## Feature 2: Price-Flag Resolution Feedback (#44)

### Goal

When a user submits a price flag and an admin resolves or dismisses it, the user should see a meaningful notification — with the new price included when resolved — and the notification bell should show a recognizable icon.

### What Already Exists

- `PriceFlagModal.js` — already has a "My flags" section (`GET /api/cards/my-flags`) showing each flag's status (pending / resolved / dismissed). Users can see outcomes if they open the modal.
- `backend/routes/admin.js` `PUT /admin/price-flags/:id` — after resolving/dismissing, already creates a `Notification` record with type `price_flag_resolved` and a content string.
- `NotificationBell.js` — renders all notifications; falls back to `'🔔'` for unknown types.

### Gaps

1. **No emoji** for `price_flag_resolved` in `NotificationBell.typeEmojis` — shows generic bell.
2. **Resolution notification text doesn't include the new price** — user knows something happened but not what the price changed to.

### Changes

**`frontend/src/components/NotificationBell.js`:**
Add to `typeEmojis`:
```js
price_flag_resolved: '🏳️',
```

**`backend/routes/admin.js` — `PUT /admin/price-flags/:id` resolve handler:**

Currently the notification content for `resolve` is:
```
"Your price correction for {cardName} was accepted and the price has been updated."
```

Change to include the new price. After `await card.save()`, `priceData.usd` holds the refreshed price. Update the content string:
```js
const resolvedPrice = (action === 'resolve' && priceData?.usd > 0)
  ? ` — updated to $${priceData.usd.toFixed(2)}`
  : '';
const content = action === 'resolve'
  ? `Your price flag for ${cardName} was accepted${resolvedPrice}.`
  : `Your price flag for ${cardName} was reviewed and dismissed.`;
```

Note: `priceData` is already in scope from the resolve branch. In the dismiss branch it is undefined — the `resolvedPrice` expression short-circuits cleanly.

---

## Architecture Notes

- No new backend routes, models, or dependencies for either feature.
- `PriceSourceHealthTab` follows the exact same pattern as `SystemHealthTab` (fetch on mount, refresh button, stat cards, error state).
- The price-in-notification change is a two-line backend edit.

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js` | **Create** — new tab component |
| `frontend/src/components/admin/AdminPanel.js` | Add import + nav item + switch case |
| `frontend/src/components/NotificationBell.js` | Add `price_flag_resolved` emoji |
| `backend/routes/admin.js` | Include new price in resolution notification text |

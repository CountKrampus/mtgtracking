# Per-Card Price History Sparklines Design

## Goal

Show a price trend sparkline for each card in the existing hover popup. Record price history automatically whenever a card's price is updated.

## Architecture

New `CardPriceHistory` model stores one price point per card per day. A shared helper `recordPriceHistory(cardId, userId, price)` is called in all three price update paths. A new route serves the history. The existing hover popup in `App.js` fetches and renders a recharts sparkline below the card image.

## Backend

### New Model: `backend/models/CardPriceHistory.js`

```js
{
  cardId:     { type: ObjectId, ref: 'Card', required: true, index: true },
  userId:     { type: ObjectId, ref: 'User', required: true },
  price:      { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now, index: true }
}
```

Compound index on `{ cardId, recordedAt }` for fast range queries.

No unique constraint — multiple points per day are allowed (last one wins in the chart query via `$group`).

### Helper: `recordPriceHistory(cardId, userId, price)`

Defined inline in `backend/server.js` near the other price update logic:

```js
async function recordPriceHistory(cardId, userId, price) {
  if (!price || price <= 0) return;
  await CardPriceHistory.create({ cardId, userId, price });
}
```

Called after `card.save()` in:
1. `POST /api/cards/:id/update-price` (individual update)
2. `POST /api/cards/update-all-prices` (bulk cron loop)
3. `POST /api/cards` (new card added with price from Scryfall/Exor)

### New Route: `GET /api/cards/:id/price-history`

Query param: `?days=30` (default 30, max 90).

Returns one data point per day (if multiple updates on the same day, the last recorded price wins — most recent update is most accurate):

```json
[
  { "date": "2026-05-10", "price": 4.50 },
  { "date": "2026-05-11", "price": 4.75 },
  ...
]
```

Implementation: aggregate with `$match` (cardId + date range) → `$group` by date string → `$sort` by date ascending. Returns empty array if no history.

### Pruning

In the existing midnight cron job (`snapshotAllCollections`), after taking snapshots, delete records older than 90 days:

```js
await CardPriceHistory.deleteMany({ recordedAt: { $lt: new Date(Date.now() - 90 * 86400000) } });
```

## Frontend

### Hover Popup Changes (`App.js`)

The existing hover popup renders a card image when the user hovers a card name. Changes:

1. Add `priceHistory` state per hovered card: `const [priceHistory, setPriceHistory] = useState([])`.
2. When `hoveredCard` is set (mouse enters), fetch `/api/cards/${hoveredCard._id}/price-history?days=30` and set `priceHistory`.
3. Clear `priceHistory` when hover ends.
4. Below the card image in the popup, render:
   - If `priceHistory.length >= 2`: a recharts `<LineChart>` sparkline (width 220, height 60, no axes labels, just the line + a dot on the last point). Line color: green if last price ≥ first price, red if down.
   - If `priceHistory.length === 1`: "Price recorded once — check back tomorrow"
   - If `priceHistory.length === 0`: nothing (no history section shown)
5. Below the sparkline: "30-day low: $X · high: $Y" in small grey text.

### Sparkline Spec

```jsx
<LineChart width={220} height={60} data={priceHistory}>
  <Line
    type="monotone"
    dataKey="price"
    stroke={trend >= 0 ? '#4ade80' : '#f87171'}
    strokeWidth={2}
    dot={false}
  />
  <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
</LineChart>
```

`trend` = `lastPrice - firstPrice`.

recharts is already a dependency (`"recharts"` in `frontend/package.json`).

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/CardPriceHistory.js` | Create — new model |
| `backend/server.js` | Add `recordPriceHistory` helper; call it in 3 price update paths; add GET route; add pruning to midnight cron |
| `frontend/src/App.js` | Add price history fetch + sparkline to hover popup |

## Verification

1. Update a card's price → check MongoDB `cardpricehistories` collection → document exists
2. Run bulk price update → multiple history records created
3. Hover a card that has been updated at least twice → sparkline appears below card image
4. Hover a card with no history → no sparkline section shown
5. Artificially insert 91-day-old records → run cron → records deleted
6. Chart colour: manually set a card's price lower than its first history point → line renders red

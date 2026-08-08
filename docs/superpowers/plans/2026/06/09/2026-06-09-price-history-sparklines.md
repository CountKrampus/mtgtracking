# Per-Card Price History Sparklines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a price point each time a card's price is updated, then show a sparkline chart in the card image hover popup so users can see their card's price trend over time.

**Architecture:** New `CardPriceHistory` Mongoose model stores price snapshots. A `recordPriceHistory(cardId, userId, price)` helper is called in the three existing price update paths in `backend/server.js`. A new `GET /api/cards/:id/price-history` route returns aggregated daily data. The existing hover popup in `frontend/src/App.js` fetches this data on hover and renders a recharts sparkline below the card image. Pruning runs in the existing midnight cron.

**Tech Stack:** Mongoose (compound index), Node.js/Express, recharts `LineChart` (already in frontend), React hooks

---

## File Map

| File | Action |
|------|--------|
| `backend/models/CardPriceHistory.js` | Create — price history model |
| `backend/server.js` | Modify — add helper, 3 call sites, GET route, midnight pruning |
| `frontend/src/App.js` | Modify — add price history fetch + sparkline in hover popup |

---

### Task 1: Create CardPriceHistory model

**Files:**
- Create: `backend/models/CardPriceHistory.js`

- [ ] **Step 1: Create the model file**

```js
const mongoose = require('mongoose');

const cardPriceHistorySchema = new mongoose.Schema({
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  recordedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

cardPriceHistorySchema.index({ cardId: 1, recordedAt: 1 });

module.exports = mongoose.model('CardPriceHistory', cardPriceHistorySchema);
```

- [ ] **Step 2: Verify file created**

Run: `ls backend/models/CardPriceHistory.js`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add backend/models/CardPriceHistory.js
git commit -m "feat: add CardPriceHistory model for price sparklines"
```

---

### Task 2: Add recordPriceHistory helper and call sites in server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add CardPriceHistory require near the top of server.js**

Find the block of model requires near the top of `backend/server.js`. After the last `require` for a model (e.g., `CollectionSnapshot`), add:

```js
const CardPriceHistory = require('./models/CardPriceHistory');
```

- [ ] **Step 2: Add recordPriceHistory helper function**

Find the `snapshotAllCollections` function (around line 316). After the closing `}` of that function, add:

```js
async function recordPriceHistory(cardId, userId, price) {
  if (!price || price <= 0) return;
  try {
    await CardPriceHistory.create({ cardId, userId, price });
  } catch (err) {
    // Non-critical — don't let history recording failures affect price updates
    console.error('recordPriceHistory error:', err.message);
  }
}
```

- [ ] **Step 3: Call recordPriceHistory in POST /api/cards/:id/update-price**

Find the route `app.post('/api/cards/:id/update-price', ...)` in `server.js` (around line 1142). Find the `await card.save();` call inside this handler. After `await card.save();`, add:

```js
await recordPriceHistory(card._id, getUserId(req), card.price);
```

The exact location: it should come right after `card.save()` completes successfully, before the `return res.json(...)` line.

- [ ] **Step 4: Call recordPriceHistory in POST /api/cards/update-all-prices**

Find `app.post('/api/cards/update-all-prices', ...)`. Inside the loop that processes each card, find `await card.save();`. After that save, add:

```js
await recordPriceHistory(card._id, getUserId(req), card.price);
```

- [ ] **Step 5: Call recordPriceHistory in POST /api/cards (new card creation)**

Find `app.post('/api/cards', ...)`. Inside the handler, find where a new card is saved (`await newCard.save()` or `const savedCard = await card.save()`). After the save, add:

```js
if (savedCard.price > 0) {
  await recordPriceHistory(savedCard._id, getUserId(req), savedCard.price);
}
```

Use the correct variable name — if the saved card is named `card`, `newCard`, or `savedCard`, use the correct one.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js
git commit -m "feat: record price history on card create and price updates"
```

---

### Task 3: Add GET /api/cards/:id/price-history route in server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add the route**

Find the block of `/api/cards/:id` routes. After `app.delete('/api/cards/:id', ...)` (or the last card-specific route), add:

```js
// Get price history for a card (last 30 days by default, one point per day)
app.get('/api/cards/:id/price-history', requireAuth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const history = await CardPriceHistory.aggregate([
      {
        $match: {
          cardId: new mongoose.Types.ObjectId(req.params.id),
          recordedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' },
          },
          price: { $last: '$price' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', price: 1 } },
    ]);

    res.json(history);
  } catch (err) {
    console.error('Price history error:', err.message);
    res.status(500).json({ message: 'Failed to fetch price history' });
  }
});
```

- [ ] **Step 2: Add 90-day pruning to the midnight cron**

Find the `snapshotAllCollections` function. Find the `cron.schedule('0 0 * * *', snapshotAllCollections)` line (around line 338). Add a wrapper that also prunes old price history:

Replace:
```js
cron.schedule('0 0 * * *', snapshotAllCollections);
```

With:
```js
cron.schedule('0 0 * * *', async () => {
  await snapshotAllCollections();
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await CardPriceHistory.deleteMany({ recordedAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`🧹 Pruned ${result.deletedCount} old price history records`);
    }
  } catch (err) {
    console.error('Price history pruning error:', err.message);
  }
});
```

- [ ] **Step 3: Test the route manually**

Start backend: `cd backend && npm run dev`

Update a card's price (use the dollar-sign button in the UI or curl). Then:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/cards/<cardId>/price-history
```

Expected response: `[{"date":"2026-06-09","price":4.50}]` (at least one entry after a price update)

If no entries, check that `recordPriceHistory` was called — add a temporary `console.log('Recording price history for', cardId)` to verify.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: add price history GET route and midnight pruning"
```

---

### Task 4: Add sparkline to hover popup in App.js

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add priceHistory state**

Find the state declarations block in `App.js` (around line 484–490 where `hoveredCard` is defined):

```js
const [hoveredCard, setHoveredCard] = useState(null);
```

Add directly after it:
```js
const [hoveredCardPriceHistory, setHoveredCardPriceHistory] = useState([]);
```

- [ ] **Step 2: Update the card name hover handlers to fetch price history**

In `App.js`, search for where `setHoveredCard(card)` is called (the `onMouseEnter` handler on card name cells). After the `setHoveredCard(card)` call in each occurrence, add a price history fetch:

```js
setHoveredCard(card);
setHoveredCardPriceHistory([]);  // clear while loading
if (card._id) {
  axios.get(`${API_URL}/cards/${card._id}/price-history?days=30`)
    .then(r => setHoveredCardPriceHistory(r.data))
    .catch(() => setHoveredCardPriceHistory([]));
}
```

Also add `setHoveredCardPriceHistory([])` wherever `setHoveredCard(null)` is called (the `onMouseLeave` handler).

There are two hover popup blocks (one for the main collection, one for the wishlist view) — update both.

- [ ] **Step 3: Add sparkline to the collection hover popup (around line 5052)**

Find the hover popup block (around line 5051–5073):

```jsx
{/* Card Image Hover Preview */}
{hoveredCard && (hoveredCard.imageUrl || hoveredCard.customArtUrl) && (
  <div
    className="fixed z-50 pointer-events-none"
    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
  >
    <img
      src={...}
      alt={hoveredCard.name}
      className="w-80 rounded-xl shadow-2xl border-4 border-purple-500 bg-gray-900"
      onLoad={...}
      onError={...}
    />
  </div>
)}
```

Replace with:

```jsx
{/* Card Image Hover Preview */}
{hoveredCard && (hoveredCard.imageUrl || hoveredCard.customArtUrl) && (
  <div
    className="fixed z-50 pointer-events-none"
    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
  >
    <div className="bg-gray-900 rounded-xl shadow-2xl border-4 border-purple-500 overflow-hidden">
      <img
        src={
          hoveredCard.customArtUrl
            ? `${API_URL.replace('/api', '')}${hoveredCard.customArtUrl}`
            : `${API_URL.replace('/api','')}/cached-images/${hoveredCard.name.replace(/\s+/g,'_')}.png`
        }
        alt={hoveredCard.name}
        className="w-80"
        onLoad={() => {}}
        onError={(e) => { e.target.onerror = null; e.target.src = hoveredCard.imageUrl; }}
      />
      {hoveredCardPriceHistory.length >= 2 && (() => {
        const first = hoveredCardPriceHistory[0].price;
        const last = hoveredCardPriceHistory[hoveredCardPriceHistory.length - 1].price;
        const trend = last - first;
        const lineColor = trend >= 0 ? '#4ade80' : '#f87171';
        const low = Math.min(...hoveredCardPriceHistory.map(d => d.price));
        const high = Math.max(...hoveredCardPriceHistory.map(d => d.price));
        return (
          <div className="px-3 pb-3 pt-1">
            <LineChart width={280} height={60} data={hoveredCardPriceHistory}>
              <Line
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
              />
            </LineChart>
            <p className="text-xs text-white/40 text-center mt-0.5">
              30d low: ${low.toFixed(2)} · high: ${high.toFixed(2)}
            </p>
          </div>
        );
      })()}
    </div>
  </div>
)}
```

Note: `LineChart`, `Line`, and `Tooltip` are already imported from recharts at the top of `App.js` (line 3).

- [ ] **Step 4: Apply the same sparkline to the wishlist hover popup (around line 6720)**

Find the second hover popup block (around line 6720) which has `border-pink-500`. Apply the same sparkline addition as Step 3, wrapping the img in a `div.bg-gray-900` and adding the sparkline block below it. Use `border-pink-500` on the outer wrapper to keep the wishlist styling.

- [ ] **Step 5: Test sparkline rendering**

1. Update one card's price (dollar-sign button)
2. Update it a second time (now there are 2 data points for today — both will group to the same day, so we only get 1 daily point; insert a test point from yesterday directly in MongoDB to get 2 distinct days)
3. Hover over the card name — sparkline should appear below the card image

For testing with 2 data points without waiting a day, manually insert a record via MongoDB:
```js
db.cardpricehistories.insertOne({
  cardId: ObjectId("YOUR_CARD_ID"),
  userId: ObjectId("YOUR_USER_ID"),
  price: 3.00,
  recordedAt: new Date(Date.now() - 86400000) // yesterday
})
```
Then hover the card — sparkline line should now appear.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add price history sparkline to card image hover popup"
```

---

## Verification Checklist

- [ ] `CardPriceHistory` collection exists in MongoDB after first price update
- [ ] Individual price update → record appears in `cardpricehistories`
- [ ] Bulk price update → multiple records created
- [ ] `GET /api/cards/:id/price-history` returns `[{date, price}]` array
- [ ] Hover popup with 1 day of data → no sparkline (only 1 point)
- [ ] Hover popup with 2+ days of data → sparkline appears below image
- [ ] Line is green when last price ≥ first price, red when lower
- [ ] Low/high summary text appears below sparkline
- [ ] 91-day-old records are pruned by midnight cron
- [ ] No console errors in hover popup when card has no history

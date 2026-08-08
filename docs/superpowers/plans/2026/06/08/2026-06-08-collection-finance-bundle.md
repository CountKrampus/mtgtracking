# Collection & Finance Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add buylist/sell value tracking, per-card price alerts with email, art variant browser, proxy/alter flags, and custom art upload for proxy printing.

**Architecture:** Backend model additions first (Card + User), then new routes, then frontend features in dependency order. nodemailer is already installed and EMAIL_* env vars are already configured in backend/.env. multer must be installed for file uploads.

**Tech Stack:** Node.js/Express/MongoDB backend, React frontend, nodemailer (already installed), multer (needs install), Tailwind CSS, lucide-react icons.

---

## File Map

| File | Changes |
|------|---------|
| `backend/models/Card.js` | Add `alertPrice`, `alertTriggered`, `isProxy`, `isAlter`, `alterArtist`, `alterType`, `customArtUrl` |
| `backend/models/User.js` | Add `buystPercentage` |
| `backend/server.js` | Nodemailer transporter; alert check in price update routes; `GET /api/collection/variants`; custom-arts static dir; `PUT /api/cards/:id/alert`; `POST/DELETE /api/cards/:id/custom-art` |
| `backend/.gitignore` | Add `custom-arts/` |
| `frontend/src/App.js` | Sell value column + toggle; bell icon; proxy/alter columns + filter; value exclusion; buylist % setting; custom art in hover + edit form; print flow art picker |
| `frontend/src/components/ArtVariantTracker.js` | New component |
| `frontend/src/components/Sidebar.js` | Add Art Variant Tracker link |

---

### Task 1: Model Additions

**Files:**
- Modify: `backend/models/Card.js`
- Modify: `backend/models/User.js`

- [ ] **Step 1: Add fields to Card model**

Open `backend/models/Card.js`. Find the schema definition and add these fields:

```js
alertPrice: { type: Number, default: null },
alertTriggered: { type: Boolean, default: false },
isProxy: { type: Boolean, default: false },
isAlter: { type: Boolean, default: false },
alterArtist: { type: String, default: '' },
alterType: { type: String, enum: ['painted', 'extended-art', 'altered-frame', 'full-art', 'other', null], default: null },
customArtUrl: { type: String, default: null },
```

- [ ] **Step 2: Add buystPercentage to User model**

Open `backend/models/User.js`. Find where other top-level fields are (like `formats`, `bannerCard`) and add:

```js
buystPercentage: { type: Number, default: 50, min: 10, max: 90 },
```

Also add it to the `toSafeObject()` method alongside other fields:
```js
buystPercentage: this.buystPercentage ?? 50,
```

- [ ] **Step 3: Commit**

```bash
git add backend/models/Card.js backend/models/User.js
git commit -m "feat: add alertPrice, isProxy, isAlter, customArtUrl, buystPercentage to models"
```

---

### Task 2: Install multer

**Files:**
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Install multer**

```bash
cd backend
npm install multer
```

Expected: `added 1 package` or similar, no errors.

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install multer for custom art file uploads"
```

---

### Task 3: Backend — Nodemailer Setup + Price Alert Routes

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add nodemailer transporter near top of server.js**

Find the `require` block at the top of `backend/server.js` (around line 1–30) and add:

```js
const nodemailer = require('nodemailer');

const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendPriceAlertEmail(toEmail, cardName, currentPrice, alertPrice) {
  try {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject: `Price Alert: ${cardName} dropped to $${currentPrice.toFixed(2)}`,
      html: `
        <h2>Price Alert Triggered</h2>
        <p><strong>${cardName}</strong> has dropped to <strong>$${currentPrice.toFixed(2)}</strong></p>
        <p>Your alert was set at $${alertPrice.toFixed(2)}</p>
        <p><a href="http://localhost:3000">Open MTG Tracker</a></p>
      `,
    });
  } catch (err) {
    console.error('Price alert email failed:', err.message);
  }
}
```

- [ ] **Step 2: Add `PUT /api/cards/:id/alert` route**

Find the section with card routes in `backend/server.js` (around line 1020 where `POST /api/cards/:id/update-price` is). Add this route before it:

```js
app.put('/api/cards/:id/alert', requireAuth, async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, userId: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    const { alertPrice } = req.body;
    card.alertPrice = (alertPrice === null || alertPrice === undefined || alertPrice === '') ? null : Number(alertPrice);
    card.alertTriggered = false;
    await card.save();
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 3: Add alert check in `POST /api/cards/:id/update-price`**

Open `backend/server.js` and find `app.post('/api/cards/:id/update-price', ...)` (around line 1024). Inside that route, find where `card.price` is updated and `card.save()` is called. Just before `await card.save()`, add:

```js
// Price alert check
if (card.alertPrice != null) {
  if (card.price <= card.alertPrice && !card.alertTriggered) {
    card.alertTriggered = true;
    const owner = await User.findById(card.userId);
    if (owner && owner.email) {
      await sendPriceAlertEmail(owner.email, card.name, card.price, card.alertPrice);
    }
  } else if (card.price > card.alertPrice) {
    card.alertTriggered = false;
  }
}
```

- [ ] **Step 4: Add alert check in bulk update route**

Find `app.post('/api/cards/update-all-prices', ...)` (around line 1098). Inside the loop where each card's price is updated and saved, add the same alert check block (repeat the code — don't reference Task 3 Step 3):

```js
// Price alert check
if (card.alertPrice != null) {
  if (card.price <= card.alertPrice && !card.alertTriggered) {
    card.alertTriggered = true;
    const owner = await User.findById(card.userId);
    if (owner && owner.email) {
      await sendPriceAlertEmail(owner.email, card.name, card.price, card.alertPrice);
    }
  } else if (card.price > card.alertPrice) {
    card.alertTriggered = false;
  }
}
```

- [ ] **Step 5: Add `GET /api/collection/variants` route**

Add this route near other collection routes in `backend/server.js`:

```js
app.get('/api/collection/variants', requireAuth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user._id }).select('name scryfallId set').lean();
    const nameMap = {};
    cards.forEach(c => {
      const key = c.name.toLowerCase();
      if (!nameMap[key]) nameMap[key] = { name: c.name, ownedScryfallIds: [] };
      if (c.scryfallId) nameMap[key].ownedScryfallIds.push(c.scryfallId);
    });
    res.json(Object.values(nameMap));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/server.js
git commit -m "feat: add price alert routes, nodemailer setup, and collection variants endpoint"
```

---

### Task 4: Backend — Custom Art Upload Routes

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/.gitignore`

- [ ] **Step 1: Add multer setup and custom-arts static serving**

At the top of `backend/server.js` where other requires are, add:

```js
const multer = require('multer');
const path = require('path'); // may already be required — check first
```

Then find where `app.use('/cached-images', ...)` is (around line 61) and add right after it:

```js
const CUSTOM_ART_DIR = path.join(__dirname, 'custom-arts');
if (!require('fs').existsSync(CUSTOM_ART_DIR)) require('fs').mkdirSync(CUSTOM_ART_DIR, { recursive: true });
app.use('/custom-arts', cors(), express.static(CUSTOM_ART_DIR));

const customArtStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CUSTOM_ART_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}${ext}`);
  },
});
const uploadCustomArt = multer({
  storage: customArtStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});
```

- [ ] **Step 2: Add POST /api/cards/:id/custom-art route**

Add near the other card routes:

```js
app.post('/api/cards/:id/custom-art', requireAuth, (req, res, next) => {
  uploadCustomArt.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const card = await Card.findOne({ _id: req.params.id, userId: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    // Delete old custom art file if it exists
    if (card.customArtUrl) {
      const oldFile = path.join(CUSTOM_ART_DIR, path.basename(card.customArtUrl));
      require('fs').unlink(oldFile, () => {});
    }
    card.customArtUrl = `/custom-arts/${req.file.filename}`;
    await card.save();
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 3: Add DELETE /api/cards/:id/custom-art route**

```js
app.delete('/api/cards/:id/custom-art', requireAuth, async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, userId: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    if (card.customArtUrl) {
      const filePath = path.join(CUSTOM_ART_DIR, path.basename(card.customArtUrl));
      require('fs').unlink(filePath, () => {});
      card.customArtUrl = null;
      await card.save();
    }
    res.json({ message: 'Custom art removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 4: Add custom-arts/ to .gitignore**

Open `backend/.gitignore` (or root `.gitignore`) — whichever already has `cached-images/` — and add:

```
custom-arts/
```

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/.gitignore
git commit -m "feat: add custom art upload/delete routes with multer"
```

---

### Task 5: Frontend — Buylist / Sell Value

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Load buystPercentage from user settings**

In `frontend/src/App.js`, find where `settings` state is defined and initialized (search for `const [settings, setSettings]`). Add `buystPercentage: 50` to the default settings object.

Find where settings are loaded from the backend (search for `PUT /api/users/me` or `GET /api/users/me` in a useEffect). Make sure `buystPercentage` is read from the response: `buystPercentage: data.buystPercentage ?? 50`.

- [ ] **Step 2: Add Buylist % input to Settings → Pricing tab**

Find `{settingsTab === 'pricing' && (` in `frontend/src/App.js` (around line 2858). Inside that tab's JSX, add a new setting row:

```jsx
<div className="flex items-center justify-between py-3 border-b border-white/10">
  <div>
    <div className="text-white font-medium">Buylist Percentage</div>
    <div className="text-white/50 text-sm">Estimated store buylist as % of market price</div>
  </div>
  <div className="flex items-center gap-2">
    <input
      type="number"
      min="10"
      max="90"
      value={settings.buystPercentage ?? 50}
      onChange={e => {
        const val = Math.min(90, Math.max(10, Number(e.target.value)));
        setSettings(s => ({ ...s, buystPercentage: val }));
        axios.put(`${API_URL}/users/me`, { buystPercentage: val }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(console.error);
      }}
      className="w-20 bg-white/10 text-white text-center rounded px-2 py-1 border border-white/20"
    />
    <span className="text-white/50 text-sm">%</span>
  </div>
</div>
```

- [ ] **Step 3: Add Sell Value column toggle**

Find where `showInDecksColumn` toggle button is (around line 4207). Add a "Sell Value" toggle button right after it:

```jsx
<button
  onClick={() => setShowSellValueColumn(!showSellValueColumn)}
  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded border border-white/20 transition"
  title="Toggle Sell Value column (estimated buylist price)"
>
  {showSellValueColumn ? '✓ Sell Value' : 'Sell Value'}
</button>
```

Add the state near other column toggle states:
```js
const [showSellValueColumn, setShowSellValueColumn] = useState(false);
```

- [ ] **Step 4: Add Sell Value column header and cells**

Find the `<thead>` row of the card table. Near the "In Decks" header, add:
```jsx
{showSellValueColumn && <th className="px-3 py-2 text-left text-white/70 text-xs font-semibold">Sell Value</th>}
```

In each card row, add after the In Decks cell:
```jsx
{showSellValueColumn && (
  <td className="px-3 py-2 text-white/70 text-xs">
    {card.isProxy ? <span className="text-white/30">proxy</span> : `$${((card.price || 0) * ((settings.buystPercentage ?? 50) / 100)).toFixed(2)}`}
  </td>
)}
```

- [ ] **Step 5: Add Est. Sell Value to the stats panel**

Find `const { totalValue, ignoredValue } = useMemo(` (around line 2549). Update the memo to also compute `sellValue`:

```js
const { totalValue, ignoredValue, sellValue } = useMemo(() => {
  // ... existing code unchanged ...
  let sellTotal = 0;
  cards.forEach(card => {
    if (!card.isProxy && !shouldIgnore(card)) {
      sellTotal += (card.price || 0) * card.quantity * ((settings.buystPercentage ?? 50) / 100);
    }
  });
  return { totalValue: total, ignoredValue: ignored, sellValue: sellTotal };
}, [cards, locations, availableTags, settings.buystPercentage]);
```

Then find where stats cards are rendered (search for `totalValue` near the stats display area) and add:
```jsx
<div className="bg-white/10 backdrop-blur-md rounded-lg p-4 text-center">
  <div className="text-white/60 text-sm mb-1">Est. Sell Value</div>
  <div className="text-2xl font-bold text-orange-300">{formatPrice(sellValue)}</div>
  <div className="text-white/40 text-xs">{settings.buystPercentage ?? 50}% of market</div>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add buylist/sell value column and stats with configurable percentage"
```

---

### Task 6: Frontend — Price Alerts

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add alert state**

Near other card-related state in `App.js`, add:
```js
const [alertPopover, setAlertPopover] = useState(null); // { cardId, value }
```

- [ ] **Step 2: Add saveAlert handler**

```js
const saveAlert = async (cardId, alertPrice) => {
  setAlertPopover(null);
  try {
    const res = await axios.put(`${API_URL}/cards/${cardId}/alert`,
      { alertPrice: alertPrice === '' ? null : Number(alertPrice) },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
    setCards(prev => prev.map(c => c._id === cardId ? { ...c, alertPrice: res.data.alertPrice, alertTriggered: res.data.alertTriggered } : c));
  } catch (err) {
    console.error('Save alert failed:', err.message);
  }
};
```

- [ ] **Step 3: Add bell icon in Actions column**

In `frontend/src/App.js`, find the Actions column buttons for each card row (search for the dollar sign / edit pencil / trash buttons around line 4390+). Add a bell icon button:

```jsx
<button
  onClick={() => setAlertPopover(alertPopover?.cardId === card._id ? null : { cardId: card._id, value: card.alertPrice ?? '' })}
  className={`p-1 rounded transition ${card.alertTriggered ? 'text-orange-400 hover:text-orange-300' : card.alertPrice ? 'text-yellow-400 hover:text-yellow-300' : 'text-white/40 hover:text-white/70'}`}
  title={card.alertPrice ? `Alert set at $${card.alertPrice}${card.alertTriggered ? ' — TRIGGERED' : ''}` : 'Set price alert'}
>
  <Bell size={16} />
</button>
```

Make sure `Bell` is imported from `lucide-react` at the top of the file (search for the existing lucide import line and add `Bell`).

- [ ] **Step 4: Add alert popover JSX**

In the card table row (or just outside it in the same map), add the popover after the action buttons:

```jsx
{alertPopover?.cardId === card._id && (
  <div className="absolute right-16 top-0 z-50 bg-gray-900 border border-white/20 rounded-lg p-3 shadow-xl w-48">
    <div className="text-white text-xs font-medium mb-2">Price Alert</div>
    <input
      autoFocus
      type="number"
      step="0.01"
      placeholder="e.g. 5.00"
      value={alertPopover.value}
      onChange={e => setAlertPopover(a => ({ ...a, value: e.target.value }))}
      onKeyDown={e => {
        if (e.key === 'Enter') saveAlert(card._id, alertPopover.value);
        if (e.key === 'Escape') setAlertPopover(null);
      }}
      className="w-full bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20 mb-2"
    />
    <div className="flex gap-1">
      <button onClick={() => saveAlert(card._id, alertPopover.value)} className="flex-1 text-xs py-1 bg-orange-600 hover:bg-orange-700 text-white rounded">Set</button>
      <button onClick={() => saveAlert(card._id, null)} className="flex-1 text-xs py-1 bg-white/10 hover:bg-white/20 text-white rounded">Clear</button>
    </div>
  </div>
)}
```

Note: the row `<tr>` needs `className="relative"` for the absolute positioning to work — add it if not already present.

- [ ] **Step 5: Add Price Alert options to Special filter**

Find the Special filter `<select>` in `App.js` (search for `Tokens Only`). Add two new options:

```jsx
<option value="alerts-active">Price Alerts Active</option>
<option value="alerts-triggered">Alerts Triggered</option>
```

Then find the `useMemo` that applies the Special filter (search for where `specialFilter` is used in the filtering logic) and add cases:

```js
if (specialFilter === 'alerts-active') return card.alertPrice != null;
if (specialFilter === 'alerts-triggered') return card.alertPrice != null && card.price <= card.alertPrice;
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add price alert bell with email notification and filter options"
```

---

### Task 7: Frontend — Proxy / Alter Tracker

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add Proxy and Alter to value exclusion**

Find `const { totalValue, ignoredValue, sellValue } = useMemo(` (updated in Task 5). Update the `shouldIgnore` function to also exclude proxies:

```js
const shouldIgnore = (card) => {
  if (card.isProxy) return true; // proxies always excluded
  if (card.location && ignoredLocations.has(card.location)) return true;
  if (card.tags && card.tags.some(tag => ignoredTags.has(tag))) return true;
  return false;
};
```

Add a `proxyCount` to the memo return:
```js
const proxyCount = cards.filter(c => c.isProxy).length;
return { totalValue: total, ignoredValue: ignored, sellValue: sellTotal, proxyCount };
```

Then find where `totalValue` is displayed (in the stats bar or header) and add a note when `proxyCount > 0`:
```jsx
{proxyCount > 0 && <span className="text-white/40 text-xs ml-1">(excl. {proxyCount} {proxyCount === 1 ? 'proxy' : 'proxies'})</span>}
```

- [ ] **Step 2: Add Proxy / Alter columns under Extra Columns**

Find where the Extra Columns toggle shows/hides columns (search for `showExtraColumns`). The columns are in `<thead>` and in each `<tr>`. Add to `<thead>` inside the `{showExtraColumns && ...}` block:

```jsx
<th className="px-3 py-2 text-left text-white/70 text-xs font-semibold">Proxy</th>
<th className="px-3 py-2 text-left text-white/70 text-xs font-semibold">Alter</th>
```

In each card row, inside the `{showExtraColumns && ...}` block:

```jsx
<td className="px-3 py-2">
  <input
    type="checkbox"
    checked={!!card.isProxy}
    onChange={async e => {
      const updated = { ...card, isProxy: e.target.checked };
      await axios.put(`${API_URL}/cards/${card._id}`, updated, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setCards(prev => prev.map(c => c._id === card._id ? { ...c, isProxy: e.target.checked } : c));
    }}
    className="w-4 h-4 accent-purple-500"
    title="Mark as proxy (excluded from value)"
  />
</td>
<td className="px-3 py-2">
  <input
    type="checkbox"
    checked={!!card.isAlter}
    onChange={async e => {
      const updated = { ...card, isAlter: e.target.checked };
      await axios.put(`${API_URL}/cards/${card._id}`, updated, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setCards(prev => prev.map(c => c._id === card._id ? { ...c, isAlter: e.target.checked } : c));
    }}
    className="w-4 h-4 accent-blue-500"
    title="Mark as alter"
  />
</td>
```

- [ ] **Step 3: Add Proxies Only / Alters Only to Special filter**

Find the Special filter `<select>` (same place as Task 6 Step 5). Add:

```jsx
<option value="proxies">Proxies Only</option>
<option value="alters">Alters Only</option>
<option value="non-proxies">Non-Proxies Only</option>
```

Add cases in the filter logic:
```js
if (specialFilter === 'proxies') return !!card.isProxy;
if (specialFilter === 'alters') return !!card.isAlter;
if (specialFilter === 'non-proxies') return !card.isProxy;
```

- [ ] **Step 4: Add proxy/alter fields to card edit modal**

Find the card edit form/modal in `App.js` (search for `showEditModal` or the edit form JSX). After the existing condition/location fields, add:

```jsx
<div className="flex items-center gap-4 mt-3">
  <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
    <input
      type="checkbox"
      checked={!!editForm.isProxy}
      onChange={e => setEditForm(f => ({ ...f, isProxy: e.target.checked }))}
      className="w-4 h-4 accent-purple-500"
    />
    Proxy
  </label>
  <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
    <input
      type="checkbox"
      checked={!!editForm.isAlter}
      onChange={e => setEditForm(f => ({ ...f, isAlter: e.target.checked }))}
      className="w-4 h-4 accent-blue-500"
    />
    Alter
  </label>
</div>
{editForm.isAlter && (
  <div className="flex gap-3 mt-3">
    <input
      type="text"
      placeholder="Alter artist name"
      value={editForm.alterArtist || ''}
      onChange={e => setEditForm(f => ({ ...f, alterArtist: e.target.value }))}
      className="flex-1 bg-white/10 text-white rounded px-3 py-1.5 border border-white/20 text-sm placeholder-white/30"
    />
    <select
      value={editForm.alterType || ''}
      onChange={e => setEditForm(f => ({ ...f, alterType: e.target.value || null }))}
      className="bg-white/10 text-white rounded px-3 py-1.5 border border-white/20 text-sm"
    >
      <option value="">Alter type</option>
      <option value="painted">Painted</option>
      <option value="extended-art">Extended Art</option>
      <option value="altered-frame">Altered Frame</option>
      <option value="full-art">Full Art</option>
      <option value="other">Other</option>
    </select>
  </div>
)}
```

- [ ] **Step 5: Add proxy/alter fields to CSV export**

Find the CSV export function in `App.js` (search for `export/csv` or the CSV generation code). Add `isProxy`, `isAlter`, `alterArtist`, `alterType` columns.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add proxy/alter tracking with value exclusion, columns, and filters"
```

---

### Task 8: Frontend — Custom Art Upload

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add custom art badge in collection table**

In the card table, find where the card name is displayed. After the name (or as a small badge next to it), add:

```jsx
{card.customArtUrl && <span className="text-xs ml-1" title="Has custom art">🎨</span>}
```

- [ ] **Step 2: Use custom art in hover preview**

Find the hover preview logic in `App.js` (search for `hoverCard` or `imageUrl` in the hover/tooltip section). Update the image source to prefer `customArtUrl`:

```jsx
src={hoverCard.customArtUrl
  ? `${API_URL.replace('/api', '')}${hoverCard.customArtUrl}`
  : (hoverCard.imageUrl?.startsWith('/api/')
    ? `${API_URL.replace('/api', '')}${hoverCard.imageUrl}`
    : hoverCard.imageUrl)
}
```

- [ ] **Step 3: Add custom art upload to card edit form**

In the card edit form (same place as Task 7 Step 4), add after the proxy/alter section:

```jsx
<div className="mt-3">
  <div className="text-white/70 text-sm mb-2">Custom Art</div>
  {editForm.customArtUrl ? (
    <div className="flex items-center gap-3">
      <img
        src={`${API_URL.replace('/api', '')}${editForm.customArtUrl}`}
        alt="Custom art"
        className="w-16 h-20 object-cover rounded border border-white/20"
      />
      <button
        onClick={async () => {
          await axios.delete(`${API_URL}/cards/${editForm._id}/custom-art`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
          setEditForm(f => ({ ...f, customArtUrl: null }));
          setCards(prev => prev.map(c => c._id === editForm._id ? { ...c, customArtUrl: null } : c));
        }}
        className="text-sm px-3 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded transition"
      >
        Remove
      </button>
    </div>
  ) : (
    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded border border-white/20 transition">
      <span>Upload Custom Art</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async e => {
          const file = e.target.files[0];
          if (!file) return;
          const formData = new FormData();
          formData.append('image', file);
          try {
            const res = await axios.post(`${API_URL}/cards/${editForm._id}/custom-art`, formData, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' }
            });
            setEditForm(f => ({ ...f, customArtUrl: res.data.customArtUrl }));
            setCards(prev => prev.map(c => c._id === editForm._id ? { ...c, customArtUrl: res.data.customArtUrl } : c));
          } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
          }
        }}
      />
    </label>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add custom art upload/display in card edit form and hover preview"
```

---

### Task 9: Frontend — Proxy Art Generator (Print Flow)

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add print art override state**

Near other print-related state (`showPrintPreview`), add:

```js
const [printArtOverrides, setPrintArtOverrides] = useState({}); // cardId → imageUrl
const [artPickerCard, setArtPickerCard] = useState(null); // { card, printings }
const [loadingArtPicker, setLoadingArtPicker] = useState(false);
```

- [ ] **Step 2: Add openArtPicker handler**

```js
const openArtPicker = async (card) => {
  setLoadingArtPicker(true);
  setArtPickerCard({ card, printings: [] });
  try {
    const res = await axios.get(
      `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(card.name)}"&unique=prints&order=released`
    );
    setArtPickerCard({ card, printings: res.data.data || [] });
  } catch (err) {
    setArtPickerCard({ card, printings: [] });
  } finally {
    setLoadingArtPicker(false);
  }
};
```

- [ ] **Step 3: Enhance print preview with "Change Art" button per card**

Find the print preview loop (around line 4942 — `getSelectedCardsForPrint().slice(...).map((card, cardIndex) => (`). Wrap the existing card div in a `<div className="relative">` and add a "Change Art" button overlay:

```jsx
<div key={card._id} className="relative">
  <button
    onClick={() => openArtPicker(card)}
    className="absolute top-1 right-1 z-10 text-xs px-1.5 py-0.5 bg-black/70 hover:bg-black text-white rounded print:hidden"
    title="Choose art for printing"
  >
    🎨
  </button>
  <div
    className="proxy-card flex items-center justify-center bg-gray-100 rounded overflow-hidden"
    style={{ width: '2.5in', height: '3.5in' }}
  >
    {/* Use override art, or custom art, or default image */}
    {(() => {
      const artUrl = printArtOverrides[card._id]
        || (card.customArtUrl ? `${API_URL.replace('/api', '')}${card.customArtUrl}` : null)
        || (card.imageUrl?.startsWith('/api/') ? `${API_URL.replace('/api', '')}${card.imageUrl}` : card.imageUrl);
      
      if (artUrl) {
        return (
          <img
            src={artUrl}
            alt={card.name}
            className="w-full h-full object-contain"
            style={{ maxWidth: '2.5in', maxHeight: '3.5in' }}
            loading="lazy"
          />
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-300 text-gray-600 p-2 text-center">
          <div className="text-sm font-bold mb-1">{card.name}</div>
          <div className="text-xs">{card.set}</div>
          <div className="text-xs mt-2 text-gray-500">No image available</div>
        </div>
      );
    })()}
  </div>
</div>
```

Also add a "Clear All Art Overrides" button in the print preview header:
```jsx
{Object.keys(printArtOverrides).length > 0 && (
  <button
    onClick={() => setPrintArtOverrides({})}
    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded transition"
  >
    Clear Art Overrides
  </button>
)}
```

- [ ] **Step 4: Add art picker modal**

After the print preview modal JSX (after the `{showPrintPreview && (...)}` block), add:

```jsx
{artPickerCard && (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 print:hidden">
    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-white/20 max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Choose Art — {artPickerCard.card.name}</h3>
        <button onClick={() => setArtPickerCard(null)} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
      </div>
      {loadingArtPicker ? (
        <div className="text-white/60 text-center py-8">Loading printings...</div>
      ) : artPickerCard.printings.length === 0 ? (
        <div className="text-white/60 text-center py-8">No printings found.</div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-4 gap-3">
            {artPickerCard.printings.map(printing => {
              const imgUrl = printing.image_uris?.normal || printing.card_faces?.[0]?.image_uris?.normal;
              if (!imgUrl) return null;
              const isSelected = printArtOverrides[artPickerCard.card._id] === imgUrl;
              return (
                <div
                  key={printing.id}
                  onClick={() => {
                    setPrintArtOverrides(o => ({ ...o, [artPickerCard.card._id]: imgUrl }));
                    setArtPickerCard(null);
                  }}
                  className={`cursor-pointer rounded-lg overflow-hidden border-2 transition ${isSelected ? 'border-purple-400' : 'border-transparent hover:border-white/40'}`}
                >
                  <img src={imgUrl} alt={printing.name} className="w-full" />
                  <div className="bg-gray-800 px-2 py-1">
                    <div className="text-white text-xs font-medium truncate">{printing.set_name}</div>
                    <div className="text-white/50 text-xs">{printing.set.toUpperCase()} · {printing.collector_number}</div>
                    {printing.prices?.usd && <div className="text-green-400 text-xs">${printing.prices.usd}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            setPrintArtOverrides(o => { const n = { ...o }; delete n[artPickerCard.card._id]; return n; });
            setArtPickerCard(null);
          }}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
        >
          Use Default Art
        </button>
        <button onClick={() => setArtPickerCard(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm ml-auto">
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Reset print art state when closing print preview**

Find `onClick={() => setShowPrintPreview(false)}` (the Close button in print preview). Update it to also clear overrides:

```jsx
onClick={() => { setShowPrintPreview(false); setPrintArtOverrides({}); setArtPickerCard(null); }}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add art picker to proxy print flow with Scryfall printings and custom art"
```

---

### Task 10: Frontend — Art Variant Tracker Component + Sidebar

**Files:**
- Create: `frontend/src/components/ArtVariantTracker.js`
- Modify: `frontend/src/components/Sidebar.js`

- [ ] **Step 1: Create ArtVariantTracker.js**

Create `frontend/src/components/ArtVariantTracker.js`:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

export default function ArtVariantTracker({ onClose }) {
  const [cardNames, setCardNames] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [printingsCache, setPrintingsCache] = useState({});
  const [loadingCard, setLoadingCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToWishlist, setAddingToWishlist] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API_URL}/collection/variants`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCardNames(r.data || []))
      .catch(() => setError('Failed to load collection.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleCard = async (entry) => {
    const key = entry.name.toLowerCase();
    if (expanded[key]) {
      setExpanded(e => ({ ...e, [key]: false }));
      return;
    }
    setExpanded(e => ({ ...e, [key]: true }));
    if (printingsCache[key]) return;
    setLoadingCard(key);
    try {
      const res = await axios.get(
        `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(entry.name)}"&unique=prints&order=released`
      );
      setPrintingsCache(c => ({ ...c, [key]: res.data.data || [] }));
    } catch {
      setPrintingsCache(c => ({ ...c, [key]: [] }));
    } finally {
      setLoadingCard(null);
    }
  };

  const addToWishlist = async (printing, cardName) => {
    const key = printing.id;
    setAddingToWishlist(a => ({ ...a, [key]: true }));
    try {
      const token = localStorage.getItem('token');
      const imgUrl = printing.image_uris?.normal || printing.card_faces?.[0]?.image_uris?.normal;
      await axios.post(`${API_URL}/wishlist`, {
        name: cardName,
        scryfallId: printing.id,
        imageUrl: imgUrl,
        targetPrice: printing.prices?.usd ? parseFloat(printing.prices.usd) : 0,
        quantity: 1,
        priority: 'medium',
        notes: `${printing.set_name} (${printing.set.toUpperCase()}) #${printing.collector_number}`,
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Added ${cardName} (${printing.set_name}) to wishlist!`);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAddingToWishlist(a => ({ ...a, [key]: false }));
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-white/60">Loading collection...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/20">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Art Variant Tracker</h2>
            <p className="text-white/50 text-sm mt-1">{cardNames.length} unique cards — click to see all printings</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-3xl leading-none">×</button>
        </div>
        {error && <div className="text-red-400 text-sm p-4">{error}</div>}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {cardNames.map(entry => {
            const key = entry.name.toLowerCase();
            const isExpanded = expanded[key];
            const printings = printingsCache[key] || [];
            const owned = printings.filter(p => entry.ownedScryfallIds.includes(p.id));
            const missing = printings.filter(p => !entry.ownedScryfallIds.includes(p.id));

            return (
              <div key={key} className="bg-white/5 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCard(entry)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 transition text-left"
                >
                  <span className="text-white font-medium">{entry.name}</span>
                  <div className="flex items-center gap-3">
                    {printings.length > 0 && (
                      <span className="text-white/50 text-xs">
                        {owned.length}/{printings.length} owned · {missing.length} missing
                      </span>
                    )}
                    <span className="text-white/40">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {loadingCard === key ? (
                      <div className="text-white/50 text-sm py-4 text-center">Loading printings...</div>
                    ) : printings.length === 0 ? (
                      <div className="text-white/50 text-sm py-4 text-center">No printings found.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {printings.map(printing => {
                          const isOwned = entry.ownedScryfallIds.includes(printing.id);
                          const imgUrl = printing.image_uris?.small || printing.card_faces?.[0]?.image_uris?.small;
                          return (
                            <div key={printing.id} className={`rounded-lg overflow-hidden border-2 ${isOwned ? 'border-green-500/60' : 'border-white/10'}`}>
                              {imgUrl && <img src={imgUrl} alt={printing.name} className="w-full" loading="lazy" />}
                              <div className="bg-gray-800 p-2">
                                <div className="text-white text-xs font-medium truncate">{printing.set_name}</div>
                                <div className="text-white/50 text-xs">{printing.set.toUpperCase()} · #{printing.collector_number}</div>
                                {printing.prices?.usd && <div className="text-green-400 text-xs">${printing.prices.usd}</div>}
                                {isOwned
                                  ? <div className="text-green-400 text-xs font-bold mt-1">✓ Owned</div>
                                  : (
                                    <button
                                      onClick={() => addToWishlist(printing, entry.name)}
                                      disabled={addingToWishlist[printing.id]}
                                      className="mt-1 w-full text-xs py-0.5 bg-pink-600/50 hover:bg-pink-600 text-white rounded transition disabled:opacity-50"
                                    >
                                      {addingToWishlist[printing.id] ? '...' : '+ Wishlist'}
                                    </button>
                                  )
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire ArtVariantTracker into App.js**

In `frontend/src/App.js`:

Add import near other component imports (or where other components are used inline — check the pattern):
```js
import ArtVariantTracker from './components/ArtVariantTracker';
```

Add state:
```js
const [showArtVariants, setShowArtVariants] = useState(false);
```

Add render (near other full-screen modal renders like `showSetCompletion`):
```jsx
{showArtVariants && <ArtVariantTracker onClose={() => setShowArtVariants(false)} />}
```

- [ ] **Step 3: Add Art Variants link to Sidebar**

Open `frontend/src/components/Sidebar.js`. Find the Tools section (search for `'ReprintTracker'` or `'SetReleaseCalendar'` or similar Tools navigation items). Add an "Art Variants" item following the exact same pattern used for other tool links:

```js
{ id: 'artVariants', label: 'Art Variants', icon: Palette, description: 'Browse all printings you\'re missing' }
```

Make sure `Palette` is imported from `lucide-react`. In the click handler for navigation items, add:
```js
if (item.id === 'artVariants') { onNavigate('artVariants'); }
```

Then in `App.js`, handle `artVariants` navigation by setting `setShowArtVariants(true)`.

Read `Sidebar.js` and `App.js` carefully to match the exact navigation pattern already in use before implementing this step.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ArtVariantTracker.js frontend/src/App.js frontend/src/components/Sidebar.js
git commit -m "feat: add Art Variant Tracker component with Scryfall printings browser"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Buylist % setting in Pricing tab → Task 5
- ✅ Sell Value hidden column → Task 5
- ✅ Est. Sell Value stat → Task 5
- ✅ alertPrice + alertTriggered on Card model → Task 1
- ✅ PUT /api/cards/:id/alert route → Task 3
- ✅ Alert check in price update routes (single + bulk) → Task 3
- ✅ Email via nodemailer → Task 3
- ✅ Bell icon in Actions column → Task 6
- ✅ Alert popover → Task 6
- ✅ Price Alerts Active / Alerts Triggered filters → Task 6
- ✅ GET /api/collection/variants → Task 3
- ✅ ArtVariantTracker.js component → Task 10
- ✅ Sidebar Tools link → Task 10
- ✅ isProxy/isAlter/alterArtist/alterType on Card → Task 1
- ✅ Proxy/Alter columns under Extra Columns → Task 7
- ✅ Proxy/Alter in edit form → Task 7
- ✅ Proxies Only / Alters Only filter → Task 7
- ✅ Value exclusion for proxies → Task 7
- ✅ CSV export additions → Task 7
- ✅ customArtUrl on Card model → Task 1
- ✅ custom-arts/ directory + static serving → Task 4
- ✅ POST/DELETE /api/cards/:id/custom-art → Task 4
- ✅ Custom art in hover preview → Task 8
- ✅ Upload in edit form + remove button → Task 8
- ✅ 🎨 badge in collection table → Task 8
- ✅ Art picker in print flow → Task 9
- ✅ Custom art pre-selected in print flow → Task 9

**No placeholders found.**

**Type consistency:** `card.customArtUrl`, `card.isProxy`, `card.alertPrice`, `card.alertTriggered` used consistently. `printArtOverrides` keyed by `card._id` throughout Task 9.

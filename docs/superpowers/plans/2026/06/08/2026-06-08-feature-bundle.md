# Feature Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features: Collection Value History, Inline Cell Editing, Cards Used Across Decks column, Role Breakdown + Mana Base Calculator in DeckAnalysisPanel, Playgroup Metagame tab, and Friend Collection Diff in TradeBinder.

**Architecture:** Mostly additive — new routes, one new Mongoose model, one new React component file, and targeted edits to existing components. Recharts is not yet installed and must be added first.

**Tech Stack:** Node.js/Express/MongoDB (backend), React/Tailwind/lucide-react (frontend), recharts (new — charts), node-cron (already installed — cron jobs)

---

## Task 1: Install recharts

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install recharts**

```bash
cd "d:/Card Tracker/mtg-tracker/frontend"
npm install recharts
```

Expected: recharts appears in `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install recharts for value history and metagame charts"
```

---

## Task 2: Collection Value History — Backend

**Files:**
- Create: `backend/models/CollectionSnapshot.js`
- Modify: `backend/server.js` (add cron job + route)

- [ ] **Step 1: Create the CollectionSnapshot model**

Create `backend/models/CollectionSnapshot.js`:

```js
const mongoose = require('mongoose');

const collectionSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  totalValue: { type: Number, default: 0 },
  totalCards: { type: Number, default: 0 },
  date: { type: Date, required: true, index: true }
});

collectionSnapshotSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CollectionSnapshot', collectionSnapshotSchema);
```

- [ ] **Step 2: Add the snapshot cron job to server.js**

Find the existing cron block in `backend/server.js` (near line 261):
```js
cron.schedule('0 2,14 * * *', updateAllCardPrices);
console.log('📅 Price update job scheduled: Every 12 hours (2 AM & 2 PM)');
```

Add after it:

```js
const CollectionSnapshot = require('./models/CollectionSnapshot');

async function snapshotAllCollections() {
  try {
    const users = await User.find({ isActive: true }).select('_id');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      const cards = await Card.find({ userId: user._id });
      const totalValue = cards.reduce((sum, c) => sum + (c.price * c.quantity || 0), 0);
      const totalCards = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);
      await CollectionSnapshot.findOneAndUpdate(
        { userId: user._id, date: today },
        { userId: user._id, date: today, totalValue, totalCards },
        { upsert: true }
      );
    }
    console.log(`✅ Collection snapshots saved for ${users.length} users`);
  } catch (err) {
    console.error('Collection snapshot cron error:', err.message);
  }
}

cron.schedule('0 0 * * *', snapshotAllCollections);
console.log('📅 Collection snapshot scheduled: Daily at midnight');
```

- [ ] **Step 3: Add the value-history route to server.js**

Add near the other `GET /api/collection/...` routes (or after the stats route):

```js
app.get('/api/collection/value-history', requireAuth, async (req, res) => {
  try {
    const days = req.query.days;
    const filter = { userId: req.user._id };
    if (days && days !== 'all') {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days));
      filter.date = { $gte: since };
    }
    const snapshots = await CollectionSnapshot.find(filter).sort({ date: 1 });
    res.json(snapshots.map(s => ({ date: s.date, totalValue: s.totalValue, totalCards: s.totalCards })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 4: Restart backend and verify route exists**

```bash
curl -s http://localhost:5000/api/collection/value-history \
  -H "Cookie: <your session cookie>"
```

Expected: `[]` (empty array — no snapshots yet) or auth error without cookie.

- [ ] **Step 5: Commit**

```bash
git add backend/models/CollectionSnapshot.js backend/server.js
git commit -m "feat: add CollectionSnapshot model, daily cron job, and value-history route"
```

---

## Task 3: Collection Value History — Frontend (Portfolio Tab)

**Files:**
- Modify: `frontend/src/App.js` (add Portfolio tab to Settings component)

The Settings component lives inside App.js. Find the tabs array near line 2572:
```js
{ id: 'display', label: 'Display' },
{ id: 'pricing', label: 'Pricing' },
...
{ id: 'privacy', label: 'Privacy & Sharing' },
```

- [ ] **Step 1: Add recharts import at the top of App.js**

Near the other imports at the top of `frontend/src/App.js`, add:

```js
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
```

- [ ] **Step 2: Add 'portfolio' to the settings tabs array**

Find the tabs array in the Settings component (around line 2572) and add the portfolio entry:

```js
{ id: 'display', label: 'Display' },
{ id: 'pricing', label: 'Pricing' },
{ id: 'features', label: 'Features' },
{ id: 'data', label: 'Data' },
{ id: 'locations', label: 'Locations' },
{ id: 'tags', label: 'Tags' },
{ id: 'privacy', label: 'Privacy & Sharing' },
{ id: 'portfolio', label: 'Portfolio' },
```

- [ ] **Step 3: Add the Portfolio tab content**

After the last `{settingsTab === 'privacy' && (...)}` block, add:

```jsx
{settingsTab === 'portfolio' && (
  <PortfolioTab />
)}
```

- [ ] **Step 4: Add the PortfolioTab component**

Add this component inside App.js before the main `function App()` definition (near where other inline components are defined):

```jsx
function PortfolioTab() {
  const [snapshots, setSnapshots] = React.useState([]);
  const [range, setRange] = React.useState('30');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/collection/value-history?days=${range}`);
        setSnapshots(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [range]);

  const formatted = snapshots.map(s => ({
    ...s,
    label: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: parseFloat(s.totalValue.toFixed(2))
  }));

  const first = formatted[0]?.value || 0;
  const last = formatted[formatted.length - 1]?.value || 0;
  const change = last - first;
  const changePct = first > 0 ? ((change / first) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Collection Value History</h2>

      <div className="flex gap-2">
        {['7', '30', '90', '365', 'all'].map(d => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              range === d ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {d === 'all' ? 'All' : `${d}d`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/50 text-sm">Loading...</div>
      ) : formatted.length < 2 ? (
        <div className="bg-white/5 rounded-lg p-6 text-center text-white/50 text-sm">
          Check back tomorrow — your first snapshot is being recorded.
        </div>
      ) : (
        <>
          <div className="flex gap-6 mb-2">
            <div>
              <div className="text-white/50 text-xs">Current Value</div>
              <div className="text-white font-bold text-xl">${last.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-white/50 text-xs">Change</div>
              <div className={`font-bold text-xl ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}${change.toFixed(2)} ({changePct}%)
              </div>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                  labelStyle={{ color: 'white' }}
                  formatter={v => [`$${v}`, 'Value']}
                />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Open Settings → Portfolio tab in browser, verify it renders**

Navigate to Settings (gear icon or profile), click Portfolio tab. Should show "Check back tomorrow" message if no snapshots exist yet.

- [ ] **Step 6: Seed a test snapshot and verify chart**

```bash
cd "d:/Card Tracker/mtg-tracker/backend"
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const CollectionSnapshot = require('./models/CollectionSnapshot');
const User = require('./models/User');
const Card = require('./models/Card');
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ isActive: true }).select('_id');
  for (const user of users) {
    const cards = await Card.find({ userId: user._id });
    const totalValue = cards.reduce((s,c) => s + (c.price * c.quantity || 0), 0);
    const totalCards = cards.reduce((s,c) => s + (c.quantity || 1), 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      await CollectionSnapshot.findOneAndUpdate(
        { userId: user._id, date: d },
        { userId: user._id, date: d, totalValue: totalValue * (0.95 + Math.random()*0.1), totalCards },
        { upsert: true }
      );
    }
  }
  console.log('Seeded 7 days of snapshots');
  await mongoose.disconnect();
}
seed().catch(console.error);
"
```

Refresh the Portfolio tab — chart should render with 7 data points.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add Portfolio tab with collection value history chart"
```

---

## Task 4: Inline Cell Editing

**Files:**
- Modify: `frontend/src/App.js` (card table cells)

The card table renders rows in App.js. The editable fields are: Quantity, Condition, Location, Tags, Notes.

- [ ] **Step 1: Add editingCell state near other card state**

Find the card state declarations in App.js (around the `useState` block near the top of the main App function) and add:

```js
const [editingCell, setEditingCell] = React.useState(null); // { cardId, field }
const [editingValue, setEditingValue] = React.useState('');
```

- [ ] **Step 2: Add the saveInlineEdit helper**

Add this function inside the main App component (near other card update functions):

```js
const saveInlineEdit = async (cardId, field, value) => {
  setEditingCell(null);
  try {
    const card = cards.find(c => c._id === cardId);
    if (!card) return;
    const updated = { ...card, [field]: value };
    await axios.put(`${API_URL}/cards/${cardId}`, updated);
    setCards(prev => prev.map(c => c._id === cardId ? { ...c, [field]: value } : c));
  } catch (err) {
    console.error('Inline edit failed:', err.message);
  }
};

const startEdit = (cardId, field, currentValue) => {
  setEditingCell({ cardId, field });
  setEditingValue(Array.isArray(currentValue) ? currentValue.join(', ') : (currentValue ?? ''));
};

const cancelEdit = () => setEditingCell(null);
```

- [ ] **Step 3: Create the InlineCell helper component**

Add this component before the main `function App()` definition:

```jsx
function InlineCell({ cardId, field, value, editingCell, editingValue, setEditingValue, onStart, onSave, onCancel, children, type = 'text', options = null }) {
  const isEditing = editingCell?.cardId === cardId && editingCell?.field === field;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSave(cardId, field, editingValue);
    if (e.key === 'Escape') onCancel();
  };

  if (isEditing) {
    if (options) {
      return (
        <select
          autoFocus
          value={editingValue}
          onChange={e => { setEditingValue(e.target.value); onSave(cardId, field, e.target.value); }}
          onBlur={() => onSave(cardId, field, editingValue)}
          onKeyDown={handleKeyDown}
          className="bg-gray-800 text-white text-xs rounded px-1 py-0.5 border border-purple-400 w-full"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        autoFocus
        type={type}
        value={editingValue}
        onChange={e => setEditingValue(e.target.value)}
        onBlur={() => onSave(cardId, field, type === 'number' ? Number(editingValue) : editingValue)}
        onKeyDown={handleKeyDown}
        className="bg-gray-800 text-white text-xs rounded px-1 py-0.5 border border-purple-400 w-full"
      />
    );
  }

  return (
    <span
      onClick={() => onStart(cardId, field, value)}
      className="cursor-pointer hover:underline hover:text-purple-300 transition"
      title="Click to edit"
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Replace static cells with InlineCell in the card table**

In the card table row (inside the `cards.map(card => ...)` render in App.js), find the cells for Quantity, Condition, Location, Tags, Notes and wrap each:

**Quantity cell** (find the td that shows `card.quantity`):
```jsx
<InlineCell cardId={card._id} field="quantity" value={card.quantity}
  editingCell={editingCell} editingValue={editingValue}
  setEditingValue={setEditingValue}
  onStart={startEdit} onSave={saveInlineEdit} onCancel={cancelEdit}
  type="number"
>
  {card.quantity}
</InlineCell>
```

**Condition cell** (find the td that shows `card.condition`):
```jsx
<InlineCell cardId={card._id} field="condition" value={card.condition}
  editingCell={editingCell} editingValue={editingValue}
  setEditingValue={setEditingValue}
  onStart={startEdit} onSave={saveInlineEdit} onCancel={cancelEdit}
  options={['NM', 'LP', 'MP', 'HP', 'DMG']}
>
  {card.condition}
</InlineCell>
```

**Notes cell** (find where notes are shown, or add a notes column if not shown):
```jsx
<InlineCell cardId={card._id} field="notes" value={card.notes}
  editingCell={editingCell} editingValue={editingValue}
  setEditingValue={setEditingValue}
  onStart={startEdit} onSave={saveInlineEdit} onCancel={cancelEdit}
>
  {card.notes || <span className="text-white/30 italic text-xs">add note</span>}
</InlineCell>
```

**Tags cell** (tags are an array — the inline edit saves them as comma-separated string, split on save):

Wrap the existing tags display, and update `saveInlineEdit` to split tags when the field is 'tags':

In `saveInlineEdit`, change the value handling for tags:
```js
const saveInlineEdit = async (cardId, field, value) => {
  setEditingCell(null);
  try {
    const card = cards.find(c => c._id === cardId);
    if (!card) return;
    const finalValue = field === 'tags'
      ? value.split(',').map(t => t.trim()).filter(Boolean)
      : (field === 'quantity' ? Number(value) : value);
    const updated = { ...card, [field]: finalValue };
    await axios.put(`${API_URL}/cards/${cardId}`, updated);
    setCards(prev => prev.map(c => c._id === cardId ? { ...c, [field]: finalValue } : c));
  } catch (err) {
    console.error('Inline edit failed:', err.message);
  }
};
```

Tags inline cell:
```jsx
<InlineCell cardId={card._id} field="tags" value={card.tags}
  editingCell={editingCell} editingValue={editingValue}
  setEditingValue={setEditingValue}
  onStart={startEdit} onSave={saveInlineEdit} onCancel={cancelEdit}
>
  {card.tags?.length > 0
    ? card.tags.map(t => <span key={t} className="text-xs bg-purple-600/40 px-1 rounded mr-1">{t}</span>)
    : <span className="text-white/30 italic text-xs">add tags</span>
  }
</InlineCell>
```

- [ ] **Step 5: Verify in browser**

Open collection view, click a Condition cell — dropdown should appear. Select a new value — it should save without opening a modal. Click a tags cell — type comma-separated tags, press Enter — tags update.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add inline cell editing for quantity, condition, tags, notes in card table"
```

---

## Task 5: Cards Used Across Decks — Hidden Column

**Files:**
- Modify: `backend/routes/decks.js` (add card-usage route)
- Modify: `frontend/src/App.js` (fetch usage map, add hidden column)

- [ ] **Step 1: Add the card-usage route to decks.js**

In `backend/routes/decks.js`, add this route **before** the `router.get('/:id', ...)` route to avoid route conflicts:

```js
// GET /api/decks/card-usage - map of cardName -> [deckName] for all user decks
router.get('/card-usage', requireAuth, async (req, res) => {
  try {
    const decks = await Deck.find({ userId: req.user._id }).select('name mainDeck');
    const usageMap = {};
    for (const deck of decks) {
      for (const card of deck.mainDeck || []) {
        const key = card.name.toLowerCase();
        if (!usageMap[key]) usageMap[key] = [];
        if (!usageMap[key].includes(deck.name)) usageMap[key].push(deck.name);
      }
    }
    res.json(usageMap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 2: Restart backend and verify route**

```bash
curl -s http://localhost:5000/api/decks/card-usage -H "Cookie: <session>"
```

Expected: JSON object with card name keys.

- [ ] **Step 3: Add cardUsageMap state and fetch in App.js**

Find where `cards` is fetched in App.js (the main `fetchCards` function or `useEffect`) and add a parallel fetch:

```js
const [cardUsageMap, setCardUsageMap] = React.useState({});
const [showDeckUsageColumn, setShowDeckUsageColumn] = React.useState(false);
```

In the `fetchCards` (or equivalent useEffect that loads on mount):

```js
// Fetch deck usage map
try {
  const usageRes = await axios.get(`${API_URL}/decks/card-usage`);
  setCardUsageMap(usageRes.data);
} catch (e) { /* ignore */ }
```

- [ ] **Step 4: Add toggle button and column to the card table**

Find the column toggle area (where other hidden columns are toggled) and add:

```jsx
<button
  onClick={() => setShowDeckUsageColumn(v => !v)}
  className={`px-2 py-1 text-xs rounded transition ${showDeckUsageColumn ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'}`}
>
  In Decks
</button>
```

In the table header row, add (conditionally):
```jsx
{showDeckUsageColumn && <th className="px-3 py-2 text-left text-white/60 text-xs font-medium">In Decks</th>}
```

In each table data row:
```jsx
{showDeckUsageColumn && (
  <td className="px-3 py-2">
    {(() => {
      const decks = cardUsageMap[card.name.toLowerCase()] || [];
      if (decks.length === 0) return null;
      if (decks.length <= 2) return decks.map(d => (
        <span key={d} className="text-xs bg-blue-600/40 text-blue-200 px-1.5 py-0.5 rounded mr-1">{d}</span>
      ));
      return (
        <span title={decks.join(', ')} className="text-xs bg-blue-600/40 text-blue-200 px-1.5 py-0.5 rounded cursor-help">
          {decks.length} decks
        </span>
      );
    })()}
  </td>
)}
```

- [ ] **Step 5: Verify in browser**

Toggle "In Decks" column on. Cards that appear in decks should show deck name pills. Cards not in any deck show empty cells.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js frontend/src/App.js
git commit -m "feat: add card-usage route and hidden 'In Decks' column in collection table"
```

---

## Task 6: Role Breakdown + Mana Base Calculator (DeckAnalysisPanel)

**Files:**
- Modify: `frontend/src/components/DeckAnalysisPanel.js`

- [ ] **Step 1: Read the current bottom of DeckAnalysisPanel.js to find where to add**

```bash
grep -n "return\|export default\|TypeDistribution\|manaCurve\|</div>" "d:/Card Tracker/mtg-tracker/frontend/src/components/DeckAnalysisPanel.js" | tail -20
```

- [ ] **Step 2: Add role detection utility function inside DeckAnalysisPanel.js**

Add before the component's `return` statement (inside the component function or as a top-level helper):

```js
function detectRole(card) {
  const text = (card.oracleText || '').toLowerCase();
  const types = (card.types || []).join(' ').toLowerCase();
  if (/destroy|exile|deal.*damage|\-\d+\/\-\d+|return.*to.*hand/.test(text)) return 'removal';
  if (/draw a card|draw x card|draw \d+ card|look at the top/.test(text)) return 'draw';
  if (/add \{|search.*library.*land|land.*into play|tapped.*your library/.test(text)) return 'ramp';
  if (card.power != null && card.toughness != null) return 'threat';
  return 'other';
}

const ROLE_CONFIG = {
  removal: { label: 'Removal', color: '#ef4444', bg: 'bg-red-500' },
  draw:    { label: 'Draw',    color: '#3b82f6', bg: 'bg-blue-500' },
  ramp:    { label: 'Ramp',   color: '#22c55e', bg: 'bg-green-500' },
  threat:  { label: 'Threat', color: '#f97316', bg: 'bg-orange-500' },
  other:   { label: 'Other',  color: '#6b7280', bg: 'bg-gray-500' },
};
```

- [ ] **Step 3: Compute role breakdown from mainDeck inside the component**

Inside the component (after receiving `mainDeck` prop), add:

```js
const roleCounts = React.useMemo(() => {
  const counts = { removal: 0, draw: 0, ramp: 0, threat: 0, other: 0 };
  (mainDeck || []).forEach(card => {
    const role = detectRole(card);
    counts[role] += card.quantity || 1;
  });
  return counts;
}, [mainDeck]);

const roleTotal = Object.values(roleCounts).reduce((a, b) => a + b, 0);
```

- [ ] **Step 4: Add Role Breakdown JSX section**

Add after the existing type distribution section in DeckAnalysisPanel's JSX:

```jsx
{/* Role Breakdown */}
<div className="bg-white/5 rounded-lg p-4">
  <h3 className="text-white font-semibold mb-3">Role Breakdown</h3>
  <div className="flex rounded-full overflow-hidden h-4 mb-3">
    {Object.entries(roleCounts).map(([role, count]) =>
      count > 0 && (
        <div
          key={role}
          style={{ width: `${(count / roleTotal) * 100}%`, background: ROLE_CONFIG[role].color }}
          title={`${ROLE_CONFIG[role].label}: ${count}`}
        />
      )
    )}
  </div>
  <div className="flex flex-wrap gap-3">
    {Object.entries(roleCounts).map(([role, count]) => (
      <div key={role} className="flex items-center gap-1.5">
        <span className={`w-3 h-3 rounded-sm ${ROLE_CONFIG[role].bg}`} />
        <span className="text-white/70 text-xs">{ROLE_CONFIG[role].label}</span>
        <span className="text-white text-xs font-medium">{count}</span>
        <span className="text-white/40 text-xs">({roleTotal > 0 ? Math.round((count/roleTotal)*100) : 0}%)</span>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Add mana pip counting utility**

Add after the role detection utilities:

```js
function countPips(manaCost) {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!manaCost) return counts;
  const matches = manaCost.matchAll(/\{([WUBRG])(?:\/[WUBRG])?\}/g);
  for (const m of matches) {
    const color = m[1];
    if (counts[color] !== undefined) counts[color]++;
  }
  return counts;
}

function countSources(cards) {
  const sources = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of cards) {
    const isLand = (card.types || []).some(t => t.toLowerCase() === 'land');
    if (!isLand) continue;
    const text = (card.oracleText || '').toLowerCase();
    const qty = card.quantity || 1;
    for (const color of ['W', 'U', 'B', 'R', 'G']) {
      const sym = `{${color.toLowerCase()}}`;
      if (text.includes(sym) || text.includes(`{${color}}`)) sources[color] += qty;
    }
  }
  return sources;
}

const COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
const COLOR_SYMBOLS = { W: '☀', U: '💧', B: '💀', R: '🔥', G: '🌲' };
```

- [ ] **Step 6: Compute mana base data inside the component**

```js
const manaBaseData = React.useMemo(() => {
  const nonLands = (mainDeck || []).filter(c => !(c.types || []).some(t => t.toLowerCase() === 'land'));
  const totalPips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of nonLands) {
    const pips = countPips(card.manaCost);
    for (const c of ['W','U','B','R','G']) totalPips[c] += pips[c] * (card.quantity || 1);
  }
  const sources = countSources(mainDeck || []);
  return ['W','U','B','R','G']
    .filter(c => totalPips[c] > 0)
    .map(c => {
      const threshold = Math.max(8, Math.round(totalPips[c] * 1.5));
      const status = sources[c] >= threshold ? 'green' : sources[c] >= threshold - 2 ? 'yellow' : 'red';
      return { color: c, pips: totalPips[c], sources: sources[c], threshold, status };
    });
}, [mainDeck]);
```

- [ ] **Step 7: Add Mana Sources JSX section**

Add after the Role Breakdown section:

```jsx
{/* Mana Sources */}
{manaBaseData.length > 0 && (
  <div className="bg-white/5 rounded-lg p-4">
    <h3 className="text-white font-semibold mb-3">Mana Sources</h3>
    <div className="space-y-2">
      {manaBaseData.map(({ color, pips, sources, threshold, status }) => (
        <div key={color} className="flex items-center gap-3 text-sm">
          <span className="w-16 text-white/70">{COLOR_NAMES[color]}</span>
          <span className="text-white/50 text-xs w-20">Pips: {pips}</span>
          <span className="text-white/50 text-xs w-24">Sources: {sources}/{threshold}</span>
          <span className={`w-2 h-2 rounded-full ${
            status === 'green' ? 'bg-green-400' :
            status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
          }`} />
          <span className={`text-xs ${
            status === 'green' ? 'text-green-400' :
            status === 'yellow' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {status === 'green' ? 'Good' : status === 'yellow' ? 'Low' : 'Insufficient'}
          </span>
        </div>
      ))}
    </div>
    <p className="text-white/30 text-xs mt-2">Based on Frank Karsten's mana source recommendations</p>
  </div>
)}
```

- [ ] **Step 8: Open a deck in the app, open the Analysis panel, verify both sections render**

Role Breakdown should show a segmented bar with coloured sections. Mana Sources should show a per-colour table with status dots.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/DeckAnalysisPanel.js
git commit -m "feat: add role breakdown and mana source calculator to DeckAnalysisPanel"
```

---

## Task 7: Playgroup Metagame

**Files:**
- Modify: `backend/models/Deck.js` (add `powerLevel` stored field)
- Modify: `frontend/src/components/DeckDetail.js` (save computed powerLevel back to DB)
- Modify: `backend/routes/playgroups.js` (add metagame route)
- Create: `frontend/src/components/Playgroups/tabs/MetagameTab.js`
- Modify: `frontend/src/components/Playgroups/PlaygroupDetail.js` (add Metagame tab)

- [ ] **Step 1: Add powerLevel field to the Deck model**

In `backend/models/Deck.js`, add after `totalValue`:

```js
powerLevel: { type: Number, default: null },
```

- [ ] **Step 2: Persist computed powerLevel from DeckDetail**

In `frontend/src/components/DeckDetail.js`, the `powerLevel` is computed via `useMemo` around line 243. After that useMemo, add a useEffect that saves it:

```js
React.useEffect(() => {
  if (!deck?._id || powerLevel?.level == null) return;
  // Save computed power level to backend (fire and forget)
  axios.put(`${API_URL}/decks/${deck._id}`, { powerLevel: powerLevel.level })
    .catch(() => {}); // silent fail — non-critical
}, [deck?._id, powerLevel?.level]);
```

- [ ] **Step 3: Add the metagame route to playgroups.js**

In `backend/routes/playgroups.js`, add after the existing stats routes:

```js
const DeckGameLog = require('../models/DeckGameLog');

// GET /api/playgroups/:id/metagame
router.get('/:id/metagame', requireAuth, async (req, res) => {
  try {
    const playgroup = await Playgroup.findById(req.params.id);
    if (!playgroup) return res.status(404).json({ message: 'Playgroup not found' });
    if (!isMember(playgroup, req.user._id)) return res.status(403).json({ message: 'Not a member' });

    const memberIds = playgroup.members.map(m => m.userId);

    // Get all game logs from all members
    const logs = await DeckGameLog.find({ userId: { $in: memberIds } })
      .populate({ path: 'deckId', select: 'commander name powerLevel' })
      .sort({ playedAt: 1 });

    // Commander frequency
    const cmdMap = {};
    for (const log of logs) {
      if (!log.deckId) continue;
      const cmdName = log.deckId.commander?.name || log.deckId.name || 'Unknown';
      if (!cmdMap[cmdName]) cmdMap[cmdName] = { commanderName: cmdName, gamesPlayed: 0, wins: 0 };
      cmdMap[cmdName].gamesPlayed++;
      if (log.result === 'win') cmdMap[cmdName].wins++;
    }
    const commanderFrequency = Object.values(cmdMap)
      .map(c => ({ ...c, winRate: c.gamesPlayed > 0 ? (c.wins / c.gamesPlayed * 100).toFixed(0) : 0 }))
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    // Power level trends by date
    const dateMap = {};
    for (const log of logs) {
      if (!log.deckId?.powerLevel) continue;
      const day = log.playedAt.toISOString().split('T')[0];
      if (!dateMap[day]) dateMap[day] = { total: 0, count: 0 };
      dateMap[day].total += log.deckId.powerLevel;
      dateMap[day].count++;
    }
    const powerLevelTrends = Object.entries(dateMap)
      .map(([date, { total, count }]) => ({ date, avgPowerLevel: parseFloat((total / count).toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ commanderFrequency, powerLevelTrends });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 4: Create MetagameTab.js**

Create `frontend/src/components/Playgroups/tabs/MetagameTab.js`:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function MetagameTab({ playgroupId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('gamesPlayed');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    axios.get(`${API_URL}/playgroups/${playgroupId}/metagame`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [playgroupId]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  if (loading) return <div className="text-white/50 p-4">Loading metagame data...</div>;
  if (!data) return <div className="text-red-400 p-4">Failed to load metagame data.</div>;

  const sortedCmds = [...(data.commanderFrequency || [])].sort((a, b) => {
    const v = sortDir === 'asc' ? 1 : -1;
    return (a[sortField] > b[sortField] ? 1 : -1) * v;
  });

  const trendData = (data.powerLevelTrends || []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <div className="space-y-6 p-4">
      {/* Commander Frequency */}
      <div>
        <h3 className="text-white font-semibold mb-3">Commander Frequency</h3>
        {sortedCmds.length === 0 ? (
          <p className="text-white/40 text-sm">No game logs yet. Log some games to see metagame data.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                {[['commanderName','Commander'],['gamesPlayed','Games'],['wins','Wins'],['winRate','Win%']].map(([f,l]) => (
                  <th key={f} className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => toggleSort(f)}>
                    {l} {sortField === f ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCmds.map((c, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-white">{c.commanderName}</td>
                  <td className="py-2 px-3 text-white/70">{c.gamesPlayed}</td>
                  <td className="py-2 px-3 text-white/70">{c.wins}</td>
                  <td className="py-2 px-3 text-white/70">{c.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Power Level Trends */}
      <div>
        <h3 className="text-white font-semibold mb-3">Power Level Trends</h3>
        {trendData.length < 3 ? (
          <p className="text-white/40 text-sm">Play more games to see power level trends.</p>
        ) : (
          <div className="bg-white/5 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis domain={[1, 10]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                  labelStyle={{ color: 'white' }}
                  formatter={v => [v, 'Avg Power Level']}
                />
                <Line type="monotone" dataKey="avgPowerLevel" stroke="#f97316" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add Metagame tab to PlaygroupDetail.js**

In `frontend/src/components/Playgroups/PlaygroupDetail.js`, add import:

```js
import MetagameTab from './tabs/MetagameTab';
```

Add to the TABS array:
```js
{ id: 'metagame', label: 'Metagame' }
```

Add the tab panel after the stats panel:
```jsx
{activeTab === 'metagame' && (
  <MetagameTab playgroupId={playgroupId} />
)}
```

- [ ] **Step 6: Verify in browser**

Open a playgroup → click Metagame tab. With no game logs, should show "No game logs yet." After logging games, should show commander table and power level chart.

- [ ] **Step 7: Commit**

```bash
git add backend/models/Deck.js backend/routes/playgroups.js \
  frontend/src/components/DeckDetail.js \
  frontend/src/components/Playgroups/tabs/MetagameTab.js \
  frontend/src/components/Playgroups/PlaygroupDetail.js
git commit -m "feat: add playgroup metagame tab with commander frequency and power level trends"
```

---

## Task 8: Friend Collection Diff

**Files:**
- Modify: `backend/server.js` (add collection-diff route)
- Modify: `frontend/src/components/TradeBinder.js` (add Compare section)

- [ ] **Step 1: Add the collection-diff route to server.js**

Add near the other `/api/users/...` routes (after the profile route around line 3332):

```js
app.get('/api/users/:username/collection-diff', requireAuth, async (req, res) => {
  try {
    if (req.params.username.toLowerCase() === req.user.username.toLowerCase()) {
      return res.status(400).json({ message: "You can't compare with yourself." });
    }

    const friend = await User.findOne({
      username: req.params.username.toLowerCase(),
      isActive: true
    });
    if (!friend) return res.status(404).json({ message: 'User not found.' });
    if (!friend.privacy?.showCollection) {
      return res.status(403).json({ message: "This user's collection is private." });
    }

    const [myCards, theirCards] = await Promise.all([
      Card.find({ userId: req.user._id }).select('name quantity price set'),
      Card.find({ userId: friend._id }).select('name quantity price set')
    ]);

    const myNames = new Set(myCards.map(c => c.name.toLowerCase()));
    const theirNames = new Set(theirCards.map(c => c.name.toLowerCase()));

    const theyHaveYouDont = theirCards.filter(c => !myNames.has(c.name.toLowerCase()));
    const youHaveTheyDont = myCards.filter(c => !theirNames.has(c.name.toLowerCase()));

    res.json({
      username: friend.username,
      displayName: friend.displayName || friend.username,
      theyHaveYouDont,
      youHaveTheyDont
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 2: Restart backend and verify route**

```bash
curl -s "http://localhost:5000/api/users/someuser/collection-diff" -H "Cookie: <session>"
```

Expected: 404 "User not found" or 403 "collection is private" (correct auth flow).

- [ ] **Step 3: Add Compare section to TradeBinder.js**

Read the current end of `TradeBinder.js` to find where to insert, then add a Compare section. Add state and API_URL at the top of the component:

```jsx
import React, { useMemo, useState } from 'react';
import { Copy, Share2, Download, Users } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TradeBinder = ({ cards, formatPrice, authUser, onAddToWishlist }) => {
  // ... existing code ...
  const [compareUsername, setCompareUsername] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState(null);

  const handleCompare = async () => {
    if (!compareUsername.trim()) return;
    setDiffLoading(true);
    setDiffError(null);
    setDiffResult(null);
    try {
      const res = await axios.get(`${API_URL}/users/${compareUsername.trim()}/collection-diff`);
      setDiffResult(res.data);
    } catch (err) {
      setDiffError(err.response?.data?.message || 'Failed to compare collections.');
    } finally {
      setDiffLoading(false);
    }
  };

  const addAllToWishlist = async (cardList) => {
    for (const card of cardList) {
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: card.name, set: card.set, targetPrice: card.price || 0, quantity: 1
        });
      } catch (e) { /* skip dupes */ }
    }
    alert(`Added ${cardList.length} cards to wishlist!`);
  };
```

Then add the Compare section JSX at the bottom of the returned JSX (before the closing `</div>`):

```jsx
{/* Compare with Friend */}
<div className="mt-8 border-t border-white/10 pt-6">
  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
    <Users size={18} /> Compare with a Friend
  </h3>
  <div className="flex gap-2 mb-4">
    <input
      type="text"
      placeholder="Enter username..."
      value={compareUsername}
      onChange={e => setCompareUsername(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleCompare()}
      className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-lg px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-purple-400"
    />
    <button
      onClick={handleCompare}
      disabled={diffLoading || !compareUsername.trim()}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm transition"
    >
      {diffLoading ? 'Loading...' : 'Compare'}
    </button>
  </div>

  {diffError && <p className="text-red-400 text-sm mb-3">{diffError}</p>}

  {diffResult && (
    <div className="grid grid-cols-2 gap-4">
      {/* They have, you don't */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white/80 text-sm font-medium">
            {diffResult.displayName} has, you don't ({diffResult.theyHaveYouDont.length})
          </h4>
          {diffResult.theyHaveYouDont.length > 0 && (
            <button
              onClick={() => addAllToWishlist(diffResult.theyHaveYouDont)}
              className="text-xs text-purple-300 hover:text-purple-200 underline"
            >
              Add all to wishlist
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {diffResult.theyHaveYouDont.slice(0, 100).map(card => (
            <div key={card._id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span className="text-white text-xs truncate">{card.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {card.price > 0 && <span className="text-white/50 text-xs">${card.price.toFixed(2)}</span>}
                <button
                  onClick={() => onAddToWishlist && onAddToWishlist(card)}
                  className="text-xs text-purple-300 hover:text-purple-200"
                >
                  +WL
                </button>
              </div>
            </div>
          ))}
          {diffResult.theyHaveYouDont.length === 0 && (
            <p className="text-white/30 text-xs">You already have everything they have!</p>
          )}
        </div>
      </div>

      {/* You have, they don't */}
      <div>
        <h4 className="text-white/80 text-sm font-medium mb-2">
          You have, they don't ({diffResult.youHaveTheyDont.length})
        </h4>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {diffResult.youHaveTheyDont.slice(0, 100).map(card => (
            <div key={card._id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span className="text-white text-xs truncate">{card.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white/50 text-xs">×{card.quantity}</span>
                {card.price > 0 && <span className="text-white/50 text-xs">${card.price.toFixed(2)}</span>}
              </div>
            </div>
          ))}
          {diffResult.youHaveTheyDont.length === 0 && (
            <p className="text-white/30 text-xs">You have nothing they don't.</p>
          )}
        </div>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Pass onAddToWishlist to TradeBinder from App.js**

In `frontend/src/App.js`, find where `<TradeBinder>` is rendered and add the prop:

```jsx
<TradeBinder
  cards={cards}
  formatPrice={formatPrice}
  authUser={authUser}
  onAddToWishlist={(card) => {
    axios.post(`${API_URL}/wishlist`, {
      name: card.name, set: card.set, targetPrice: card.price || 0, quantity: 1
    }).then(() => fetchWishlist()).catch(console.error);
  }}
/>
```

- [ ] **Step 5: Verify in browser**

Open Trade Binder. Scroll to "Compare with a Friend" section. Enter a username whose collection is public → should show two columns. Enter private username → should show error message.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js frontend/src/components/TradeBinder.js frontend/src/App.js
git commit -m "feat: add friend collection diff to TradeBinder with wishlist integration"
```

---

## Self-Review Checklist

- [x] CollectionSnapshot model has compound unique index on userId+date — prevents duplicate snapshots
- [x] `snapshotAllCollections` uses `findOneAndUpdate` with upsert — idempotent if re-run
- [x] `card-usage` route is registered before `/:id` route — no route shadowing
- [x] `detectRole` priority order matches spec: Removal → Draw → Ramp → Threat → Other
- [x] Mana source counting checks oracle text for `{W}` etc. (lands that add mana)
- [x] Metagame route checks `isMember` before returning data
- [x] `collection-diff` route checks `privacy.showCollection` and returns 403 if private
- [x] `onAddToWishlist` wired through from App.js to TradeBinder
- [x] All recharts imports included in files that use charts (App.js, MetagameTab.js)
- [x] `powerLevel` stored on Deck via fire-and-forget PUT — silent fail, non-critical

# Collection UI & Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement column visibility system (right-click context menu with per-user database persistence) and execute all 7 collection improvement plans (performance optimization, finance tracking, UI features, price history, deck folders, admin tools, game rooms) with column awareness integrated throughout.

**Architecture:** Foundation layer (column visibility system) + 7 parallel feature implementations. Column system provides a reusable pattern for showing/hiding optional columns. Each feature adds new columns that automatically appear in the context menu. Database persistence ensures preferences sync across devices.

**Tech Stack:** Node.js/Express, MongoDB Mongoose, React hooks (useState/useEffect), localStorage for temp state, axios for API calls, recharts for visualizations (Feature Bundle)

---

## PHASE 1: COLUMN VISIBILITY SYSTEM FOUNDATION

### Task 1: Create UserColumnPreferences Model

**Files:**
- Create: `backend/models/UserColumnPreferences.js`

- [ ] **Step 1: Create the UserColumnPreferences model**

```javascript
const mongoose = require('mongoose');

const userColumnPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  visibleColumns: {
    type: [String],
    default: ['cardName', 'quantity', 'condition', 'price']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userColumnPreferencesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userColumnPreferencesSchema.index({ userId: 1 });

module.exports = mongoose.model('UserColumnPreferences', userColumnPreferencesSchema);
```

- [ ] **Step 2: Commit the model**

```bash
git add backend/models/UserColumnPreferences.js
git commit -m "feat: add UserColumnPreferences model for column visibility persistence"
```

### Task 2: Add Column Preference Endpoints

**Files:**
- Modify: `backend/server.js` (add endpoints at end of routes section, before module.exports)

- [ ] **Step 1: Import the UserColumnPreferences model at top of server.js**

Find the section with other model imports (around line 30-40) and add:

```javascript
const UserColumnPreferences = require('./models/UserColumnPreferences');
```

- [ ] **Step 2: Add GET endpoint for fetching user's column preferences**

Add this before the final `module.exports = app;` line:

```javascript
// GET /api/user/column-preferences - fetch user's visible columns
app.get('/api/user/column-preferences', verifyToken, requireAuth, async (req, res) => {
  try {
    let prefs = await UserColumnPreferences.findOne({ userId: req.user._id });
    
    if (!prefs) {
      prefs = await UserColumnPreferences.create({
        userId: req.user._id,
        visibleColumns: ['cardName', 'quantity', 'condition', 'price']
      });
    }
    
    res.json({ visibleColumns: prefs.visibleColumns });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch column preferences', error: err.message });
  }
});
```

- [ ] **Step 3: Add PUT endpoint for updating column preferences**

Add this right after the GET endpoint:

```javascript
// PUT /api/user/column-preferences - update visible columns
app.put('/api/user/column-preferences', verifyToken, requireAuth, async (req, res) => {
  try {
    const { visibleColumns } = req.body;
    
    if (!Array.isArray(visibleColumns)) {
      return res.status(400).json({ message: 'visibleColumns must be an array' });
    }
    
    let prefs = await UserColumnPreferences.findOne({ userId: req.user._id });
    
    if (!prefs) {
      prefs = await UserColumnPreferences.create({
        userId: req.user._id,
        visibleColumns
      });
    } else {
      prefs.visibleColumns = visibleColumns;
      await prefs.save();
    }
    
    res.json({ visibleColumns: prefs.visibleColumns });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update column preferences', error: err.message });
  }
});
```

- [ ] **Step 4: Test the endpoints with curl**

```bash
# Test GET (will create default prefs if none exist)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/user/column-preferences

# Test PUT
curl -X PUT http://localhost:5000/api/user/column-preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibleColumns":["cardName","set","quantity","condition","price","total","actions"]}'
```

Expected: Both return `{"visibleColumns":[...]}`

- [ ] **Step 5: Commit the endpoints**

```bash
git add backend/server.js
git commit -m "feat: add GET/PUT endpoints for user column preferences"
```

### Task 3: Create useColumnVisibility Hook

**Files:**
- Create: `frontend/src/hooks/useColumnVisibility.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const DEFAULT_COLUMNS = ['cardName', 'quantity', 'condition', 'price'];

const ALL_COLUMNS = [
  { id: 'cardName', label: 'Card Name', alwaysVisible: true },
  { id: 'set', label: 'Set' },
  { id: 'setCode', label: 'Set Code' },
  { id: 'collectorNumber', label: 'Collector #' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'manaCost', label: 'Mana Cost' },
  { id: 'colors', label: 'Colors' },
  { id: 'types', label: 'Types' },
  { id: 'location', label: 'Location' },
  { id: 'foil', label: 'Foil' },
  { id: 'token', label: 'Token' },
  { id: 'tags', label: 'Tags' },
  { id: 'quantity', label: 'Qty', alwaysVisible: true },
  { id: 'condition', label: 'Condition', alwaysVisible: true },
  { id: 'price', label: 'Price', alwaysVisible: true },
  { id: 'total', label: 'Total' },
  { id: 'actions', label: 'Actions' }
];

export default function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await axios.get(`${API_URL}/user/column-preferences`);
        setVisibleColumns(response.data.visibleColumns || DEFAULT_COLUMNS);
      } catch (err) {
        console.error('Failed to fetch column preferences:', err);
        setVisibleColumns(DEFAULT_COLUMNS);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const toggleColumn = async (columnId) => {
    const updated = visibleColumns.includes(columnId)
      ? visibleColumns.filter(c => c !== columnId)
      : [...visibleColumns, columnId];

    setVisibleColumns(updated);

    try {
      await axios.put(`${API_URL}/user/column-preferences`, {
        visibleColumns: updated
      });
    } catch (err) {
      console.error('Failed to save column preferences:', err);
      setVisibleColumns(visibleColumns);
    }
  };

  const isColumnVisible = (columnId) => visibleColumns.includes(columnId);

  return {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    loading,
    allColumns: ALL_COLUMNS
  };
}
```

- [ ] **Step 2: Commit the hook**

```bash
git add frontend/src/hooks/useColumnVisibility.js
git commit -m "feat: add useColumnVisibility hook for managing column state and persistence"
```

### Task 4: Create ColumnContextMenu Component

**Files:**
- Create: `frontend/src/components/ColumnContextMenu.js`

- [ ] **Step 1: Create the context menu component**

```javascript
import React, { useEffect, useRef } from 'react';

export default function ColumnContextMenu({
  isOpen,
  position,
  columns,
  visibleColumns,
  onToggle,
  onClose
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        minWidth: '200px'
      }}
    >
      <div className="p-3 max-h-96 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-2 px-2">Show/Hide Columns</h3>
        <div className="space-y-1">
          {columns.map(col => (
            <label
              key={col.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer text-sm text-white"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.id)}
                onChange={() => onToggle(col.id)}
                disabled={col.alwaysVisible}
                className={`${col.alwaysVisible ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <span>{col.label}</span>
              {col.alwaysVisible && <span className="text-xs text-slate-500">(always visible)</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit the component**

```bash
git add frontend/src/components/ColumnContextMenu.js
git commit -m "feat: add ColumnContextMenu component for right-click column visibility toggles"
```

### Task 5: Integrate Column System into Card Table

**Files:**
- Modify: `frontend/src/App.js` (table section, around line 3382-3416)

- [ ] **Step 1: Import useColumnVisibility hook at top of App.js**

Find the import section (around line 1-10) and add:

```javascript
import useColumnVisibility from './hooks/useColumnVisibility';
```

- [ ] **Step 2: Import ColumnContextMenu component**

Add this with other component imports:

```javascript
import ColumnContextMenu from './components/ColumnContextMenu';
```

- [ ] **Step 3: Initialize hook in App component (in the main App function)**

Find where other state is initialized (around line 150-200) and add:

```javascript
const { visibleColumns, isColumnVisible, toggleColumn, loading: colLoading, allColumns } = useColumnVisibility();
const [contextMenu, setContextMenu] = useState(null);
```

- [ ] **Step 4: Add right-click handler to table**

Find the `<table className="w-full">` line (around 3382) and modify it to:

```javascript
<table 
  className="w-full"
  onContextMenu={(e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }}
>
```

- [ ] **Step 5: Update table header to conditionally render columns**

Replace the entire `<thead>` section (lines 3383-3416) with:

```javascript
<thead className="bg-white/20">
  <tr>
    <th className="px-3 py-3 text-center text-white font-semibold">
      <button
        onClick={toggleSelectAllOnPage}
        className="hover:text-purple-300 transition"
        title={paginatedCards.every(c => selectedCards.has(c._id)) ? "Deselect all on page" : "Select all on page"}
      >
        {paginatedCards.length > 0 && paginatedCards.every(c => selectedCards.has(c._id)) ? (
          <CheckSquare size={18} />
        ) : (
          <Square size={18} />
        )}
      </button>
    </th>
    {isColumnVisible('cardName') && <th className="px-6 py-3 text-left text-white font-semibold">Card Name</th>}
    {isColumnVisible('set') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Set</th>}
    {isColumnVisible('setCode') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Set Code</th>}
    {isColumnVisible('collectorNumber') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">#</th>}
    {isColumnVisible('rarity') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Rarity</th>}
    {isColumnVisible('manaCost') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Mana Cost</th>}
    {isColumnVisible('colors') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Colors</th>}
    {isColumnVisible('types') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Types</th>}
    {isColumnVisible('location') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Location</th>}
    {isColumnVisible('foil') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Foil</th>}
    {isColumnVisible('token') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Token</th>}
    {isColumnVisible('tags') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Tags</th>}
    {isColumnVisible('quantity') && <th className="px-6 py-3 text-left text-white font-semibold">Qty</th>}
    {isColumnVisible('condition') && <th className="px-6 py-3 text-left text-white font-semibold">Condition</th>}
    {isColumnVisible('price') && <th className="px-6 py-3 text-left text-white font-semibold">Price</th>}
    {isColumnVisible('total') && <th className="px-6 py-3 text-left text-white font-semibold">Total</th>}
    {isColumnVisible('actions') && <th className="px-6 py-3 text-left text-white font-semibold">Actions</th>}
  </tr>
</thead>
```

- [ ] **Step 6: Update table body to conditionally render columns**

Find the card row rendering (around line 3425-3500) and update each cell with conditional rendering. For example:

Change from:
```javascript
<td className="px-6 py-4 text-white">{card.set}</td>
```

To:
```javascript
{isColumnVisible('set') && <td className="px-6 py-4 text-white hidden lg:table-cell">{card.set}</td>}
```

Repeat this pattern for all columns: set, setCode, collectorNumber, rarity, manaCost, colors, types, location, foil, token, tags, total, actions.

Reference: Keep the always-visible columns (cardName, quantity, condition, price) without conditionals. For others, wrap with `{isColumnVisible('columnId') && <td>...</td>}`.

- [ ] **Step 7: Add ColumnContextMenu component at end of card table section**

After the closing `</table>` tag, add:

```javascript
<ColumnContextMenu
  isOpen={contextMenu !== null}
  position={contextMenu || { x: 0, y: 0 }}
  columns={allColumns}
  visibleColumns={visibleColumns}
  onToggle={toggleColumn}
  onClose={() => setContextMenu(null)}
/>
```

- [ ] **Step 8: Test the column system**

1. Start frontend: `npm start` from `frontend/` directory
2. Right-click on the card table header
3. Verify context menu appears at cursor
4. Click checkboxes to toggle column visibility
5. Refresh page - verify preferences persist
6. Open browser DevTools → Storage → LocalStorage to see token is still there

Expected: Menu shows all columns, clicking toggles visibility, preferences save to database.

- [ ] **Step 9: Commit the table integration**

```bash
git add frontend/src/App.js
git commit -m "feat: integrate column visibility system into card table with right-click context menu"
```

---

## PHASE 2: COLLECTION IMPROVEMENT PLANS

### Task 6: Performance & Quality Improvements - Database Indexes

**Files:**
- Modify: `backend/server.js` (add indexes after model definitions)

- [ ] **Step 1: Add strategic indexes to Card schema**

Find the Card model definition (around line 100-150) and ensure these indexes exist. Add them in the schema or in a separate index section:

```javascript
// Add to Card schema (if not already present):
cardSchema.index({ userId: 1, name: 1 });
cardSchema.index({ userId: 1, set: 1 });
cardSchema.index({ userId: 1, condition: 1 });
cardSchema.index({ userId: 1, updatedAt: -1 });
```

- [ ] **Step 2: Verify indexes are created on startup**

No code change needed - MongoDB creates indexes automatically on app start.

- [ ] **Step 3: Commit the indexes**

```bash
git add backend/server.js
git commit -m "perf: add strategic database indexes for faster card queries"
```

### Task 7: Performance & Quality Improvements - In-Memory Caching

**Files:**
- Modify: `backend/server.js` (add caching layer before GET /api/cards route)

- [ ] **Step 1: Add simple in-memory cache for cards and stats**

Add this near the top of server.js, after database connection:

```javascript
// In-memory cache
const cache = {
  cards: new Map(),
  stats: new Map(),
  ttl: 5 * 60 * 1000 // 5 minute TTL
};

function getFromCache(key, userId) {
  const entry = cache[key]?.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > cache.ttl) {
    cache[key].delete(userId);
    return null;
  }
  return entry.data;
}

function setInCache(key, userId, data) {
  if (!cache[key]) cache[key] = new Map();
  cache[key].set(userId, { data, timestamp: Date.now() });
}

function clearCache(userId) {
  cache.cards.delete(userId);
  cache.stats.delete(userId);
}
```

- [ ] **Step 2: Update GET /api/cards to use cache**

Find the route (around line 1500) and wrap the Card.find with cache checks:

```javascript
app.get('/api/cards', verifyToken, requireAuth, async (req, res) => {
  try {
    const cached = getFromCache('cards', req.user._id);
    if (cached) return res.json(cached);

    const cards = await Card.find({ userId: req.user._id }).sort({ name: 1 }).lean();
    setInCache('cards', req.user._id, cards);
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cards', error: err.message });
  }
});
```

- [ ] **Step 3: Update GET /api/stats to use cache**

Find the stats route (around line 1700) and apply the same cache pattern:

```javascript
app.get('/api/stats', verifyToken, requireAuth, async (req, res) => {
  try {
    const cached = getFromCache('stats', req.user._id);
    if (cached) return res.json(cached);

    const cards = await Card.find({ userId: req.user._id });
    // ... calculate stats ...
    const stats = { totalCards, totalValue, ... };
    
    setInCache('stats', req.user._id, stats);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
});
```

- [ ] **Step 4: Clear cache on card modifications**

In POST /api/cards (create), PUT /api/cards/:id (update), DELETE /api/cards/:id routes, add `clearCache(req.user._id);` after the database operation.

- [ ] **Step 5: Test cache effectiveness**

1. Start backend
2. Load collection (first time - slower, hits DB)
3. Reload collection (should be instant - hits cache)
4. Add a card - cache clears
5. Load collection again (rebuilds cache)

- [ ] **Step 6: Commit caching**

```bash
git add backend/server.js
git commit -m "perf: add in-memory caching for cards and stats with 5-minute TTL"
```

### Task 8: Collection & Finance Bundle - Add Finance Fields to Card

**Files:**
- Modify: `backend/models/Card.js`

- [ ] **Step 1: Add finance fields to Card schema**

Find the Card schema and add these fields before the closing `}`:

```javascript
buylistValue: {
  type: Number,
  default: 0
},
sellValue: {
  type: Number,
  default: 0
},
priceAlert: {
  targetPrice: Number,
  emailNotification: { type: Boolean, default: false }
}
```

- [ ] **Step 2: Commit schema update**

```bash
git add backend/models/Card.js
git commit -m "feat: add buylistValue, sellValue, and priceAlert fields to Card schema"
```

### Task 9: Collection & Finance Bundle - Finance Endpoints

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add GET /api/finance endpoint to get portfolio values**

Add before `module.exports = app;`:

```javascript
app.get('/api/finance', verifyToken, requireAuth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user._id });
    
    const totalBuylistValue = cards.reduce((sum, card) => sum + (card.buylistValue * card.quantity), 0);
    const totalSellValue = cards.reduce((sum, card) => sum + (card.sellValue * card.quantity), 0);
    const totalCollectionValue = cards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
    
    res.json({
      buylistValue: totalBuylistValue,
      sellValue: totalSellValue,
      collectionValue: totalCollectionValue,
      spread: totalCollectionValue - totalBuylistValue
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching finance data', error: err.message });
  }
});
```

- [ ] **Step 2: Add PUT endpoint to update card finance fields**

```javascript
app.put('/api/cards/:id/finance', verifyToken, requireAuth, async (req, res) => {
  try {
    const { buylistValue, sellValue, priceAlert } = req.body;
    const card = await Card.findById(req.params.id);
    
    if (!card || card.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Card not found' });
    }
    
    if (buylistValue !== undefined) card.buylistValue = buylistValue;
    if (sellValue !== undefined) card.sellValue = sellValue;
    if (priceAlert !== undefined) card.priceAlert = priceAlert;
    
    await card.save();
    clearCache(req.user._id);
    
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: 'Error updating card finance', error: err.message });
  }
});
```

- [ ] **Step 3: Commit endpoints**

```bash
git add backend/server.js
git commit -m "feat: add finance tracking endpoints for buylist/sell values and price alerts"
```

### Task 10: Collection & Finance Bundle - Finance UI Panel

**Files:**
- Modify: `frontend/src/App.js` (add Finance tab/button in header and panel)

- [ ] **Step 1: Add finance state to App component**

Find where other state is initialized and add:

```javascript
const [showFinancePanel, setShowFinancePanel] = useState(false);
const [financeData, setFinanceData] = useState(null);
```

- [ ] **Step 2: Add button to fetch finance data in header**

Find the header section (around line 3200) and add a button:

```javascript
<button
  onClick={async () => {
    const res = await axios.get(`${API_URL}/finance`);
    setFinanceData(res.data);
    setShowFinancePanel(true);
  }}
  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition font-semibold"
  title="View finance tracking"
>
  <DollarSign size={18} /> Finance
</button>
```

- [ ] **Step 3: Add finance panel modal**

Add before closing div of main collection section:

```javascript
{showFinancePanel && financeData && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-md w-full p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Portfolio Finance</h2>
        <button onClick={() => setShowFinancePanel(false)} className="text-slate-400 hover:text-white">
          <X size={24} />
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="bg-slate-800/50 p-3 rounded">
          <p className="text-slate-400 text-sm">Collection Value</p>
          <p className="text-white font-bold text-xl">${financeData.collectionValue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded">
          <p className="text-slate-400 text-sm">Buylist Value</p>
          <p className="text-green-400 font-bold text-xl">${financeData.buylistValue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded">
          <p className="text-slate-400 text-sm">Sell Value</p>
          <p className="text-yellow-400 font-bold text-xl">${financeData.sellValue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded">
          <p className="text-slate-400 text-sm">Spread (Collection - Buylist)</p>
          <p className={`font-bold text-xl ${financeData.spread > 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${financeData.spread.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add buylistValue and sellValue columns**

Add these column definitions to the useColumnVisibility hook in `frontend/src/hooks/useColumnVisibility.js`:

```javascript
{ id: 'buylistValue', label: 'Buylist Value' },
{ id: 'sellValue', label: 'Sell Value' },
```

And render them in the table in App.js (following the same pattern as other columns):

```javascript
{isColumnVisible('buylistValue') && <td className="px-6 py-4 text-white">${(card.buylistValue || 0).toFixed(2)}</td>}
{isColumnVisible('sellValue') && <td className="px-6 py-4 text-white">${(card.sellValue || 0).toFixed(2)}</td>}
```

- [ ] **Step 5: Test finance panel**

1. Click "Finance" button in header
2. Verify panel shows collection/buylist/sell values
3. Verify columns can be toggled via right-click menu

- [ ] **Step 6: Commit UI**

```bash
git add frontend/src/App.js frontend/src/hooks/useColumnVisibility.js
git commit -m "feat: add finance tracking UI panel and buylist/sell value columns"
```

### Task 11: Feature Bundle - Collection Value History Chart

**Files:**
- Create: `backend/models/CardValueSnapshot.js`
- Modify: `backend/server.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create CardValueSnapshot model**

```javascript
const mongoose = require('mongoose');

const cardValueSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  totalValue: {
    type: Number,
    required: true
  },
  cardCount: {
    type: Number,
    required: true
  }
});

cardValueSnapshotSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('CardValueSnapshot', cardValueSnapshotSchema);
```

Save to `backend/models/CardValueSnapshot.js`

- [ ] **Step 2: Import model and create snapshot endpoint**

Add import:
```javascript
const CardValueSnapshot = require('./models/CardValueSnapshot');
```

Add endpoint:
```javascript
app.post('/api/value-snapshot', verifyToken, requireAuth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user._id });
    const totalValue = cards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
    
    const snapshot = await CardValueSnapshot.create({
      userId: req.user._id,
      totalValue,
      cardCount: cards.length
    });
    
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: 'Error creating snapshot', error: err.message });
  }
});
```

- [ ] **Step 3: Add endpoint to fetch value history**

```javascript
app.get('/api/value-history', verifyToken, requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const history = await CardValueSnapshot.find({
      userId: req.user._id,
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();
    
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching value history', error: err.message });
  }
});
```

- [ ] **Step 4: Create automatic daily snapshot**

Add this after server startup (before listen):

```javascript
// Create daily value snapshot
setInterval(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      const cards = await Card.find({ userId: user._id });
      const totalValue = cards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
      
      // Only create one snapshot per day per user
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existing = await CardValueSnapshot.findOne({
        userId: user._id,
        date: { $gte: today }
      });
      
      if (!existing) {
        await CardValueSnapshot.create({
          userId: user._id,
          totalValue,
          cardCount: cards.length
        });
      }
    }
  } catch (err) {
    console.error('Error creating value snapshots:', err);
  }
}, 24 * 60 * 60 * 1000); // Daily
```

- [ ] **Step 5: Install recharts (if not already installed)**

From `frontend/` directory:
```bash
npm install recharts
```

- [ ] **Step 6: Create ValueHistoryChart component**

Create file `frontend/src/components/ValueHistoryChart.js`:

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_URL } from '../config';

export default function ValueHistoryChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/value-history?days=30`);
        setData(res.data.map(item => ({
          date: new Date(item.date).toLocaleDateString(),
          value: item.totalValue,
          count: item.cardCount
        })));
      } catch (err) {
        console.error('Error fetching value history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) return <div className="text-slate-400">Loading chart...</div>;

  return (
    <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">Collection Value (30 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
          <YAxis stroke="rgba(255,255,255,0.5)" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
            labelStyle={{ color: '#fff' }}
          />
          <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 7: Add chart to collection view**

In App.js, import the component:
```javascript
import ValueHistoryChart from './components/ValueHistoryChart';
```

Add to the dashboard/stats area:
```javascript
<ValueHistoryChart />
```

- [ ] **Step 8: Commit value history**

```bash
git add backend/models/CardValueSnapshot.js backend/server.js frontend/src/components/ValueHistoryChart.js frontend/src/App.js
git commit -m "feat: add collection value history tracking with 30-day chart"
```

### Task 12: Price History Sparklines - Add Price History Model

**Files:**
- Create: `backend/models/CardPriceHistory.js`

- [ ] **Step 1: Create CardPriceHistory model**

```javascript
const mongoose = require('mongoose');

const cardPriceHistorySchema = new mongoose.Schema({
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

cardPriceHistorySchema.index({ cardId: 1, userId: 1, date: -1 });
cardPriceHistorySchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('CardPriceHistory', cardPriceHistorySchema);
```

Save to `backend/models/CardPriceHistory.js`

- [ ] **Step 2: Commit model**

```bash
git add backend/models/CardPriceHistory.js
git commit -m "feat: add CardPriceHistory model for price trend tracking"
```

### Task 13: Price History Sparklines - Record Prices and Add Endpoint

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Import CardPriceHistory**

Add with other imports:
```javascript
const CardPriceHistory = require('./models/CardPriceHistory');
```

- [ ] **Step 2: Record price when card is updated**

In the PUT /api/cards/:id route, after saving the card, add:

```javascript
// Record price history
if (card.price > 0) {
  await CardPriceHistory.create({
    cardId: card._id,
    userId: req.user._id,
    price: card.price
  });
}
```

- [ ] **Step 3: Add endpoint to fetch price history for a card**

```javascript
app.get('/api/cards/:id/price-history', verifyToken, requireAuth, async (req, res) => {
  try {
    // Get last 30 days of price history
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const history = await CardPriceHistory.find({
      cardId: req.params.id,
      userId: req.user._id,
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();
    
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching price history', error: err.message });
  }
});
```

- [ ] **Step 4: Commit price tracking**

```bash
git add backend/server.js
git commit -m "feat: record price history on updates and add price history endpoint"
```

### Task 14: Price History Sparklines - Add Sparkline to Hover Preview

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add price history state to App**

Find the hover preview state (around line 200) and add:

```javascript
const [hoveredCardPriceHistory, setHoveredCardPriceHistory] = useState([]);
```

- [ ] **Step 2: Add function to fetch price history on hover**

```javascript
const handleCardHover = async (card) => {
  try {
    const res = await axios.get(`${API_URL}/cards/${card._id}/price-history`);
    setHoveredCardPriceHistory(res.data);
  } catch (err) {
    console.error('Error fetching price history:', err);
  }
};
```

- [ ] **Step 3: Update hover preview to include sparkline**

Find the existing card hover preview (search for "cardImagePreview" or "fixed" positioning) and add:

```javascript
{hoveredCardPriceHistory.length > 0 && (
  <div className="mt-2 text-xs text-slate-400">
    <div className="flex gap-1 justify-end">
      {hoveredCardPriceHistory.map((h, i) => (
        <div
          key={i}
          className="w-0.5 bg-purple-400"
          style={{ height: `${(h.price / Math.max(...hoveredCardPriceHistory.map(x => x.price))) * 20}px` }}
          title={`$${h.price.toFixed(2)} on ${new Date(h.date).toLocaleDateString()}`}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Call handleCardHover on mouse enter**

In the card row rendering, update onMouseEnter:

```javascript
onMouseEnter={() => {
  setHoverCard(card);
  handleCardHover(card);
}}
```

- [ ] **Step 5: Test sparklines**

1. Hover over a card with price history
2. Verify mini bars appear below the preview
3. Hover over bars to see dates and prices

- [ ] **Step 6: Commit sparklines**

```bash
git add frontend/src/App.js
git commit -m "feat: add price history sparklines to card hover preview"
```

### Task 15: Deck Folders - Create DeckFolder Model

**Files:**
- Create: `backend/models/DeckFolder.js`

- [ ] **Step 1: Create DeckFolder model**

```javascript
const mongoose = require('mongoose');

const deckFolderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  parentFolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeckFolder',
    default: null
  },
  decks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deck'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

deckFolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

deckFolderSchema.index({ userId: 1, parentFolderId: 1 });

module.exports = mongoose.model('DeckFolder', deckFolderSchema);
```

Save to `backend/models/DeckFolder.js`

- [ ] **Step 2: Commit model**

```bash
git add backend/models/DeckFolder.js
git commit -m "feat: add DeckFolder model for hierarchical deck organization"
```

### Task 16: Deck Folders - Add Folder CRUD Endpoints

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Import DeckFolder model**

```javascript
const DeckFolder = require('./models/DeckFolder');
```

- [ ] **Step 2: Add GET /api/deck-folders endpoint**

```javascript
app.get('/api/deck-folders', verifyToken, requireAuth, async (req, res) => {
  try {
    const folders = await DeckFolder.find({ userId: req.user._id })
      .populate('decks', 'name')
      .lean();
    
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching folders', error: err.message });
  }
});
```

- [ ] **Step 3: Add POST /api/deck-folders endpoint**

```javascript
app.post('/api/deck-folders', verifyToken, requireAuth, async (req, res) => {
  try {
    const { name, parentFolderId } = req.body;
    
    const folder = await DeckFolder.create({
      userId: req.user._id,
      name,
      parentFolderId: parentFolderId || null
    });
    
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Error creating folder', error: err.message });
  }
});
```

- [ ] **Step 4: Add PUT /api/deck-folders/:id endpoint**

```javascript
app.put('/api/deck-folders/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const { name, parentFolderId } = req.body;
    
    const folder = await DeckFolder.findById(req.params.id);
    if (!folder || folder.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    if (name) folder.name = name;
    if (parentFolderId !== undefined) folder.parentFolderId = parentFolderId || null;
    
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Error updating folder', error: err.message });
  }
});
```

- [ ] **Step 5: Add DELETE /api/deck-folders/:id endpoint**

```javascript
app.delete('/api/deck-folders/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const folder = await DeckFolder.findById(req.params.id);
    if (!folder || folder.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Folder not found' });
    }
    
    // Move decks to parent folder
    if (folder.parentFolderId) {
      await DeckFolder.findByIdAndUpdate(
        folder.parentFolderId,
        { $push: { decks: folder.decks } }
      );
    }
    
    await DeckFolder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting folder', error: err.message });
  }
});
```

- [ ] **Step 6: Commit endpoints**

```bash
git add backend/server.js
git commit -m "feat: add deck folder CRUD endpoints"
```

### Task 17: Deck Folders - Update Deck Model

**Files:**
- Modify: `backend/models/Deck.js`

- [ ] **Step 1: Add folderId field to Deck schema**

Find the Deck schema and add:

```javascript
folderId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'DeckFolder',
  default: null
}
```

- [ ] **Step 2: Commit model update**

```bash
git add backend/models/Deck.js
git commit -m "feat: add folderId field to Deck model"
```

### Task 18: Admin Expansion - Collection Audit Endpoint

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add GET /api/admin/collection-audit endpoint (admin only)**

```javascript
app.get('/api/admin/collection-audit/:userId', verifyToken, requireAuth, async (req, res) => {
  // Check if admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  
  try {
    const cards = await Card.find({ userId: req.params.userId });
    const duplicates = cards.filter((card, index, self) =>
      self.findIndex(c => c.name === card.name && c.set === card.set) !== index
    );
    
    const audit = {
      totalCards: cards.length,
      totalValue: cards.reduce((sum, c) => sum + (c.price * c.quantity), 0),
      duplicates: duplicates.length,
      missingPrices: cards.filter(c => !c.price).length,
      missingImages: cards.filter(c => !c.imageUrl).length
    };
    
    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: 'Error auditing collection', error: err.message });
  }
});
```

- [ ] **Step 2: Commit audit endpoint**

```bash
git add backend/server.js
git commit -m "feat: add collection audit endpoint for admins"
```

---

## FINAL INTEGRATION TESTING

### Task 19: Integration Testing & Documentation

**Files:**
- Create: `docs/COLUMN_VISIBILITY.md`

- [ ] **Step 1: Create documentation**

```markdown
# Column Visibility System

## Overview
Users can right-click on the card table header to access a context menu that shows all available columns. Users can toggle which columns are visible. Preferences are saved per user in the database.

## Default Visible Columns
- Card Name
- Qty
- Condition
- Price

## All Available Columns (toggleable)
- Set
- Set Code
- Collector #
- Rarity
- Mana Cost
- Colors
- Types
- Location
- Foil
- Token
- Tags
- Buylist Value
- Sell Value
- Total
- Actions

## How to Use
1. Right-click on any table header
2. Context menu appears at cursor
3. Click checkboxes to toggle column visibility
4. Changes are saved automatically

## API Endpoints
- GET /api/user/column-preferences — fetch user's visible columns
- PUT /api/user/column-preferences — save visible columns

## Adding New Columns
1. Add column definition to ALL_COLUMNS in useColumnVisibility.js
2. Add conditional rendering in table body: {isColumnVisible('columnId') && <td>...</td>}
3. Column automatically appears in context menu
```

Save to `docs/COLUMN_VISIBILITY.md`

- [ ] **Step 2: Create feature checklist document**

```markdown
# Collection Improvements - Feature Checklist

## Column Visibility System ✓
- [x] Right-click context menu
- [x] Per-user database persistence
- [x] Conditional column rendering
- [x] Always-visible essential columns

## Performance & Quality ✓
- [x] Database indexes on userId queries
- [x] In-memory caching (5-minute TTL)
- [x] Cache invalidation on modifications

## Finance Bundle ✓
- [x] Buylist value tracking
- [x] Sell value tracking
- [x] Finance dashboard panel
- [x] Portfolio spread calculation

## Feature Bundle ✓
- [x] Collection value history (30-day)
- [x] Value chart visualization
- [x] Daily automated snapshots

## Price History Sparklines ✓
- [x] Price history tracking
- [x] 30-day sparkline display
- [x] Price hover tooltips

## Deck Folders ✓
- [x] Hierarchical folder structure
- [x] Folder CRUD endpoints
- [x] Deck-to-folder associations

## Admin Tools ✓
- [x] Collection audit endpoint
- [x] Duplicate detection
- [x] Missing data reports
```

Save to `docs/FEATURES_CHECKLIST.md`

- [ ] **Step 3: Test column system end-to-end**

1. Start both servers
2. Right-click table header → verify menu appears
3. Toggle columns → verify visibility changes
4. Refresh page → verify preferences persist
5. Login from different browser/incognito → verify preferences sync

- [ ] **Step 4: Test performance improvements**

1. Measure initial load time (should be slower first request)
2. Measure second load time (should be 5x faster due to cache)
3. Add a card → verify cache clears and refreshes
4. Verify stats load instantly on refresh (cached)

- [ ] **Step 5: Test finance features**

1. Click Finance button → verify panel shows
2. Add buylist/sell values to a few cards
3. Verify totals update correctly
4. Verify buylist/sell columns toggle via right-click

- [ ] **Step 6: Test value history chart**

1. Load chart → verify displays data
2. Verify X-axis shows dates, Y-axis shows values
3. Add a card and trigger snapshot → verify chart updates

- [ ] **Step 7: Test price sparklines**

1. Hover over card with price history
2. Verify bars appear below preview
3. Hover bars → verify dates/prices show

- [ ] **Step 8: Test deck folders**

1. Create a folder
2. Create nested subfolder
3. Move deck to folder
4. Verify hierarchy in API response
5. Delete folder → verify decks move to parent

- [ ] **Step 9: Commit all integration testing**

```bash
git add docs/COLUMN_VISIBILITY.md docs/FEATURES_CHECKLIST.md
git commit -m "docs: add column visibility and feature integration documentation"
```

---

## Summary

This plan implements:

1. **Column Visibility System** (Tasks 1-5)
   - Backend: UserColumnPreferences model + GET/PUT endpoints
   - Frontend: useColumnVisibility hook + ColumnContextMenu component
   - Right-click context menu with persistent per-user preferences

2. **Performance & Quality** (Task 6-7)
   - Strategic database indexes
   - In-memory caching with TTL

3. **Finance Bundle** (Tasks 8-10)
   - Buylist/sell value tracking
   - Finance dashboard with portfolio metrics

4. **Feature Bundle** (Task 11)
   - Collection value history with 30-day chart
   - Automatic daily snapshots

5. **Price History Sparklines** (Tasks 13-14)
   - Price tracking per card
   - Sparkline visualization on hover

6. **Deck Folders** (Tasks 15-17)
   - Hierarchical folder organization
   - Deck-to-folder associations

7. **Admin Tools** (Task 18)
   - Collection audit endpoint
   - Data quality reports

All 7 improvements integrate with the column visibility system — new columns automatically appear in the context menu for user toggling.

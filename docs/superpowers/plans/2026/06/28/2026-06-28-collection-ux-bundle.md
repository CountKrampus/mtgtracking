# Collection UX Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four UX improvements: saved filter presets, collector achievement milestones, mobile swipe gestures on card rows, and a floating quick-action button on mobile.

**Architecture:** Tasks 1–2 are independent frontend-only features in CollectionView. Task 3 adds a backend route + model + frontend component. Task 4 is a new reusable component. All tasks are independent and can be done in any order.

**Tech Stack:** React, Tailwind CSS, Express/Mongoose (Task 3 only), localStorage (Task 1)

---

## File Map

| File | Task | Role |
|------|------|------|
| `frontend/src/components/CollectionView.js` | 1, 2, 4 | Add preset UI, FAB, swipe wrapping |
| `frontend/src/components/SwipeableRow.js` | 2 | New: reusable touch-swipe wrapper |
| `backend/models/CollectorAchievement.js` | 3 | New: earned achievement records |
| `backend/routes/achievements.js` | 3 | New: GET /api/achievements |
| `backend/server.js` | 3 | Register achievements route |
| `frontend/src/components/AchievementsGrid.js` | 3 | New: achievement display component |
| `frontend/src/components/Dashboard.js` | 3 | Add AchievementsGrid section |

---

## Task 1: Saved Filter Presets

**Files:**
- Modify: `frontend/src/components/CollectionView.js`

Filter state lives in `CollectionView` as 9 separate `useState` hooks (lines 109–116: `filterCondition`, `filterColor`, `filterType`, `filterSpecial`, `filterRarity`, `filterSet`, `filterTag`, `filterLocation`, plus `searchTerm`). Presets are stored in `localStorage` under key `'mtg-filter-presets'` — no backend needed.

### Step 1a: Add `FilterPresetsPanel` component above `CollectionView`

Add this component **outside** (above) the `CollectionView` function — never define it inside. Place it near the other helper components at the top of the file (around line 22, after the imports).

```jsx
function FilterPresetsPanel({ currentFilters, onApply, onClose }) {
  const STORAGE_KEY = 'mtg-filter-presets';
  const [presets, setPresets] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });
  const [saveName, setSaveName] = React.useState('');
  const [showSaveInput, setShowSaveInput] = React.useState(false);

  const save = () => {
    if (!saveName.trim()) return;
    const next = [...presets, { id: Date.now().toString(), name: saveName.trim(), filters: currentFilters }];
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaveName('');
    setShowSaveInput(false);
  };

  const remove = (id) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-gray-900 border border-white/20 rounded-xl shadow-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-sm">Filter Presets</span>
        <button onClick={onClose} className="text-white/50 hover:text-white p-1"><X size={14} /></button>
      </div>

      {presets.length === 0 && (
        <p className="text-white/40 text-xs text-center py-3">No saved presets yet.</p>
      )}

      <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
        {presets.map(preset => (
          <div key={preset.id} className="flex items-center gap-2">
            <button
              onClick={() => { onApply(preset.filters); onClose(); }}
              className="flex-1 text-left px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition truncate"
            >
              {preset.name}
            </button>
            <button
              onClick={() => remove(preset.id)}
              className="p-1 text-white/30 hover:text-red-400 transition flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {showSaveInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Preset name..."
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            style={{ fontSize: '16px' }}
            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <button onClick={save} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition">Save</button>
          <button onClick={() => setShowSaveInput(false)} className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs transition">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="w-full px-2 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 hover:text-white rounded-lg text-sm transition text-center"
        >
          + Save current filters as preset
        </button>
      )}
    </div>
  );
}
```

### Step 1b: Add preset toggle state to `CollectionView`

Find the block of filter `useState` declarations (around line 109) and add:

```js
const [showPresets, setShowPresets] = React.useState(false);
```

### Step 1c: Add `currentFilters` object and `applyPreset` handler

Add these below the filter state declarations:

```js
const currentFilters = {
  searchTerm, filterCondition, filterColor, filterSet,
  filterType, filterSpecial, filterRarity, filterTag, filterLocation,
};

const applyPreset = (filters) => {
  setSearchTerm(filters.searchTerm ?? '');
  setFilterCondition(filters.filterCondition ?? 'all');
  setFilterColor(filters.filterColor ?? 'all');
  setFilterSet(filters.filterSet ?? 'all');
  setFilterType(filters.filterType ?? 'all');
  setFilterSpecial(filters.filterSpecial ?? 'all');
  setFilterRarity(filters.filterRarity ?? 'all');
  setFilterTag(filters.filterTag ?? 'all');
  setFilterLocation(filters.filterLocation ?? 'all');
};
```

### Step 1d: Add Presets button to the desktop filter bar

`Bookmark` must be imported from `lucide-react` (add to the existing import). In the desktop filter bar (the section starting around line 635 `hidden sm:block`), find the filter toggle button row and add the Presets button next to the existing filter controls. Place it at the end of the filter action buttons area:

```jsx
{/* Presets button — place alongside existing filter buttons */}
<div className="relative">
  <button
    onClick={() => setShowPresets(p => !p)}
    className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg text-sm transition"
    title="Filter presets"
  >
    <Bookmark size={14} />
    <span>Presets</span>
  </button>
  {showPresets && (
    <FilterPresetsPanel
      currentFilters={currentFilters}
      onApply={applyPreset}
      onClose={() => setShowPresets(false)}
    />
  )}
</div>
```

### Step 1e: Add Presets button to mobile filter bar

In the mobile filter bar section (`flex sm:hidden gap-2 mb-3`, around line 605), add the Presets button after the existing Filters button:

```jsx
<div className="relative">
  <button
    onClick={() => setShowPresets(p => !p)}
    className="flex items-center gap-2 px-3 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white transition min-h-[44px] flex-shrink-0"
    title="Presets"
  >
    <Bookmark size={16} />
  </button>
  {showPresets && (
    <FilterPresetsPanel
      currentFilters={currentFilters}
      onApply={applyPreset}
      onClose={() => setShowPresets(false)}
    />
  )}
</div>
```

### Step 1f: Dismiss presets panel on outside click

Add a `useEffect` to close the panel when clicking outside:

```js
useEffect(() => {
  if (!showPresets) return;
  const handler = (e) => {
    if (!e.target.closest('[data-presets-panel]')) setShowPresets(false);
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [showPresets]);
```

Add `data-presets-panel` attribute to both `FilterPresetsPanel` root `<div>` and the wrapper `<div className="relative">` buttons in steps 1d and 1e.

### Step 1g: Commit

```bash
git add frontend/src/components/CollectionView.js
git commit -m "feat: add saved filter presets with localStorage persistence"
```

---

## Task 2: Mobile Swipe Gestures on Card Rows

**Files:**
- Create: `frontend/src/components/SwipeableRow.js`
- Modify: `frontend/src/components/CollectionView.js` (update `MobileCardRow`)

The current `MobileCardRow` shows action buttons in a row at the bottom of each card. Swipe left on a card reveals a full-height action panel (edit / delete) on the right edge, replacing the always-visible buttons. This is the standard iOS/Android pattern.

### Step 2a: Create `SwipeableRow.js`

```jsx
// frontend/src/components/SwipeableRow.js
import React, { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 60;   // px before snap open
const ACTION_WIDTH    = 130;  // px of revealed action area

export default function SwipeableRow({ children, actions, disabled = false }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen]     = useState(false);
  const startX = useRef(null);
  const startOffset = useRef(0);

  const onTouchStart = (e) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startOffset.current = open ? -ACTION_WIDTH : 0;
  };

  const onTouchMove = (e) => {
    if (startX.current === null || disabled) return;
    const delta = e.touches[0].clientX - startX.current;
    const next = Math.min(0, Math.max(-ACTION_WIDTH, startOffset.current + delta));
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (startX.current === null) return;
    const shouldOpen = offset < -SWIPE_THRESHOLD;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -ACTION_WIDTH : 0);
    startX.current = null;
  };

  const close = () => { setOpen(false); setOffset(0); };

  return (
    <div className="relative overflow-hidden rounded-xl" onClick={open ? close : undefined}>
      {/* Action buttons revealed on swipe — positioned at right edge */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        {actions.map(({ label, icon: Icon, color, onClick }, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onClick(); close(); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium transition ${color}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Card content — slides left on swipe */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current ? 'none' : 'transform 0.2s ease',
          position: 'relative',
          zIndex: 1,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
```

### Step 2b: Update `MobileCardRow` in `CollectionView.js` to use `SwipeableRow`

Add import at top of `CollectionView.js`:

```js
import SwipeableRow from './SwipeableRow';
```

Replace the `MobileCardRow` function with:

```jsx
function MobileCardRow({ card, formatPrice, onEdit, onDelete, onUpdatePrice, onViewDetail }) {
  const swipeActions = [
    {
      label: 'Edit',
      icon: Edit2,
      color: 'bg-blue-600 hover:bg-blue-700',
      onClick: () => onEdit(card),
    },
    {
      label: 'Delete',
      icon: Trash2,
      color: 'bg-red-600 hover:bg-red-700',
      onClick: () => onDelete(card._id),
    },
  ];

  return (
    <SwipeableRow actions={swipeActions}>
      <div
        className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 active:bg-white/20 transition"
        onClick={() => onViewDetail(card)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-tight truncate">{card.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {card.set && <span className="text-white/50 text-xs">{card.set}</span>}
              <span className="px-1.5 py-0.5 bg-white/10 text-white/70 text-[11px] rounded">{card.condition}</span>
              {card.rarity && <span className="text-white/40 text-[11px]">{card.rarity}</span>}
            </div>
            {card.manaCost && (
              <p className="text-white/40 text-xs mt-1 font-mono">{card.manaCost}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-green-400 font-semibold">{formatPrice(card.price)}</p>
            <p className="text-white/40 text-xs mt-0.5">×{card.quantity}</p>
            <p className="text-white/30 text-xs">{formatPrice(card.price * card.quantity)} total</p>
          </div>
        </div>
        {/* Price update button stays visible — swipe reveals edit/delete */}
        <div className="flex justify-between items-center mt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-white/30 text-[11px]">← Swipe to edit or delete</p>
          <button
            onClick={() => onUpdatePrice(card._id)}
            className="p-2.5 bg-indigo-600/50 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Update price"
          >
            <DollarSign size={15} />
          </button>
        </div>
      </div>
    </SwipeableRow>
  );
}
```

### Step 2c: Commit

```bash
git add frontend/src/components/SwipeableRow.js frontend/src/components/CollectionView.js
git commit -m "feat: swipe left on mobile card rows to reveal edit/delete actions"
```

---

## Task 3: Collector Achievement Milestones

**Files:**
- Create: `backend/models/CollectorAchievement.js`
- Create: `backend/routes/achievements.js`
- Modify: `backend/server.js`
- Create: `frontend/src/components/AchievementsGrid.js`
- Modify: `frontend/src/components/Dashboard.js`

### Step 3a: Write failing test

In `backend/tests/achievements.test.js`:

```js
const request = require('supertest');
const { createTestApp, createTestUser, getAuthHeader } = require('./helpers');

describe('GET /api/achievements', () => {
  let app, user, headers;

  beforeAll(async () => {
    app = await createTestApp();
    user = await createTestUser();
    headers = await getAuthHeader(user);
  });

  it('returns array of achievements with earned flag', async () => {
    const res = await request(app)
      .get('/api/achievements')
      .set(headers)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('earned');
    expect(typeof res.body[0].earned).toBe('boolean');
  });

  it('requires authentication', async () => {
    await request(app).get('/api/achievements').expect(401);
  });
});
```

Run: `cd backend && npx jest achievements --no-coverage`
Expected: FAIL — route does not exist yet.

### Step 3b: Create `backend/models/CollectorAchievement.js`

```js
const mongoose = require('mongoose');

const collectorAchievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementId: { type: String, required: true },
  earnedAt: { type: Date, default: Date.now },
});
collectorAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('CollectorAchievement', collectorAchievementSchema);
```

### Step 3c: Create `backend/routes/achievements.js`

```js
const express = require('express');
const router = express.Router();
const Card = require('../models/Card');
const CollectorAchievement = require('../models/CollectorAchievement');
const { requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

const ACHIEVEMENTS = [
  { id: 'first_card',     name: 'First Card',         desc: 'Add your first card to the collection',   icon: '🃏',  check: (s) => s.totalCards >= 1     },
  { id: 'ten_cards',      name: 'Getting Started',     desc: 'Own 10 cards',                            icon: '📦',  check: (s) => s.totalCards >= 10    },
  { id: '100_cards',      name: 'Collector',           desc: 'Own 100 cards',                           icon: '📚',  check: (s) => s.totalCards >= 100   },
  { id: '500_cards',      name: 'Serious Collector',   desc: 'Own 500 cards',                           icon: '🏆',  check: (s) => s.totalCards >= 500   },
  { id: '1000_cards',     name: 'Master Collector',    desc: 'Own 1,000 cards',                         icon: '👑',  check: (s) => s.totalCards >= 1000  },
  { id: 'ten_value',      name: 'First Value',         desc: 'Collection worth $10+',                   icon: '💵',  check: (s) => s.totalValue >= 10    },
  { id: '100_value',      name: 'Valuable',            desc: 'Collection worth $100+',                  icon: '💰',  check: (s) => s.totalValue >= 100   },
  { id: '500_value',      name: 'High Value',          desc: 'Collection worth $500+',                  icon: '💎',  check: (s) => s.totalValue >= 500   },
  { id: '1000_value',     name: 'Premium Collection',  desc: 'Collection worth $1,000+',                icon: '🏅',  check: (s) => s.totalValue >= 1000  },
  { id: 'all_colors',     name: 'Five Colors',         desc: 'Own cards of all 5 mana colors',          icon: '🌈',  check: (s) => s.allColors           },
  { id: 'first_foil',     name: 'First Foil',          desc: 'Own your first foil card',                icon: '✨',  check: (s) => s.foilCount >= 1      },
  { id: 'ten_foils',      name: 'Foil Fan',            desc: 'Own 10 foil cards',                       icon: '⭐',  check: (s) => s.foilCount >= 10     },
  { id: 'five_sets',      name: 'Set Explorer',        desc: 'Own cards from 5+ different sets',        icon: '🗺️',  check: (s) => s.uniqueSets >= 5     },
  { id: 'twenty_sets',    name: 'Set Connoisseur',     desc: 'Own cards from 20+ different sets',       icon: '🌍',  check: (s) => s.uniqueSets >= 20    },
  { id: 'first_mythic',   name: 'Mythic!',             desc: 'Own a Mythic Rare',                       icon: '🔥',  check: (s) => s.mythicCount >= 1    },
];

async function getCollectionStats(userQuery) {
  const cards = await Card.find(userQuery).lean();
  const totalCards = cards.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalValue = cards.reduce((s, c) => s + ((c.price || 0) * (c.quantity || 1)), 0);
  const foilCount  = cards.filter(c => c.isFoil).reduce((s, c) => s + (c.quantity || 1), 0);
  const mythicCount = cards.filter(c => c.rarity === 'M').reduce((s, c) => s + (c.quantity || 1), 0);
  const sets = new Set(cards.map(c => c.set).filter(Boolean));
  const uniqueSets = sets.size;
  const colorSet = new Set(cards.flatMap(c => c.colors || []));
  const allColors = ['W', 'U', 'B', 'R', 'G'].every(c => colorSet.has(c));
  return { totalCards, totalValue, foilCount, mythicCount, uniqueSets, allColors };
}

// GET /api/achievements — returns all achievements with earned status
router.get('/', requireAuth, async (req, res) => {
  try {
    const userQuery = buildUserQuery({}, req);
    const [stats, earned] = await Promise.all([
      getCollectionStats(userQuery),
      CollectorAchievement.find({ userId: req.user._id }).lean(),
    ]);

    const earnedSet = new Set(earned.map(e => e.achievementId));
    const earnedDates = Object.fromEntries(earned.map(e => [e.achievementId, e.earnedAt]));

    // Auto-grant newly earned achievements
    const toGrant = ACHIEVEMENTS.filter(a => a.check(stats) && !earnedSet.has(a.id));
    if (toGrant.length) {
      await CollectorAchievement.insertMany(
        toGrant.map(a => ({ userId: req.user._id, achievementId: a.id })),
        { ordered: false }
      );
      toGrant.forEach(a => { earnedSet.add(a.id); earnedDates[a.id] = new Date(); });
    }

    const result = ACHIEVEMENTS.map(a => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      icon: a.icon,
      earned: earnedSet.has(a.id),
      earnedAt: earnedDates[a.id] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching achievements', error: err.message });
  }
});

module.exports = router;
```

### Step 3d: Register route in `backend/server.js`

Find the block where other routes are registered (look for `app.use('/api/trades'` or `app.use('/api/decks'`). Add:

```js
const achievementsRouter = require('./routes/achievements');
app.use('/api/achievements', achievementsRouter);
```

### Step 3e: Run test — expect PASS

```bash
cd backend && npx jest achievements --no-coverage
```
Expected: 2 tests pass.

### Step 3f: Create `frontend/src/components/AchievementsGrid.js`

```jsx
import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function AchievementsGrid() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/achievements`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setAchievements(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const earned = achievements.filter(a => a.earned);
  const unearned = achievements.filter(a => !a.earned);

  if (loading) return null;

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Collector Achievements</h2>
        <span className="text-white/50 text-sm">{earned.length}/{achievements.length}</span>
      </div>

      {earned.length > 0 && (
        <div className="mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Earned</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {earned.map(a => (
              <div
                key={a.id}
                title={`${a.name}: ${a.desc}`}
                className="flex flex-col items-center gap-1 p-2 bg-purple-600/20 border border-purple-500/30 rounded-xl"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-white text-[10px] font-semibold text-center leading-tight">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unearned.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Locked</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {unearned.map(a => (
              <div
                key={a.id}
                title={a.desc}
                className="flex flex-col items-center gap-1 p-2 bg-white/5 border border-white/10 rounded-xl opacity-50"
              >
                <span className="text-2xl grayscale">{a.icon}</span>
                <span className="text-white/40 text-[10px] text-center leading-tight">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3g: Add `AchievementsGrid` to `Dashboard.js`

Find the import block at the top of `frontend/src/components/Dashboard.js` and add:

```js
import AchievementsGrid from './AchievementsGrid';
```

Find the `return (` statement in `Dashboard` and add the achievements section at the bottom of the main content area (before the closing `</div>`):

```jsx
<AchievementsGrid />
```

### Step 3h: Commit

```bash
git add backend/models/CollectorAchievement.js backend/routes/achievements.js backend/server.js \
        backend/tests/achievements.test.js \
        frontend/src/components/AchievementsGrid.js frontend/src/components/Dashboard.js
git commit -m "feat: collector achievement milestones — auto-grant on collection stats"
```

---

## Task 4: Mobile Floating Quick-Action Button (FAB)

**Files:**
- Modify: `frontend/src/components/CollectionView.js`

The FAB is a purple `+` button fixed above the BottomNav on mobile only. It belongs inside `CollectionView` so it can directly call `setShowAddForm(true)` and `fileInputRef.current.click()`. `showAddForm` is already a state variable in `CollectionView` (line 120).

### Step 4a: Add `CollectionFAB` component above `CollectionView`

Add **outside** (above) the `CollectionView` function, after the other helper components:

```jsx
function CollectionFAB({ onAddCard, onImport }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {open && (
        <div
          className="sm:hidden fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="sm:hidden fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3">
        {open && (
          <>
            <div className="flex items-center gap-2">
              <span className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">Import from file</span>
              <button
                onClick={() => { setOpen(false); onImport(); }}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition"
              >
                <Upload size={20} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">Add card</span>
              <button
                onClick={() => { setOpen(false); onAddCard(); }}
                className="w-12 h-12 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-full shadow-lg flex items-center justify-center transition"
              >
                <PlusCircle size={20} />
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setOpen(p => !p)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
            open ? 'bg-gray-700 rotate-45' : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
          }`}
        >
          <Plus size={26} className="text-white" />
        </button>
      </div>
    </>
  );
}
```

`Upload`, `PlusCircle`, and `Plus` must be imported from `lucide-react` (add to the existing import if not already present).

### Step 4b: Render `CollectionFAB` inside `CollectionView`

Find the `return (` in `CollectionView`. Add just before the closing `</>` of the return fragment:

```jsx
<CollectionFAB
  onAddCard={() => {
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }}
  onImport={() => fileInputRef.current?.click()}
/>
```

`fileInputRef` is already passed as a prop to `CollectionView` (visible in the prop destructuring at line ~83).

### Step 4c: Commit

```bash
git add frontend/src/components/CollectionView.js
git commit -m "feat: floating quick-action button on mobile collection view"
```

---

## Verification

1. Start servers: run `start-both-servers.bat`
2. **Filter presets:** Apply some filters → click Presets → "Save current as preset" → name it → close → reset filters → reopen Presets → click the saved preset → filters restore
3. **Swipe gestures (mobile):** On a phone or browser mobile emulation (Chrome DevTools), swipe left on a card → Edit and Delete buttons slide in → tap Edit opens edit form, tap Delete confirms delete
4. **Achievements:** Open Dashboard → "Collector Achievements" section appears → shows earned badges (colored) and locked badges (greyed)
5. **FAB:** On mobile, purple `+` button floats above bottom nav on Collection view → tap expands to "Add card" and "Import from file" → tap Add card scrolls to top and expands the add form

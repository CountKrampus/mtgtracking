# Mobile Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MTG Tracker fully usable on phones with a bottom navigation bar, mobile card grid for the collection, collapsible filter sheet, and full-screen modal sheets — desktop unchanged.

**Architecture:** Tailwind CSS breakpoints only (`sm:` = 640px+ = desktop, bare classes = mobile). Two new components (`BottomNav`, `MobileFilterSheet`), a `MobileCardRow` sub-component inside CollectionView, and a consistent modal pattern (`items-end sm:items-center`, `rounded-t-xl sm:rounded-xl`) applied to all modals. No separate routes or duplicate views.

**Tech Stack:** React 18, Tailwind CSS, react-router-dom v7, lucide-react icons.

---

## Task 1: BottomNav component

**Files:**
- Create: `frontend/src/components/BottomNav.js`

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/components/BottomNav.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, MessageSquare, Layers, Grid2x2, Heart, Users, Settings, Globe, X, DollarSign } from 'lucide-react';

const PRIMARY_NAV = [
  { icon: Home,         label: 'Dashboard',  path: '/dashboard' },
  { icon: BookOpen,     label: 'Collection', path: '/collection' },
  { icon: MessageSquare,label: 'Forum',      path: '/forum' },
  { icon: Layers,       label: 'Decks',      path: '/decks' },
];

const MORE_NAV = [
  { icon: Heart,    label: 'Wishlist',         path: '/wishlist' },
  { icon: Users,    label: 'Life Counter',     path: '/lifecounter' },
  { icon: Globe,    label: 'Community Decks',  path: '/community-decks' },
  { icon: Settings, label: 'Settings',         path: '/settings' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const go = (path) => { navigate(path); setShowMore(false); };

  return (
    <>
      {/* More sheet backdrop */}
      {showMore && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More sheet */}
      {showMore && (
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-50 bg-gray-900/97 border-t border-white/10 rounded-t-2xl p-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-base">More</span>
            <button onClick={() => setShowMore(false)} className="p-2 text-white/60 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MORE_NAV.map(({ icon: Icon, label, path }) => (
              <button
                key={path}
                onClick={() => go(path)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition min-h-[72px] ${
                  isActive(path)
                    ? 'bg-purple-600/30 text-purple-400'
                    : 'hover:bg-white/10 text-white/60'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {PRIMARY_NAV.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => go(path)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] transition ${
                isActive(path) ? 'text-purple-400' : 'text-white/50 active:text-white/80'
              }`}
            >
              <Icon size={22} strokeWidth={isActive(path) ? 2.5 : 1.75} />
              <span className="text-[10px] leading-none">{label}</span>
            </button>
          ))}
          <button
            onClick={() => setShowMore((p) => !p)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] transition ${
              showMore ? 'text-purple-400' : 'text-white/50 active:text-white/80'
            }`}
          >
            <Grid2x2 size={22} strokeWidth={showMore ? 2.5 : 1.75} />
            <span className="text-[10px] leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED (no new errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BottomNav.js
git commit -m "feat(mobile): add BottomNav component with More sheet"
```

---

## Task 2: Wire BottomNav into App.js layout

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add the BottomNav import**

Find the import block (around line 30) and add:
```js
import BottomNav from './components/BottomNav';
```

- [ ] **Step 2: Add BottomNav to the JSX and fix main padding**

Find the outer layout div in the App return. It currently looks like:
```jsx
<div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col overflow-hidden">
  ...
  <div className="flex flex-1 overflow-hidden">
    <Sidebar ... />
    <main className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-content-offset sm:pt-6">
```

Make these two changes:

1. Add `pb-20 sm:pb-0` to the `<main>` className so content doesn't hide behind the nav bar:
```jsx
<main className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-content-offset sm:pt-6 pb-20 sm:pb-0">
```

2. Add `<BottomNav />` as the last child of the outer `h-screen` div (after the `flex flex-1` div):
```jsx
    </div>{/* end flex flex-1 */}
    <BottomNav />
  </div>{/* end h-screen */}
```

- [ ] **Step 3: Tighten mobile top header padding**

Find the top header bar:
```jsx
<div className="bg-slate-900/80 backdrop-blur border-b border-slate-700 px-6 py-3 flex items-center justify-between">
```
Change to:
```jsx
<div className="bg-slate-900/80 backdrop-blur border-b border-slate-700 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
```

- [ ] **Step 4: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat(mobile): wire BottomNav into App layout, fix main padding"
```

---

## Task 3: CollectionView — mobile header action buttons

**Files:**
- Modify: `frontend/src/components/CollectionView.js`

Context: CollectionView has a row of ~10 action buttons (Import, JSON, CSV, Update Prices, Fetch Card Text, Wishlist, Deck Builder, Commanders, Sets, Gear). These overflow on narrow screens. On mobile we show only the two most essential (Import + a "⋯" overflow button); the rest go in a bottom sheet.

- [ ] **Step 1: Add mobile actions state**

Inside `function CollectionView(`, find the existing `useState` declarations (around line 68) and add:
```js
const [showMobileActions, setShowMobileActions] = useState(false);
```

- [ ] **Step 2: Add the mobile actions sheet JSX**

Find the closing `</>` of the CollectionView return, just before it, add this block (it must be defined at module scope later — for now add as JSX inside the return):

```jsx
{/* Mobile actions sheet */}
{showMobileActions && (
  <>
    <div className="sm:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setShowMobileActions(false)} />
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl border-t border-white/10 p-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-semibold">Actions</span>
        <button onClick={() => setShowMobileActions(false)} className="p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X size={20} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { exportData('json'); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <Download size={16} /> Export JSON
        </button>
        <button onClick={() => { exportData('csv'); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <Download size={16} /> Export CSV
        </button>
        <button onClick={() => { setShowPriceUpdateModal(true); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <RefreshCw size={16} /> Update Prices
        </button>
        <button onClick={() => { updateAllOracleText(); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <RefreshCw size={16} /> Fetch Card Text
        </button>
        <button onClick={() => { setCurrentView('wishlist'); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-pink-600/40 hover:bg-pink-600/60 text-white rounded-xl transition">
          <Heart size={16} /> Wishlist
        </button>
        <button onClick={() => { setCurrentView('decks'); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-purple-600/40 hover:bg-purple-600/60 text-white rounded-xl transition">
          <Layers size={16} /> Deck Builder
        </button>
        <button onClick={() => { getCommanderRecommendations(); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-amber-600/40 hover:bg-amber-600/60 text-white rounded-xl transition">
          <Crown size={16} /> Commanders
        </button>
        <button onClick={() => { getSetCompletionData(); setShowMobileActions(false); }}
          className="flex items-center gap-2 px-4 py-3 bg-teal-600/40 hover:bg-teal-600/60 text-white rounded-xl transition">
          <BarChart3 size={16} /> Sets
        </button>
      </div>
    </div>
  </>
)}
```

Note: `exportData`, `setCurrentView`, `getCommanderRecommendations`, `getSetCompletionData` are all props already passed to CollectionView from App.js. `updateAllOracleText` and `setShowPriceUpdateModal` are also existing props.

- [ ] **Step 3: Wrap the desktop header buttons**

Find the section that renders the Import / JSON / CSV / etc. buttons. It starts with a `<div className="flex gap-2 flex-wrap ...">` or similar. Wrap it:

```jsx
{/* Desktop action buttons */}
<div className="hidden sm:flex gap-2 flex-wrap items-center">
  {/* ...all existing Import, JSON, CSV, Update Prices, etc. buttons unchanged... */}
</div>

{/* Mobile: Import + More */}
<div className="flex sm:hidden gap-2">
  <button
    onClick={() => fileInputRef.current?.click()}
    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition min-h-[44px]"
  >
    <Upload size={16} /> Import
  </button>
  <button
    onClick={() => setShowMobileActions(true)}
    className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold text-sm transition min-h-[44px]"
  >
    ⋯ More
  </button>
</div>
```

- [ ] **Step 4: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CollectionView.js
git commit -m "feat(mobile): collapse CollectionView action buttons into mobile sheet"
```

---

## Task 4: MobileFilterSheet component + filter button in CollectionView

**Files:**
- Create: `frontend/src/components/MobileFilterSheet.js`
- Modify: `frontend/src/components/CollectionView.js`

- [ ] **Step 1: Create MobileFilterSheet**

```jsx
// frontend/src/components/MobileFilterSheet.js
import React from 'react';
import { X, Search } from 'lucide-react';

export default function MobileFilterSheet({
  isOpen, onClose,
  searchTerm, setSearchTerm,
  filterCondition, setFilterCondition,
  filterSet, setFilterSet,
  filterColor, setFilterColor,
  filterType, setFilterType,
  filterSpecial, setFilterSpecial,
  filterRarity, setFilterRarity,
  filterTag, setFilterTag,
  filterLocation, setFilterLocation,
  sets, availableTags, locations,
  onClear,
}) {
  if (!isOpen) return null;

  const selectClass = "w-full px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 appearance-none";
  const labelClass = "block text-white/60 text-sm mb-1 font-medium";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl max-h-[88vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <span className="text-white font-semibold text-lg">Filters</span>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Search */}
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-white/40" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Card name, set, tags..."
                className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className={labelClass}>Condition</label>
            <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className={selectClass}>
              <option value="all">All Conditions</option>
              {['NM', 'LP', 'MP', 'HP', 'DMG'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Set */}
          <div>
            <label className={labelClass}>Set</label>
            <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} className={selectClass}>
              <option value="all">All Sets</option>
              {sets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className={labelClass}>Color</label>
            <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} className={selectClass}>
              <option value="all">All Colors</option>
              {['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClass}>
              <option value="all">All Types</option>
              {['Artifact','Battle','Creature','Enchantment','Instant','Land','Planeswalker','Sorcery','Tribal'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Special */}
          <div>
            <label className={labelClass}>Special</label>
            <select value={filterSpecial} onChange={(e) => setFilterSpecial(e.target.value)} className={selectClass}>
              <option value="all">All Cards</option>
              <option value="tokens">Tokens Only</option>
              <option value="non-tokens">Non-Tokens Only</option>
              <option value="foil">Foil Only</option>
              <option value="non-foil">Non-Foil Only</option>
            </select>
          </div>

          {/* Rarity */}
          <div>
            <label className={labelClass}>Rarity</label>
            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} className={selectClass}>
              <option value="all">All Rarities</option>
              <option value="C">Common (C)</option>
              <option value="U">Uncommon (U)</option>
              <option value="R">Rare (R)</option>
              <option value="M">Mythic (M)</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>Tags</label>
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className={selectClass}>
              <option value="all">All Tags</option>
              {availableTags.map((t) => {
                const name = t.name || t;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>Location</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={selectClass}>
              <option value="all">All Locations</option>
              {locations.map((l) => <option key={l._id} value={l.name}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => { onClear(); onClose(); }}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition font-medium min-h-[44px]"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition font-semibold min-h-[44px]"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Import MobileFilterSheet in CollectionView**

At the top of `frontend/src/components/CollectionView.js`, add the import:
```js
import MobileFilterSheet from './MobileFilterSheet';
```

- [ ] **Step 3: Add showMobileFilters state to CollectionView**

Inside `function CollectionView(`, near the other `useState` declarations:
```js
const [showMobileFilters, setShowMobileFilters] = useState(false);
```

- [ ] **Step 4: Add filter count helper**

Inside `function CollectionView(`, add:
```js
const activeFilterCount = [filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation]
  .filter((v) => v !== 'all').length + (searchTerm ? 1 : 0);
```

- [ ] **Step 5: Add mobile filter button + sheet to the filter bar section**

Find the filter bar section in the return JSX. It currently starts with:
```jsx
<div className="mb-6">
  <button onClick={() => setShowFilters(!showFilters)} ...>
```

Replace it with:
```jsx
<div className="mb-6">
  {/* Mobile: search + filter button */}
  <div className="flex sm:hidden gap-2 mb-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-3 text-white/60" size={18} />
      <input
        type="text"
        placeholder="Search cards..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-9 pr-4 py-2.5 bg-white/20 border border-white/30 rounded-xl text-white text-base placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[44px]"
      />
    </div>
    <button
      onClick={() => setShowMobileFilters(true)}
      className="relative flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white transition min-h-[44px] flex-shrink-0"
    >
      <span className="text-sm font-medium">Filters</span>
      {activeFilterCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
          {activeFilterCount}
        </span>
      )}
    </button>
  </div>

  {/* Desktop: collapsible filter bar (unchanged) */}
  <div className="hidden sm:block">
    <button onClick={() => setShowFilters(!showFilters)} ...>
      {/* ...existing toggle button... */}
    </button>
    {showFilters && (
      <div className="bg-white/10 backdrop-blur-md rounded-b-lg p-4 shadow-xl sticky top-0 z-30">
        {/* ...existing 8-column filter grid... */}
      </div>
    )}
  </div>

  {/* Mobile filter sheet */}
  <MobileFilterSheet
    isOpen={showMobileFilters}
    onClose={() => setShowMobileFilters(false)}
    searchTerm={searchTerm} setSearchTerm={setSearchTerm}
    filterCondition={filterCondition} setFilterCondition={setFilterCondition}
    filterSet={filterSet} setFilterSet={setFilterSet}
    filterColor={filterColor} setFilterColor={setFilterColor}
    filterType={filterType} setFilterType={setFilterType}
    filterSpecial={filterSpecial} setFilterSpecial={setFilterSpecial}
    filterRarity={filterRarity} setFilterRarity={setFilterRarity}
    filterTag={filterTag} setFilterTag={setFilterTag}
    filterLocation={filterLocation} setFilterLocation={setFilterLocation}
    sets={sets}
    availableTags={availableTags}
    locations={locations}
    onClear={() => {
      setSearchTerm(''); setFilterCondition('all'); setFilterSet('all');
      setFilterColor('all'); setFilterType('all'); setFilterSpecial('all');
      setFilterRarity('all'); setFilterTag('all'); setFilterLocation('all');
    }}
  />
</div>
```

Note: `sets` is a `useMemo` computed from cards inside CollectionView. `availableTags` and `locations` come from `useLocationTag()`.

- [ ] **Step 6: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/MobileFilterSheet.js frontend/src/components/CollectionView.js
git commit -m "feat(mobile): add MobileFilterSheet, mobile filter button with active count badge"
```

---

## Task 5: CollectionView — mobile card grid

**Files:**
- Modify: `frontend/src/components/CollectionView.js`

The collection table is replaced on mobile with a card-grid layout. `MobileCardRow` is a module-scope function (not inside `CollectionView`) to avoid the remount bug.

- [ ] **Step 1: Add MobileCardRow above CollectionView**

At the TOP of `frontend/src/components/CollectionView.js`, after the imports but BEFORE `function CollectionView(`, add:

```jsx
// Module-scope: prevents remount on every CollectionView render
function MobileCardRow({ card, formatPrice, onEdit, onDelete, onUpdatePrice, onViewDetail }) {
  return (
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
      <div className="flex justify-end gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onUpdatePrice(card._id)}
          className="p-2.5 bg-indigo-600/50 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Update price"
        >
          <DollarSign size={15} />
        </button>
        <button
          onClick={() => onEdit(card)}
          className="p-2.5 bg-blue-600/50 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Edit"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => onDelete(card._id)}
          className="p-2.5 bg-red-600/50 hover:bg-red-600 active:bg-red-700 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
```

`DollarSign`, `Edit2`, `Trash2` are already imported in CollectionView.js.

- [ ] **Step 2: Add Edit2 and Trash2 to imports if not present**

Check the lucide-react import line near the top of CollectionView.js. It should already have `DollarSign`, `Edit2`, `Trash2`. If any are missing add them to the destructure.

- [ ] **Step 3: Add the mobile card grid alongside the desktop table**

Find the Cards List section in CollectionView's return:
```jsx
{/* Cards List */}
<div className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
  <div className="overflow-x-auto">
    <table className="w-full" ...>
```

Wrap the entire existing `<div className="bg-white/10 ...">` in a desktop wrapper, and add a mobile grid before it:

```jsx
{/* Mobile card grid */}
<div className="sm:hidden space-y-3 mb-4">
  {paginatedCards.length === 0 ? (
    <div className="text-center py-12 text-white/40">
      No cards match your filters.
    </div>
  ) : (
    paginatedCards.map((card) => (
      <MobileCardRow
        key={card._id}
        card={card}
        formatPrice={formatPrice}
        onEdit={(c) => {
          setEditingId(c._id);
          setFormData({
            name: c.name, set: c.set || '', setCode: c.setCode || '',
            collectorNumber: c.collectorNumber || '', rarity: c.rarity || '',
            quantity: c.quantity, condition: c.condition,
            price: c.price, colors: c.colors || [], types: c.types || [],
            manaCost: c.manaCost || '', tags: c.tags || [], location: c.location || '',
            isToken: c.isToken || false, isFoil: c.isFoil || false,
            oracleText: c.oracleText || '', imageUrl: c.imageUrl || '',
            scryfallId: c.scryfallId || ''
          });
          setShowAddForm(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onDelete={(id) => {
          if (window.confirm('Delete this card?')) handleDelete(id, fetchCards);
        }}
        onUpdatePrice={(id) => updateCardPrice(id, false, false, fetchCards)}
        onViewDetail={setDetailCard}
      />
    ))
  )}
</div>

{/* Desktop table */}
<div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
  <div className="overflow-x-auto">
    <table className="w-full" ...>
    {/* ...all existing table JSX unchanged... */}
    </table>
  </div>
</div>
```

Note: `setEditingId`, `setFormData`, `setShowAddForm`, `handleDelete`, `updateCardPrice`, `fetchCards`, `setDetailCard` are all already available inside CollectionView via `useCardCollection()` context.

- [ ] **Step 4: Mobile pagination**

Find the pagination section in CollectionView. It currently renders page number buttons. Wrap it so mobile shows a simplified version:

```jsx
{/* Mobile pagination */}
{totalPages > 1 && (
  <div className="sm:hidden flex items-center justify-between mt-4 px-2">
    <button
      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
      disabled={currentPage === 1}
      className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl disabled:opacity-40 transition min-h-[44px] font-medium"
    >
      ← Prev
    </button>
    <span className="text-white/60 text-sm">
      Page {currentPage} of {totalPages}
    </span>
    <button
      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
      disabled={currentPage === totalPages}
      className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl disabled:opacity-40 transition min-h-[44px] font-medium"
    >
      Next →
    </button>
  </div>
)}
{/* Desktop pagination (existing, wrap in hidden sm:block) */}
<div className="hidden sm:block">
  {/* ...existing pagination JSX... */}
</div>
```

- [ ] **Step 5: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CollectionView.js
git commit -m "feat(mobile): add mobile card grid and simplified pagination to CollectionView"
```

---

## Task 6: Modals → full-screen bottom sheets on mobile

**Files:**
- Modify: `frontend/src/components/CollectionView.js`

All modals currently use `items-center justify-center` (centered overlay) with a `max-w-2xl` inner card. On mobile these overflow. The fix: `items-end sm:items-center`, `rounded-t-xl sm:rounded-xl`, `w-full sm:max-w-2xl`, `max-h-[90vh] overflow-y-auto`.

The pattern to apply to every modal wrapper:

**Before (find each one):**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
  <div className="bg-gray-900 rounded-xl w-full max-w-2xl ...">
```

**After:**
```jsx
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4">
  <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto ...">
```

- [ ] **Step 1: Apply pattern to Price Update modal**

Search for the price update modal in CollectionView.js (look for `showPriceUpdateModal &&`). Apply the before→after pattern above to its outer div.

- [ ] **Step 2: Apply pattern to Import Results modal**

Search for `showImportResults &&`. Apply the pattern.

- [ ] **Step 3: Apply pattern to Commander Recommendations panel**

Search for `showCommanderRecs &&`. Apply the pattern. This panel may be taller — use `max-h-[92vh]`.

- [ ] **Step 4: Apply pattern to Set Completion panel**

Search for `showSetCompletion &&`. Apply the pattern.

- [ ] **Step 5: Apply pattern to Combo Finder panel**

Search for `showComboFinder &&`. Apply the pattern.

- [ ] **Step 6: Apply pattern to Finance panel**

Search for `showFinancePanel &&`. Apply the pattern.

- [ ] **Step 7: Apply pattern to QR Preview modal**

Search for `showQRPreview &&`. Apply the pattern. Use `sm:max-w-sm` (QR is small).

- [ ] **Step 8: Apply pattern to Print Labels modal**

Search for `showPrintLabels &&`. Apply the pattern.

- [ ] **Step 9: Apply pattern to Location/Tags manager modal**

Search for `showLocationManager &&` (or similar). Apply the pattern. Use `max-h-[92vh]`.

- [ ] **Step 10: Apply pattern to Similar Cards panel**

Search for `showSimilarCards &&`. Apply the pattern. Use `max-h-[92vh]`.

- [ ] **Step 11: Apply pattern to Synergies panel**

Search for `showSynergies &&`. Apply the pattern. Use `max-h-[92vh]`.

- [ ] **Step 12: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/CollectionView.js
git commit -m "feat(mobile): convert all CollectionView modals to bottom sheets on mobile"
```

---

## Task 7: WishlistView mobile card list

**Files:**
- Modify: `frontend/src/components/WishlistView.js`

- [ ] **Step 1: Add MobileWishlistRow above WishlistView**

At the TOP of `frontend/src/components/WishlistView.js`, before `function WishlistView(`, add:

```jsx
function MobileWishlistRow({ item, formatPrice, onAcquire, onEdit, onDelete }) {
  const isDeal = item.targetPrice > 0 && item.currentPrice > 0 && item.currentPrice <= item.targetPrice;
  const diff = item.currentPrice - item.targetPrice;
  return (
    <div className={`rounded-xl p-4 border transition ${isDeal ? 'bg-green-900/30 border-green-500/30' : 'bg-white/10 border-white/10'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.set && <span className="text-white/50 text-xs">{item.set}</span>}
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              item.priority === 'high' ? 'bg-red-600/50 text-white' :
              item.priority === 'medium' ? 'bg-yellow-600/50 text-white' :
              'bg-gray-600/50 text-white'
            }`}>
              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            </span>
            {isDeal && <span className="px-1.5 py-0.5 bg-green-600 text-white text-[11px] font-bold rounded">DEAL!</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white/80 text-sm">Target: {formatPrice(item.targetPrice)}</p>
          <p className="text-white/60 text-xs">Current: {formatPrice(item.currentPrice)}</p>
          {item.targetPrice > 0 && (
            <p className={`text-xs font-semibold ${diff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {diff <= 0 ? '' : '+'}{formatPrice(diff)}
            </p>
          )}
        </div>
      </div>
      {item.notes && <p className="text-white/40 text-xs mb-3 truncate">{item.notes}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => onAcquire(item._id)}
          className="p-2.5 bg-green-600/60 hover:bg-green-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Acquire">
          <Plus size={15} />
        </button>
        <button onClick={() => onEdit(item)}
          className="p-2.5 bg-blue-600/60 hover:bg-blue-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Edit">
          <Edit2 size={15} />
        </button>
        <button onClick={() => onDelete(item._id)}
          className="p-2.5 bg-red-600/60 hover:bg-red-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Edit2, Trash2, Plus to WishlistView imports if missing**

Check the lucide-react import in WishlistView.js. It currently has `Plus`, `Edit2`, `Trash2` — confirm they're present.

- [ ] **Step 3: Replace the wishlist table with desktop/mobile split**

Find the `{/* Wishlist Table */}` section. Replace the outer `<div className="bg-white/10 ...">` with:

```jsx
{/* Mobile list */}
<div className="sm:hidden space-y-3">
  {filteredWishlistItems.length === 0 ? (
    <div className="text-center py-12 text-white/40">Your wishlist is empty. Add cards you want to acquire!</div>
  ) : (
    filteredWishlistItems.map(item => (
      <MobileWishlistRow
        key={item._id}
        item={item}
        formatPrice={formatPrice}
        onAcquire={handleAcquireWishlistItem}
        onEdit={handleWishlistEdit}
        onDelete={handleWishlistDelete}
      />
    ))
  )}
</div>

{/* Desktop table (unchanged, wrapped) */}
<div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
  <div className="overflow-x-auto">
    <table className="w-full">
      {/* ...all existing table JSX... */}
    </table>
  </div>
</div>
```

- [ ] **Step 4: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WishlistView.js
git commit -m "feat(mobile): add mobile card list to WishlistView"
```

---

## Task 8: Forum responsive fixes

**Files:**
- Modify: `frontend/src/components/Forum/ForumHome.js`
- Modify: `frontend/src/components/Forum/ThreadView.js`

Goal: fix overflow, padding, and font sizes. No structural redesign.

- [ ] **Step 1: ForumHome — add responsive padding and text**

Read `frontend/src/components/Forum/ForumHome.js`. For every outer container div that has `px-6` or `px-8`, change to `px-3 sm:px-6`. For any `text-2xl` headings that aren't in cards, add `text-xl sm:text-2xl`. For row/grid layouts with `flex gap-4` that should stack on mobile, add `flex-col sm:flex-row`.

Specifically:
- Category list rows: ensure `flex-col sm:flex-row` where they have user avatar + content side by side
- Thread preview rows: ensure text truncation (`truncate` or `line-clamp-2`) on mobile
- Stats numbers: ensure they don't overflow (`min-w-0` on text containers)

- [ ] **Step 2: ThreadView — reading experience**

Read `frontend/src/components/Forum/ThreadView.js`. Apply:
- Post container: `px-3 sm:px-6 py-4 sm:py-6`
- Post body text: `text-sm sm:text-base leading-relaxed`
- Reply composer: textarea `text-base` (prevents iOS zoom), full-width button row `flex-col sm:flex-row gap-2`
- User avatar + name row in posts: ensure it doesn't break on small screens (`flex items-start gap-3`, `min-w-0` on name column)

- [ ] **Step 3: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Forum/ForumHome.js frontend/src/components/Forum/ThreadView.js
git commit -m "feat(mobile): responsive padding and layout fixes for Forum views"
```

---

## Task 9: Dashboard + SettingsView responsive

**Files:**
- Modify: `frontend/src/components/Dashboard.js`
- Modify: `frontend/src/components/SettingsView.js`

- [ ] **Step 1: Dashboard — action buttons stack on mobile**

Read `frontend/src/components/Dashboard.js`. Find the action buttons row (Add Card, Import, Update Prices). Change its container from `flex gap-2` to `flex flex-col sm:flex-row gap-2`. Add `w-full sm:w-auto` to each button so they stretch full-width on mobile.

- [ ] **Step 2: Dashboard — stats grid**

Find the stats cards grid. If it uses `grid-cols-4` without a mobile override, change to `grid-cols-2 sm:grid-cols-4`. Verify it already handles this (it uses `grid-cols-2 sm:grid-cols-4` per the existing code).

- [ ] **Step 3: SettingsView — scrollable tab bar**

Read `frontend/src/components/SettingsView.js`. Find the settings tab bar (the row of tab buttons: Display, Pricing, Features, etc.). Change its container from `flex gap-2 border-b ...` to:
```jsx
<div className="flex gap-1 overflow-x-auto border-b border-white/20 pb-0 scrollbar-hide sm:flex-wrap">
```
And each tab button: add `whitespace-nowrap flex-shrink-0` so they don't wrap badly on mobile.

- [ ] **Step 4: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard.js frontend/src/components/SettingsView.js
git commit -m "feat(mobile): responsive fixes for Dashboard actions and SettingsView tabs"
```

---

## Task 10: Touch targets + iOS font zoom fix + safe area

**Files:**
- Modify: `frontend/src/App.css`
- Modify: `frontend/tailwind.config.js`

iOS auto-zooms when an input has `font-size < 16px`. The fix is `font-size: 16px` on inputs on mobile. All tappable elements should be at least 44×44px.

- [ ] **Step 1: Add iOS input font fix to App.css**

Open `frontend/src/App.css`. After the existing `@media (max-width: 640px)` block (or create it if it doesn't exist in a clean spot), add:

```css
/* iOS zoom prevention: inputs must be >= 16px font-size */
@media (max-width: 639px) {
  input[type="text"],
  input[type="email"],
  input[type="password"],
  input[type="number"],
  input[type="search"],
  select,
  textarea {
    font-size: 16px !important;
  }
}
```

- [ ] **Step 2: Add scrollbar-hide utility to tailwind.config.js**

Task 9 uses `scrollbar-hide` for the settings tab bar. Add it via a Tailwind plugin. Open `frontend/tailwind.config.js` and add to plugins array:

```js
const plugin = require('tailwindcss/plugin');

module.exports = {
  // ...existing config...
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    }),
  ],
};
```

If a `plugins` array already exists, add to it.

- [ ] **Step 3: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.css frontend/tailwind.config.js
git commit -m "feat(mobile): iOS input font zoom fix, scrollbar-hide utility, safe area insets"
```

---

## Task 11: All remaining modals → bottom sheets

**Files:**
- Modify: `frontend/src/components/shared/ConfirmModal.js`
- Modify: `frontend/src/components/Forum/ForumShop.js`
- Modify: `frontend/src/components/Forum/ForumAdminPanel.js`
- Modify: `frontend/src/components/Forum/MuteManager.js`
- Modify: `frontend/src/components/Forum/ThreadComposer.js`
- Modify: `frontend/src/components/Forum/PostEditHistory.js`
- Modify: `frontend/src/components/Forum/DuplicateDetectionModal.js`
- Modify: `frontend/src/components/Forum/ForumHome.js` (inline modal at line 252)
- Modify: `frontend/src/components/Forum/ThreadView.js` (confirmation dialogs at lines 553, 582)
- Modify: `frontend/src/components/Forum/ForumProfilePage.js` (modal at line 762)
- Modify: `frontend/src/components/Forum/DeckImportButton.js`
- Modify: `frontend/src/components/DeckList.js` (modals at lines 370, 432)
- Modify: `frontend/src/components/Gameplay/CubeBuilder.js` (modal at line 826)
- Modify: `frontend/src/components/CameraModal.js`
- Modify: `frontend/src/components/auth/AccountSettings.js`
- Modify: `frontend/src/components/avatars/AvatarPicker.js`
- Modify: `frontend/src/components/admin/AdminPanel.js`
- Modify: `frontend/src/components/admin/user-management/WarningsTab.js`
- Modify: `frontend/src/components/admin/user-management/BansTab.js` (×2 modals)
- Modify: `frontend/src/components/admin/user-management/UsersTab.js`
- Modify: `frontend/src/components/admin/user-management/AppealsTab.js`
- Modify: `frontend/src/components/LifeCounter/CommanderDamage.js`
- Modify: `frontend/src/components/LifeCounter/GameHistory.js`
- Modify: `frontend/src/components/LifeCounter/LifeCounter.js` (×2 modals)
- Modify: `frontend/src/components/LifeCounter/ManaPoolTracker.js`
- Modify: `frontend/src/components/LifeCounter/PartnerDamage.js`
- Modify: `frontend/src/components/LifeCounter/PlayerAdvancedControls.js`
- Modify: `frontend/src/components/LifeCounter/PlayerProfiles.js`
- Modify: `frontend/src/components/LifeCounter/SettingsPanel.js`
- Modify: `frontend/src/components/LifeCounter/ShareGame.js`
- Modify: `frontend/src/components/LifeCounter/StatsDashboard.js`
- Modify: `frontend/src/components/LifeCounter/TriggerReminders.js`
- Modify: `frontend/src/components/LifeCounter/ToolsPanel.js`
- Modify: `frontend/src/components/MyProfile.js` (modal at line 327)

The same two-line pattern from Task 6 applied to every remaining `fixed inset-0` modal.

**Before (in each file):**
```jsx
<div className="fixed inset-0 ... flex items-center justify-center z-50 p-4">
  <div className="bg-... rounded-xl w-full max-w-2xl ...">
```

**After:**
```jsx
<div className="fixed inset-0 ... flex items-end sm:items-center justify-center z-50 sm:p-4">
  <div className="bg-... rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto ...">
```

Size variants by panel type:
- **Narrow** (confirm dialogs, small forms like AvatarPicker, ThreadView confirmations): `sm:max-w-sm` — no `max-w` change needed on mobile since it goes full-width anyway
- **Standard** (most panels: ForumShop, AccountSettings, PostEditHistory, DuplicateDetectionModal, DeckList, LifeCounter modals): `sm:max-w-2xl`
- **Wide** (ForumAdminPanel, MuteManager, AdminPanel, user-management tabs, CubeBuilder, ThreadComposer): `sm:max-w-4xl`

**Exceptions — do NOT apply the pattern to:**
- `shared/ConfirmModal.js`: this IS a `fixed inset-0` component but it's a tiny confirmation dialog. Apply `items-end sm:items-center`, `rounded-t-2xl sm:rounded-xl`, and `sm:max-w-sm` — keep it compact.
- `LifeCounter/PlayerAdvancedControls.js:42`: uses `fixed inset-0 ... p-4` for a full-screen mode — check content before applying; if it's intentionally full-screen, skip.
- Any component that intentionally fills the full screen (e.g., `flex flex-col` with no max-width) — skip those, they're already full-screen.

- [ ] **Step 1: Fix shared/ConfirmModal.js**

This fixes confirmation dialogs everywhere they're used. Find the outer div and apply:
```jsx
<div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60">
  <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm p-6">
```

- [ ] **Step 2: Fix Forum modals (7 files)**

Apply the standard pattern to each file listed under Forum above. For `ThreadView.js` confirmations (lines 553, 582) and `ForumHome.js` inline modal (line 252), use `sm:max-w-sm` since these are simple dialogs. For `ForumShop.js`, `ForumAdminPanel.js`, `MuteManager.js`, `ThreadComposer.js`, `PostEditHistory.js`, `DuplicateDetectionModal.js`, `ForumProfilePage.js`, `DeckImportButton.js` use `sm:max-w-2xl` or `sm:max-w-4xl` based on their content width.

- [ ] **Step 3: Fix DeckList.js + CubeBuilder.js (2 files)**

Apply standard pattern to both modals in `DeckList.js` (lines 370, 432) and the modal in `CubeBuilder.js` (line 826). Use `sm:max-w-2xl`.

- [ ] **Step 4: Fix CameraModal.js**

The camera modal at line 636 is `fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4`. This is intentionally full-screen (shows camera feed). Skip the bottom-sheet pattern — it should stay full-screen on mobile. Instead, just verify it already has correct z-index and `p-0` on mobile so the camera fills the screen: change `p-4` to `p-0 sm:p-4`.

- [ ] **Step 5: Fix auth/AccountSettings.js + avatars/AvatarPicker.js (2 files)**

Apply standard pattern. AccountSettings: `sm:max-w-2xl`. AvatarPicker: `sm:max-w-sm` (it's a picker grid, doesn't need to be wide).

- [ ] **Step 6: Fix admin panels (5 files)**

Apply standard pattern to `admin/AdminPanel.js` and all four user-management tabs (`WarningsTab.js`, `BansTab.js` ×2, `UsersTab.js`, `AppealsTab.js`). Use `sm:max-w-4xl` for the admin panels (they have tables and need width on desktop). The mobile treatment is the same: full-width bottom sheet.

- [ ] **Step 7: Fix LifeCounter modals (11 files)**

Apply standard pattern to all LifeCounter modals. Most use `sm:max-w-lg` or `sm:max-w-2xl`. Skip `PlayerAdvancedControls.js` if its overlay is intentionally full-screen (verify by reading — if it has no inner max-width card, leave it).

- [ ] **Step 8: Fix MyProfile.js**

Apply standard pattern to the modal at line 327. Use `sm:max-w-2xl`.

- [ ] **Step 9: Build and verify**

```bash
cd frontend && CI=false npm run build
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/shared/ConfirmModal.js \
  frontend/src/components/Forum/ForumShop.js \
  frontend/src/components/Forum/ForumAdminPanel.js \
  frontend/src/components/Forum/MuteManager.js \
  frontend/src/components/Forum/ThreadComposer.js \
  frontend/src/components/Forum/PostEditHistory.js \
  frontend/src/components/Forum/DuplicateDetectionModal.js \
  frontend/src/components/Forum/ForumHome.js \
  frontend/src/components/Forum/ThreadView.js \
  frontend/src/components/Forum/ForumProfilePage.js \
  frontend/src/components/Forum/DeckImportButton.js \
  frontend/src/components/DeckList.js \
  frontend/src/components/Gameplay/CubeBuilder.js \
  frontend/src/components/CameraModal.js \
  frontend/src/components/auth/AccountSettings.js \
  frontend/src/components/avatars/AvatarPicker.js \
  frontend/src/components/admin/AdminPanel.js \
  "frontend/src/components/admin/user-management/WarningsTab.js" \
  "frontend/src/components/admin/user-management/BansTab.js" \
  "frontend/src/components/admin/user-management/UsersTab.js" \
  "frontend/src/components/admin/user-management/AppealsTab.js" \
  frontend/src/components/LifeCounter/CommanderDamage.js \
  frontend/src/components/LifeCounter/GameHistory.js \
  frontend/src/components/LifeCounter/LifeCounter.js \
  frontend/src/components/LifeCounter/ManaPoolTracker.js \
  frontend/src/components/LifeCounter/PartnerDamage.js \
  frontend/src/components/LifeCounter/PlayerAdvancedControls.js \
  frontend/src/components/LifeCounter/PlayerProfiles.js \
  frontend/src/components/LifeCounter/SettingsPanel.js \
  frontend/src/components/LifeCounter/ShareGame.js \
  frontend/src/components/LifeCounter/StatsDashboard.js \
  frontend/src/components/LifeCounter/TriggerReminders.js \
  frontend/src/components/LifeCounter/ToolsPanel.js \
  frontend/src/components/MyProfile.js
git commit -m "feat(mobile): convert all remaining modals to bottom sheets (Forum, admin, LifeCounter, Deck)"
```

---

## Verification Checklist

After all tasks, manually verify on a 375px-wide viewport (Chrome DevTools mobile simulation):

- [ ] Bottom nav bar visible, correct active highlight, More sheet opens/closes
- [ ] Collection page: search bar + Filters button visible, filter badge shows count
- [ ] Collection page: card grid renders (not table), Edit/Delete/Price buttons tappable
- [ ] Prev/Next pagination works on mobile
- [ ] Opening any modal (ForumShop, admin panels, LifeCounter dialogs, account settings, confirm dialogs) shows a bottom sheet (not a clipped center card)
- [ ] Wishlist shows card list on mobile
- [ ] Settings tab bar scrolls horizontally
- [ ] No inputs zoom the viewport on iOS (font-size ≥ 16px)
- [ ] Desktop (1280px): identical to before — bottom nav hidden, full table, all buttons visible

# App.js Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `frontend/src/App.js` (1105 lines, ~35 `useState` variables and their handlers, most of it existing only to prop-drill into `CollectionView`) into focused files, fixing the cross-route trigger bug where Dashboard/Sidebar/Command-Palette actions for Collection tools silently no-op unless the user happens to already be on `/collection`.

**Architecture:** Six Collection-only tools (Price Update, Commander Recommendations, Set Completion, Combo Finder, Finance, QR/Print Labels) move out of App.js into self-contained modal components under `frontend/src/components/CollectionTools/`, each owning its own state/API calls (matching the `DuplicateCleanup.js` pattern already established this session). `CollectionView` gains one local `activeTool` state plus a `?tool=` URL query param convention so any external trigger (Dashboard's button, Sidebar's buttons, Command Palette commands) can open a specific tool via `navigate('/collection?tool=priceUpdate')` regardless of current route — this is the fix for the underlying bug, not a separate patch. The 30+ `<Route>` table moves to `frontend/src/routes/AppRoutes.js`. QR/Print Labels is split differently (a shared hook + two modal components) because it's used by both `CollectionView` and `SettingsView`, not just one.

**Tech Stack:** React (CRA), react-router-dom (`useSearchParams`), lucide-react. No frontend test infra — verified via `npm run build` per task plus a full manual click-through in the final task.

**Spec:** `docs/superpowers/specs/2026-08-06-app-js-split-design.md`

**Source-of-truth line ranges** (confirmed by direct reading, `frontend/src/components/CollectionView.js` as of this plan's writing — re-verify at implementation time in case earlier tasks shift line numbers):
- Commander Recommendations modal JSX: lines 2457–2637
- Set Completion Tracker modal JSX: lines 2639–2719
- Combo Finder modal JSX: lines 2721–2980
- Price Update modal JSX: lines 2982–3036
- Finance Panel modal JSX: lines 3038–3071
- QR Preview modal JSX: lines 3088–3117
- Print All Labels modal JSX: lines 3119–3152

Each task below extracts one JSX range into a new file **verbatim**, with only the specific substitutions listed (state variable references become local `useState`/props instead of the old lifted props). Do not paraphrase or rewrite the JSX — cut and paste it, then apply exactly the listed substitutions.

---

## Task 1: `activeTool` mechanism + extract Price Update Modal

**Files:**
- Create: `frontend/src/components/CollectionTools/PriceUpdateModal.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/Dashboard.js` (prop rename only, see Step 6)

This task establishes the `activeTool`/`?tool=` mechanism that every later modal-extraction task reuses, so it also carries the most new wiring code. Later tasks are shorter.

- [ ] **Step 1: Create `frontend/src/components/CollectionTools/PriceUpdateModal.js`**

```jsx
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PriceUpdateModal({ isOpen, onClose, updateAllPrices }) {
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateFullData, setUpdateFullData] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-blue-500 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">Update All Prices</h2>
        <p className="text-white/60 mb-6">Choose update options:</p>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="w-5 h-5 mt-0.5 cursor-pointer"
            />
            <div>
              <div className="text-white font-medium">Force Update Existing Cards</div>
              <div className="text-white/60 text-sm">Update all cards even if they already have price data</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={updateFullData}
              onChange={(e) => setUpdateFullData(e.target.checked)}
              className="w-5 h-5 mt-0.5 cursor-pointer"
            />
            <div>
              <div className="text-white font-medium">Update Full Card Data</div>
              <div className="text-white/60 text-sm">Fetch complete metadata (set, rarity, colors, images, etc.)</div>
            </div>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              updateAllPrices(forceUpdate, updateFullData);
            }}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
          >
            <RefreshCw size={18} /> Update Prices
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

This is the JSX from `CollectionView.js` lines 2982–3036, with these substitutions: `showPriceUpdateModal &&` → component's own `if (!isOpen) return null` guard; `setShowPriceUpdateModal(false)` → `onClose()`; `forceUpdate`/`setForceUpdate`/`updateFullData`/`setUpdateFullData` → local `useState` (were lifted props, now local); `updateAllPrices` stays a prop (it comes from `useCardCollection()`, not from this modal's own state).

- [ ] **Step 2: Delete the old block from `CollectionView.js`**

Delete lines 2982–3036 (the `{/* Price Update Options Modal */}` comment through its closing `)}`) from `CollectionView.js`.

- [ ] **Step 3: Add the `activeTool` mechanism + render the new modal in `CollectionView.js`**

Add `useSearchParams` to the existing `react-router-dom` import at the top of the file (find the current import line and add `useSearchParams` to it — do not add a second import line).

Add near the top of the `CollectionView` function body, right after the existing `const navigate = useNavigate();` line:

```js
  const [searchParams, setSearchParams] = useSearchParams();
  // Lets Dashboard/Sidebar/Command-Palette open a specific Collection tool
  // from anywhere via navigate('/collection?tool=priceUpdate') etc., since
  // these tools only render while /collection is actually mounted.
  const [activeTool, setActiveTool] = useState(null);
  useEffect(() => {
    // Depends on searchParams (not mount-only) because the Sidebar is
    // rendered outside <Routes> and never unmounts CollectionView - clicking
    // a tool button while ALREADY on /collection only changes the query
    // string, it doesn't remount this component. A mount-only effect would
    // silently miss that case. Stripping the param below removes 'tool' from
    // searchParams, which re-triggers this effect once more with tool now
    // absent, so it self-terminates without looping.
    const tool = searchParams.get('tool');
    const validTools = ['priceUpdate', 'commanderRecs', 'setCompletion', 'comboFinder', 'finance'];
    if (tool && validTools.includes(tool)) {
      setActiveTool(tool);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tool');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);
```

Import `PriceUpdateModal` at the top of the file: `import PriceUpdateModal from './CollectionTools/PriceUpdateModal';`

Add the render call in the same place the old block was (where you deleted lines 2982–3036 in Step 2):

```jsx
        <PriceUpdateModal
          isOpen={activeTool === 'priceUpdate'}
          onClose={() => setActiveTool(null)}
          updateAllPrices={updateAllPrices}
        />
```

(`updateAllPrices` is already destructured from `useCardCollection()` earlier in this file — confirm it's still there; it was already in the existing destructuring at the top of `CollectionView`.)

- [ ] **Step 4: Remove `showPriceUpdateModal`/`setShowPriceUpdateModal`/`forceUpdate`/`setForceUpdate`/`updateFullData`/`setUpdateFullData` from `CollectionView`'s props destructuring**

In the `function CollectionView({ ... })` parameter list, remove:
```
showPriceUpdateModal, setShowPriceUpdateModal, forceUpdate, setForceUpdate, updateFullData, setUpdateFullData,
```

- [ ] **Step 5: Remove the corresponding state and prop-passing from `App.js`**

Remove these lines from `App.js`:
```js
  const [forceUpdate, setForceUpdate] = useState(false); // Force update cards even if they have data
  const [updateFullData, setUpdateFullData] = useState(false); // Update full card data (set, rarity, etc.)
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);
```

In the `<CollectionView ... />` route element, remove the line:
```
showPriceUpdateModal={showPriceUpdateModal} setShowPriceUpdateModal={setShowPriceUpdateModal}
forceUpdate={forceUpdate} setForceUpdate={setForceUpdate}
updateFullData={updateFullData} setUpdateFullData={setUpdateFullData}
```

In `handleKeyboardShortcut`'s Escape-key handling, remove the line `if (showPriceUpdateModal) { setShowPriceUpdateModal(false); return; }` and remove `showPriceUpdateModal` from that `useCallback`'s dependency array.

- [ ] **Step 6: Fix the cross-route triggers (this is the bug fix)**

In `App.js`, change the Dashboard route element's prop:
```js
onUpdatePrices={() => setShowPriceUpdateModal(true)}
```
to:
```js
onUpdatePrices={() => navigate('/collection?tool=priceUpdate')}
```
(there are two occurrences of this exact line in `App.js` — one on the `<Sidebar>` element, one on the `<Dashboard>` route element inside `<Route path="/dashboard">`; update both).

In `paletteCommands`, change:
```js
{ id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => setShowPriceUpdateModal(true) },
```
to:
```js
{ id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => navigate('/collection?tool=priceUpdate') },
```

`Dashboard.js` itself needs no changes — it already just calls whatever `onUpdatePrices` prop it's given; the fix is entirely in how `App.js` defines that prop.

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CollectionTools/PriceUpdateModal.js frontend/src/components/CollectionView.js frontend/src/App.js
git commit -m "feat: extract PriceUpdateModal and fix cross-route Update Prices trigger"
```

---

## Task 2: Extract Commander Recommendations Modal

**Files:**
- Create: `frontend/src/components/CollectionTools/CommanderRecommendationsModal.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `frontend/src/components/CollectionTools/CommanderRecommendationsModal.js`**

```jsx
import React, { useState } from 'react';
import { X, Crown, Search, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function CommanderRecommendationsModal({ isOpen, onClose, cards, fetchCards }) {
  const [commanderRecs, setCommanderRecs] = useState([]);
  const [loadingCommanders, setLoadingCommanders] = useState(false);
  const [commanderColorFilter, setCommanderColorFilter] = useState('auto');
  const [commanderFinderMode, setCommanderFinderMode] = useState('collection'); // 'collection' | 'finder'
  const [finderColors, setFinderColors] = useState([]);
  const [finderThemes, setFinderThemes] = useState([]);
  const [finderCreatureType, setFinderCreatureType] = useState('');

  const getCommanderRecommendations = async () => {
    setLoadingCommanders(true);
    setCommanderRecs([]);

    try {
      const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      const themeCounts = {};

      cards.forEach(card => {
        if (card.colors) {
          card.colors.forEach(color => {
            const c = color[0].toUpperCase();
            if (colorCounts[c] !== undefined) {
              colorCounts[c] += card.quantity;
            }
          });
        }

        const oracleText = (card.oracleText || '').toLowerCase();
        const themes = [
          { name: 'tokens', patterns: [/create.*token/, /token.*creature/] },
          { name: 'graveyard', patterns: [/from.*graveyard/, /into.*graveyard/, /mill/] },
          { name: 'counters', patterns: [/\+1\/\+1 counter/, /proliferate/] },
          { name: 'lifegain', patterns: [/gain.*life/, /lifelink/] },
          { name: 'sacrifice', patterns: [/sacrifice.*creature/, /when.*dies/] },
          { name: 'spellslinger', patterns: [/instant.*sorcery/, /when.*cast.*spell/] },
          { name: 'artifacts', patterns: [/artifact.*enter/, /artifact.*you.*control/] },
          { name: 'enchantments', patterns: [/enchantment.*enter/, /constellation/] },
          { name: 'tribal', patterns: [/creature.*type/, /creatures.*you.*control.*get/] },
          { name: 'ramp', patterns: [/add.*mana/, /search.*land/] },
          { name: 'draw', patterns: [/draw.*card/, /whenever.*draw/] },
          { name: 'control', patterns: [/counter.*spell/, /destroy.*target/, /exile.*target/] }
        ];

        themes.forEach(({ name, patterns }) => {
          if (patterns.some(p => p.test(oracleText))) {
            themeCounts[name] = (themeCounts[name] || 0) + card.quantity;
          }
        });
      });

      let colorQuery = '';
      if (commanderColorFilter === 'auto') {
        const sortedColors = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .filter(([_, count]) => count > 0);

        if (sortedColors.length >= 2) {
          const topColors = sortedColors.slice(0, 3).map(([c]) => c.toLowerCase());
          colorQuery = `id:${topColors.join('')}`;
        }
      } else if (commanderColorFilter !== 'all') {
        colorQuery = `id:${commanderColorFilter}`;
      }

      const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
      let themeQuery = '';
      if (topTheme) {
        const themeSearches = {
          tokens: 'o:"create" o:"token"',
          graveyard: 'o:"graveyard"',
          counters: 'o:"+1/+1 counter"',
          lifegain: 'o:"gain" o:"life"',
          sacrifice: 'o:"sacrifice"',
          spellslinger: 'o:"instant" o:"sorcery"',
          artifacts: 'o:"artifact"',
          enchantments: 'o:"enchantment"',
          tribal: 'o:"creature" o:"type"',
          ramp: 'o:"add" o:"mana"',
          draw: 'o:"draw" o:"card"',
          control: 'o:"counter" OR o:"destroy"'
        };
        themeQuery = themeSearches[topTheme[0]] || '';
      }

      const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error getting commander recommendations:', error);
      try {
        const response = await axios.get(
          'https://api.scryfall.com/cards/search?q=t:legendary+t:creature&order=edhrec&unique=cards'
        );
        setCommanderRecs(response.data.data.slice(0, 20));
      } catch (e) {
        setCommanderRecs([]);
      }
    } finally {
      setLoadingCommanders(false);
    }
  };

  const addCommanderToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;

      await axios.post(`${API_URL}/cards`, {
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber,
        rarity: cardData.rarity,
        quantity: 1,
        condition: 'NM',
        price: cardData.prices?.usd || 0,
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText,
        tags: ['commander'],
        location: ''
      });

      alert(`Added ${cardData.name} to your collection!`);
      fetchCards();
    } catch (error) {
      console.error('Error adding commander:', error);
      alert('Error adding commander to collection');
    }
  };

  const searchCommandersByPreference = async () => {
    setLoadingCommanders(true);
    setCommanderRecs([]);

    const themeSearches = {
      tokens: 'o:"create" o:"token"',
      graveyard: 'o:"graveyard"',
      counters: 'o:"+1/+1 counter"',
      lifegain: 'o:"gain" o:"life"',
      sacrifice: 'o:"sacrifice"',
      spellslinger: '(o:"instant" o:"sorcery")',
      artifacts: 'o:"artifact"',
      enchantments: 'o:"enchantment"',
      tribal: 'o:"creature you control"',
      ramp: 'o:"search your library" o:"land"',
      draw: 'o:"draw" o:"card"',
      control: '(o:"counter target" OR o:"destroy target")',
      voltron: '(o:"equip" OR o:"aura" OR o:"attach")',
      mill: 'o:"mill"',
      blink: '(o:"exile" o:"return" o:"battlefield")',
      stax: '(o:"can\'t" OR o:"don\'t untap")',
      grouphug: '(o:"each player" o:"draw")',
      aristocrats: '(o:"when" o:"dies")',
      storm: '(o:"copy" o:"spell")',
      landfall: 'o:"landfall"',
    };

    try {
      let parts = ['t:legendary', 't:creature'];

      if (finderColors.length > 0) {
        parts.push(`id<=${finderColors.join('').toLowerCase()}`);
      }

      const themeQueries = finderThemes.map(t => themeSearches[t]).filter(Boolean);
      if (themeQueries.length === 1) {
        parts.push(themeQueries[0]);
      } else if (themeQueries.length > 1) {
        parts.push(`(${themeQueries.join(' OR ')})`);
      }

      if (finderCreatureType.trim()) {
        parts.push(`t:${finderCreatureType.trim().toLowerCase()}`);
      }

      const searchQuery = parts.join(' ');
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error searching commanders by preference:', error);
      setCommanderRecs([]);
    } finally {
      setLoadingCommanders(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) getCommanderRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setCommanderRecs([]);
    setCommanderFinderMode('collection');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      {/* PASTE HERE: the inner <div className="bg-gray-900 rounded-t-2xl ..."> through its matching
          closing </div>, i.e. CollectionView.js lines 2460–2635 verbatim (everything between the
          outer overlay div opened above and the outer overlay div's own closing, which this file's
          closing tags below already provide) — see substitution list underneath this code block. */}
    </div>
  );
}
```

Paste `CollectionView.js` lines 2460–2635 (the `<div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-amber-500">` block and everything inside it) in place of the `{/* PASTE HERE */}` comment above, then apply these substitutions within the pasted content:
- The close button's `onClick={() => { setShowCommanderRecs(false); setCommanderRecs([]); setCommanderFinderMode('collection'); }}` → `onClick={handleClose}`.
- All other references to `commanderRecs`, `loadingCommanders`, `commanderColorFilter`, `setCommanderColorFilter`, `commanderFinderMode`, `setCommanderFinderMode`, `finderColors`, `setFinderColors`, `finderThemes`, `setFinderThemes`, `finderCreatureType`, `setFinderCreatureType`, `getCommanderRecommendations`, `searchCommandersByPreference`, `addCommanderToCollection` are unchanged — they now resolve to this file's own local state/functions defined above instead of props, same names.

- [ ] **Step 2: Delete the old block from `CollectionView.js`**

Delete lines 2457–2637 from `CollectionView.js` (the `{/* Commander Recommendations Modal */}` comment through its closing `)}`).

- [ ] **Step 3: Render the new modal in `CollectionView.js`**

Import: `import CommanderRecommendationsModal from './CollectionTools/CommanderRecommendationsModal';`

Render where the old block was:
```jsx
        <CommanderRecommendationsModal
          isOpen={activeTool === 'commanderRecs'}
          onClose={() => setActiveTool(null)}
          cards={cards}
          fetchCards={fetchCards}
        />
```

- [ ] **Step 4: Remove the extracted props from `CollectionView`'s destructuring**

Remove from the `function CollectionView({ ... })` parameter list:
```
showCommanderRecs, setShowCommanderRecs, commanderRecs, setCommanderRecs,
loadingCommanders, setLoadingCommanders, commanderColorFilter, setCommanderColorFilter,
commanderFinderMode, setCommanderFinderMode, finderColors, setFinderColors,
finderThemes, setFinderThemes, finderCreatureType, setFinderCreatureType,
getCommanderRecommendations, searchCommandersByPreference, addCommanderToCollection,
```

- [ ] **Step 5: Remove the corresponding state/handlers and prop-passing from `App.js`**

Remove the `// Commander Recommendations` state block (7 `useState` lines starting `const [showCommanderRecs, ...`), the `getCommanderRecommendations`, `addCommanderToCollection`, and `searchCommandersByPreference` function definitions in full, and the `showCommanderRecs={showCommanderRecs} setShowCommanderRecs={setShowCommanderRecs}` ... through `addCommanderToCollection={addCommanderToCollection}` prop lines on the `<CollectionView>` element.

In `handleKeyboardShortcut`, remove `if (showCommanderRecs) { setShowCommanderRecs(false); setCommanderFinderMode('collection'); return; }` and remove `showCommanderRecs` from the dependency array.

- [ ] **Step 6: Fix the cross-route triggers**

On the `<Sidebar>` element in `App.js`, change:
```js
onCommanders={getCommanderRecommendations}
```
to:
```js
onCommanders={() => navigate('/collection?tool=commanderRecs')}
```

In `paletteCommands`, change:
```js
{ id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => getCommanderRecommendations(), feature: 'commanderRecs' },
```
to:
```js
{ id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => navigate('/collection?tool=commanderRecs'), feature: 'commanderRecs' },
```

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CollectionTools/CommanderRecommendationsModal.js frontend/src/components/CollectionView.js frontend/src/App.js
git commit -m "feat: extract CommanderRecommendationsModal and fix its cross-route trigger"
```

---

## Task 3: Extract Set Completion Modal

**Files:**
- Create: `frontend/src/components/CollectionTools/SetCompletionModal.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `frontend/src/components/CollectionTools/SetCompletionModal.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { X, BarChart3, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function SetCompletionModal({ isOpen, onClose, cards }) {
  const [completionData, setCompletionData] = useState([]);
  const [loadingSetCompletion, setLoadingSetCompletion] = useState(false);

  const getSetCompletionData = async () => {
    setLoadingSetCompletion(true);

    try {
      const cardsBySet = {};
      cards.forEach(card => {
        if (card.setCode) {
          const code = card.setCode.toLowerCase();
          if (!cardsBySet[code]) {
            cardsBySet[code] = {
              setCode: code,
              setName: card.set,
              ownedCards: new Set(),
              totalOwned: 0
            };
          }
          cardsBySet[code].ownedCards.add(card.name);
          cardsBySet[code].totalOwned += card.quantity;
        }
      });

      const completion = [];
      const setCodes = Object.keys(cardsBySet);

      for (const code of setCodes.slice(0, 20)) {
        try {
          const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
          const setInfo = setResponse.data;

          completion.push({
            setCode: code.toUpperCase(),
            setName: setInfo.name,
            icon: setInfo.icon_svg_uri,
            ownedUnique: cardsBySet[code].ownedCards.size,
            totalInSet: setInfo.card_count,
            totalOwned: cardsBySet[code].totalOwned,
            releasedAt: setInfo.released_at,
            setType: setInfo.set_type
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.log(`Could not fetch set info for ${code}`);
        }
      }

      completion.sort((a, b) => (b.ownedUnique / b.totalInSet) - (a.ownedUnique / a.totalInSet));

      setCompletionData(completion);
    } catch (error) {
      console.error('Error getting set completion data:', error);
    } finally {
      setLoadingSetCompletion(false);
    }
  };

  useEffect(() => {
    if (isOpen) getSetCompletionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setCompletionData([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      {/* PASTE HERE: CollectionView.js lines 2642–2717 verbatim (the inner
          <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-4xl ..."> block) */}
    </div>
  );
}
```

Paste `CollectionView.js` lines 2642–2717 in place of the comment. Substitution: the close button's `onClick={() => { setShowSetCompletion(false); setCompletionData([]); }}` → `onClick={handleClose}`. All other references (`completionData`, `loadingSetCompletion`) resolve unchanged to this file's local state.

- [ ] **Step 2: Delete the old block from `CollectionView.js`**

Delete lines 2639–2719.

- [ ] **Step 3: Render the new modal**

Import: `import SetCompletionModal from './CollectionTools/SetCompletionModal';`

```jsx
        <SetCompletionModal
          isOpen={activeTool === 'setCompletion'}
          onClose={() => setActiveTool(null)}
          cards={cards}
        />
```

- [ ] **Step 4: Remove extracted props from `CollectionView`'s destructuring**

Remove:
```
showSetCompletion, setShowSetCompletion, completionData, setCompletionData, loadingSetCompletion, getSetCompletionData,
```

- [ ] **Step 5: Remove state/handler and prop-passing from `App.js`**

Remove the `// Set Completion Tracker` state block (3 `useState` lines) and the `getSetCompletionData` function definition. Remove the corresponding `showSetCompletion={...} ... getSetCompletionData={getSetCompletionData}` prop lines from the `<CollectionView>` element.

In `handleKeyboardShortcut`, remove `if (showSetCompletion) { setShowSetCompletion(false); return; }` and remove `showSetCompletion` from the dependency array.

- [ ] **Step 6: Fix cross-route triggers**

On `<Sidebar>`: `onSets={getSetCompletionData}` → `onSets={() => navigate('/collection?tool=setCompletion')}`.

In `paletteCommands`: `action: () => getSetCompletionData()` → `action: () => navigate('/collection?tool=setCompletion')` (the `tool-sets` command).

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CollectionTools/SetCompletionModal.js frontend/src/components/CollectionView.js frontend/src/App.js
git commit -m "feat: extract SetCompletionModal and fix its cross-route trigger"
```

---

## Task 4: Extract Combo Finder Modal

**Files:**
- Create: `frontend/src/components/CollectionTools/ComboFinderModal.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `frontend/src/components/CollectionTools/ComboFinderModal.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { X, Zap, Heart, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function ComboFinderModal({ isOpen, onClose, fetchWishlist }) {
  const [comboResults, setComboResults] = useState({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboTab, setComboTab] = useState('complete');

  const findCombos = async () => {
    setLoadingCombos(true);
    setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
    setComboTab('complete');

    try {
      const response = await axios.get(`${API_URL}/combos/find`);
      setComboResults(response.data);
      if (response.data.found === 0 && response.data.partialFound > 0) {
        setComboTab('partial');
      }
    } catch (error) {
      console.error('Error finding combos:', error);
      setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0, error: error.message });
    } finally {
      setLoadingCombos(false);
    }
  };

  const addToWishlistFromCombo = async (cardName) => {
    try {
      const searchResponse = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(cardName)}`);
      const cardData = searchResponse.data;

      await axios.post(`${API_URL}/wishlist`, {
        name: cardData.name,
        set: cardData.set || 'Unknown',
        imageUrl: cardData.imageUrl,
        currentPrice: cardData.price || 0,
        targetPrice: cardData.price || 0,
        priority: 'medium',
        notes: 'Added from Combo Finder'
      });

      alert(`${cardData.name} added to wishlist!`);
      fetchWishlist();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: cardName,
          set: 'Unknown',
          currentPrice: 0,
          targetPrice: 0,
          priority: 'medium',
          notes: 'Added from Combo Finder'
        });
        alert(`${cardName} added to wishlist!`);
        fetchWishlist();
      } catch (e) {
        alert('Failed to add card to wishlist');
      }
    }
  };

  useEffect(() => {
    if (isOpen) findCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
    setComboTab('complete');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      {/* PASTE HERE: CollectionView.js lines 2724–2979 verbatim (the inner
          <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl ..."> block) */}
    </div>
  );
}
```

Paste `CollectionView.js` lines 2724–2979 in place of the comment. Substitution: the close button's `onClick={() => { setShowComboFinder(false); setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 }); setComboTab('complete'); }}` → `onClick={handleClose}`. The "Try Again" button's `onClick={findCombos}` is unchanged (resolves to the local function). All other references (`comboResults`, `loadingCombos`, `comboTab`, `setComboTab`, `addToWishlistFromCombo`) resolve unchanged to local state/functions.

- [ ] **Step 2: Delete the old block from `CollectionView.js`**

Delete lines 2721–2980.

- [ ] **Step 3: Render the new modal**

Import: `import ComboFinderModal from './CollectionTools/ComboFinderModal';`

```jsx
        <ComboFinderModal
          isOpen={activeTool === 'comboFinder'}
          onClose={() => setActiveTool(null)}
          fetchWishlist={fetchWishlist}
        />
```

(`fetchWishlist` is already destructured from `useWishlist()` earlier in `CollectionView.js`.)

- [ ] **Step 4: Remove extracted props from `CollectionView`'s destructuring**

Remove:
```
showComboFinder, setShowComboFinder, comboResults, setComboResults, loadingCombos, comboTab, setComboTab,
findCombos, addToWishlistFromCombo,
```

- [ ] **Step 5: Remove state/handlers and prop-passing from `App.js`**

Remove the `// Combo Finder` state block (4 `useState` lines), the `findCombos` and `addToWishlistFromCombo` function definitions, and the corresponding prop lines on `<CollectionView>`.

In `handleKeyboardShortcut`, remove `if (showComboFinder) { setShowComboFinder(false); return; }` and remove `showComboFinder` from the dependency array.

- [ ] **Step 6: Fix cross-route triggers**

On `<Sidebar>`: `onCombos={findCombos}` → `onCombos={() => navigate('/collection?tool=comboFinder')}`.

In `paletteCommands`: `action: () => findCombos()` → `action: () => navigate('/collection?tool=comboFinder')` (the `tool-combos` command).

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CollectionTools/ComboFinderModal.js frontend/src/components/CollectionView.js frontend/src/App.js
git commit -m "feat: extract ComboFinderModal and fix its cross-route trigger"
```

---

## Task 5: Extract Finance Panel

**Files:**
- Create: `frontend/src/components/CollectionTools/FinancePanel.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `frontend/src/components/CollectionTools/FinancePanel.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function FinancePanel({ isOpen, onClose }) {
  const [financeData, setFinanceData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const response = await axios.get(`${API_URL}/finance`);
        setFinanceData(response.data);
      } catch (error) {
        console.error('Error fetching finance data:', error);
      }
    })();
  }, [isOpen]);

  if (!isOpen || !financeData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      {/* PASTE HERE: CollectionView.js lines 3041–3069 verbatim (the inner
          <div className="bg-slate-900 rounded-t-2xl sm:rounded-lg border border-slate-700 ..."> block) */}
    </div>
  );
}
```

Paste `CollectionView.js` lines 3041–3069 in place of the comment. Substitution: the close button's `onClick={() => setShowFinancePanel(false)}` → `onClick={onClose}`. `financeData` resolves unchanged to this file's local state.

- [ ] **Step 2: Delete the old block from `CollectionView.js`**

Delete lines 3038–3071.

- [ ] **Step 3: Render the new modal**

Import: `import FinancePanel from './CollectionTools/FinancePanel';`

```jsx
        <FinancePanel
          isOpen={activeTool === 'finance'}
          onClose={() => setActiveTool(null)}
        />
```

- [ ] **Step 4: Remove extracted props from `CollectionView`'s destructuring**

Remove:
```
showFinancePanel, setShowFinancePanel, financeData, openFinancePanel,
```

- [ ] **Step 5: Remove state/handler and prop-passing from `App.js`**

Remove `const [showFinancePanel, setShowFinancePanel] = useState(false);`, `const [financeData, setFinanceData] = useState(null);`, and the `openFinancePanel` function definition. Remove `showFinancePanel={showFinancePanel} setShowFinancePanel={setShowFinancePanel}` and `financeData={financeData} openFinancePanel={openFinancePanel}` from the `<CollectionView>` element.

`App.js`'s `onFinance={openFinancePanel}` prop passed to `<Sidebar>` and `paletteCommands`'s `act-finance` entry both currently call `openFinancePanel()` — this function is being removed, so both call sites must change in Step 6 below (not left calling a now-deleted function).

- [ ] **Step 6: Fix cross-route triggers**

On `<Sidebar>`: `onFinance={openFinancePanel}` → `onFinance={() => navigate('/collection?tool=finance')}`.

In `paletteCommands`: `{ id: 'act-finance', label: 'View Finance', icon: DollarSign, category: 'Actions', action: () => openFinancePanel() }` → `action: () => navigate('/collection?tool=finance')`.

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CollectionTools/FinancePanel.js frontend/src/components/CollectionView.js frontend/src/App.js
git commit -m "feat: extract FinancePanel and fix its cross-route trigger"
```

---

## Task 6: Extract `useQRLabels` hook + QR/Print-Labels modals, wire into SettingsView

**Files:**
- Create: `frontend/src/hooks/useQRLabels.js`
- Create: `frontend/src/components/CollectionTools/QRPreviewModal.js`
- Create: `frontend/src/components/CollectionTools/PrintLabelsModal.js`
- Modify: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/components/SettingsView.js`
- Modify: `frontend/src/App.js`

Unlike Tasks 1–5, this one isn't triggered via `?tool=` — `CollectionView` and `SettingsView` each call the hook independently and manage their own show/hide locally, since both need "live" QR generation while mounted on their own route (see spec section 3).

- [ ] **Step 1: Create `frontend/src/hooks/useQRLabels.js`**

```js
import { useState } from 'react';
import QRCode from 'qrcode';

// Shared QR-label generation/preview/print-labels state, used independently
// by both CollectionView and SettingsView (each gets its own instance).
export default function useQRLabels() {
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [qrPreviewLocation, setQRPreviewLocation] = useState(null);
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  const generateQR = async (locationName) => {
    const url = `${window.location.origin}?location=${encodeURIComponent(locationName)}`;
    try {
      return await QRCode.toDataURL(url, { width: 150, margin: 1 });
    } catch (err) {
      console.error('QR generation failed:', err);
      return null;
    }
  };

  return {
    qrDataUrls, setQrDataUrls,
    generateQR,
    showQRPreview, setShowQRPreview,
    qrPreviewLocation, setQRPreviewLocation,
    showPrintLabels, setShowPrintLabels,
  };
}
```

This is `App.js`'s existing `generateQR` function (lines 248–256) plus the four QR-related `useState` declarations (lines 231–234), moved verbatim into a hook.

- [ ] **Step 2: Create `frontend/src/components/CollectionTools/QRPreviewModal.js`**

```jsx
import React from 'react';
import { X } from 'lucide-react';

export default function QRPreviewModal({ showQRPreview, qrPreviewLocation, setShowQRPreview, qrDataUrls, locationStats, formatPrice }) {
  if (!showQRPreview || !qrPreviewLocation) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      {/* PASTE HERE: CollectionView.js lines 3091–3116 verbatim (the inner
          <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-sm ..."> block) */}
    </div>
  );
}
```

Paste `CollectionView.js` lines 3091–3116 in place of the comment — no substitutions needed, every reference inside (`setShowQRPreview`, `qrDataUrls`, `qrPreviewLocation`, `locationStats`, `formatPrice`) is a prop of this component with the same name.

- [ ] **Step 3: Create `frontend/src/components/CollectionTools/PrintLabelsModal.js`**

```jsx
import React from 'react';

export default function PrintLabelsModal({ showPrintLabels, setShowPrintLabels, locations, qrDataUrls, locationStats, formatPrice }) {
  if (!showPrintLabels) return null;

  return (
    <>
      {/* PASTE HERE: CollectionView.js lines 3120–3152 verbatim (the outer
          <div className="fixed inset-0 bg-black/90 flex flex-col z-50 print:bg-white"> block) */}
    </>
  );
}
```

Paste `CollectionView.js` lines 3120–3152 in place of the comment — no substitutions needed.

- [ ] **Step 4: Delete the old blocks from `CollectionView.js`, add the hook + new components**

Delete lines 3088–3117 (QR Preview) and lines 3119–3152 (Print Labels) from `CollectionView.js`.

Remove `showQRPreview, setShowQRPreview, qrPreviewLocation, setQRPreviewLocation, qrDataUrls, setQrDataUrls, showPrintLabels, setShowPrintLabels, generateQR,` from `CollectionView`'s props destructuring.

Add near the top of the `CollectionView` function body (with the other hook calls like `useLocationTag()`):
```js
  const qrLabels = useQRLabels();
```

Import at the top of the file:
```js
import useQRLabels from '../hooks/useQRLabels';
import QRPreviewModal from './CollectionTools/QRPreviewModal';
import PrintLabelsModal from './CollectionTools/PrintLabelsModal';
```

Render where the old blocks were:
```jsx
        <QRPreviewModal
          showQRPreview={qrLabels.showQRPreview}
          qrPreviewLocation={qrLabels.qrPreviewLocation}
          setShowQRPreview={qrLabels.setShowQRPreview}
          qrDataUrls={qrLabels.qrDataUrls}
          locationStats={locationStats}
          formatPrice={formatPrice}
        />
        <PrintLabelsModal
          showPrintLabels={qrLabels.showPrintLabels}
          setShowPrintLabels={qrLabels.setShowPrintLabels}
          locations={locations}
          qrDataUrls={qrLabels.qrDataUrls}
          locationStats={locationStats}
          formatPrice={formatPrice}
        />
```

Find every remaining reference within `CollectionView.js` to `generateQR`, `qrDataUrls`, `setQrDataUrls`, `setQRPreviewLocation`, `setShowQRPreview`, `setShowPrintLabels` (there is at least one elsewhere in the file — the per-location QR button that triggers a preview, likely near the Locations UI or wherever a location row has a "Print QR" action; search the file for `generateQR(` to find it) and update those call sites to use `qrLabels.generateQR(...)`, `qrLabels.qrDataUrls`, `qrLabels.setQrDataUrls`, `qrLabels.setQRPreviewLocation`, `qrLabels.setShowQRPreview`, `qrLabels.setShowPrintLabels` respectively.

- [ ] **Step 5: Wire the hook into `SettingsView.js`**

Read `frontend/src/components/SettingsView.js`'s current props list and locate where `generateQR`, `qrDataUrls`, `setQrDataUrls`, `setQRPreviewLocation`, `setShowQRPreview`, `setShowPrintLabels` are used (they arrive today as props from `App.js`, per the `/settings` route element in `App.js`). Remove those six from `SettingsView`'s props destructuring. Add `import useQRLabels from '../hooks/useQRLabels';` and `import QRPreviewModal from './CollectionTools/QRPreviewModal';` and `import PrintLabelsModal from './CollectionTools/PrintLabelsModal';` (adjust the relative path if `SettingsView.js` doesn't live directly in `components/` — it does, per `App.js`'s import `import SettingsView from './components/SettingsView';`, so these paths match `CollectionView.js`'s).

Add near the top of `SettingsView`'s function body: `const qrLabels = useQRLabels();`

Update every place `SettingsView.js` currently calls `generateQR(...)`, reads/writes `qrDataUrls`/`setQrDataUrls`, or calls `setQRPreviewLocation`/`setShowQRPreview`/`setShowPrintLabels` to use `qrLabels.<name>` instead (same six substitutions as Step 4). Render `<QRPreviewModal .../>` and `<PrintLabelsModal .../>` (same props shape as Step 4) somewhere in `SettingsView`'s own returned JSX — near wherever its existing Locations-manager markup ends is reasonable; match this file's existing structure rather than inventing new layout.

- [ ] **Step 6: Remove the hook state and prop-passing from `App.js`**

Remove the `// QR Labels` state block (4 `useState` lines, 231–234) and the `generateQR` function (248–256) from `App.js`.

On the `<CollectionView>` element, remove:
```
showQRPreview={showQRPreview} setShowQRPreview={setShowQRPreview}
qrPreviewLocation={qrPreviewLocation} setQRPreviewLocation={setQRPreviewLocation}
qrDataUrls={qrDataUrls} setQrDataUrls={setQrDataUrls}
showPrintLabels={showPrintLabels} setShowPrintLabels={setShowPrintLabels}
generateQR={generateQR}
```

On the `<SettingsView>` element, remove:
```
generateQR={generateQR}
qrDataUrls={qrDataUrls}
setQrDataUrls={setQrDataUrls}
setQRPreviewLocation={setQRPreviewLocation}
setShowQRPreview={setShowQRPreview}
setShowPrintLabels={setShowPrintLabels}
```

In `handleKeyboardShortcut`, remove `if (showQRPreview) { setShowQRPreview(false); return; }` and remove `showQRPreview` from the dependency array. (QR Preview/Print Labels no longer participate in the App-level Escape handler at all now that they're fully local to whichever route is showing them — each modal already closes itself independently via its own UI; this is an intentional, spec-approved narrowing of Escape's scope, not an oversight.)

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useQRLabels.js frontend/src/components/CollectionTools/QRPreviewModal.js frontend/src/components/CollectionTools/PrintLabelsModal.js frontend/src/components/CollectionView.js frontend/src/components/SettingsView.js frontend/src/App.js
git commit -m "feat: extract useQRLabels hook and QR/print-labels modals, used independently by Collection and Settings"
```

---

## Task 7: Extract the route table into `AppRoutes.js`

**Files:**
- Create: `frontend/src/routes/AppRoutes.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `frontend/src/routes/AppRoutes.js`**

```jsx
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ChunkErrorBoundary from '../components/ChunkErrorBoundary';
import SharedDeckView from '../components/CommunityDecks/SharedDeckView';
import CommunityDecks from '../components/CommunityDecks/CommunityDecks';
import ForumView from '../components/ForumView';
import MessagesPage from '../components/MessagesPage';
import MyProfile from '../components/MyProfile';
import UserProfile from '../components/UserProfile';
import SettingsView from '../components/SettingsView';
import lazyWithRetry from '../utils/lazyWithRetry';

const DeckBuilder = React.lazy(() => import('../components/DeckBuilder'));
const LifeCounter = React.lazy(() => import('../components/LifeCounter/LifeCounter'));
const Dashboard = lazyWithRetry(() => import('../components/Dashboard'), { retries: 2, retryDelay: 600 });

const CardRulingsBrowser = React.lazy(() => import('../components/Learn/CardRulingsBrowser'));
const InteractionChecker = React.lazy(() => import('../components/Learn/InteractionChecker'));
const NewPlayerGuide = React.lazy(() => import('../components/Learn/NewPlayerGuide'));
const KeywordGlossary = React.lazy(() => import('../components/Learn/KeywordGlossary'));
const ComboTutorials = React.lazy(() => import('../components/Learn/ComboTutorials'));
const FormatGuides = React.lazy(() => import('../components/Learn/FormatGuides'));

const SealedSimulator = React.lazy(() => import('../components/Gameplay/SealedSimulator'));
const ArchenemyMode = React.lazy(() => import('../components/Gameplay/ArchenemyMode'));
const StarVariant = React.lazy(() => import('../components/Gameplay/StarVariant'));
const PlanechaseMode = React.lazy(() => import('../components/Gameplay/PlanechaseMode'));
const CustomFormatBuilder = React.lazy(() => import('../components/Gameplay/CustomFormatBuilder'));
const CubeBuilder = React.lazy(() => import('../components/Gameplay/CubeBuilder'));

const ReprintTracker = React.lazy(() => import('../components/Tools/ReprintTracker'));
const SetReleaseCalendar = React.lazy(() => import('../components/Tools/SetReleaseCalendar'));
const SpoilerSeasonIntegration = React.lazy(() => import('../components/Tools/SpoilerSeasonIntegration'));

const CollectionView = React.lazy(() => import('../components/CollectionView'));
const WishlistView = React.lazy(() => import('../components/WishlistView'));
const CollectionHealthReportView = React.lazy(() => import('../components/CollectionHealthReportView'));
const TradingBoard = React.lazy(() => import('../components/TradingBoard'));
const ChallengesView = React.lazy(() => import('../components/ChallengesView'));

function SharedDeckViewRoute() {
  const { shareCode } = useParams();
  return <SharedDeckView shareCode={shareCode} />;
}

function UserProfileRoute({ onBack }) {
  const { username } = useParams();
  return <UserProfile username={username} onBack={onBack} />;
}

function LoadingFallback() {
  return <div className="flex items-center justify-center h-full text-white/50">Loading...</div>;
}

export default function AppRoutes({
  cards, totalCards, totalValue, ignoredValue, formatPrice,
  navigate, fileInputRef, isImporting, setIsImporting,
  importProgress, setImportProgress, importResults, setImportResults,
  showImportResults, setShowImportResults,
  authUser, settings, updateSettings, resetSettings,
  locations, availableTags, locationStats,
  newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
  editingLocation, handleCreateLocation, handleUpdateLocation, cancelEditLocation,
  startEditLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
  newTagName, setNewTagName, handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
}) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <ChunkErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard
              cards={cards}
              totalCards={totalCards}
              totalValue={totalValue}
              ignoredValue={ignoredValue}
              onAddCard={() => navigate('/collection')}
              onImport={() => fileInputRef.current?.click()}
              onUpdatePrices={() => navigate('/collection?tool=priceUpdate')}
              fileInputRef={fileInputRef}
              isImporting={isImporting}
              formatPrice={formatPrice}
            />
          </Suspense>
        </ChunkErrorBoundary>
      } />

      <Route path="/collection" element={
        <Suspense fallback={<LoadingFallback />}>
          <CollectionView
            fileInputRef={fileInputRef}
            isImporting={isImporting} setIsImporting={setIsImporting}
            importProgress={importProgress} setImportProgress={setImportProgress}
            importResults={importResults} setImportResults={setImportResults}
            showImportResults={showImportResults} setShowImportResults={setShowImportResults}
          />
        </Suspense>
      } />

      <Route path="/wishlist" element={
        <Suspense fallback={<LoadingFallback />}><WishlistView /></Suspense>
      } />

      <Route path="/health-report" element={
        <Suspense fallback={<LoadingFallback />}><CollectionHealthReportView /></Suspense>
      } />

      <Route path="/trades" element={
        <Suspense fallback={<LoadingFallback />}><TradingBoard /></Suspense>
      } />

      <Route path="/challenges" element={
        <Suspense fallback={<LoadingFallback />}><ChallengesView /></Suspense>
      } />

      <Route path="/decks" element={
        <Suspense fallback={<LoadingFallback />}><DeckBuilder /></Suspense>
      } />

      <Route path="/lifecounter" element={
        <Suspense fallback={<LoadingFallback />}><LifeCounter onBack={() => navigate('/dashboard')} /></Suspense>
      } />

      <Route path="/settings" element={
        <SettingsView
          settings={settings}
          updateSettings={updateSettings}
          resetSettings={resetSettings}
          formatPrice={formatPrice}
          locations={locations}
          availableTags={availableTags}
          locationStats={locationStats}
          newLocationName={newLocationName}
          setNewLocationName={setNewLocationName}
          newLocationDesc={newLocationDesc}
          setNewLocationDesc={setNewLocationDesc}
          editingLocation={editingLocation}
          handleCreateLocation={handleCreateLocation}
          handleUpdateLocation={handleUpdateLocation}
          cancelEditLocation={cancelEditLocation}
          startEditLocation={startEditLocation}
          handleDeleteLocation={handleDeleteLocation}
          handleToggleLocationIgnorePrice={handleToggleLocationIgnorePrice}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          handleCreateTag={handleCreateTag}
          handleDeleteTag={handleDeleteTag}
          handleToggleTagIgnorePrice={handleToggleTagIgnorePrice}
        />
      } />

      <Route path="/messages" element={
        authUser ? <MessagesPage user={authUser} onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/profile" element={
        authUser ? <MyProfile user={authUser} onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/u/:username" element={
        authUser ? <UserProfileRoute onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/forum/*" element={<ForumView />} />

      <Route path="/community-decks" element={<CommunityDecks />} />

      <Route path="/learn/card-rulings" element={<Suspense fallback={<LoadingFallback />}><CardRulingsBrowser /></Suspense>} />
      <Route path="/learn/interaction-checker" element={<Suspense fallback={<LoadingFallback />}><InteractionChecker /></Suspense>} />
      <Route path="/learn/new-player-guide" element={<Suspense fallback={<LoadingFallback />}><NewPlayerGuide /></Suspense>} />
      <Route path="/learn/keyword-glossary" element={<Suspense fallback={<LoadingFallback />}><KeywordGlossary /></Suspense>} />
      <Route path="/learn/combo-tutorials" element={<Suspense fallback={<LoadingFallback />}><ComboTutorials /></Suspense>} />
      <Route path="/learn/format-guides" element={<Suspense fallback={<LoadingFallback />}><FormatGuides /></Suspense>} />

      <Route path="/play/sealed-simulator" element={<Suspense fallback={<LoadingFallback />}><SealedSimulator /></Suspense>} />
      <Route path="/play/archenemy" element={<Suspense fallback={<LoadingFallback />}><ArchenemyMode /></Suspense>} />
      <Route path="/play/star-variant" element={<Suspense fallback={<LoadingFallback />}><StarVariant /></Suspense>} />
      <Route path="/play/planechase" element={<Suspense fallback={<LoadingFallback />}><PlanechaseMode /></Suspense>} />
      <Route path="/play/custom-format" element={<Suspense fallback={<LoadingFallback />}><CustomFormatBuilder /></Suspense>} />

      <Route path="/tools/cube-builder" element={<Suspense fallback={<LoadingFallback />}><CubeBuilder /></Suspense>} />
      <Route path="/tools/reprint-tracker" element={<Suspense fallback={<LoadingFallback />}><ReprintTracker /></Suspense>} />
      <Route path="/tools/set-calendar" element={<Suspense fallback={<LoadingFallback />}><SetReleaseCalendar /></Suspense>} />
      <Route path="/tools/spoilers" element={<Suspense fallback={<LoadingFallback />}><SpoilerSeasonIntegration /></Suspense>} />

      <Route path="/shared/deck/:shareCode" element={<SharedDeckViewRoute />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
```

Note the `/collection` route element keeps `fileInputRef` and the four import-flow props (`isImporting`, `importProgress`, `importResults`, `showImportResults` + their setters) — the import flow was never one of the seven tools in scope for extraction (see spec's tool list), so those props are unchanged from before this refactor. Every other prop `CollectionView` used to receive was one of the six extracted tools' lifted state, removed in Tasks 1–6 (`CollectionView` now manages `activeTool` and `qrLabels` internally, and gets `cards`/`fetchCards`/etc. from its own `useCardCollection()`/`useLocationTag()`/`useWishlist()` hooks, same as it already did for the majority of its data before this refactor).

- [ ] **Step 2: Replace the inline `<Routes>...</Routes>` block in `App.js` with `<AppRoutes />`**

Delete the entire `<Routes>...</Routes>` JSX block (originally lines 833–1039, now shifted earlier by everything removed in Tasks 1–6 — locate it by its `<Route path="/" element={<Navigate to="/dashboard" replace />} />` opening line) and the `LoadingFallback` local component definition (no longer used directly in `App.js`), and the `SharedDeckViewRoute`/`UserProfileRoute` helper components at the top of the file (moved into `AppRoutes.js`).

Import `AppRoutes` at the top of `App.js`: `import AppRoutes from './routes/AppRoutes';`

Remove the now-unused `React.lazy`/`lazyWithRetry` component declarations and their associated imports (`lazyWithRetry`, `ChunkErrorBoundary` if no longer referenced elsewhere in `App.js`, `SharedDeckView`, `CommunityDecks`, `ForumView`, `MessagesPage`, `MyProfile`, `UserProfile`, `SettingsView`) — check each import is genuinely unused elsewhere in `App.js` before removing it (e.g. `ChunkErrorBoundary` might still wrap something else; verify with a search before deleting any import).

In its place, render:
```jsx
          <AppRoutes
            cards={cards}
            totalCards={totalCards}
            totalValue={totalValue}
            ignoredValue={ignoredValue}
            formatPrice={formatPrice}
            navigate={navigate}
            fileInputRef={fileInputRef}
            isImporting={isImporting} setIsImporting={setIsImporting}
            importProgress={importProgress} setImportProgress={setImportProgress}
            importResults={importResults} setImportResults={setImportResults}
            showImportResults={showImportResults} setShowImportResults={setShowImportResults}
            authUser={authUser}
            settings={settings}
            updateSettings={updateSettings}
            resetSettings={resetSettings}
            locations={locations}
            availableTags={availableTags}
            locationStats={locationStats}
            newLocationName={newLocationName}
            setNewLocationName={setNewLocationName}
            newLocationDesc={newLocationDesc}
            setNewLocationDesc={setNewLocationDesc}
            editingLocation={editingLocation}
            handleCreateLocation={handleCreateLocation}
            handleUpdateLocation={handleUpdateLocation}
            cancelEditLocation={cancelEditLocation}
            startEditLocation={startEditLocation}
            handleDeleteLocation={handleDeleteLocation}
            handleToggleLocationIgnorePrice={handleToggleLocationIgnorePrice}
            newTagName={newTagName}
            setNewTagName={setNewTagName}
            handleCreateTag={handleCreateTag}
            handleDeleteTag={handleDeleteTag}
            handleToggleTagIgnorePrice={handleToggleTagIgnorePrice}
          />
```

(This keeps the same `<Breadcrumb />`-then-routes structure inside `<main>` that already exists in `App.js` — only the `<Routes>` block itself is replaced by `<AppRoutes />`.)

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/AppRoutes.js frontend/src/App.js
git commit -m "refactor: extract the route table into routes/AppRoutes.js"
```

---

## Task 8: Final cleanup pass on `App.js`

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Remove now-dead imports**

Read the full current `App.js` and remove any top-of-file import that's no longer referenced anywhere in the file as a result of Tasks 1–7 (e.g. icons like `Crown`, `BarChart3`, `Zap` might still be used by `paletteCommands`' `icon:` fields — check each before removing; `QRCode` from `'qrcode'` should now be unused since `generateQR` moved into the hook; `X` might now be unused if no inline modal JSX referencing it remains in `App.js`).

- [ ] **Step 2: Verify the `handleKeyboardShortcut` Escape handling is coherent**

After Tasks 1–6's removals, the Escape-key branch inside `handleKeyboardShortcut` should now only reference `showCommandPalette` and `showImportResults` (import results is not part of this refactor's scope — leave it as-is). Confirm no dangling references to removed state (`showPriceUpdateModal`, `showCommanderRecs`, `showSetCompletion`, `showComboFinder`, `showQRPreview`) remain in either the handler body or its dependency array.

- [ ] **Step 3: Verify it compiles with no warnings about unused variables**

Run: `cd frontend && npm run build`
Expected: succeeds with no new `no-unused-vars` warnings introduced by this refactor (pre-existing unrelated warnings in other files are fine).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js
git commit -m "chore: remove dead imports and state left over from the App.js split"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 2: Manual click-through**

With both servers running, log in and verify:
- From `/dashboard`, click "Update Prices" — navigates to `/collection` and the Price Update modal opens immediately (this is the bug fix from Task 1 — confirm it actually opens, not just navigates).
- From any page, open the Command Palette (Ctrl+K) and run "Update Prices", "Commander Recommendations", "Set Completion Tracker", "Find Combos", "View Finance" — each navigates to `/collection` and opens the correct modal.
- From the Sidebar (visible on any page), click each of Commanders/Sets/Combos/Finance/Update Prices — same result.
- While already on `/collection`, each tool's own toolbar/menu entry still opens its modal directly without a page navigation.
- Commander Recommendations: both "From Collection" and "Commander Finder" modes work, "+ Add to Collection" adds a card.
- Set Completion Tracker renders progress bars.
- Combo Finder's Complete/Near-Complete tabs both work, "Add to wishlist" on a missing combo piece works.
- Finance panel shows correct values.
- QR Preview and Print Labels both work from `/collection` (per-location QR button) AND from `/settings` (Locations manager) — confirm both routes generate/display QR codes independently.
- Escape key closes the Command Palette when open.
- The URL's `?tool=` param disappears after the modal opens (doesn't linger, doesn't reopen the modal if you press back).

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff (base: the commit before Task 1, head: the last commit) before merging.

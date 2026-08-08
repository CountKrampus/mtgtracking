# Multi-Deck Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Compare Decks" tool in the Deck Builder — pick any two of your own decks, see a mana-curve/color-pip overlay plus a single filterable card list (All / Shared / Only A / Only B). Entirely client-side, no new backend route.

**Architecture:** One new self-contained modal component (`DeckComparisonModal.js`), wired into `DeckList.js` exactly like the existing `DeckShellExtractor`/`DeckShoppingList` tool modals. All comparison logic runs in a `useMemo` over the two selected `Deck` objects already present in the `decks` array `DeckList.js` already has loaded — no fetch, no loading state beyond the picker step itself.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual mobile-width click-through, matching every other frontend feature built this session).

**Spec:** `docs/superpowers/specs/2026-08-07-multi-deck-comparison-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `GET /api/decks` (what populates `DeckList.js`'s `decks` prop) returns full `Deck` documents including `mainDeck`, `commander`, `partnerCommander`, and a persisted `statistics` field (`manaCurve`, `colorDistribution`, `typeDistribution`, `avgManaCost`) computed server-side on every save — see `backend/models/Deck.js:39-45` and `backend/utils/deckHelpers.js:59-106`.
- `manaCurve` bucket keys are `'0','1','2','3','4','5','6','7+'` — note the literal string `'7+'`, not `7`.
- `colorDistribution`/`manaCurve` may come back as either a plain object OR a `Map` instance depending on code path — `DeckDetail.js:802-803` already has a defensive `toPlainObj` helper for this; reuse the identical pattern.
- `calculateDeckStatistics` (backend) folds each deck's `commander`/`partnerCommander` into `manaCurve`/`colorDistribution` already — so the stats charts include the commander's contribution. This is intentional per the spec; do NOT try to subtract the commander back out of the stats.
- Commander presence must be checked via `?.name` (e.g. `deck.partnerCommander?.name`), never raw truthiness — a Mongoose nested-subdocument path is a truthy object even when logically "no partner commander" exists. This bug has bitten this codebase twice already (see `backend/utils/deckHelpers.js:79-82`).
- Color hex values for consistent styling, from `DeckDetail.js:42-49`:
  ```js
  const COLOR_META = {
    W: { color: '#f5e6a3', label: 'White'     },
    U: { color: '#60a5fa', label: 'Blue'      },
    B: { color: '#6b7280', label: 'Black'     },
    R: { color: '#f87171', label: 'Red'       },
    G: { color: '#4ade80', label: 'Green'     },
    C: { color: '#9ca3af', label: 'Colorless' },
  };
  ```
- The mobile bottom-sheet modal shape used everywhere in this codebase (all ~40 modals fixed this session) is `fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0` on the outer wrapper, with `bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto` (or similar) on the inner panel. Use this exact shape — do not invent a new one.
- Filter-toggle rows and multi-control button rows must use `flex flex-wrap`, never rely on horizontal scroll (that pattern is reserved for genuine tab strips like Admin Panel's group tabs) — this was a repeated finding across this session's mobile audit.

---

## Task 1: `DeckComparisonModal.js` skeleton — picker step + wiring into `DeckList.js`

**Files:**
- Create: `frontend/src/components/DeckComparisonModal.js`
- Modify: `frontend/src/components/DeckList.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Create the component file with the picker step**

Create `frontend/src/components/DeckComparisonModal.js`:

```jsx
import React, { useState, useMemo } from 'react';
import { X, GitCompare } from 'lucide-react';

// Picker step: choose two distinct decks before the comparison renders.
function DeckPicker({ decks, deckAId, deckBId, onSelectA, onSelectB, onCompare }) {
  const canCompare = deckAId && deckBId && deckAId !== deckBId;

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        Pick two of your decks to compare their mana curve, colors, and card overlap.
      </p>
      <div>
        <label className="block text-sm text-white mb-1">Deck A</label>
        <select
          value={deckAId}
          onChange={(e) => onSelectA(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a deck…</option>
          {decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-white mb-1">Deck B</label>
        <select
          value={deckBId}
          onChange={(e) => onSelectB(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">Select a deck…</option>
          {decks.filter(d => d._id !== deckAId).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <button
        onClick={onCompare}
        disabled={!canCompare}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
      >
        Compare
      </button>
    </div>
  );
}

function DeckComparisonModal({ decks = [], onClose }) {
  const [deckAId, setDeckAId] = useState('');
  const [deckBId, setDeckBId] = useState('');
  const [comparing, setComparing] = useState(false);

  const deckA = useMemo(() => decks.find(d => d._id === deckAId), [decks, deckAId]);
  const deckB = useMemo(() => decks.find(d => d._id === deckBId), [decks, deckBId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare size={22} className="text-blue-400" />
            Compare Decks
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!comparing || !deckA || !deckB ? (
          <DeckPicker
            decks={decks}
            deckAId={deckAId}
            deckBId={deckBId}
            onSelectA={setDeckAId}
            onSelectB={setDeckBId}
            onCompare={() => setComparing(true)}
          />
        ) : (
          <div className="text-white/60 text-sm">
            Comparing {deckA.name} vs {deckB.name}… (comparison view built in Task 2/3)
          </div>
        )}
      </div>
    </div>
  );
}

export default DeckComparisonModal;
```

- [ ] **Step 2: Wire into `DeckList.js`**

Add the import near the top, alongside the other tool modal imports (~line 4):
```js
import DeckComparisonModal from './DeckComparisonModal';
```

Add state near the other modal-visibility flags (~line 68):
```js
  const [showComparison, setShowComparison] = useState(false);
```

Add the header button in the button row (~line 291, right after the Find Staples button so related tools stay grouped):
```jsx
          <button onClick={() => setShowStaples(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Find Staples</button>
          <button onClick={() => setShowComparison(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Compare Decks</button>
          <button onClick={() => setShowShoppingList(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Shopping List</button>
```

Add the modal render right after the Find Staples modal block (~line 439):
```jsx
      {/* Deck Comparison Modal */}
      {showComparison && (
        <DeckComparisonModal decks={decks} onClose={() => setShowComparison(false)} />
      )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running:
- Click "Compare Decks" in Deck Builder's header — confirm the picker modal opens.
- Confirm Deck B's dropdown excludes whatever's currently selected in Deck A.
- Confirm "Compare" stays disabled until two distinct decks are chosen.
- Click "Compare" — confirm the placeholder text renders with the correct deck names.
- Click the X — confirm it closes and resets (reopening shows the picker again, not the stale comparison).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DeckComparisonModal.js frontend/src/components/DeckList.js
git commit -m "feat: add deck comparison picker modal skeleton"
```

---

## Task 2: Card overlap computation + filterable card list

**Files:**
- Modify: `frontend/src/components/DeckComparisonModal.js`

- [ ] **Step 1: Add the overlap computation**

Replace the placeholder `useMemo`s and comparison-view branch with real logic. Add this `useMemo` inside `DeckComparisonModal`, after the `deckA`/`deckB` memos:

```jsx
  const comparison = useMemo(() => {
    if (!deckA || !deckB) return null;

    const byName = new Map(); // name -> { name, imageUrl, inA: bool, inB: bool }

    (deckA.mainDeck || []).forEach(card => {
      if (!card?.name) return;
      const entry = byName.get(card.name) || { name: card.name, imageUrl: card.imageUrl, inA: false, inB: false };
      entry.inA = true;
      if (!entry.imageUrl) entry.imageUrl = card.imageUrl;
      byName.set(card.name, entry);
    });

    (deckB.mainDeck || []).forEach(card => {
      if (!card?.name) return;
      const entry = byName.get(card.name) || { name: card.name, imageUrl: card.imageUrl, inA: false, inB: false };
      entry.inB = true;
      if (!entry.imageUrl) entry.imageUrl = card.imageUrl;
      byName.set(card.name, entry);
    });

    const all = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    const shared = all.filter(c => c.inA && c.inB);
    const onlyA = all.filter(c => c.inA && !c.inB);
    const onlyB = all.filter(c => !c.inA && c.inB);

    return { all, shared, onlyA, onlyB };
  }, [deckA, deckB]);
```

- [ ] **Step 2: Add the filter toggle + card list UI**

Add state for the filter (near `comparing` state):
```jsx
  const [filter, setFilter] = useState('all');
```

Add this module-scope component above `DeckComparisonModal` (not inside it — this codebase's established rule is that component functions defined inside another component's render body cause a remount-on-every-render bug):

```jsx
function CardListRow({ card, deckAName, deckBName, onPreview }) {
  return (
    <button
      onClick={() => onPreview(card)}
      className="w-full flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-white/5 transition-colors text-left"
    >
      <span className="text-white text-sm truncate">{card.name}</span>
      <span className="flex gap-1 flex-shrink-0">
        {card.inA && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300" title={deckAName}>A</span>
        )}
        {card.inB && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300" title={deckBName}>B</span>
        )}
      </span>
    </button>
  );
}
```

Replace the placeholder comparison-view branch (`Comparing {deckA.name}...`) with:

```jsx
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-white font-semibold">{deckA.name} <span className="text-white/40">vs</span> {deckB.name}</h3>
              <button
                onClick={() => { setComparing(false); }}
                className="text-xs text-white/50 hover:text-white transition"
              >
                Change decks
              </button>
            </div>

            {/* Stats section placeholder — built in Task 3 */}

            {/* Filter toggle */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: `All (${comparison.all.length})` },
                { key: 'shared', label: `Shared (${comparison.shared.length})` },
                { key: 'onlyA', label: `Only ${deckA.name} (${comparison.onlyA.length})` },
                { key: 'onlyB', label: `Only ${deckB.name} (${comparison.onlyB.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    filter === key ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Card list */}
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {comparison[filter].length === 0 ? (
                <p className="text-gray-500 text-sm italic py-4 text-center">No cards in this view.</p>
              ) : (
                comparison[filter].map(card => (
                  <CardListRow
                    key={card.name}
                    card={card}
                    deckAName={deckA.name}
                    deckBName={deckB.name}
                    onPreview={() => {}}
                  />
                ))
              )}
            </div>
          </div>
        )}
```

Note: `comparison[filter]` relies on `filter` being exactly one of `'all' | 'shared' | 'onlyA' | 'onlyB'`, matching the `comparison` object's keys built in Step 1 — keep these in sync if either is renamed.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running, compare two decks that share at least a few cards (e.g. two Commander decks both running Sol Ring/Command Tower) and two decks with no overlap:
- Confirm "All" shows every distinct card name from both decks, each correctly badged A/B/both.
- Confirm "Shared" only shows cards present in both decks.
- Confirm "Only [Deck A name]" / "Only [Deck B name]" show the correct disjoint sets, and the counts in each toggle button match the list length.
- Confirm switching filters is instant (no network calls — check the Network tab shows nothing new firing).
- Confirm "Change decks" returns to the picker with the previous selections still filled in (state isn't reset, since `deckAId`/`deckBId` state is untouched by `setComparing(false)`).
- At 375px width, confirm the filter toggle wraps onto two rows rather than clipping or scrolling.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DeckComparisonModal.js
git commit -m "feat: add card overlap computation and filterable list to deck comparison"
```

---

## Task 3: Stats section (mana curve overlay + color pips), commander header, tap-to-preview

**Files:**
- Modify: `frontend/src/components/DeckComparisonModal.js`

- [ ] **Step 1: Add the two-series mana curve overlay chart**

Add this module-scope component (above `DeckComparisonModal`, alongside `CardListRow`):

```jsx
const CMC_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7+'];

function ManaCurveOverlay({ curveA, curveB }) {
  const a = curveA instanceof Map ? Object.fromEntries(curveA) : (curveA || {});
  const b = curveB instanceof Map ? Object.fromEntries(curveB) : (curveB || {});
  const maxCount = Math.max(...CMC_ORDER.map(cmc => Math.max(a[cmc] || 0, b[cmc] || 0)), 1);

  return (
    <div className="flex items-end justify-around h-32 gap-2">
      {CMC_ORDER.map(cmc => {
        const countA = a[cmc] || 0;
        const countB = b[cmc] || 0;
        return (
          <div key={cmc} className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-end gap-0.5 h-24 w-full justify-center">
              <div
                className="w-2.5 rounded-t bg-blue-500"
                style={{ height: `${(countA / maxCount) * 100}%`, minHeight: countA > 0 ? '4px' : '0' }}
                title={`Deck A: ${countA} at CMC ${cmc}`}
              />
              <div
                className="w-2.5 rounded-t bg-purple-500"
                style={{ height: `${(countB / maxCount) * 100}%`, minHeight: countB > 0 ? '4px' : '0' }}
                title={`Deck B: ${countB} at CMC ${cmc}`}
              />
            </div>
            <div className="text-xs text-white/60">{cmc}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add the color pip comparison**

Add this module-scope component alongside `ManaCurveOverlay`:

```jsx
const COLOR_META = {
  W: { color: '#f5e6a3', label: 'White'     },
  U: { color: '#60a5fa', label: 'Blue'      },
  B: { color: '#6b7280', label: 'Black'     },
  R: { color: '#f87171', label: 'Red'       },
  G: { color: '#4ade80', label: 'Green'     },
  C: { color: '#9ca3af', label: 'Colorless' },
};

function ColorPipComparison({ colorsA, colorsB, nameA, nameB }) {
  const a = colorsA instanceof Map ? Object.fromEntries(colorsA) : (colorsA || {});
  const b = colorsB instanceof Map ? Object.fromEntries(colorsB) : (colorsB || {});
  const totalA = Object.values(a).reduce((s, v) => s + v, 0) || 1;
  const totalB = Object.values(b).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-2">
      {Object.keys(COLOR_META).map(key => {
        const countA = a[key] || 0;
        const countB = b[key] || 0;
        if (countA === 0 && countB === 0) return null;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-black/70"
              style={{ backgroundColor: COLOR_META[key].color }}
            >
              {key}
            </span>
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden" title={`${nameA}: ${countA}`}>
                <div className="h-full bg-blue-500/70" style={{ width: `${(countA / totalA) * 100}%` }} />
              </div>
              <span className="text-white/50 w-6 text-right">{countA}</span>
            </div>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-white/50 w-6">{countB}</span>
              <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden" title={`${nameB}: ${countB}`}>
                <div className="h-full bg-purple-500/70 ml-auto" style={{ width: `${(countB / totalB) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Note: this deliberately does NOT reuse `ManaCurveChart.js`/`PieChart` from `DeckDetail.js` — both are single-series components and this needs a genuinely different two-series-overlaid visual. `COLOR_META`'s color values are copied from `DeckDetail.js:42-49` for visual consistency (same hex codes), not imported, since `DeckDetail.js` doesn't export it.

- [ ] **Step 3: Wire the stats section into the comparison view**

Replace the `{/* Stats section placeholder — built in Task 3 */}` comment with:

```jsx
            {/* Commander header row */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[140px] flex items-center gap-2">
                {deckA.commander?.imageUrl && (
                  <img src={deckA.commander.imageUrl} alt={deckA.commander.name} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white/40 text-xs">Deck A</div>
                  <div className="text-white text-sm font-medium truncate">{deckA.commander?.name || '—'}</div>
                </div>
              </div>
              <div className="flex-1 min-w-[140px] flex items-center gap-2">
                {deckB.commander?.imageUrl && (
                  <img src={deckB.commander.imageUrl} alt={deckB.commander.name} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white/40 text-xs">Deck B</div>
                  <div className="text-white text-sm font-medium truncate">{deckB.commander?.name || '—'}</div>
                </div>
              </div>
            </div>

            {/* Stats: mana curve + colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Mana Curve</h4>
                <div className="flex items-center gap-3 text-xs mb-1">
                  <span className="flex items-center gap-1 text-blue-300"><span className="w-2 h-2 rounded-full bg-blue-500" />{deckA.name}</span>
                  <span className="flex items-center gap-1 text-purple-300"><span className="w-2 h-2 rounded-full bg-purple-500" />{deckB.name}</span>
                </div>
                <ManaCurveOverlay curveA={deckA.statistics?.manaCurve} curveB={deckB.statistics?.manaCurve} />
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Colors</h4>
                <ColorPipComparison
                  colorsA={deckA.statistics?.colorDistribution}
                  colorsB={deckB.statistics?.colorDistribution}
                  nameA={deckA.name}
                  nameB={deckB.name}
                />
              </div>
            </div>
```

- [ ] **Step 4: Add tap-to-preview**

Add state near the other state declarations in `DeckComparisonModal`:
```jsx
  const [previewCard, setPreviewCard] = useState(null);
```

Change the `CardListRow` usage's `onPreview={() => {}}` to `onPreview={setPreviewCard}`.

Add the preview overlay right before the closing `</div>` of the outermost `fixed inset-0` wrapper (as a sibling to the modal panel, matching `CollectionComparison.js`'s existing hover-preview pattern — but triggered by click/tap instead of `onMouseEnter`, since hover doesn't exist on touch devices):

```jsx
        {previewCard && (previewCard.imageUrl) && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewCard(null)}
          >
            <img
              src={previewCard.imageUrl}
              alt={previewCard.name}
              className="max-w-xs w-full rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        )}
```

This renders as a full-screen tap-to-dismiss overlay rather than `CollectionComparison`'s fixed-position-near-cursor approach, since there's no cursor position on touch and a centered full-screen overlay works identically on both mouse and touch input.

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 6: Manual smoke test — full feature + mobile verification**

With the dev server running:
- Compare two decks; confirm both commanders show correctly in the header row (with images), and a deck with no commander set shows "—" without erroring.
- Confirm the mana curve overlay shows two differently-colored bar series per CMC bucket (0 through 7+), matching each deck's actual `statistics.manaCurve`.
- Confirm the color pip comparison shows a bar per color present in either deck, correctly proportioned, and colors with 0 in both decks are hidden (not rendered as empty rows).
- Click a card row in the list — confirm the image preview appears centered; click again anywhere to dismiss.
- Compare a deck with a `partnerCommander` set against one without — confirm no phantom "undefined" commander entry appears (checked via `?.name`, per this session's established `partnerCommander` truthiness bug pattern — though note this component only reads `commander`, not `partnerCommander`, for its header row per the spec's scope, so this is really confirming `deckA.commander?.name || '—'` doesn't choke on a deck that has no commander at all, e.g. a non-Commander-format deck).
- At 375px width: confirm the commander header row stacks to one column, the two stats cards (`grid-cols-1 sm:grid-cols-2`) stack vertically, the mana curve bars don't overflow horizontally, and the color pip rows stay readable (no text truncation cutting off numbers).
- At 1280px width: confirm the two stats cards sit side by side and nothing regresses from Task 1/2's layout.
- Confirm `npm run build` has no new warnings introduced by this task.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DeckComparisonModal.js
git commit -m "feat: add mana curve overlay, color comparison, and tap-to-preview to deck comparison"
```

---

## Task 4: Final verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 2: End-to-end manual smoke test**

Full click-through at both mobile (375px) and desktop (1280px) widths:
- Open Compare Decks from the Deck Builder header.
- Pick two decks with meaningful overlap, compare, verify stats + all 4 filter states.
- Pick two decks with zero overlap (if available), verify "Shared" shows the empty state correctly.
- Close and reopen — confirm no stale state leaks between separate uses of the tool (previous selections cleared or intentionally retained — whichever `DeckPicker`'s actual behavior is by this point, just confirm it's not broken/inconsistent).
- Confirm the existing "Calculate Sleeves" / "Find Staples" / "Shopping List" / "New Deck" / "Import Deck" buttons in the header still work unmodified.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

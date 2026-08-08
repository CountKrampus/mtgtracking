# Set Completion → Bulk Add Missing to Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "View Missing" action per set in the Set Completion Tracker that fetches the set's full card list from Scryfall, diffs it against owned cards, and lets the user bulk-add the missing ones to their wishlist via a reviewable checklist.

**Architecture:** One new component (`SetMissingCardsModal.js`) that stacks above the existing `SetCompletionModal.js`. Fetches the set's card list directly from Scryfall (client-side, paginated), computes the missing set by filtering out names already in `ownedCardNames` (passed down, already computed by the parent), and loops the existing single-item `POST /api/wishlist` endpoint for the selected cards after deduping against the current wishlist. No new backend routes.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual mobile-width click-through, matching every other frontend feature built this session).

**Spec:** `docs/superpowers/specs/2026-08-07-set-completion-wishlist-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `SetCompletionModal.js`'s `getSetCompletionData()` already builds `cardsBySet[code].ownedCards` as a `Set<string>` of owned card names for that set (line ~21-27), used to compute `ownedUnique`. This is exactly the data `SetMissingCardsModal` needs — thread it through as a prop rather than recomputing.
- Scryfall's set-card-list endpoint: `GET https://api.scryfall.com/cards/search?q=e:{code}&unique=cards&order=set`. Response shape: `{ data: [...cards], has_more: bool, next_page: url, total_cards: N }`. When `has_more` is true, fetch `next_page` for the next batch. Most sets are under 175 cards (one page); some are not.
- Each Scryfall card object in `data[]` has `id`, `name`, `mana_cost`, `image_uris.normal` (may be absent for multi-faced cards — treat missing gracefully, don't crash), `set_name`, `set`, `colors`, `type_line`, `prices.usd`, `oracle_text`.
- `addToWishlist(scryfallCard, sourceName)` (`frontend/src/contexts/WishlistContext.js:197`) shows the exact field mapping to use for each `POST /api/wishlist` call:
  ```js
  {
    name: scryfallCard.name,
    set: scryfallCard.set_name || '',
    setCode: scryfallCard.set?.toUpperCase() || '',
    scryfallId: scryfallCard.id,
    imageUrl: scryfallCard.image_uris?.normal || '',
    colors: scryfallCard.colors || [],
    types: scryfallCard.type_line ? scryfallCard.type_line.split('—')[0].trim().split(' ') : [],
    manaCost: scryfallCard.mana_cost || '',
    rarity: scryfallCard.rarity ? scryfallCard.rarity[0].toUpperCase() : '',
    targetPrice: 0,
    currentPrice: scryfallCard.prices?.usd ? parseFloat(scryfallCard.prices.usd) : 0,
    priority: 'medium',
    notes: '',
    quantity: 1,
    condition: 'NM',
    oracleText: scryfallCard.oracle_text || ''
  }
  ```
  This plan's bulk-add does NOT call `addToWishlist` itself (that helper does one POST + one `alert()` per call, which would spam N alerts) — it POSTs directly via `axios.post(`${API_URL}/wishlist`, {...})` in a loop, using this same field mapping, with a single summary result at the end instead.
- `useWishlist()` (`frontend/src/contexts/WishlistContext.js`) exposes `wishlistItems` — already loaded, available anywhere via context (`WishlistProvider` wraps the app in `App.js:473`). Use this for the dedup check (skip any missing-card whose `name` already matches a `wishlistItems` entry).
- `POST /api/wishlist` (`backend/server.js:975`) has no dedup/merge logic of its own — every POST creates a new row regardless of duplicates. This is exactly why the frontend must dedup against `wishlistItems` itself before posting.
- Mobile bottom-sheet modal shape used everywhere in this codebase: `fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0` on the outer wrapper. Since `SetCompletionModal.js` is already a `z-50` modal, `SetMissingCardsModal` must use `z-[60]` instead of `z-50` to stack correctly on top of it (same convention as `CollectionComparison.js`'s hover-preview and `DeckComparisonModal.js`'s tap-to-preview overlays).
- Filter-toggle/multi-control rows must use `flex flex-wrap`, never horizontal scroll (reserved for genuine tab strips) — repeated finding across this session's mobile audit.

---

## Task 1: `SetMissingCardsModal.js` — fetch, diff, and render the checklist

**Files:**
- Create: `frontend/src/components/CollectionTools/SetMissingCardsModal.js`
- Modify: `frontend/src/components/CollectionTools/SetCompletionModal.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Create the component with fetch + pagination + diff logic**

Create `frontend/src/components/CollectionTools/SetMissingCardsModal.js`:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useWishlist } from '../../contexts/WishlistContext';
import { API_URL } from '../../config';

function MissingCardRow({ card, checked, onToggle }) {
  return (
    <label className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/5 transition-colors cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 flex-shrink-0" />
      {card.image_uris?.normal && (
        <img src={card.image_uris.normal} alt={card.name} className="w-8 h-11 object-cover rounded flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm truncate">{card.name}</div>
        <div className="text-white/40 text-xs truncate">{card.mana_cost || ''}</div>
      </div>
    </label>
  );
}

export default function SetMissingCardsModal({ setCode, setName, ownedCardNames, onClose }) {
  const { wishlistItems, fetchWishlist } = useWishlist();
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedNames, setCheckedNames] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState(null);
  const [partial, setPartial] = useState(false);

  const fetchMissing = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPartial(false);
    let url = `https://api.scryfall.com/cards/search?q=e:${setCode.toLowerCase()}&unique=cards&order=set`;
    const allCards = [];
    try {
      while (url) {
        const res = await axios.get(url);
        allCards.push(...res.data.data);
        url = res.data.has_more ? res.data.next_page : null;
      }
    } catch (err) {
      // Keep whatever pages already succeeded rather than discarding them -
      // if page 1 loaded fine and only page 2 failed, the user still gets a
      // usable (if incomplete) list plus a way to retry, per the spec.
      if (allCards.length > 0) {
        setPartial(true);
      } else {
        setError(err.response?.data?.details || 'Failed to load set card list. Please try again.');
      }
    } finally {
      const missingCards = allCards.filter(c => !ownedCardNames.has(c.name));
      setMissing(missingCards);
      setCheckedNames(new Set(missingCards.map(c => c.name)));
      setLoading(false);
    }
  }, [setCode, ownedCardNames]);

  useEffect(() => { fetchMissing(); }, [fetchMissing]);

  const toggleCard = (name) => {
    setCheckedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectAll = () => setCheckedNames(new Set(missing.map(c => c.name)));
  const selectNone = () => setCheckedNames(new Set());

  const handleAddSelected = async () => {
    setAdding(true);
    const wishlistNames = new Set(wishlistItems.map(w => w.name));
    const toAdd = missing.filter(c => checkedNames.has(c.name));
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const card of toAdd) {
      if (wishlistNames.has(card.name)) {
        skipped++;
        continue;
      }
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: card.name,
          set: card.set_name || '',
          setCode: card.set?.toUpperCase() || '',
          scryfallId: card.id,
          imageUrl: card.image_uris?.normal || '',
          colors: card.colors || [],
          types: card.type_line ? card.type_line.split('—')[0].trim().split(' ') : [],
          manaCost: card.mana_cost || '',
          rarity: card.rarity ? card.rarity[0].toUpperCase() : '',
          targetPrice: 0,
          currentPrice: card.prices?.usd ? parseFloat(card.prices.usd) : 0,
          priority: 'medium',
          notes: '',
          quantity: 1,
          condition: 'NM',
          oracleText: card.oracle_text || ''
        });
        added++;
      } catch {
        failed++;
      }
    }

    await fetchWishlist();
    setAdding(false);
    setResult({ added, skipped, failed });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">Missing from {setName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={32} className="text-teal-500 animate-spin mb-3" />
              <p className="text-white/60 text-sm">Fetching set card list...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle size={28} className="text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchMissing}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <div className="text-center py-8">
              <p className="text-white text-sm">
                Added {result.added} card{result.added !== 1 ? 's' : ''} to your wishlist
                {result.skipped > 0 && ` (${result.skipped} already on your wishlist were skipped)`}
                {result.failed > 0 && ` — ${result.failed} failed, please try again`}
                .
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && !result && missing.length === 0 && (
            <p className="text-center text-white/60 py-8">No missing cards found — every printing in this set with a name is already owned.</p>
          )}

          {!loading && !error && !result && missing.length > 0 && (
            <>
              {partial && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <span className="text-yellow-300 text-xs">This list may be incomplete — part of the set failed to load.</span>
                  <button onClick={fetchMissing} className="text-xs text-yellow-300 hover:text-yellow-200 font-medium transition">Retry</button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-white/60 text-sm">{checkedNames.size} of {missing.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectAll} className="text-xs text-purple-400 hover:text-purple-300 transition">Select All</button>
                  <button onClick={selectNone} className="text-xs text-purple-400 hover:text-purple-300 transition">Select None</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-0.5 mb-4">
                {missing.map(card => (
                  <MissingCardRow
                    key={card.id}
                    card={card}
                    checked={checkedNames.has(card.name)}
                    onToggle={() => toggleCard(card.name)}
                  />
                ))}
              </div>
              <button
                onClick={handleAddSelected}
                disabled={adding || checkedNames.size === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
              >
                {adding ? 'Adding…' : `Add Selected to Wishlist (${checkedNames.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: the `fetchWishlist` call after adding is what keeps this component's own `wishlistItems` dedup check correct if the modal were ever reopened without a full remount — it also matches this codebase's established pattern of refreshing context state after a write rather than assuming local state is already correct.

- [ ] **Step 2: Wire into `SetCompletionModal.js`**

Add the import near the top:
```js
import SetMissingCardsModal from './SetMissingCardsModal';
```

Add state near the existing `completionData`/`loadingSetCompletion` state:
```js
  const [missingCardsSet, setMissingCardsSet] = useState(null); // { setCode, setName, ownedCardNames } | null
```

`getSetCompletionData()` currently only stores `ownedUnique` (a count) per set in the `completion` array it builds — it does NOT currently retain the underlying `Set` object (`cardsBySet[code].ownedCards`) on each pushed entry. Add it: find this block inside the `for (const code of setCodes.slice(0, 20))` loop:
```jsx
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
```
and add one field to carry the `Set` through:
```jsx
          completion.push({
            setCode: code.toUpperCase(),
            setName: setInfo.name,
            icon: setInfo.icon_svg_uri,
            ownedUnique: cardsBySet[code].ownedCards.size,
            ownedCardNames: cardsBySet[code].ownedCards,
            totalInSet: setInfo.card_count,
            totalOwned: cardsBySet[code].totalOwned,
            releasedAt: setInfo.released_at,
            setType: setInfo.set_type
          });
```

Add the "View Missing" button to each set row. Find the percentage-display block (around the `<p className="text-white font-bold">{percentage}%</p>` line) and add a button below the existing progress bar, right after the `{set.totalOwned} total copies owned` paragraph:
```jsx
                    <p className="text-white/40 text-xs mt-2">
                      {set.totalOwned} total copies owned
                    </p>
                    {percentage < 100 && (
                      <button
                        onClick={() => setMissingCardsSet({ setCode: set.setCode, setName: set.setName, ownedCardNames: set.ownedCardNames })}
                        className="mt-2 px-3 py-1 bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 rounded text-xs font-medium transition"
                      >
                        View Missing
                      </button>
                    )}
```

Add the modal render at the end of the component, right before the closing tags of the outer modal (after the "Showing up to 20 sets..." footer `div`, still inside the outermost `fixed inset-0` wrapper):
```jsx
        {missingCardsSet && (
          <SetMissingCardsModal
            setCode={missingCardsSet.setCode}
            setName={missingCardsSet.setName}
            ownedCardNames={missingCardsSet.ownedCardNames}
            onClose={() => setMissingCardsSet(null)}
          />
        )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running:
- Open the Set Completion Tracker (gear/Sets button in the header, per this codebase's existing entry point), wait for it to load.
- Click "View Missing" on a set below 100% completion — confirm the missing-card list loads and the count roughly matches `totalInSet - ownedUnique` from that row (won't be exact if the set includes non-card entries like tokens depending on Scryfall's `unique=cards` filtering — note any discrepancy but don't treat a small mismatch as a bug unless it's wildly off).
- Uncheck a few cards, click "Add Selected to Wishlist" — confirm only the checked ones get added, and the summary count matches.
- Click "View Missing" again on a set you've now partially wishlisted from — confirm the already-wishlisted cards are silently skipped and the summary reports the skip count.
- Confirm the "View Missing" button does NOT appear on a 100%-complete set.
- At 375px width: confirm the Select All/Select None row wraps via `flex-wrap` rather than clipping, and the stacked `z-[60]` modal renders fully on top of `SetCompletionModal`'s `z-50` without visual clipping.
- The partial-pagination-failure path (page 1 succeeds, a later page fails) is hard to reproduce reliably live — verify it by code review instead: confirm `fetchMissing`'s catch block checks `allCards.length > 0` before deciding between `setPartial(true)` (keep what loaded) and `setError(...)` (nothing loaded), and that the `finally` block always computes `missing`/`checkedNames` from whatever's in `allCards` regardless of which branch ran.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CollectionTools/SetMissingCardsModal.js frontend/src/components/CollectionTools/SetCompletionModal.js
git commit -m "feat: add bulk-add-missing-to-wishlist to Set Completion Tracker"
```

---

## Task 2: Final verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 2: End-to-end manual smoke test**

Full click-through at both mobile (375px) and desktop (1280px) widths:
- Open Set Completion Tracker → View Missing on a large set (200+ cards, to exercise Scryfall pagination) → confirm the full list loads, not just the first page.
- Trigger the error/retry path by throttling the network to "Offline" in devtools right as you click "View Missing" — confirm the inline retry UI appears rather than a blank screen or crash, then restore the network and click Retry to confirm it recovers.
- Confirm the existing Set Completion Tracker behavior (progress bars, percentages, set icons) is completely unchanged from before this feature.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

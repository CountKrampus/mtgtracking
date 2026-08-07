# Deck-vs-Collection Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Shopping List" view to Deck Builder that ranks missing cards by how many of the user's decks (2+) are missing them, with a batched live price lookup and one-click Add to Wishlist.

**Architecture:** Entirely client-side. A new component `frontend/src/components/DeckShoppingList.js` (mirroring the existing `DeckShellExtractor.js`'s exact structure/pattern) takes the already-loaded `decks` array (same prop `DeckShellExtractor` receives from `DeckList.js`) and reads the user's collection via the already-loaded `useCardCollection()` context. It aggregates missing cards client-side via `useMemo`, then does exactly one batched `POST https://api.scryfall.com/cards/collection` request (via `useEffect`) to fill in prices for the (small, filtered) result list. No backend changes.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-deck-shopping-list-design.md`

---

## Task 1: `DeckShoppingList.js` component (aggregation + price fetch + UI)

**Files:**
- Create: `frontend/src/components/DeckShoppingList.js`
- Modify: `frontend/src/components/DeckList.js`

- [ ] **Step 1: Read the reference files this task mirrors**

Read `frontend/src/components/DeckShellExtractor.js` in full — this new component matches its modal shell structure (outer `fixed inset-0` overlay div, `bg-slate-900` panel, header with icon + title + close `X` button, `useMemo`-derived list, empty state) exactly, just with different aggregation logic and an added price-fetch phase.

Read `frontend/src/contexts/WishlistContext.js`'s `addToWishlist` function (around line 197) to confirm its exact expected object shape before wiring the adapter in Step 4.

Read `backend/routes/decks.js`'s `getDeckColorIdentity` function (~line 49) to confirm the exact `partnerCommander?.name` truthiness-check pattern to mirror in Step 2 (this app's Mongoose documents have a known gotcha where `partnerCommander: null` reads back as a truthy empty object — but note: `decks` here comes from the frontend's own `axios.get` JSON response, which is a plain JS object from `JSON.parse`, NOT a live Mongoose document, so `deck.partnerCommander` will genuinely be `null` when absent, and `deck.partnerCommander ? ... : ...` would actually work correctly here. Still use `?.name` for consistency and defensiveness — it's correct either way and matches the codebase's established pattern for this exact field).

- [ ] **Step 2: Create the component skeleton with Phase 1 (client-side aggregation)**

Create `frontend/src/components/DeckShoppingList.js`:

```js
import React, { useState, useMemo, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import axios from 'axios';
import { useCardCollection } from '../contexts/CardCollectionContext';
import { useWishlist } from '../contexts/WishlistContext';

// Aggregates missing cards across ALL of the user's decks, ranked by how
// many decks each is missing from - the cross-deck insight a single deck's
// own "Collection Ownership" panel can't show. Computed entirely
// client-side from already-loaded deck + collection data, matching
// DeckShellExtractor.js's "Find Staples" pattern (see its own comment for
// why this beats a new backend endpoint). The one exception is price: deck
// mainDeck entries have no price field at all (see backend/models/Deck.js),
// so a single batched Scryfall lookup fills that in after the aggregation.
function DeckShoppingList({ decks = [], onClose }) {
  const { cards } = useCardCollection();
  const { addToWishlist } = useWishlist();
  const [prices, setPrices] = useState({}); // scryfallId -> price
  const [pricesLoaded, setPricesLoaded] = useState(false);

  const candidates = useMemo(() => {
    // ownedNames is built from every collection card, not just ones
    // missing a scryfallId - a deck card can itself lack a scryfallId
    // (never fetched full data) while the same card IS owned under a
    // scryfallId'd printing, and name is still the right fallback there.
    const ownedScryfallIds = new Set();
    const ownedNames = new Set();
    cards.forEach(c => {
      if (c.scryfallId) ownedScryfallIds.add(c.scryfallId);
      ownedNames.add(c.name.toLowerCase());
    });
    const isOwned = (card) =>
      (card.scryfallId && ownedScryfallIds.has(card.scryfallId)) || ownedNames.has((card.name || '').toLowerCase());

    const byKey = new Map();
    decks.forEach(deck => {
      const deckCards = [
        deck.commander,
        ...(deck.partnerCommander?.name ? [deck.partnerCommander] : []),
        ...(deck.mainDeck || [])
      ].filter(Boolean);

      deckCards.forEach(card => {
        if (!card?.name || isOwned(card)) return;
        const key = card.scryfallId || card.name;
        const entry = byKey.get(key) || {
          scryfallId: card.scryfallId,
          name: card.name,
          imageUrl: card.imageUrl,
          manaCost: card.manaCost,
          colors: card.colors,
          types: card.types,
          deckIds: new Set(),
        };
        entry.deckIds.add(deck._id);
        byKey.set(key, entry);
      });
    });

    return [...byKey.values()]
      .map(entry => ({ ...entry, deckCount: entry.deckIds.size }))
      .filter(entry => entry.deckCount >= 2)
      .sort((a, b) => b.deckCount - a.deckCount || a.name.localeCompare(b.name));
  }, [decks, cards]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={22} className="text-teal-400" />
            Shopping List
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Cards missing from 2 or more of your decks - buying one of these unlocks
          progress across multiple decks at once.
        </p>

        {candidates.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No cards are missing from 2 or more of your decks - nothing to consolidate here.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map(card => (
              <div key={card.scryfallId || card.name} className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{card.name}</div>
                  <div className="text-slate-400 text-xs">Missing from {card.deckCount} decks</div>
                </div>
                <span className="text-slate-300 text-sm shrink-0 w-16 text-right">
                  {prices[card.scryfallId] != null ? `$${prices[card.scryfallId].toFixed(2)}` : (pricesLoaded ? '—' : '…')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeckShoppingList;
```

- [ ] **Step 2b: Sanity-check the skeleton compiles before continuing**

Run: `cd frontend && npm run build`
Expected: succeeds (the `+ Add to Wishlist` button and Phase 2 price fetch aren't wired yet, but the component itself should compile and render — this is a checkpoint, not a full feature test).

- [ ] **Step 3: Add Phase 2 (batched Scryfall price fetch)**

Add this `useEffect` in the component body, after the `candidates` `useMemo`:

```js
  useEffect(() => {
    const ids = candidates.filter(c => c.scryfallId).map(c => c.scryfallId);
    if (ids.length === 0) {
      setPricesLoaded(true);
      return;
    }
    setPricesLoaded(false);
    // Scryfall's collection endpoint accepts up to 75 identifiers per call -
    // chunk defensively even though deckCount >= 2 filtering keeps this list
    // short in practice.
    const chunks = [];
    for (let i = 0; i < ids.length; i += 75) chunks.push(ids.slice(i, i + 75));

    Promise.all(
      chunks.map(chunk =>
        axios.post('https://api.scryfall.com/cards/collection', {
          identifiers: chunk.map(id => ({ id }))
        }).then(res => res.data.data || [])
      )
    )
      .then(results => {
        const flat = results.flat();
        const priceMap = {};
        flat.forEach(card => {
          if (card.prices?.usd) priceMap[card.id] = parseFloat(card.prices.usd);
        });
        setPrices(priceMap);
      })
      .catch(error => {
        console.error('Error fetching shopping list prices:', error);
        // Leave prices empty - the list still renders with name/deckCount.
      })
      .finally(() => setPricesLoaded(true));
    // Only re-fetch when the actual set of candidate ids changes, not on
    // every render (candidates is a new array each render since it's a
    // useMemo result recomputed from decks/cards, but its *content* is
    // usually stable between opens of the same modal instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.map(c => c.scryfallId).join(',')]);
```

- [ ] **Step 4: Re-sort by price once loaded, and wire the Wishlist action**

Add a second `useMemo` right after `candidates` that layers in price-based sorting once prices are available, and replace the raw `candidates.map(...)` in the JSX with this sorted version:

```js
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (b.deckCount !== a.deckCount) return b.deckCount - a.deckCount;
      const aPrice = prices[a.scryfallId];
      const bPrice = prices[b.scryfallId];
      if (aPrice == null && bPrice == null) return a.name.localeCompare(b.name);
      if (aPrice == null) return 1; // no price data sorts last within its deckCount tier
      if (bPrice == null) return -1;
      return aPrice - bPrice;
    });
  }, [candidates, prices]);
```

Update the JSX to map over `sortedCandidates` instead of `candidates`.

Add the Wishlist adapter/handler in the component body, near the top with other logic:

```js
  const addCandidateToWishlist = (card) => {
    addToWishlist({
      id: card.scryfallId,
      name: card.name,
      image_uris: { normal: card.imageUrl },
      mana_cost: card.manaCost,
      type_line: (card.types || []).join(' '),
      colors: card.colors,
      prices: { usd: prices[card.scryfallId] },
    }, 'Deck shopping list');
  };
```

Add the button to each row, replacing the price-only `<span>` with a flex container holding both price and the button:

```jsx
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-300 text-sm w-16 text-right">
                    {prices[card.scryfallId] != null ? `$${prices[card.scryfallId].toFixed(2)}` : (pricesLoaded ? '—' : '…')}
                  </span>
                  <button
                    onClick={() => addCandidateToWishlist(card)}
                    className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded transition"
                  >
                    + Wishlist
                  </button>
                </div>
```

- [ ] **Step 5: Wire the button and modal into `DeckList.js`**

In `frontend/src/components/DeckList.js`:

Add the import near the existing `DeckShellExtractor` import (line 3):
```js
import DeckShoppingList from './DeckShoppingList';
```

Add state alongside `showStaples` (line 66):
```js
  const [showShoppingList, setShowShoppingList] = useState(false);
```

Add the button in the header button row (after the "Find Staples" button, before "New Deck", matching the existing row at lines 286-290):
```jsx
          <button onClick={() => setShowShoppingList(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Shopping List</button>
```

Add the modal render, right after the existing `DeckShellExtractor` modal block (after line 436):
```jsx
      {/* Deck Shopping List Modal */}
      {showShoppingList && (
        <DeckShoppingList decks={decks} onClose={() => setShowShoppingList(false)} />
      )}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors or warnings.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DeckShoppingList.js frontend/src/components/DeckList.js
git commit -m "feat: add deck-vs-collection shopping list ranking missing cards by cross-deck impact"
```

---

## Task 2: Manual verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 2: Manual smoke test**

With both servers running, open Deck Builder:
- Click "Shopping List" — confirm the modal opens showing cards missing from 2+ of your decks, ranked by deck count, each showing "Missing from N decks".
- Confirm prices appear shortly after opening (they start blank/"…" then populate) — check the browser's network tab for exactly one (or a small few, if you have 75+ candidates) request to `api.scryfall.com/cards/collection`, not one request per card.
- Click "+ Wishlist" on a candidate — confirm it's added to the Wishlist view with a real image, mana cost, and price (not blank fields) and the note "Similar to Deck shopping list".
- If you have fewer than 2 decks, or no cards are missing from 2+ decks, confirm the empty state message shows instead of an empty list.
- Confirm closing and reopening the modal (or navigating away and back to Deck Builder) doesn't error and re-renders correctly.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

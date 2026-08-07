# Deck-vs-Collection Shopping List — Design

**Status:** Approved, ready for implementation planning
**Date:** 2026-08-07

## Problem

A user building multiple decks has no way to see, across *all* their decks at once, which missing cards would unlock the most decks if bought. Each deck's own "Collection Ownership" panel (`GET /:id/ownership`) shows that deck's missing cards in isolation, but there's no cross-deck aggregate view — a card missing from 4 different decks looks the same as a card missing from just 1, unless the user manually compares each deck's missing-card list themselves.

This is item #41 from the 2026-08-06 codebase feature-idea review (`project_feature_ideas` memory), picked because it has the best value-to-effort ratio of the batch: the per-deck ownership-matching logic already exists, this is purely a cross-deck aggregation of data the app already computes per deck.

## Goal

A new "Shopping List" view in Deck Builder that ranks the user's missing cards by how many decks each one is missing from (2+ decks only — a card missing from just one deck isn't a cross-deck insight, it's normal deck building already visible on that deck's own page), letting the user see at a glance which single purchase has the broadest payoff, and one-click add it to their Wishlist.

## Architecture

**Entirely client-side — no new backend endpoint.**

`frontend/src/components/DeckList.js` already fetches every deck's full data (including `mainDeck` arrays with `scryfallId`/`name`/`price`) into a `decks` array in its own state, and already passes that array as a prop to `DeckShellExtractor.js` ("Find Staples") for a very similar cross-deck aggregation — that component's own code comment explains this was a deliberate choice ("computed client-side from already-fetched deck data... rather than a new backend endpoint"). Separately, `useCardCollection()` (`contexts/CardCollectionContext.js`) already loads the user's full collection app-wide and is already consumed by sibling views (`CollectionView.js`, `WishlistView.js`).

Between those two already-loaded data sources, this feature needs nothing new from the backend: a new component, `DeckShoppingList.js`, takes `decks` (same prop `DeckShellExtractor` already receives) as a prop and reads `cards` from `useCardCollection()` directly. It computes the ranked list via `useMemo`, mirroring `DeckShellExtractor.js`'s exact structure (modal shell, `X`/close button, `useMemo`-derived list, empty state).

This means: no new route, no new backend test file, and no caching/staleness concerns since it always reflects whatever `decks`/`cards` state the rest of the page is already showing.

**One exception to "no network round-trip":** `deck.mainDeck` entries have no `price` field in the schema at all (confirmed via `backend/models/Deck.js` — only `scryfallId`/`name`/`manaCost`/`types`/`colors`/`imageUrl`/`quantity`), so the aggregated missing-card list has no price data to show or sort by until one is fetched. Rather than dropping the price field (explicitly requested during brainstorming) or fetching it per-card (reintroducing the sequential-delay problem the Manabase Builder had), this component makes exactly one batched request to Scryfall's `POST /cards/collection` endpoint (accepts up to 75 identifiers per call) for the already-filtered (`deckCount >= 2`) list — which by construction is far smaller than the full missing-card set. The frontend already calls Scryfall's API directly in several places (`CollectionView.js`, `DeckImport.js`, `DeckEditor.js`, etc.), so this isn't a new pattern for this app, just a new endpoint on the same API. If the batch request fails, the list still renders (name + deck count), just without price/price-based sort — degrade gracefully rather than blocking the view.

## Component: `DeckShoppingList.js`

**Props:** `decks` (array, same shape `DeckShellExtractor` receives), `onClose`.

**Computation, two phases:**

Phase 1 — `useMemo`, keyed on `[decks, cards]`, entirely synchronous:
1. Build `ownedScryfallIds`/`ownedNames` sets from `cards` (the collection), matching the existing dual-key fallback pattern used elsewhere in this codebase (`decks.js`'s `/recommendations` route: match by `scryfallId` first, fall back to case-insensitive name match for collection cards missing a `scryfallId` — offline imports).
2. For each deck, walk `[deck.commander, deck.partnerCommander, ...deck.mainDeck]` (matching the existing `allDeckCards` pattern from `/:id/ownership`, including the same `?.name` truthiness fix applied there for `partnerCommander`), and determine which are NOT owned.
3. Aggregate missing cards by `scryfallId` (falling back to `name` if no `scryfallId`) into `Map<key, { scryfallId, name, imageUrl, manaCost, colors, types, deckCount }>` (all fields beyond `name`/`imageUrl`/`deckCount` are carried through only for the Wishlist adapter below, not displayed directly), incrementing `deckCount` per distinct deck it's missing from.
4. Filter to entries with `deckCount >= 2`, sort by `deckCount` descending (price tie-break happens in Phase 2, once prices exist), tie-broken alphabetically by `name` in the meantime so ordering isn't arbitrary before prices load.

Phase 2 — `useEffect` on the Phase 1 result (specifically on its list of `scryfallId`s): batch-fetch `POST https://api.scryfall.com/cards/collection` with `{ identifiers: candidates.filter(c => c.scryfallId).map(id => ({ id })) }` (cards with no `scryfallId`, i.e. offline-imported, are skipped — no reliable Scryfall identifier to look up), store the returned `{ [scryfallId]: price }` map in local state, and re-sort the displayed list once prices arrive (deckCount desc, then price asc, cards with no price data sorting last). On fetch failure, catch and leave prices empty — the list still renders with deckCount-only sorting, just without a price column.

**Row actions:** "+ Add to Wishlist" only, calling the existing `addToWishlist(card, sourceName)` from `WishlistContext.js` with `sourceName: 'Deck shopping list'` — no click-through to individual decks, no acquire/add-to-deck action (this view is purely informational + wishlist triage, matching the "Add to Wishlist only" scope decision made during brainstorming).

**Important — field shape mismatch to handle:** `addToWishlist(scryfallCard, sourceName)` expects a raw Scryfall API-shaped object (`id`, `image_uris.normal`, `mana_cost`, `type_line`, `prices.usd`, `set_name`, `set`, `rarity`, `oracle_text` — see its usage from Recommendations/Similar Cards, which pass live Scryfall search results). This feature's aggregated cards come from `deck.mainDeck` entries instead, which use this app's own internal shape (`scryfallId`, `imageUrl`, `manaCost`, `types`, `colors` — no `set`/`rarity`/`oracleText` at all, since those aren't stored on deck mainDeck entries). Calling `addToWishlist` directly with an aggregated card would silently write `undefined` into most fields. The click handler must build an adapter object first, pulling price from the Phase 2 price map by `scryfallId`:
```js
addToWishlist({
  id: card.scryfallId,
  name: card.name,
  image_uris: { normal: card.imageUrl },
  mana_cost: card.manaCost,
  type_line: (card.types || []).join(' '),
  colors: card.colors,
  prices: { usd: prices[card.scryfallId] },
  // set_name, set, rarity, oracle_text intentionally omitted - not
  // available on stored mainDeck entries; addToWishlist already defaults
  // each to '' when absent.
}, 'Deck shopping list');
```

**Display per row:** card name, "Missing from N decks", price (shows "…" or is simply blank while Phase 2's fetch is in flight, then the real price once it resolves; blank permanently if the batch fetch failed or the card has no `scryfallId`). No deck names, no thumbnail (kept lean per the brainstorming decision — price was the only additional field requested beyond name/count).

**Empty state:** "No cards are missing from 2 or more of your decks — nothing to consolidate here."

**Edge cases:**
- Zero decks, or all decks fully owned → empty state.
- A card missing from 2 decks but already on the user's Wishlist → still shown (this view doesn't check Wishlist state, matching how Recommendations doesn't hide already-wishlisted cards either — no established precedent for cross-referencing Wishlist in these surfacing features).
- A `mainDeck` card with no `scryfallId` (offline-imported) → still included in the Phase 1 aggregation (matched by name via the fallback), but excluded from the Phase 2 price batch (no identifier to look up) — shows in the list with no price, sorted last within its `deckCount` tier.
- More than 75 filtered candidates (Scryfall's batch limit) → chunk into multiple `/cards/collection` requests, matching how a large candidate list would be handled; in practice `deckCount >= 2` filtering keeps this list short for most users, so this is a defensive limit, not an expected common case.

## UI Placement

New "Shopping List" button in `DeckList.js`'s header button row, alongside the existing "Calculate Sleeves" and "Find Staples" buttons (same row, same button styling convention — e.g. a distinct color like `bg-teal-600 hover:bg-teal-700` to differentiate from the existing blue/indigo pair). Clicking it renders `<DeckShoppingList decks={decks} onClose={...} />` exactly like `DeckShellExtractor` is already rendered conditionally via a `showShoppingList` boolean state flag.

## Testing

No backend changes, so no backend test file. This codebase has no frontend test infrastructure (confirmed convention from Phases 1-3 of Smart Deck Score) — verified via `npm run build` plus manual click-through:
- Open Shopping List with 2+ decks sharing a missing card → confirm it appears, ranked correctly, with the right deck count, and that a price appears shortly after opening (Phase 2 fetch resolving).
- Open with no cross-deck missing cards → confirm empty state.
- Click "+ Add to Wishlist" → confirm it's added with real fields (name/image/mana cost/colors/price), not blank ones (existing `addToWishlist` flow already tested/proven by Phase 2/3's own manual smoke tests, but the adapter mapping is new and worth a direct check here).
- Simulate/observe the Scryfall batch request failing (e.g. throttle network offline in devtools) → confirm the list still renders with names and deck counts, just without prices.

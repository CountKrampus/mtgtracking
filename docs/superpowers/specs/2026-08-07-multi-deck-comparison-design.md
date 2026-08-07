# Multi-Deck Comparison — Design

## Summary

A "Compare Decks" tool in the Deck Builder that lets a user pick any two of their own decks and see a structural diff: mana curve and color-pip comparison up top, and a single filterable card list below (All / Shared / Only Deck A / Only Deck B). Entirely client-side — no new backend route, no network calls beyond what's already loaded.

**Why:** The app already has collection-vs-user comparison (`CollectionComparison.js`) but nothing for deck-vs-deck. This closes that gap using the same architecture already proven out by Find Staples (`DeckShellExtractor.js`) and Deck Shopping List.

## Entry Point

A new "Compare Decks" button in `DeckList.js`'s header row, alongside the existing Calculate Sleeves / Find Staples / Shopping List buttons. Clicking it opens a picker modal with two searchable `<select>`-style dropdowns ("Deck A", "Deck B"), populated from the `decks` array already loaded into `DeckList.js` (same prop already passed to `DeckShellExtractor`/`DeckShoppingList`). A disabled "Compare" button enables once both dropdowns have a distinct deck selected. Selecting "Compare" swaps the picker for the comparison view within the same modal (no separate route/page).

Only decks the user owns are selectable (the `decks` prop is already scoped to the current user's decks, matching existing tool modals — no cross-user access here, unlike `CollectionComparison`).

## Data & Matching

Fully client-side, computed via `useMemo` from the two selected `Deck` objects — no new backend endpoint, no network round-trip. This matches `DeckShellExtractor.js`'s existing "compute from already-fetched deck data" pattern rather than introducing a new comparison-scoped API route.

**Card matching:** by card `name`, consistent with `DeckShellExtractor`'s existing staple-detection convention. Quantity is not part of the match key — a card present in both decks counts as "shared" regardless of how many copies each deck runs (Commander decks are singleton, so this is almost always 1-for-1 in practice; for non-Commander formats this keeps the logic simple rather than adding a quantity-diff dimension that wasn't asked for).

**Commander handling:** each deck's `commander` (and `partnerCommander`, if present — checked via `?.name` per this codebase's established Mongoose-subdocument-truthiness convention, not raw truthiness) is displayed in the header row as context, and is **excluded** from the shared/unique card-list computation below — two decks with different commanders can never "share" a commander there anyway, and showing it twice (once as header context, once in an "Only in Deck A" bucket) would be redundant. This exclusion applies only to the card-list section; see Stats below for why the curve/color charts do still reflect the commander's contribution.

**No value/price comparison** — explicitly out of scope per this design's approval. This is what keeps the feature entirely network-free; a value comparison would require the same batched Scryfall price lookup `DeckShoppingList.js` needed (deck `mainDeck` entries don't store a price field).

## Layout

### 1. Header row
Both decks' name + commander card (image + name), side by side. On mobile this stacks vertically (single column), matching the established `flex flex-wrap` convention from this session's mobile-audit fixes rather than a fixed two-column grid that would squeeze at narrow widths.

### 2. Stats section
Two comparisons, read directly from each deck's already-persisted `statistics` field (`backend/models/Deck.js`'s `statistics.manaCurve`/`colorDistribution`, computed server-side by `calculateDeckStatistics` on every deck save — no recomputation needed client-side):

- **Mana curve overlay**: a bar chart with both decks' bars grouped per CMC bucket (buckets are `0,1,2,3,4,5,6,'7+'` — note the literal `'7+'` string key, not `7`), color-coded per deck (e.g. Deck A blue, Deck B purple, matching this codebase's existing dual-series chart conventions).
- **Color pip comparison**: side-by-side WUBRG breakdown per deck, read from `colorDistribution` (a plain object with `W/U/B/R/G/C` keys after JSON serialization — Mongoose `Map` fields serialize to plain objects, not `Map` instances, on the client).

Note: `calculateDeckStatistics` folds each deck's commander(s) into `manaCurve`/`colorDistribution` already (see `backend/utils/deckHelpers.js:83-88`) — so the stats charts naturally reflect the whole 100-card deck including its commander, while the card list below excludes the commander from its overlap buckets. This is intentional, not a contradiction: the charts describe "what does this deck's mana base/curve look like," where the commander's color identity is relevant; the card list describes "which specific cards differ," where the commander isn't a meaningful diff target between two decks that likely have different commanders entirely.

### 3. Card list section
A single scrollable list (not fixed columns — this is the layout chosen specifically because it never needs to squeeze into multiple columns on mobile) with a 4-way filter toggle: **All / Shared (N) / Only [Deck A name] (N) / Only [Deck B name] (N)**. Each row shows the card name and a small badge indicating which deck(s) it belongs to. Default filter on open: "All".

Tapping/clicking a card row shows an image preview, matching the existing hover-preview pattern used in `CollectionComparison.js` and `DeckDetail.js` — adapted to tap-to-toggle on touch devices rather than relying on `onMouseEnter`, since hover doesn't exist on mobile.

This is a **read-only analysis view** — no add-to-deck, add-to-wishlist, or edit actions. Confirmed in scope discussion: the goal is comparison, not a shopping/import workflow (that's what `DeckShoppingList.js` already covers for the collection-vs-deck-gap case).

## Component Structure

- **New file:** `frontend/src/components/DeckComparisonModal.js` — self-contained modal component taking `decks` (array, for the picker) and `onClose` as props, mirroring `DeckShellExtractor.js`'s prop shape exactly.
  - Internal state: `deckAId`/`deckBId` (picker selection), `filter` (`'all' | 'shared' | 'onlyA' | 'onlyB'`), `previewCard` (tap-to-preview state).
  - Internal sub-components (module-scope, not defined inside the main component body — per this codebase's established rule that inline component definitions inside a render body cause remount-on-every-render bugs): `DeckPicker`, `ManaCurveOverlay`, `ColorPipComparison`, `CardListRow`.
- **Modified file:** `frontend/src/components/DeckList.js` — add `showComparison` state + "Compare Decks" button + `<DeckComparisonModal>` render, following the exact wiring pattern already used for `showStaples`/`DeckShellExtractor` (lines ~289-291, ~438).

No backend files are touched. No new tests needed beyond frontend build verification and manual click-through (this codebase has no frontend test infrastructure, consistent with every other frontend-only feature built this session).

## Error Handling

Minimal — this feature reads data that's already successfully loaded (`decks` prop can't be in an error state by the time `DeckList.js` renders its own header buttons). Edge cases handled:
- **Fewer than 2 decks exist**: the "Compare Decks" button is still shown (consistent with Find Staples/Shopping List, which also don't hide themselves for small deck counts) but the picker's second dropdown has nothing to select — the "Compare" button stays disabled until two distinct decks are chosen, which is naturally impossible with 0-1 decks.
- **A deck has an empty `mainDeck`**: renders normally — 0 shared, 0 unique-to-that-deck, curve/color charts show all-zero bars rather than erroring.

## Testing

Frontend-only feature, no test infrastructure in this repo (matching every other frontend feature built this session — verified via `npm run build` + manual click-through). Manual verification plan:
- Compare two decks with meaningful overlap (shared staples + unique cards each) — confirm all 4 filter states show correct counts and card lists.
- Compare a deck against itself is prevented (dropdown B excludes whatever's selected in dropdown A).
- Compare two decks where one has a `partnerCommander` and one doesn't — confirm no phantom entries (same class of bug fixed earlier this session for deck ownership calculations).
- Mobile-width (375px) click-through — confirm the header row stacks, the stats charts don't overflow, and the 4-way filter toggle uses `flex-wrap` (not horizontal scroll — that pattern is reserved in this codebase for genuine tab strips like the Admin Panel's group tabs, not small fixed-count filter controls) so it drops to two rows rather than clipping, per this session's mobile-audit conventions.
- Desktop-width click-through — confirm no regression to `DeckList.js`'s existing header button row.

# Duplicate Cleanup → Trading Board Bridge — Design

## Summary

After merging duplicate card rows in `frontend/src/components/DuplicateCleanup.js`, if a merge results in a card with `quantity > 1`, offer a one-click path to list the excess copies on the Trading Board — no need to leave the modal or manually recreate a listing later.

**Why:** Merging duplicates (e.g. two rows of Sol Ring becoming one row with quantity 2) surfaces exactly the moment a user realizes they own more copies than a singleton Commander deck needs. Today that realization goes nowhere — they'd have to separately remember to visit the Trading Board and recreate the listing by hand.

## Current State (confirmed by reading the code)

- `DuplicateCleanup.js`'s `merge()` helper (`await axios.post(`${API_URL}/cards/merge-duplicates`, ...)`) currently discards the response body. The backend route (`backend/routes/cards.js:72-121`) already returns `{ merged: true, target, removedCount }`, where `target` is the fully-updated, saved Card document — including its new summed `quantity`. This is exactly the data needed; no backend changes required.
- `useTrades()` (`frontend/src/contexts/TradesContext.js`) is available anywhere in the app — `TradesProvider` wraps the whole tree (`frontend/src/App.js:474`) — and its `createListing(data)` (line 82) POSTs to `/api/trades` and refreshes the relevant listing lists. This is the same function `TradingBoard.js`'s own "Post a Listing" form already calls.
- `TradingBoard.js`'s existing `CreateListingModal` is single-card, form-based (name autocomplete, one quantity field) — not reusable as-is for a multi-card bulk flow. This design does **not** extract or reuse it; it builds a purpose-fit checklist instead, matching the pattern already established by the Set Completion → Wishlist bridge (loop the existing single-item write endpoint from a reviewable checklist, rather than reusing a single-item form component for bulk data).

## Flow

1. `merge()` is changed to capture and return the response body's `target`.
2. Each of the three merge handlers (`handleMergeExactGroup`, `handleMergeAllExact`, `handleMergeSuggestion`) checks the merged `target.quantity`: if `> 1`, appends `{ _id, name, set, condition, quantity, price, scryfallId, imageUrl }` to a new `excessCandidates` state array on `DuplicateCleanup`. This accumulates across an entire session in the modal — merging 5 groups in a row (including via "Merge All") builds up to 5 candidates rather than interrupting after each one.
3. Once `excessCandidates` is non-empty, a small dismissible banner appears at the top of `DuplicateCleanup`'s body: "N card(s) now have excess copies — List for trade?" with a button that opens the new `ExcessCopiesModal`.
4. `ExcessCopiesModal` shows each candidate as a checklist row (name/set/condition, current quantity, and an editable "quantity to list" number input defaulting to `quantity - 1` — i.e. keep one copy). All rows checked by default. "Select All"/"Select None" shortcuts for longer lists.
5. "List Selected for Trade" loops `createListing({ type: 'have', cardName: name, cardSet: set, condition, quantity: <edited value>, estimatedValue: price, scryfallId, imageUrl, notes: '' })` once per checked row.
6. One summary result replaces per-card feedback: "Listed 3 cards for trade" (with a failure count appended if any individual `createListing` call throws, matching the partial-failure reporting pattern from the Set Completion bridge).
7. Closing `ExcessCopiesModal` (whether cards were listed or not) clears the banner's underlying `excessCandidates` state — this is a one-shot-per-session prompt, not a nagging reminder that reappears.

## Edge Cases

- **Merges resulting in exactly quantity 1 are impossible in practice**: a merge always sums the target's existing quantity with at least one source card's quantity (both ≥1), so the result is always ≥2. The `quantity > 1` check will therefore fire for essentially every successful merge — this is expected, not a bug to guard against.
- **Same card merged twice in one session** (shouldn't happen — merged source rows are deleted server-side, so a given card can't be merged again in the same modal session) — no dedup logic needed in `excessCandidates` beyond what naturally follows from each merge only firing once.
- **`createListing` fails for one card mid-loop**: continue attempting the rest (matching the established partial-failure-tolerant loop pattern), report the failure count in the final summary.
- **User closes `DuplicateCleanup` entirely with pending `excessCandidates`**: the prompt/banner and its state are simply discarded — no persistence across modal sessions, matching this being a lightweight in-session nudge rather than a durable to-do list.

## Component Structure

- **New file:** `frontend/src/components/ExcessCopiesModal.js` — takes `candidates` (array) and `onClose`. Stacks at `z-[60]` above `DuplicateCleanup.js`'s `z-50`, matching the stacking convention already established by `CollectionComparison.js`'s hover-preview overlay, `DeckComparisonModal.js`'s tap-to-preview overlay, and `SetMissingCardsModal.js` (from the Set Completion bridge spec). Calls `useTrades()` directly for `createListing`.
- **Modified file:** `frontend/src/components/DuplicateCleanup.js` — `merge()` returns the response's `target`; the three merge handlers push to a new `excessCandidates` state array when `target.quantity > 1`; a banner renders conditionally; `<ExcessCopiesModal>` renders conditionally, clearing `excessCandidates` on close.

No backend files touched.

## Testing

No frontend test infrastructure in this repo — verified via `npm run build` + manual click-through:
- Merge an exact-duplicate group (2 rows → 1 row, quantity 1+1=2): confirm the banner appears with count 1.
- Use "Merge All" against multiple exact groups: confirm the banner's count reflects all resulting quantity>1 merges, not just the last one.
- Open the excess-copies checklist, uncheck one card, adjust another's list-quantity field, submit: confirm only the checked cards are posted, with the edited quantity respected (not the default `quantity - 1`).
- Confirm the new listings actually appear in Trading Board's "My Listings" tab afterward (cross-check against `useTrades()`'s already-working listing flow).
- Mobile-width (375px): confirm the banner and checklist rows use `flex-wrap` where multiple controls sit in a row, and the modal stacking (`z-[60]` over `z-50`) doesn't visually clip on a narrow viewport.

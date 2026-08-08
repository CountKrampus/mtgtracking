# Set Completion → Bulk Add Missing to Wishlist — Design

## Summary

Each set in the Set Completion Tracker (`frontend/src/components/CollectionTools/SetCompletionModal.js`) gets a "View Missing" action that fetches that set's full card list from Scryfall, diffs it against what the user owns from that set, and shows a reviewable checklist the user can bulk-add to their wishlist.

**Why:** The tracker currently only shows *counts* (owned-unique vs. total-in-set) — it has no idea which specific cards are missing, and there's no path from "I'm at 68% on this set" to actually acquiring the missing 32%.

## Current State (confirmed by reading the code)

- `SetCompletionModal.js` computes `ownedUnique`/`totalInSet` per set from two sources: the user's already-loaded `cards` prop (grouped by `setCode`, tracking owned card *names*) and one Scryfall `/sets/{code}` metadata call per set (for `card_count`). It never fetches the set's actual card list, so "missing" cards are never enumerated today.
- `addToWishlist(scryfallCard, sourceName)` (`frontend/src/contexts/WishlistContext.js:197`) does one `POST /api/wishlist` + one `alert()` per call — no bulk variant exists, and `POST /api/wishlist` (`backend/server.js:975`) has no dedup/merge logic (unlike the Card collection's auto-merge-on-duplicate), so calling it repeatedly for cards already wishlisted would create duplicate entries.
- `WishlistProvider` wraps the whole app (`frontend/src/App.js:473`), so `useWishlist()` — and its already-loaded `wishlistItems` — is available from anywhere, including a component rendered inside `SetCompletionModal`.

## Entry Point & Flow

1. Each set row gets a "View Missing" button (only enabled once that row's completion percentage is under 100% — a fully-completed set has nothing to show).
2. Clicking it fetches the set's full card list: `GET https://api.scryfall.com/cards/search?q=e:{code}&unique=cards&order=set`, following Scryfall's `has_more`/`next_page` for sets over 175 cards (most sets are well under this, but some are not).
3. Filters out any card whose name is already in that row's existing `ownedCards` set (already computed by `SetCompletionModal` for the percentage calculation — reused, not recomputed).
4. Opens a review panel: checklist of missing cards (thumbnail, name, mana cost), all checked by default, "Select All"/"Select None" shortcuts, and an "Add Selected to Wishlist" button showing a live count.
5. On submit: cards already present in the user's wishlist (matched by name against `wishlistItems` from `useWishlist()`) are silently skipped. Remaining selected cards are added via looped `POST /api/wishlist` calls (reusing the existing single-item endpoint — no new backend route), using the same field-mapping `addToWishlist` already uses (`scryfallCard.id` → `scryfallId`, `image_uris.normal` → `imageUrl`, etc.) but without that helper's per-call `alert()`.
6. A single summary result replaces the per-card alert: e.g. "Added 14 cards to your wishlist (3 already on your wishlist were skipped)."

## Error Handling

- Scryfall card-list fetch fails (network/rate-limit): show an inline error in the review panel with a "Retry" button. Does not close or break the parent Set Completion Tracker.
- Partial pagination failure (page 1 succeeds, page 2 fails): show what was successfully fetched so far, with a notice that the list may be incomplete and a retry option, rather than discarding the partial result.
- A wishlist POST fails mid-batch (e.g. one card): continue attempting the rest, then report the summary with a failure count included ("Added 12, 2 failed, 3 skipped as already on your wishlist").

## Component Structure

- **New file:** `frontend/src/components/CollectionTools/SetMissingCardsModal.js` — takes `setCode`, `setName`, `ownedCardNames` (a `Set<string>`, passed down from `SetCompletionModal`'s already-computed per-set data) and `onClose`. Owns its own fetch/pagination/checklist/submit state internally; calls `useWishlist()` directly for both reading `wishlistItems` (dedup check) and triggering wishlist adds.
  - Since `SetCompletionModal` is itself already a `z-50` modal, this new modal must render **on top of it**, not as a page-level sibling — use `z-[60]` (matching the stacking convention already established by `CollectionComparison.js`'s hover-preview overlay and `DeckComparisonModal.js`'s tap-to-preview overlay, both of which layer a second `fixed` element above an already-open `z-50` modal).
- **Modified file:** `frontend/src/components/CollectionTools/SetCompletionModal.js` — add the "View Missing" button per set row (disabled at 100%), track which set's missing-cards panel is open, render `<SetMissingCardsModal>` conditionally. The existing `cardsBySet[code].ownedCards` (a `Set`) built during `getSetCompletionData` is threaded through as `ownedCardNames` rather than rebuilt.

No backend files touched — this is entirely a frontend feature reusing the existing `POST /api/wishlist` endpoint.

## Testing

No frontend test infrastructure in this repo — verified via `npm run build` + manual click-through, matching every other frontend feature built this session:
- A set with meaningful missing cards: confirm the fetched missing-list count matches `totalInSet - ownedUnique` from the tracker row (sanity cross-check against the already-displayed number).
- A set where the user already has some cards wishlisted: confirm those are silently skipped and the summary reports the skip count correctly.
- A set with over 175 cards (triggers pagination): confirm the full list loads, not just the first page.
- Mobile-width (375px) click-through of the review checklist and its action buttons — matching this session's established mobile-audit conventions (`pb-16` bottom-sheet clearance if this renders as its own bottom-sheet modal layered over `SetCompletionModal`, `flex-wrap` on the Select All/None + Add Selected button row).
- Simulate a Scryfall fetch failure (e.g. throttle network in devtools) — confirm the inline retry UI appears rather than a crash.

# Smart Deck Recommendations (Phase 2) Design

## Overview

Phase 2 of the Smart Deck Score feature (see `docs/superpowers/specs/2026-08-06-smart-deck-score-design.md` for Phase 1 and the overall three-phase decomposition). Adds theme-based card recommendations (Ramp / Draw / Removal) to the Deck Detail page, defaulting to cards already in the user's collection, with a toggle to expand to all of Magic.

## Backend

### New route: `GET /api/decks/:id/recommendations`

Query params: `category` (`ramp` | `draw` | `removal`, required), `scope` (`owned` | `all`, defaults to `owned`).

Lives in **`backend/routes/decks.js`**, not `cardInsights.js` — `cardInsights.js` is mounted at `/api/cards` and its `:id` refers to a card in the collection, not a deck; this route's `:id` is a deck id and needs `Deck` model access, which only `decks.js` has wired up. The Scryfall-search-plus-EDHREC-ordering *pattern* is borrowed from `cardInsights.js`'s `similar`/`synergies` routes (including reusing `cachedApiCall` from `utils/apiCache`), but the route itself and its curated category-query table live in `decks.js` alongside the rest of the deck-specific logic.

1. **Color identity**: derived from the deck's commander(s) + colors already present in `mainDeck` (the same signal already used by `estimatePowerLevel`/`calculateManabaseScore` in `backend/utils/deckAnalysis.js` — no new color-detection logic, reuse what exists).
2. **Category search query**: a new curated table in `backend/routes/decks.js`, matching the style of `cardInsights.js`'s existing `MECHANIC_PATTERNS`/`KEYWORD_PATTERNS`:
   ```js
   const RECOMMENDATION_CATEGORIES = {
     ramp: 'o:"search your library" o:"land" OR o:"add" o:"mana"',
     draw: 'o:"draw a card" OR o:"draw two cards"',
     removal: 'o:"destroy target" OR o:"exile target"',
   };
   ```
   This deliberately does **not** reuse Phase 1's `POWER_INDICATORS.ramp`/`.draw`/`.efficientRemoval` fixed name-lists — those lists are ~15 cards each, curated for *scoring* an existing deck, and are too small to serve as a genuine recommendation pool for "cards you don't have yet." Recommendations instead search Scryfall broadly by oracle text, the same approach `similar`/`synergies` already use in this same file.
3. **Scryfall search**: `t:{category-appropriate}` is not applied (ramp/draw/removal span multiple card types); the query is `{category query} (id<={color identity, or 'c' if colorless})`, ordered by `edhrec`, capped at 20 results, excluding any card already in the deck — checked against `mainDeck` **and** the commander(s) (by name), so a commander whose own oracle text happens to match a category's query is never recommended back to itself.
4. **Scope filtering**: when `scope=owned`, cross-reference the Scryfall results against the user's `Card` collection (`buildUserQuery`-scoped) by `scryfallId`; fall back to case-insensitive name match for collection cards missing a `scryfallId` (offline-imported cards). Only return results with a match. When `scope=all`, return all 20 unfiltered.
5. Response shape: `{ category, scope, cards: [...] }` where each card is the raw Scryfall card object (matching `similar`/`synergies`' existing response shape) plus an `owned: true|false` flag per card (computed the same way regardless of `scope`, so the frontend can style owned-vs-unowned consistently even in `scope=all` mode).

## Frontend (`DeckDetail.js`)

New "Recommendations" section rendered below the Phase 1 Smart Deck Score panel:
- Three tabs: Ramp / Draw / Removal.
- A toggle: "My Collection" (default) / "All of Magic" — re-fetches with the corresponding `scope`.
- A card grid (same visual pattern as the existing Similar Cards/Synergies modals' card grid — image, name, mana cost, EDHREC-ordered).
- Clicking a card with `owned: true` calls the existing `POST /api/decks/:id/add-card` (already used elsewhere in this codebase for exactly this purpose) with that card's data, then refreshes the deck.
- Clicking a card with `owned: false` (only reachable in "All of Magic" mode) offers an "Add to Wishlist" action instead, matching how `CollectionView.js`'s existing Similar Cards/Synergies modals already handle unowned suggestions — reuse that same POST-to-wishlist call, not a new one.
- Empty state per tab: "No {category} recommendations found for this deck's colors."

## Non-goals

- No changes to Phase 1 (Smart Deck Score panel) beyond adding this new section below it.
- No new "owned-only" restriction mechanism elsewhere in the app (Similar Cards/Synergies keep their current all-of-Magic-only behavior; this owned/all toggle is specific to deck recommendations).
- No caching/precomputation of recommendations — computed live on each request via Scryfall search, matching how `similar`/`synergies` already work (both already use `cachedApiCall` for the underlying Scryfall HTTP call, which this route reuses).
- No recommendation categories beyond Ramp/Draw/Removal (Tutors/Board Wipes/Protection etc. are explicitly out of scope for this phase).

## Testing

Backend: TDD via jest, new test file `backend/__tests__/deckRecommendations.test.js` covering: color-identity-filtered results, exclusion of cards already in the deck, `scope=owned` filtering against the collection (including the `scryfallId`-missing fallback-to-name case), and the `owned` flag being correct in `scope=all` mode. Frontend: no test infrastructure in this repo; verified via `npm run build` plus manual click-through (add an owned recommendation to a deck, wishlist an unowned one).

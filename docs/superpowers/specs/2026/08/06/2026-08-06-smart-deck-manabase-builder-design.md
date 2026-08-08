# Smart Deck Manabase Builder (Phase 3) Design

## Overview

Phase 3 of the Smart Deck Score feature (see `docs/superpowers/specs/2026-08-06-smart-deck-score-design.md` for the overall three-phase decomposition). Adds a budget-driven manabase builder to Deck Detail: set a dollar budget, get a suggested land package (fixing lands for the deck's colors, best value within budget), toggle individual lands, see a live preview of how the selection would change the deck's Manabase Score, and bulk-add whatever's selected.

## Dependencies

This phase is designed against code from the other two phases and cannot be built before them:
- **Phase 1** (`docs/superpowers/specs/2026-08-06-smart-deck-score-design.md`): requires `calculateManabaseScore` to exist in both `backend/utils/deckAnalysis.js` and its frontend copy in `DeckDetail.js`, plus the `COLOR_SOURCES` table this phase extends.
- **Phase 2** (`docs/superpowers/specs/2026-08-06-smart-deck-recommendations-design.md`): requires the `getDeckColorIdentity` helper added to `backend/routes/decks.js`.

## Backend

### `COLOR_SOURCES` extended with a `cycle` tag

Rather than a second land list, each entry in Phase 1's `COLOR_SOURCES` table (in both `backend/utils/deckAnalysis.js` and its frontend copy) gains a `cycle` field:
```js
'Tundra': { colors: ['W', 'U'], cycle: 'trueDual' },
'Hallowed Fountain': { colors: ['W', 'U'], cycle: 'shockland' },
'Flooded Strand': { colors: ['W', 'U'], cycle: 'fetchland' },
'Command Tower': { colors: ['W','U','B','R','G'], cycle: 'universalFixer' },
'Azorius Signet': { colors: ['W', 'U'], cycle: 'signet' },
```
This changes `COLOR_SOURCES`'s value shape from a plain color array to `{ colors, cycle }` — every existing consumer of `COLOR_SOURCES` in Phase 1's `calculateManabaseScore` (`COLOR_SOURCES[card.name]` used as a color array) must be updated to read `.colors` instead of using the value directly. This is a breaking shape change to a table Phase 1 introduces, made here because Phase 3 needs the cycle metadata and introducing a second table would duplicate ~40 land names across two files, the same duplication problem already caught and avoided once during Phase 1's own plan-writing.

### New route: `GET /api/decks/:id/manabase-builder`

Query param: `budget` (required, dollar amount).

1. Color identity via `getDeckColorIdentity(deck)` (Phase 2's helper, already in `decks.js`).
2. Candidates: every `COLOR_SOURCES` entry whose `colors` overlaps the deck's color identity, excluding cards already in `mainDeck`/commander (same exclusion logic Phase 2's recommendations route already has).
3. Price each candidate via the existing `getPriceWithFallback` pricing utility (already used elsewhere in this codebase for on-demand price lookups).
4. Greedy-select a suggested package: sort candidates by (number of the *deck's own* colors the card fixes ÷ price) descending — a universal 5-color fixer like Command Tower only counts colors that intersect the deck's actual color identity, not all 5 unconditionally, so it doesn't artificially outrank a card that fixes exactly what a 2-color deck needs. Add to the package until the running total would exceed `budget`.
5. Response: `{ budget, suggested: [{ name, colors, cycle, price }], candidates: [...] }` — `suggested` is the greedy pick, `candidates` is the full priced list (so the frontend can let the user swap in an unsuggested card if they want, without a second request).

No score computation happens in this route — that's entirely client-side (see Frontend).

## Frontend (`DeckDetail.js`)

New "Manabase Builder" section, below Phase 2's Recommendations section:
- A dollar budget input + "Suggest Land Package" button, calling the new route once per click.
- The `suggested` lands render as a checklist (checked by default), each showing name, cycle label, price, colors.
- **Live score preview, computed entirely client-side**: on every checkbox toggle, build a hypothetical deck (current `mainDeck` + currently-checked lands) and run it through the frontend's own `calculateManabaseScore` copy (already present per Phase 1) — no backend round-trip. Displays "Manabase Score: {current grade} → {projected grade}".
- "Add Selected to Deck" button: calls the existing `POST /:id/add-card` route once per checked land (same pattern Phase 2 already uses for its own add-to-deck action), then refreshes.

## Non-goals

- No land-cycles browser as a separate/standalone UI — the cycle data feeds the builder directly; there's no independent "browse all land cycles" page, per the "New tool on Deck Detail" scope decision (the standalone-tool alternative was explicitly not chosen).
- No support for a land-count budget (cards, not dollars) — dollar budget only, per the confirmed decision.
- No re-optimization suggestions for lands already in the deck (this only suggests additions, it doesn't recommend cutting existing lands).
- No live backend recomputation of the score per checkbox click — entirely client-side by design, to keep the interaction snappy.

## Testing

Backend: TDD via jest, new test file `backend/__tests__/deckManabaseBuilder.test.js` covering: budget-constrained greedy selection, exclusion of cards already in the deck, price-fetch integration (mocked), and the `COLOR_SOURCES` shape change not breaking Phase 1's `calculateManabaseScore` tests (existing Phase 1 tests must be updated to match the new `{ colors, cycle }` shape as part of this phase's implementation, even though Phase 1 was designed first). Frontend: no test infrastructure in this repo; verified via `npm run build` plus manual click-through (suggest a package, toggle a land off, confirm the score preview updates, add selected lands, confirm they appear in the deck).

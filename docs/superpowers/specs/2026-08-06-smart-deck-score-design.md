# Smart Deck Score (Manabase Score + Deck Health Score) Design

## Overview

Adds two new deck-quality scores — **Manabase Score** and **Deck Health Score** — alongside the existing Power Level and Salt Score in the Deck Builder's deck detail view, inspired by a competitor app's "Smart Decks" feature. This is Phase 1 of a three-phase decomposition of that competitor feature; card recommendations and a manabase-builder/land-cycles browser are separate, later features and are explicitly out of scope here.

## Backend

### `COLOR_SOURCES` table (new, in `backend/utils/deckAnalysis.js`)

A curated `{ 'Card Name': ['W','U',...] }` table of nonbasic cards (lands AND mana rocks/dorks) that produce specific colored mana — nonbasic duals, fetches, shocks, Command Tower, and colored-mana rocks like Signets, Arcane Signet, Fellwar Stone, Chrome Mox, Mox Diamond, Jeweled Lotus — matching the existing style of `SALTY_CARDS`/`POWER_INDICATORS` in the same file. This is a **separate table from `POWER_INDICATORS.fastMana`**, not a cross-reference against it: `fastMana` classifies cards by raw power/speed regardless of color (it includes colorless-only sources like Sol Ring, Mana Crypt, and Mana Vault, which produce no colored mana and must NOT count toward any color's source total). Basic lands (Plains/Island/Swamp/Mountain/Forest) are handled separately by name, not via this table.

### `calculateManabaseScore(deck)` (new)

Grounded in Frank Karsten's published mana-source-count research (the community-standard reference for this kind of analysis), scaled to Commander's 99-card deck size:
- Single-pip spells need ~22 color sources, double-pip ~29, triple-pip ~34+ (60-card baseline ×~1.6).

Algorithm:
1. For each color (W/U/B/R/G), compute **pip-weighted demand**: sum the count of that color's mana symbols across every non-land card's mana cost in `mainDeck` + commander(s) (a `{1}{W}{W}` card contributes 2 to W's demand, not 1).
2. For each color, compute **actual sources**: basic lands producing that color (by name) + any deck card present in `COLOR_SOURCES` that produces that color.
3. Interpolate a target source count per color from the Karsten single/double/triple-pip figures, weighted by that color's average pip-per-card demand.
4. Compare actual vs. target per color; the overall grade is derived from the worst-performing color that has nonzero demand (a deck's manabase is only as good as its weakest color requirement), mapped to a letter grade A–F.
5. Returns `{ grade: 'B+', bySourceColor: { W: { sources: 12, target: 14 }, ... }, landCount: 37, recommendedLandRange: [36, 38] }`.

### `calculateDeckHealthScore(deck)` (new)

A heuristic 0–100 composite, in the same spirit as the existing Power Level/Salt Score heuristics (not a formal published formula — no such community standard exists for this the way it does for manabases):
- **Curve smoothness**: penalizes decks whose `manaCurve` is too top-heavy (too many 5+ CMC cards) or too thin early (too few 1-2 CMC plays), using the deck's existing `calculateDeckStatistics` output.
- **Ramp/Draw/Removal density**: extends `POWER_INDICATORS` with two new curated categories, `ramp` and `draw` (mirroring the existing `efficientRemoval` category's style), and scores based on how many of each are present relative to Commander-format norms.
- **Land-to-spell ratio**: cross-checks `landCount` (from the manabase calculation) against total deck size.
- Returns `{ score: 82, breakdown: { curveSmoothness, ramp, draw, removal, landRatio } }` (0–100 each, weighted-averaged into the overall score).

### `calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore)` (new)

Normalizes all four into one headline 0–100 number: Power Level (1–10) and Deck Health (already 0–100) scaled directly; Salt Score inverted and capped (lower salt contributes positively, extreme salt scores don't dominate the average); Manabase grade (A–F) mapped to a 0–100 scale. Simple weighted average, not a novel formula — this number exists purely to drive the panel's headline display, not as a rankable metric.

### Wiring

`backend/routes/decks.js`'s deck-detail route (wherever `calculateSaltScore`/`estimatePowerLevel` are currently invoked) also calls the two new functions and includes their output in the response, matching the existing pattern.

## Frontend (`frontend/src/components/DeckDetail.js`)

Per the approved mockup: the existing side-by-side "Power Level" + "Salt Score" two-card row is **replaced** by a unified "Smart Deck Score" panel:
- A headline section showing the global score (0–100) prominently at the top.
- Below it, a compact 4-item strip: Power, Salt, Mana (grade), Health — each clickable.
- Clicking any one of the four **swaps the strip out** for a detail view of just that score (its existing breakdown list style, e.g. "Fast Mana: 2 cards" for Power, plus the new per-color source breakdown for Manabase and the curve/ramp/draw/removal breakdown for Health), with a "← Back" control that restores the 4-item strip.
- The frontend computes these scores via the same `useMemo`-based client-side logic pattern the file already uses for Power Level/Salt Score (a frontend copy of the calculation logic, kept in sync with the backend copy — matching the existing documented convention in `deckAnalysis.js`'s header comment).

## Non-goals

- No card recommendation engine (Phase 2, separate design).
- No manabase-builder/land-cycles browser tool (Phase 3, separate design).
- No change to how Power Level or Salt Score are themselves calculated — only their presentation moves into the new panel.
- No per-turn hypergeometric simulation for the manabase score — uses Karsten's published flat pip-count targets, not a full probability engine (matches the existing heuristic-level fidelity of Power Level/Salt Score rather than introducing a much more precise but inconsistent new standard).

## Testing

Backend: unit tests in `backend/__tests__/deckAnalysis.test.js` (existing file) for `calculateManabaseScore`, `calculateDeckHealthScore`, and `calculateGlobalScore`, covering mono-color decks, 3+ color decks with varying fixing-land density, and edge cases (empty mainDeck, no commander). Frontend: no test infrastructure exists in this repo; verified via `npm run build` plus manual click-through of the panel/swap-to-detail interaction in the Deck Builder.

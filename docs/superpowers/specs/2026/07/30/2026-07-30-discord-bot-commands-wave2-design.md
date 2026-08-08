# Discord Bot Commands — Wave 2 Design

## Overview

The MTG Tracker Discord bot currently supports 11 slash commands (`link`, `unlink`, `card`, `collection stats`, `add`, `remove`, `update`, `price`, `wishlist`, `decks`, `deck`). This adds 6 more, exposing collection/deck-building features that today only exist as client-side logic in the React frontend: similar-card search, card synergies, commander recommendations, set completion tracking, storage-location lookup, and deck power level / salt score.

## Architecture

The bot's existing rule — it only ever talks to the MTG Tracker backend, never to Scryfall or any third party directly (see `discord-bot/src/commands/card.js`, `discord-bot/src/lib/resolveCard.js`) — is preserved. Four features (`similar`, `synergies`, `commander recommendations`, `set completion`) currently exist *only* as Scryfall-calling logic embedded in the frontend (`frontend/src/components/CollectionView.js`, `frontend/src/App.js`). This design extracts that logic into new backend routes so both the web app's existing UI and the new bot commands can call it, rather than the bot re-implementing (and inevitably drifting from) the same query-building and oracle-text-parsing logic a second time.

Similarly, deck power level and salt score are currently pure functions computed client-side in `frontend/src/components/DeckDetail.js` (lines 107-242, `SALTY_CARDS`/`POWER_INDICATORS` tables plus two `useMemo` scoring functions). These get extracted into a shared backend util and folded into the existing `GET /api/decks/:id/stats` response.

**Explicitly out of scope:** this design does not change what the frontend calls — `CollectionView.js`, `App.js`, and `DeckDetail.js` keep making their existing direct Scryfall calls / client-side computations unchanged. Pointing the frontend at the new backend endpoints instead is a reasonable follow-up but is a separate, independently-shippable change and isn't part of this plan.

## New / changed backend endpoints

All four new routes are `requireAuth`-gated and scoped to the caller's own collection via `buildUserQuery`/`getUserId`, identical to every existing route in `backend/server.js`.

### `GET /api/cards/:id/similar`

Ports `findSimilarCards` (`CollectionView.js:551-570`). Looks up the caller's owned card by `:id`, builds the Scryfall query:

```
t:<card.types[0]> (c:<color> c:<color> ...)   -- or c:colorless if no colors
-!"<card.name>"
```

ordered by `edhrec`, `unique=cards`. On Scryfall error, falls back to a type-only query. Returns the top 20 results (name, set, prices.usd, type_line) as JSON.

### `GET /api/cards/:id/synergies`

Ports `findCardSynergies` (`CollectionView.js:590-690`). Same tribal-detection regex against oracle text and card name, the same keyword pattern table (flying, deathtouch, lifelink, ... 14 entries), and the same mechanic pattern table (18 entries covering counters, sacrifice, tokens, etc.), including the type-based mechanic fallback for Instant/Sorcery/Artifact/Enchantment when no mechanic pattern matches. Returns:

```json
{ "tribal": [...], "keywords": [...], "mechanics": [...] }
```

each capped at 12 results, same as the frontend.

### `GET /api/commanders/recommend`

Ports the collection-analysis branch of `getCommanderRecommendations` (`App.js:265-366`) — NOT the manual "finder" mode (`searchCommandersByPreference`, `App.js:400+`), which stays frontend-only since it requires a multi-select UI the bot doesn't have. Always analyzes the caller's own collection:

- Color counts per card (`card.colors`), weighted by quantity.
- Theme detection via the same 12 oracle-text regex patterns (tokens, graveyard, counters, lifegain, sacrifice, spellslinger, artifacts, enchantments, tribal, ramp, draw, control), weighted by quantity.
- Top theme by weight picks a theme Scryfall sub-query from the same `themeSearches` map.

New query parameter `colors` (optional, e.g. `UB`, `WUBRG`, `G`):

- **Omitted:** no color-identity clause is added to the query at all — searches `t:legendary t:creature <themeQuery>` across all colors.
- **Provided:** replaces the auto-detected dominant-color clause with `id:<colors>` (or `id<=<colors>` — match the existing frontend's semantics at `App.js:318`/`432`, which uses `id:` for the auto-detected top colors).

Falls back to a plain `t:legendary t:creature` search (matching `App.js:355-359`) if the themed query errors. Returns top 20 results, `order=edhrec`, `unique=cards`.

### `GET /api/sets/completion`

Ports `getSetCompletionData` (`App.js:463-522`). Groups the caller's owned cards by `setCode`, caps at 20 distinct sets (matching the frontend's cap to avoid excessive Scryfall calls), fetches `GET https://api.scryfall.com/sets/:code` per set with the same 100ms delay between requests, and returns:

```json
[{ "setCode": "...", "setName": "...", "ownedUnique": N, "totalInSet": N, "totalOwned": N, "releasedAt": "...", "setType": "..." }, ...]
```

sorted by completion percentage (`ownedUnique / totalInSet`) descending, same as the frontend.

### Extend `GET /api/decks/:id/stats`

Add two new fields to the existing response (`backend/routes/decks.js:469-526`), computed by a new `backend/utils/deckAnalysis.js` module:

```js
// backend/utils/deckAnalysis.js
const SALTY_CARDS = { /* verbatim copy of DeckDetail.js:107-127 */ };
const POWER_INDICATORS = { /* verbatim copy of DeckDetail.js:129-149 */ };

function calculateSaltScore(deck) { /* ports DeckDetail.js:196-212 */ }
function estimatePowerLevel(deck, deckValue) { /* ports DeckDetail.js:215-241 */ }

module.exports = { calculateSaltScore, estimatePowerLevel };
```

`estimatePowerLevel` needs `deck.mainDeck`, `deck.commander`, `deck.statistics.avgManaCost`, and a `deckValue` number — the route computes this last one the same way `GET /api/decks/:id/ownership` does (`ownedValue + missingValue` from `backend/routes/decks.js:402-413`), re-running that same owned/missing pass rather than requiring the bot to call `/ownership` separately first.

The `/api/decks/:id/stats` response gains:

```json
{
  ...existing fields...,
  "powerLevel": { "level": 7, "breakdown": { "fastMana": 2, "tutors": 1, "comboPieces": 0, "efficientRemoval": 3, "powerhouses": 1, "avgCmc": 2.8, "deckValue": 1450 } },
  "saltScore": { "score": 8, "cards": [{ "name": "Rhystic Study", "salt": 2 }, ...] }
}
```

## New bot commands

All six follow the existing conventions: `deferReply({ ephemeral: true })` up front (each makes 2+ backend round-trips), `replyNotLinked(interaction)` on a 401, an error embed/message on any other non-200 status, and a plain ephemeral embed reply on success.

### `/similar <card>`

Resolves the caller's owned card by name via the existing `resolveCard()` helper (`discord-bot/src/lib/resolveCard.js`, including its disambiguation select-menu for multiple matches). Calls `GET /cards/:id/similar`. Renders an embed titled `Similar to <card.name>` with up to 10 fields, each `name (set) — $price`.

### `/synergy <card>`

Same resolution via `resolveCard()`. Calls `GET /cards/:id/synergies`. Renders one embed titled `Synergies for <card.name>` with three fields — `Tribal`, `Keywords`, `Mechanics` — each listing up to 5 card names (or `None found` if empty).

### `/commander [colors]`

No card resolution needed. Optional string option `colors`. Calls `GET /commanders/recommend?colors=<colors>` (param omitted entirely from the query string if not provided). Renders an embed titled `Commander Recommendations` with up to 10 fields, each `name — $price`.

### `/sets`

No arguments. Calls `GET /sets/completion`. Renders an embed titled `Set Completion` with up to 10 fields (top 10 by completion %), each `<setCode> — <setName>: <ownedUnique>/<totalInSet> (<pct>%)`.

### `/location <name>`

Calls `GET /locations`, case-insensitive matches `name` against location names (substring match, same style as `resolveCard.js`'s name matching). If exactly one location matches, calls `GET /cards`, filters client-side (bot-side) to `card.location === matchedLocation.name`, and renders an embed listing up to 25 cards as `name x<quantity>` (with a footer note if truncated). If zero or multiple locations match, follows up with a plain message listing the available location names instead of guessing.

### `/deckstats <deck>`

Resolves the deck by exact name via the same two-step lookup as `/deck` (`GET /decks` list, find by case-insensitive exact name match, then `GET /decks/:id/stats`). Renders an embed titled `<deck.name> — Power & Salt` with fields `Power Level` (`<level>/10`), `Salt Score` (`<score>`), and (if any) a `Salty Cards` field listing up to 5 `name (salt)` pairs.

## Command registration

Six new `SlashCommandBuilder` entries added to `discord-bot/src/registerCommands.js`'s `commands` array, following the existing style (string options for card/deck names, no options for `/sets`, optional string option for `/commander`'s `colors`).

## Testing

**Backend:** one new supertest + MongoMemoryServer test file per new/changed route, following the existing pattern in `backend/__tests__/discord-routes.test.js` — mocking `axios`/the Scryfall HTTP calls where a route makes them (`similar`, `synergies`, `commander recommend`, `sets/completion`), and testing `deckAnalysis.js`'s two functions directly with unit tests (no HTTP mocking needed — they're pure functions over a deck object).

**Bot:** one new test file per new command in `discord-bot/__tests__/`, following `add.test.js`'s `jest.mock('../src/apiClient')` pattern — asserting the right backend endpoint is called, the right embed shape is returned, `deferReply` is called first, and `replyNotLinked` fires on a 401.

## Non-goals

- The frontend is not modified to call the new endpoints — it keeps its existing direct Scryfall calls.
- `/commander`'s manual "finder" mode (explicit theme/creature-type picker) is not exposed via the bot — only the collection-auto-analysis mode, with the new color override.
- `/sets` does not support looking up one specific set by code/name in this pass — it always shows the top 10 by completion %.
- `/similar` and `/synergy` are read-only in the bot — no inline "add to collection/wishlist" button, unlike the frontend's interactive version. Users `/add` by name afterward if they want a suggested card.

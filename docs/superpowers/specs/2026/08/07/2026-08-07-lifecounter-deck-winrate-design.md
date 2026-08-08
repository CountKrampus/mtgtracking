# Life Counter → Deck Win-Rate Stats — Design

## Summary

Show each deck's Life Counter games-played/win-rate on its card in the Deck Builder list. Almost the entire feature already exists — this closes the one missing link.

## Current State (confirmed by reading the code)

- `GameSetup.js` already lets players pick a deck per seat before starting a Life Counter game.
- `LifeCounter.js`'s `handleEndGame` already saves `deckId`/`commanderName`/`isWinner` per player into the `GameSession` document on every completed game.
- `GET /api/lifecounter/stats` (`backend/server.js:1651-1735`) already aggregates this into `mostPlayedDecks: [{ deckId, commanderName, gamesPlayed, wins, winRate }]`.
- `DeckBuilder.js` already fetches this and builds a `deckPlayCounts` map (keyed by stringified `deckId`), and already passes it to `<DeckList deckPlayCounts={deckPlayCounts} ... />`.
- The gap: `DeckList.js`'s function signature (`frontend/src/components/DeckList.js:64`) does not destructure `deckPlayCounts` from its props, so the value is silently dropped before it ever reaches the deck cards. Nothing renders it.

## Design

- `DeckList.js` destructures `deckPlayCounts = {}` from its props.
- `DeckCard` (defined inside `DeckList`, line 154) receives `deckPlayCounts` and looks up `deckPlayCounts[deck._id]`.
- If found, render a small badge on the card — "🎮 {gamesPlayed} games · {winRate}% WR" — placed in the existing cards/value row (`{deck.statistics?.totalCards} cards / ${deck.totalValue}`), matching that row's existing text-sm/white-60 styling. If not found (deck never played), render nothing extra — no "0 games" clutter on decks that have never touched Life Counter.
- Win rate color-coded the same way `Dashboard.js`'s existing "Most Played Decks" widget already does (`text-green-400` at ≥50%, `text-red-400` below), for visual consistency between the two places this same data now appears.

## Testing

No frontend test infrastructure in this repo — verified via `npm run build` + manual click-through: play a Life Counter game with a deck assigned through to completion, confirm that deck's card in Deck Builder now shows the games/win-rate badge, and confirm a deck never played in Life Counter shows no badge at all.

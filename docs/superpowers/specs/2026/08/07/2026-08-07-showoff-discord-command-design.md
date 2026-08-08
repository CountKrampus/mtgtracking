# `/showoff` Discord Command — Design

## Summary

A new Discord slash command letting a linked user post their top valuable cards, or a specific deck's spotlight, publicly into the channel.

## Current State (confirmed by reading the code)

- `discord-bot/src/commands/deckstats.js` is the closest existing precedent: it resolves a deck by name via `GET /decks` (case-insensitive match), then fetches deck detail. It replies `ephemeral: true`, like every other command in this bot.
- `discord-bot/src/commands/collection.js` shows the established subcommand pattern (`/collection stats`) via `interaction.options.getSubcommand()`.
- `GET /api/cards` already supports `sortBy`/`sortOrder`/`limit` query params (`backend/utils/cardUtils.js`'s `buildCardListQuery`) — no backend change needed for the "top cards" half of this feature.
- `GET /api/decks/:id` already returns full deck data (commander, `mainDeck`, `statistics`, `totalValue`) — no backend change needed for the "deck spotlight" half either.
- `discord-bot/src/registerCommands.js` and `discord-bot/src/index.js` are the two files every existing command touches for registration (slash command definition + handler require/registration respectively) — no other wiring exists.

## Design

New `discord-bot/src/commands/showoff.js`, two subcommands:

- **`/showoff cards [count]`** — `count` optional integer, default 5, max 10 (enforced via `SlashCommandBuilder`'s `.setMaxValue(10)`). Calls `GET /api/cards?sortBy=price&sortOrder=desc&limit=<count>`, builds an embed listing each card's name, set, and price.
- **`/showoff deck <name>`** — `name` required string. Resolves to a deck via `GET /decks` + case-insensitive name match (copying `deckstats.js`'s existing lookup logic exactly), then `GET /decks/:id`. Builds an embed with the commander's image as the embed thumbnail, deck name, format, `mainDeck.length` (or `statistics.totalCards`) card count, and `totalValue`.

Both reply via `interaction.reply({ embeds: [...] })` with **no** `ephemeral: true` flag — public in the channel. This is a deliberate, isolated exception to every other command in this bot (confirmed: `deckstats.js`, `collection.js`, and by extension the rest of `discord-bot/src/commands/` all reply ephemerally) — the whole purpose of this command is visibility, so hiding the result would defeat it.

Standard not-linked / API-error handling matches every other command: `replyNotLinked(interaction)` on a 401, a generic `❌ Something went wrong (${status}).` reply on other non-200s — but note these error replies should stay `ephemeral: true` even though the success path is public, since an error message is only useful to the person who ran the command, not the whole channel.

## Testing

`discord-bot/__tests__/deckstats.test.js` is the exact model to follow: `jest.mock('../src/apiClient')`, a `mockInteraction()` helper stubbing `deferReply`/`followUp`/`editReply`/`options`, and assertions on `api.get` call order plus the resulting embed's shape. This project's Jest suite (`discord-bot/__tests__/`) already has 16 command test files — `showoff.test.js` follows the same house style. Cover: `cards` subcommand builds a correctly-sorted/limited embed, `deck` subcommand resolves and shows the right fields, not-linked (401) produces the standard private error, an unmatched deck name produces the standard private "no deck named" error, and — since this command's whole point is a behavior no other command has — an explicit assertion that the success-path reply does NOT include `ephemeral: true` (while the error-path replies still do).


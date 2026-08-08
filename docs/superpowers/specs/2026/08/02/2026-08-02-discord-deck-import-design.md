# Discord Bot `/deck import` Design

## Overview

Adds deck-URL import to the Discord bot, reusing the backend's existing `POST /api/decks/import` (parse/preview) and `POST /api/decks` (persist) routes — the same two-step flow the web app's `DeckImport.js` already uses. Supports all 4 URL-based sources the backend already supports: **Moxfield, Archidekt, TappedOut, and MTGGoldfish** (the two paste-based sources, plain text list and MTGA Arena export, are not exposed via the bot — Discord isn't a good place to paste a multi-line decklist).

This requires restructuring the existing `/deck` command, which currently takes a single required `name` string option (`/deck <name>` looks up one of your existing decks by name), into two subcommands. This is a breaking change to `/deck`'s existing syntax — anyone using `/deck <name>` today will need `/deck view <name>` after this ships.

## `/deck` command restructure

- `/deck view <name>` — today's existing lookup behavior (`discord-bot/src/commands/deck.js`'s current logic), moved under a subcommand with no functional change: `GET /decks`, case-insensitive name match, `GET /decks/:id`, embed with Format/Cards fields.
- `/deck import <url>` — new, described below.

`discord-bot/src/registerCommands.js`'s current `deck` entry:
```js
new SlashCommandBuilder().setName('deck').setDescription('View a deck')
  .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),
```
becomes a command with two subcommands (`view` carrying today's `name` option, `import` carrying the new `url` option).

## `/deck import <url>` flow

1. **Domain detection.** The bot doesn't replicate the backend's per-source URL-format validation (deck-ID regexes, etc.) — it only does coarse hostname routing to pick the right `source` discriminator to send:
   - `moxfield.com` → `source: 'moxfield'`
   - `archidekt.com` → `source: 'archidekt'`
   - `tappedout.net` → `source: 'tappedout'`
   - `mtggoldfish.com` → `source: 'mtggoldfish'`
   - Anything else → reply immediately (no defer needed yet) with an error naming the 4 supported sites, without calling the backend at all.

2. **Defer.** Once a source is matched, `await interaction.deferReply({ephemeral: true})` — this chains an external fetch (Moxfield/Archidekt/TappedOut/MTGGoldfish) plus batched Scryfall lookups, well past Discord's 3s window, matching the existing `deck.js` convention for any multi-round-trip command.

3. **Parse.** `POST /decks/import` with `{source, data: url}`, authenticated via `client(interaction.user.id)` the same way every other command calls the backend.
   - 401 → `replyNotLinked`.
   - 400 with `"No commander found in deck list"` (the backend enforces this for all 4 sources, not just Moxfield) → surfaced verbatim via `followUp`, since it's already a clear, accurate message.
   - Any other non-200 → surface `res.data?.message` (the backend's own per-source error text — invalid URL format, private/not-found deck, scrape failure, etc.) rather than a generic status-code message, since these messages are already specific and helpful (e.g. TappedOut's "Invalid TappedOut URL — expected https://tappedout.net/mtg-decks/your-deck-name/").

4. **Preview.** On success, `res.data` is `{deckData, statistics, validation}` (not yet saved). Render an embed: deck name, commander (+ partner commander if present), total card count (`statistics.totalCards`), and color identity (union of `commander.colorIdentity` and `partnerCommander.colorIdentity` if present). Attach two buttons: **Confirm Import** (`customId: 'deck-import-confirm'`) and **Cancel** (`customId: 'deck-import-cancel'`).

5. **Await one button click** (`interaction.channel.awaitMessageComponent`, filtered to this user + either customId, 30s timeout — matching the bot's existing timeout convention). No loop needed; this is a single confirm/cancel decision, not a multi-turn browse.
   - Timeout → update the message to say the import timed out and nothing was saved.
   - Cancel → update the message to say the import was cancelled, clear the buttons.
   - Confirm → `POST /decks` with `{...deckData, statistics}` (fast, no external calls — same as the web app's second step). On success, update the message with a success line naming the deck. On failure (401 mid-session, or any other non-201), surface the backend's error the same way step 3 does.

## Non-goals

- No `text`/`arena` paste-based import via the bot — URL sources only.
- No dedup — reimporting the same URL creates a second deck, matching current backend/web behavior.
- No bot-side replication of each source's URL-format validation regex — coarse domain routing only, with the backend's own per-source error messages surfaced for anything more specific.
- No change to non-Commander-format decks being rejected — that's an existing backend-wide limitation (`if (!parsedData.commander) return 400`), not something this feature changes.

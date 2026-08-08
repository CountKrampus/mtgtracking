# Discord Bot Commands — Wave 3 Design (Trading, Achievements, Wishlist Deals, Price Alerts)

## Overview

Four additions to the MTG Tracker Discord bot (currently 17 commands), all reusing **existing backend endpoints** — no backend changes required:

1. `/wishlist deals` — new subcommand surfacing wishlist items whose current price has hit your target.
2. `/achievements` — new command showing earned collector badges.
3. `/pricealerts` — new command listing cards with an active price alert threshold.
4. `/trades` — a new command with 6 subcommands, the full trading system: browse listings, view your own listings, create `have`/`want` listings, make multi-card offers, and accept/reject/cancel offers via interactive buttons.

Item 4 is the substantial piece and requires one architectural change: the bot's main interaction dispatcher currently only handles slash commands, not button clicks, and accept/reject/cancel buttons need to work whenever they're clicked — which could be long after the command that created the message finished running.

## 1. `/wishlist deals`

New subcommand alongside the existing `list`/`add`/`remove` in `discord-bot/src/commands/wishlist.js`. Calls the same `GET /wishlist` endpoint already used by `list`, filters bot-side for items where `currentPrice > 0 && targetPrice > 0 && currentPrice <= targetPrice`, and renders them the same way `list` does (name + priority) plus the current vs. target price. If nothing qualifies, replies with a plain "No deals right now" message rather than an empty embed.

## 2. `/achievements`

New command file. Calls `GET /api/achievements` (already returns all 15 achievements with `earned`/`earnedAt`, auto-granting newly-earned ones on each call). Renders an embed listing only the earned ones (icon + name), with a `X/15 earned` summary in the title or a field. If none earned yet, says so plainly rather than showing an empty list.

## 3. `/pricealerts`

New command file. Calls `GET /cards` (the same endpoint `/location` already uses), filters bot-side for cards where `card.priceAlert?.targetPrice > 0 || card.priceAlert?.targetHigh > 0`, and renders each as a field showing the card name and whichever threshold(s) are set alongside the card's current `price`. Caps at 25 (embed field limit), same convention as other list-style commands in this bot.

## 4. `/trades` — full trading system

### Data model recap (already exists, no changes)

- `TradeListing`: `userId`, `username`, `type` (`have`/`want`), `cardName`, `cardSet`, `cardSetCode`, `scryfallId`, `imageUrl`, `condition`, `quantity`, `estimatedValue`, `notes`, `status` (`active`/`completed`/`cancelled`).
- `TradeOffer`: `listingId`, `fromUserId`/`fromUsername`, `toUserId`/`toUsername`, `offeredCards` (array of `{cardName, cardSet, condition, quantity, estimatedValue, scryfallId, imageUrl}`), `message`, `status` (`pending`/`accepted`/`rejected`/`cancelled`/`countered`).
- Backend already enforces ownership server-side on every mutating route (e.g. `accept`/`reject` 403 unless `offer.toUserId === req.user._id`) — the bot doesn't need to duplicate that check, just surface the 403 as a normal error if it somehow occurs.

### `/trades browse [type] [card]`

Calls `GET /api/trades?type=<type>&card=<card>` (public endpoint — the backend route itself has no `requireAuth`, so this subcommand works even for an unlinked Discord account, consistent with the website's public listing board). Renders up to 10 active listings as embed fields: `<type emoji> cardName (set, condition) — posted by username`.

### `/trades my-listings`

Calls `GET /api/trades/my-listings` (requires linking — 401 → `replyNotLinked`). Renders your own active listings.

### `/trades create <type> <card> [message]`

- `type`: `have` or `want` (Discord choice option).
- `card`: the card name.
- For `type=have`: resolves against the caller's own collection using the existing `resolveCard(interaction, api, searchName)` helper (same disambiguation-select-menu behavior as `/similar`/`/synergy`/`/add`). On a match, `POST /api/trades` with `cardName/cardSet/cardSetCode/scryfallId/imageUrl/condition` copied from the matched card, `estimatedValue` from the card's `price`, `quantity: 1`.
- For `type=want`: resolves via `GET /scryfall/search?name=<card>` (the same lookup `/card` already uses — no owned-copy required). On a match, `POST /api/trades` with `cardName/cardSet/cardSetCode/scryfallId/imageUrl` from the Scryfall result, `condition: 'NM'` (a "want" listing's condition reflects what you're asking for, defaulting to Near Mint), `estimatedValue` from the Scryfall price if present, `quantity: 1`.
- `message` (optional) maps to the listing's `notes` field.

### `/trades offer <listing> [message]`

1. Resolve the target listing: `GET /api/trades?card=<listing>` (bot-side, case-insensitive substring match against `cardName`, matching `/location`'s established zero/one/many disambiguation pattern — zero matches lists a hint to browse, multiple matches asks for a more specific name).
2. Fetch the caller's own collection (`GET /cards`) and present it as a **multi-select** `StringSelectMenuBuilder` (`.setMinValues(1).setMaxValues(min(25, cards.length))`), reusing the same 25-option Discord limit already handled in `resolveCard.js`. The interaction resolves once the user confirms their selection (Discord's native multi-select confirm — no separate "submit" button needed).
3. Build `offeredCards` from the selected cards (`cardName/cardSet/condition/quantity: 1/estimatedValue: card.price/scryfallId/imageUrl` per selected card) and `POST /api/trades/:listingId/offers` with `{offeredCards, message}`.

### `/trades received`

Calls `GET /api/trades/offers/received`. For each `status: 'pending'` offer (cap at 5, oldest-first or newest-first — newest first, matching the backend's own `sort({createdAt: -1})`), sends its own ephemeral embed (fromUsername, the listing's card, the offered cards summarized as a bullet list, the offer's message) with two buttons: **Accept** (`customId: trade-accept:<offerId>`) and **Reject** (`customId: trade-reject:<offerId>`).

### `/trades sent`

Calls `GET /api/trades/offers/sent`. Renders each offer's status. Pending ones get a **Cancel** button (`customId: trade-cancel:<offerId>`).

### Button interaction handling (new dispatcher logic)

`discord-bot/src/index.js`'s `Events.InteractionCreate` handler currently does `if (!interaction.isChatInputCommand()) return;` — silently dropping every button click. Add a parallel branch: `if (interaction.isButton())`, parse the `customId` (`trade-accept:<id>`, `trade-reject:<id>`, `trade-cancel:<id>`), call the corresponding backend route (`PUT /api/trades/offers/:offerId/accept|reject|cancel`) authenticated as `interaction.user.id` (same `client(discordUserId)` pattern every other command uses), then `interaction.update(...)` the original message to show the result (e.g. replace the two buttons with a single disabled "✅ Accepted" button, or just edit the embed's description and remove the button row) so the same offer can't be double-actioned by clicking again. A network/logic error (e.g. someone else already accepted, or the offer already resolved) surfaces as an ephemeral follow-up rather than crashing.

### Non-goals

- No counter-offers (`PUT /api/trades/offers/:offerId/counter`) — explicitly deferred.
- No direct offer-to-a-specific-user mechanism with no listing involved — explicitly deferred; offering only happens on an existing listing (yours or someone else's), which the backend already fully supports.
- No listing deletion/cancellation command (`DELETE /api/trades/:id`) in this pass — a reasonable small follow-up, not included here since it wasn't asked for.

## Command count

Bot goes from 17 commands to 20 (`/wishlist` gains a subcommand rather than a new top-level command; `/achievements`, `/pricealerts`, and `/trades` are new top-level commands).

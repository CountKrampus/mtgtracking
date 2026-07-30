# Discord Bot — Design

**Status: active.** Approved 2026-07-30 for implementation.

## Problem / Goal

A full account-linked Discord bot: a user links their Discord account to their site account, then can query and manage their own collection, wishlist, and decks from Discord, and receive price-alert notifications there.

## Non-goals (v1)

- No server-wide/public commands unrelated to a linked account (e.g. no generic "any MTG card price lookup" open to anyone in a server — this is a personal-collection tool, not a public utility bot). `/card` lookup is the one exception, since it's a pure Scryfall passthrough with no personal data.
- No moderation-bot features (this is not a Discord server-management bot).
- No deck *editing* from Discord — decks are read-only (`/decks list`, `/deck view`); building/modifying a deck still happens in the web app.

## Design

### Hosting

A separate Node process, `discord-bot/` (own `package.json`, uses `discord.js`), run independently from the main Express server via its own `npm run bot` script, with its own entry in `start-both-servers.bat` as a third window alongside backend and frontend. Keeps a Discord outage or bot crash from affecting the main API.

The bot holds **zero direct database access** and **zero per-user secrets**. It only talks to the existing backend over HTTP, using a single long-lived service token (stored in the bot process's own `.env`) that identifies requests as coming from the bot itself — never a specific user's session. Every request instead names the acting user via their Discord user ID, and the backend resolves that to the real account server-side. This means:

- All command logic reuses the exact same validation, auto-merge, pricing, and milestone logic the web app already goes through (no duplicated business logic).
- There is no per-user token that can leak from the bot's process — compromising the bot's own service token requires also compromising the backend's `DiscordLink` table to identify a specific victim, and revoking a user's link is a single document delete.

### Account linking

1. New `DiscordLink` model: `{ userId: ObjectId, discordUserId: String (unique, indexed), linkedAt: Date }`.
2. New `LinkCode` model: `{ code: String, userId: ObjectId, expiresAt: Date }`, with a Mongo TTL index on `expiresAt` so unused codes clean themselves up automatically after 10 minutes.
3. Web app gets a "Link Discord Account" button in Settings → `POST /api/discord/link-code` (normal authenticated web session) → generates a random 6-character code tied to the logged-in user, returns it for display.
4. User runs `/link <code>` in a DM with the bot. The bot calls `POST /api/discord/exchange` — a bot-only route, authenticated via `requireBotAuth` (the shared service token) — with `{ code, discordUserId }`. The backend validates the code hasn't expired, consumes it, and creates the `DiscordLink` record.
5. **Unlinking**: `/unlink` in Discord (bot calls `DELETE /api/discord/link` with the caller's `discordUserId`), or a "Disconnect Discord" button in web Settings (`DELETE /api/discord/link` on the normal authenticated session, looked up by the current user's `userId`). Either path just deletes the one `DiscordLink` document — instant, no token bookkeeping.

### Bot auth to the backend

`requireBotAuth` middleware: checks a shared secret (bot service token) sent as `Authorization: Bearer <BOT_SERVICE_TOKEN>` on the handful of `/api/discord/*` routes the bot calls (`/exchange`, and the per-command proxy routes below). On every request other than `/link-code` (which is a normal user-session route) and `/exchange` (which is establishing the link), the bot also sends `discordUserId` in the request; the backend looks up `DiscordLink` to resolve the real `userId`, then proceeds exactly as if that user were making the request themselves (same `req.user` shape, same downstream route logic, same per-user rate limiting).

If no `DiscordLink` exists for that `discordUserId`, the backend returns 404/`not_linked`, and the bot replies "You haven't linked your account yet — run `/link <code>` first."

### Commands (v1 scope)

All commands below (except `/card` and `/link`) require the calling Discord user to be linked. The bot always calls through to the backend regardless; if the account isn't linked, the backend returns the `not_linked` error code (see Error handling below) and the bot relays that as the link prompt.

**Collection**
- `/card <name>` — Scryfall lookup (no linking required): `GET /api/scryfall/search?name=`
- `/collection stats` — `GET /api/stats`
- `/add <qty> <name>` — `POST /api/cards` (reuses existing auto-merge logic)
- `/remove <qty> <name>` — resolve the card via `GET /api/cards?search=`, then `PUT`/`DELETE /api/cards/:id` depending on whether the resulting quantity is 0
- `/update <name> <field> <value>` — `PUT /api/cards/:id` (condition/quantity/location)
- `/price <name>` — `POST /api/cards/:id/update-price`

**Wishlist**
- `/wishlist list` — `GET /api/wishlist`
- `/wishlist add <name>` — `POST /api/wishlist`
- `/wishlist remove <name>` — `DELETE /api/wishlist/:id`

**Decks** (read-only)
- `/decks list` — `GET /api/decks`
- `/deck view <name>` — `GET /api/decks/:id`

**Notifications**
- Linking Discord also registers a `Webhook` (existing model) pointed at a small HTTP listener inside the bot process itself. When a price alert fires, the existing webhook-dispatch logic POSTs to that listener, and the bot formats it into a Discord embed, DM'd to the linked user.

**Link management**
- `/link <code>` / `/unlink` — see Account linking above.

All replies are ephemeral (visible only to the command's sender) by default, since collection contents are personal.

### Ambiguous matches

For commands that resolve a card "by name" (`/remove`, `/update`, `/price`) where more than one owned card matches (different set/condition), the bot shows a numbered Discord select menu rather than guessing which one was meant.

### Error handling

- **Not linked**: backend returns a distinct `not_linked` error code; bot replies with the link prompt.
- **Ambiguous card matches**: numbered picker, as above.
- **Rate limiting**: the existing `userRateLimit` middleware already applies per-resolved-user regardless of request origin, so bot traffic is naturally throttled the same as web traffic — no new rate-limiting code needed.
- **Bot service token leak**: an attacker with the service token can act as the bot, but every bot request still requires a real, previously-linked `discordUserId` to do anything useful — there's no way to mint a new link without also controlling the linking code, which only the account owner receives.

### Data model changes

- New `DiscordLink` model.
- New `LinkCode` model (TTL index).
- No changes to existing models. The existing `Webhook` model is reused as-is for notifications.

## Testing

- Backend: `buildApp()` + supertest tests for `POST /api/discord/link-code` (issues code, ties to user), `POST /api/discord/exchange` (valid code links, expired/consumed code rejected, missing/invalid service token rejected), `DELETE /api/discord/link` (both auth paths), and `requireBotAuth` middleware (valid token passes, missing/invalid rejected).
- Command-resolution logic (e.g. the "find the card by name, disambiguate if multiple" logic) tested against a mocked backend API client — no real Discord gateway connection needed for this.
- Manual smoke test on a real Discord server with a real bot token for the full command set end-to-end, same as this session's browser-based verification for other UI features.

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

The commands in this design call the app's *existing* routes directly (`POST /api/cards`, `GET /api/wishlist`, `GET /api/decks`, etc. — see Commands below) rather than new bot-specific proxy routes, so the bot's credentials have to satisfy those routes' existing `verifyToken` → `requireAuth`/`requireEditor` chain unchanged.

This means the extension belongs in the shared `verifyToken` middleware itself (`backend/middleware/auth.js`), not a separate middleware bolted onto a handful of new routes:

- The bot sends `Authorization: Bearer <BOT_SERVICE_TOKEN>` (a shared secret, from the bot process's own `.env`, distinct from any user's JWT) plus an `X-Discord-User-Id` header on every request.
- `verifyToken` checks for this pair first. If the bearer token matches `BOT_SERVICE_TOKEN`, it looks up `DiscordLink` by the header's Discord user ID, loads that `User`, and sets `req.user` exactly as it would for a normal JWT — same shape, so every downstream route (`requireAuth`, `requireEditor`, `buildUserQuery`, rate limiting, etc.) behaves identically regardless of which auth path populated it.
- If the bearer token doesn't match `BOT_SERVICE_TOKEN`, `verifyToken` falls through to today's normal JWT verification unchanged — this is purely additive.
- If no `DiscordLink` exists for that Discord user ID, `verifyToken` leaves `req.user` as `null` (same as an invalid/missing normal token) and adds `req.notLinked = true` so route handlers/the bot can distinguish "not authenticated" from "authenticated as the bot, but this Discord user hasn't linked yet" and reply with the link prompt instead of a generic 401.

The three new `/api/discord/*` routes (`link-code`, `exchange`, `notifications/pending`) are the only ones with bespoke logic; everything else (cards, wishlist, decks) needs no code changes at all beyond this one middleware extension.

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
- Price alerts already create an in-app `Notification` document (`type: 'price_alert'`) when they fire, via `createPriceAlertNotification` in `jobs/dailyPriceSnapshot.js` — no changes needed to the alert-firing path itself.
- The bot polls `GET /api/discord/notifications/pending?since=<ISO8601>` (bot-auth) every ~30 seconds. The route finds all `DiscordLink` records, queries `Notification.find({ userId: { $in: linkedUserIds }, type: 'price_alert', createdAt: { $gt: since } })`, and returns each match mapped to its `discordUserId`. The bot formats each into a Discord embed, DMs the linked user, and remembers the latest `createdAt` it saw as the `since` value for its next poll.
- This avoids registering a `Webhook` pointed at the bot's own address, which the existing SSRF guard in `utils/webhookDelivery.js` would block anyway (it explicitly rejects localhost/private-IP targets, which the bot's own listener would be). Keeps the bot's network posture strictly outbound-only, consistent with the rest of this design, and needs no new notification-queue model.

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
- No changes to existing models. Notifications reuse the existing `Notification` model (`type: 'price_alert'`) read-only via a new polling route — the `Webhook` model isn't used by this design at all.

## Testing

- Backend: `buildApp()` + supertest tests for `POST /api/discord/link-code` (issues code, ties to user), `POST /api/discord/exchange` (valid code links, expired/consumed code rejected, missing/invalid service token rejected), `DELETE /api/discord/link` (both auth paths), and `requireBotAuth` middleware (valid token passes, missing/invalid rejected).
- Command-resolution logic (e.g. the "find the card by name, disambiguate if multiple" logic) tested against a mocked backend API client — no real Discord gateway connection needed for this.
- Manual smoke test on a real Discord server with a real bot token for the full command set end-to-end, same as this session's browser-based verification for other UI features.

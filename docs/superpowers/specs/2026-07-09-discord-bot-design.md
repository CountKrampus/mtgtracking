# Discord Bot — Design

**Status: deferred.** Not scheduled for implementation now — this spec exists so the feature is scoped and ready to build quickly whenever it's wanted, per the owner's request. Nothing here should be built until explicitly requested.

## Problem / Goal

A full account-linked Discord bot: a user links their Discord account to their site account, then can query and manage their own collection from Discord (not just read-only lookups).

## Non-goals (for v1, whenever built)

- No server-wide/public commands unrelated to a linked account (e.g. no generic "any MTG card price lookup" open to anyone in a server — this is a personal-collection tool, not a public utility bot).
- No moderation-bot features (this is not a Discord server-management bot).

## Design

### Hosting

A separate Node process, `backend/discord-bot/index.js` (own `package.json` or folder-scoped dependencies under the existing backend `node_modules` — decide based on whether `discord.js` conflicts with anything already installed), run independently from the main Express server (own `npm run bot` script, own entry in `start-both-servers.bat` as a third window, alongside backend and frontend). Keeps a Discord outage or bot crash from affecting the main API. The bot talks to the existing backend over HTTP using a dedicated service-account-style auth token (not a normal user's JWT — see Auth below), so it goes through the same validated API surface as the web frontend rather than touching MongoDB directly.

### Account linking

1. New `DiscordLink` model: `{ userId: ObjectId, discordUserId: String (unique), linkedAt: Date }`.
2. New route `POST /api/discord/link/start` (authenticated web session) generates a short-lived, single-use linking code (random 6-char string, 10-minute expiry — reuse the pattern already used for password-reset tokens if one exists in `utils/`).
3. User runs `/link <code>` in Discord DM with the bot. Bot calls a bot-only backend endpoint (`POST /api/discord/link/complete`, authenticated via the bot's service token) with the code + their Discord user ID; backend validates the code, creates the `DiscordLink`.
4. Unlinking: `/unlink` in Discord, or a "Disconnect Discord" button in web Settings.

### Bot auth to the backend

A single long-lived service token (stored in the bot process's own `.env`, not tied to any human user), checked by a small dedicated middleware (`requireBotAuth`) on the handful of `/api/discord/*` routes the bot calls. The bot never holds or uses a real user's JWT — every request identifies the acting user by their linked `discordUserId`, and the backend resolves that to the corresponding `userId` server-side.

### Commands (v1 scope)

- `/collection` — quick stats (total cards, total value, last updated).
- `/card <name>` — is it in your collection, quantity, condition, current price.
- `/add <name> [quantity] [condition]` — add a card (reuses the existing auto-merge `POST /api/cards` logic through a bot-auth route).
- `/wishlist` — top wishlist items by priority.
- `/link` / `/unlink` — account linking (see above).

All replies are ephemeral (visible only to the command's sender) by default, since collection contents are personal.

### Data model changes

- New `DiscordLink` model (above).
- No changes to existing models.

## Testing

- Linking-code generation/validation/expiry unit tests.
- Command handlers tested against a mocked backend API client (no real Discord gateway connection needed for logic tests — only a manual smoke test requires an actual bot token/server).
- `requireBotAuth` middleware test: valid service token passes, missing/invalid rejected.

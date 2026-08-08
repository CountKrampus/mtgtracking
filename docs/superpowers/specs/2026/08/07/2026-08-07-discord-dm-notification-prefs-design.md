# Discord DM Notification Preferences — Design Spec

**Feature #50** — Generalize Discord DM delivery beyond price alerts to all notification types, with per-type opt-in preferences.

---

## Problem

The Discord bot currently DMs users only for `price_alert` notifications, hardcoded in both the backend query and the bot's poller formatter. All other notification types (`trade_offer`, `mention`, `reply`, etc.) are never forwarded to Discord even for users who have linked their account.

---

## Goals

- Let users opt in to Discord DMs for any notification type (price alerts, trade offers, forum mentions, DMs, etc.)
- Defaults are all opt-out except `price_alert`, which stays on for existing linked users
- Configurable from both the Settings web UI and via `/notifications` bot commands
- No new database collections — prefs live on the existing `DiscordLink` document

---

## Non-Goals

- Push notifications via webhooks (external URLs) — that is the separate Webhook model system
- Per-card or per-thread granularity — type-level opt-in is sufficient

---

## Notification Types

| Type | Default | Discord DM prefix |
|------|---------|-------------------|
| `price_alert` | **on** (backward compat) | 📉 Price Alert: |
| `trade_offer` | off | 🔄 Trade Offer: |
| `trade_accepted` | off | ✅ Trade Accepted: |
| `trade_rejected` | off | ❌ Trade Declined: |
| `trade_countered` | off | 🔁 Trade Countered: |
| `mention` | off | 🔔 Mention: |
| `reply` | off | 💬 Reply: |
| `upvote` | off | ⬆️ Upvote: |
| `dm` | off | 📨 New Message: |
| `collection_health_report` | off | 📊 Collection Report: |
| `price_flag_resolved` | off | 🏷️ Price Flag: |

The `content` field already stored on each `Notification` document is used as the DM body. No new content generation is needed.

---

## Data Model

### `DiscordLink` — add `notificationPrefs`

```js
notificationPrefs: {
  price_alert:              { type: Boolean, default: true },
  trade_offer:              { type: Boolean, default: false },
  trade_accepted:           { type: Boolean, default: false },
  trade_rejected:           { type: Boolean, default: false },
  trade_countered:          { type: Boolean, default: false },
  mention:                  { type: Boolean, default: false },
  reply:                    { type: Boolean, default: false },
  upvote:                   { type: Boolean, default: false },
  dm:                       { type: Boolean, default: false },
  collection_health_report: { type: Boolean, default: false },
  price_flag_resolved:      { type: Boolean, default: false },
}
```

Existing `DiscordLink` documents without this field get Mongoose's defaults on first read — `price_alert: true`, all others `false`. No migration script needed.

---

## Backend

### New routes — `backend/routes/discord.js`

Both require `requireMultiUser + requireAuth`.

**`GET /api/discord/link/prefs`**
Returns the current user's `notificationPrefs` from their `DiscordLink` document. Returns `404` if no link exists.

**`PATCH /api/discord/link/prefs`**
Body: `{ [type]: boolean, … }` — partial update, unknown keys are rejected with `400`. Updates only the keys present in the request body.

```js
const ALLOWED_PREF_KEYS = new Set([
  'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected',
  'trade_countered', 'mention', 'reply', 'upvote', 'dm', 'collection_health_report'
]);
```

### Expand `GET /api/discord/notifications/pending` — `backend/routes/discord.js`

**Current query:**
```js
Notification.find({ userId: { $in: userIds }, type: 'price_alert', discordDeliveredAt: null })
```

**New query:** build a `$or` array from each user's enabled prefs:

```js
const orClauses = links
  .map(link => {
    const enabledTypes = Object.entries(link.notificationPrefs || {})
      .filter(([, enabled]) => enabled)
      .map(([type]) => type);
    // Always include price_alert if prefs missing (backward compat)
    if (!link.notificationPrefs) enabledTypes.push('price_alert');
    return enabledTypes.length > 0
      ? { userId: link.userId, type: { $in: enabledTypes } }
      : null;
  })
  .filter(Boolean);

if (orClauses.length === 0) return res.json({ notifications: [], polledAt: new Date().toISOString() });

const notifications = await Notification.find({
  $or: orClauses,
  discordDeliveredAt: null
}).sort({ createdAt: 1 }).lean();
```

**Response shape** — add `type` field (was missing before):
```js
{ id, discordUserId, type, content, cardId, createdAt }
```

---

## Discord Bot

### `formatDM(type, content)` — new helper in `discord-bot/src/lib/formatDM.js`

```js
const PREFIXES = {
  price_alert:              '📉 Price Alert',
  trade_offer:              '🔄 Trade Offer',
  trade_accepted:           '✅ Trade Accepted',
  trade_rejected:           '❌ Trade Declined',
  trade_countered:          '🔁 Trade Countered',
  mention:                  '🔔 Mention',
  reply:                    '💬 Reply',
  upvote:                   '⬆️ Upvote',
  dm:                       '📨 New Message',
  collection_health_report: '📊 Collection Report',
  price_flag_resolved:      '🏷️ Price Flag',
};

function formatDM(type, content) {
  const prefix = PREFIXES[type] ?? '🔔 Notification';
  return `${prefix}: ${content}`;
}
```

### Poller update — `discord-bot/src/index.js`

Replace hardcoded `📉 Price Alert: ${notif.content}` with `formatDM(notif.type, notif.content)`.

### `/notifications` command — `discord-bot/src/commands/notifications.js`

Two subcommands:

**`/notifications list`**
Calls `GET /api/discord/link/prefs`, displays a formatted embed showing each type and its current on/off state (✅ / ❌), grouped by category (Pricing, Trading, Forum, Messages, Collection).

**`/notifications toggle <type>`**
`<type>` is a string choice autocompleted from the 10 allowed types. Calls `PATCH /api/discord/link/prefs` with `{ [type]: !currentValue }`, confirms the new state: `"✅ Price Alert notifications enabled."` / `"❌ Trade Offer notifications disabled."`

Both subcommands authenticate as the linked site user (same pattern as all other bot commands).

---

## Frontend — Settings Page

In the Discord section of Settings (currently just Link/Unlink button), add a **"Notification Preferences"** subsection that renders only when the account is linked.

Grouped toggle rows:

- **Pricing** — Price Alert
- **Trading** — Trade Offer, Trade Accepted, Trade Declined, Trade Countered
- **Forum** — Mention, Reply, Upvote
- **Messages** — Direct Message
- **Collection** — Collection Health Report, Price Flag Resolution

On load: `GET /api/discord/link/prefs` to populate toggle states.  
On toggle: `PATCH /api/discord/link/prefs` with `{ [type]: newBool }` — optimistic UI, revert on error.

---

## Error Handling

- `PATCH /api/discord/link/prefs` with an unknown key → `400 Bad Request`
- `GET` or `PATCH` prefs when no DiscordLink exists → `404 Not Found` (Settings UI hides this section when unlinked, so this only surfaces to the bot if the link was just deleted)
- Bot `/notifications toggle` when user is not linked → reply with `"Link your account first with /link <code>."`
- If all users have all prefs off, the `$or` array is empty — early-return an empty array rather than running a query with `$or: []` (which matches everything in MongoDB)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/models/DiscordLink.js` | Add `notificationPrefs` field |
| `backend/routes/discord.js` | Add `GET/PATCH /link/prefs`; expand pending query; add `type` to response |
| `discord-bot/src/lib/formatDM.js` | New — DM formatting helper |
| `discord-bot/src/index.js` | Use `formatDM` in poller |
| `discord-bot/src/commands/notifications.js` | New — `/notifications list` and `toggle` |
| `discord-bot/src/registerCommands.js` | Register `/notifications` |
| `frontend/src/...Settings...` | Add notification prefs toggles in Discord section |

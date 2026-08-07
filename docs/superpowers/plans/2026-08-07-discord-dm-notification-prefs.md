# Discord DM Notification Preferences — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Let users opt in to Discord DMs for any notification type (trade offers, mentions, price flags, etc.) via Settings UI and `/notifications` bot commands. Currently only `price_alert` is delivered.

**Spec:** `docs/superpowers/specs/2026-08-07-discord-dm-notification-prefs-design.md`

**Depends on:** Feature #44 (price-flag resolution feedback) must be implemented first so `price_flag_resolved` exists as a notification type before adding it to prefs.

---

## Constant reference

Used in backend routes and bot — define once, import everywhere:

```js
const DISCORD_NOTIF_TYPES = [
  'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected',
  'trade_countered', 'mention', 'reply', 'upvote', 'dm',
  'collection_health_report', 'price_flag_resolved',
];
```

---

## Tasks

- [ ] **Task 1 — Add `notificationPrefs` to `DiscordLink` model**
  - File: `backend/models/DiscordLink.js`
  - Add field:
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
  - No migration needed — Mongoose defaults apply on first read for existing documents

- [ ] **Task 2 — Add GET/PATCH `/api/discord/link/prefs` routes**
  - File: `backend/routes/discord.js`
  - Both routes require `requireMultiUser + requireAuth`
  - `GET /api/discord/link/prefs`:
    ```js
    const link = await DiscordLink.findOne({ userId: req.user._id });
    if (!link) return res.status(404).json({ message: 'No Discord account linked' });
    res.json(link.notificationPrefs);
    ```
  - `PATCH /api/discord/link/prefs`:
    - Validate all keys in `req.body` are in `DISCORD_NOTIF_TYPES`; reject unknown keys with `400`
    - Apply only the provided keys:
      ```js
      for (const [key, val] of Object.entries(req.body)) {
        link.notificationPrefs[key] = Boolean(val);
      }
      await link.save();
      res.json(link.notificationPrefs);
      ```

- [ ] **Task 3 — Expand `/api/discord/notifications/pending` query**
  - File: `backend/routes/discord.js`
  - Replace fixed `type: 'price_alert'` filter with per-user `$or` clauses:
    ```js
    const orClauses = links
      .map(link => {
        const prefs = link.notificationPrefs || {};
        const enabledTypes = DISCORD_NOTIF_TYPES.filter(t =>
          t === 'price_alert' ? (prefs.price_alert !== false) : prefs[t] === true
        );
        return enabledTypes.length > 0
          ? { userId: link.userId, type: { $in: enabledTypes } }
          : null;
      })
      .filter(Boolean);

    if (orClauses.length === 0) {
      return res.json({ notifications: [], polledAt: new Date().toISOString() });
    }

    const notifications = await Notification.find({
      $or: orClauses,
      discordDeliveredAt: null,
    }).sort({ createdAt: 1 }).lean();
    ```
  - Add `type` to the response mapping:
    ```js
    const results = notifications.map(n => ({
      id: n._id,
      discordUserId: discordIdByUserId.get(n.userId.toString()),
      type: n.type,
      content: n.content,
      cardId: n.cardId,
      createdAt: n.createdAt,
    }));
    ```
  - Note: `price_alert` defaults to enabled even when `notificationPrefs` is missing (backward compat for existing links)

- [ ] **Task 4 — Add `formatDM` helper to bot**
  - File: `discord-bot/src/lib/formatDM.js` (new file)
  - Create the `lib/` directory if it doesn't exist
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

    module.exports = { formatDM };
    ```

- [ ] **Task 5 — Update bot poller to use `formatDM`**
  - File: `discord-bot/src/index.js`
  - Import `formatDM` from `./lib/formatDM`
  - Replace:
    ```js
    await user.send({ content: `📉 Price Alert: ${notif.content}` });
    ```
    with:
    ```js
    await user.send({ content: formatDM(notif.type, notif.content) });
    ```

- [ ] **Task 6 — Add `/notifications` bot command**
  - File: `discord-bot/src/commands/notifications.js` (new file)
  - Two subcommands: `list` and `toggle`
  - `/notifications list`:
    - Calls `GET /api/discord/link/prefs` (authenticated as linked user)
    - Returns an embed with two columns per type: name and ✅/❌ state
    - Group display: Pricing | Trading | Forum | Messages | Collection
  - `/notifications toggle <type>`:
    - `<type>` is a string choice with all 11 types as choices (use display labels as names, internal type as value)
    - Fetch current prefs, flip the target type, call `PATCH /api/discord/link/prefs`
    - Reply: `"✅ Price Alert notifications enabled."` or `"❌ Trade Offer notifications disabled."`
  - If `GET prefs` returns 404 (not linked): reply `"Link your account first with /link <code>."`

- [ ] **Task 7 — Register `/notifications` command**
  - File: `discord-bot/src/registerCommands.js`
  - Import the notifications command and add it to the commands array
  - File: `discord-bot/src/index.js`
  - Add `notifications` to the command dispatch map

- [ ] **Task 8 — Add notification prefs UI to Settings page**
  - Find the Discord section in the Settings component (search for "Discord" or "discord" near Link/Unlink button)
  - Add a "Notification Preferences" subsection, rendered only when `discordLinked === true`
  - On mount (when linked): `GET /api/discord/link/prefs` → store in local state
  - Render grouped toggle rows:
    - **Pricing**: Price Alert
    - **Trading**: Trade Offer, Trade Accepted, Trade Declined, Trade Countered
    - **Forum**: Mention, Reply, Upvote
    - **Messages**: Direct Message
    - **Collection**: Collection Health Report, Price Flag Resolution
  - Each toggle: on change call `PATCH /api/discord/link/prefs` with `{ [type]: newBool }`
  - Optimistic UI — flip toggle immediately, revert on API error with a toast

---

## Acceptance Criteria

- Existing linked user receives `price_alert` DMs without any action (backward compat)
- `/notifications list` shows all types with correct on/off state
- `/notifications toggle trade_offer` enables trade offer DMs; next trade offer notification is delivered via Discord DM
- Settings Discord section shows prefs toggles when linked, hidden when unlinked
- Toggling a type in Settings is reflected immediately in `/notifications list` output
- `$or: []` case (all prefs off for all users) returns empty array without a MongoDB error
- Unknown type key in `PATCH /api/discord/link/prefs` returns `400`

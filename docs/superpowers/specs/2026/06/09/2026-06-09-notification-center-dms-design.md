# Notification Center + Direct Messages Design

## Goal

A bell icon with unread badge surfaces all app events in one place. Players can send each other direct messages. Admins can send modmail to any user. Both DMs and modmail use threaded conversations.

## Architecture

Two tightly-coupled sub-systems:

1. **Notifications** — a feed of events (price alerts, invites, DMs, modmail) shown in a dropdown from the bell icon in the sidebar.
2. **Direct Messages** — conversation threads between two users (or admin → user for modmail). A dedicated `/messages` inbox view.

DMs and modmail both create `Notification` records for recipients, linking back to the conversation.

---

## Backend Models

### `backend/models/Notification.js`

```js
{
  userId:    { type: ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, enum: [
    'price_alert', 'borrow_request', 'playgroup_invite',
    'game_night', 'game_room', 'direct_message', 'modmail'
  ], required: true },
  title:     { type: String, required: true, maxlength: 100 },
  body:      { type: String, default: '', maxlength: 300 },
  link:      { type: String, default: '' },   // e.g. /messages/abc123
  read:      { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
}
```

Compound index on `{ userId, read, createdAt }`.

Auto-delete after 30 days: add `expires` TTL index (`createdAt`, expireAfterSeconds: 2592000).

### `backend/models/Conversation.js`

```js
{
  participants: [{ type: ObjectId, ref: 'User', required: true }],  // always exactly 2
  type:         { type: String, enum: ['dm', 'modmail'], default: 'dm' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  createdAt:    { type: Date, default: Date.now }
}
```

Index on `participants` for fast lookup of "conversations I'm in".

### `backend/models/DirectMessage.js`

```js
{
  conversationId: { type: ObjectId, ref: 'Conversation', required: true, index: true },
  senderId:       { type: ObjectId, ref: 'User', required: true },
  senderName:     { type: String, required: true },
  body:           { type: String, required: true, maxlength: 2000 },
  createdAt:      { type: Date, default: Date.now, index: true }
}
```

---

## Backend Routes

### `backend/routes/notifications.js`

All routes require `requireAuth`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | Most recent 20 notifications for current user. Query: `?unreadOnly=true` |
| `GET` | `/api/notifications/unread-count` | Returns `{ count: N }` — used for bell badge |
| `PUT` | `/api/notifications/:id/read` | Mark one as read |
| `PUT` | `/api/notifications/read-all` | Mark all as read |

### `backend/routes/messages.js`

All routes require `requireAuth`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/messages` | List all conversations for current user, sorted by `lastMessageAt` desc. Returns conversation + last message + other participant's name/avatar |
| `POST` | `/api/messages` | Start a new conversation. Body: `{ recipientUsername, body, type? }`. Creates `Conversation` + first `DirectMessage` + `Notification` for recipient. Returns `{ conversationId }` |
| `GET` | `/api/messages/:conversationId` | Full message thread. Validates current user is a participant |
| `POST` | `/api/messages/:conversationId/reply` | Send a reply. Body: `{ body }`. Creates `DirectMessage`, updates `conversation.lastMessageAt`, creates `Notification` for the other participant |

**Admin-only modmail:**
`POST /api/messages` with `type: 'modmail'` requires `requireAdmin`. `recipientUsername` can be any user. Regular users can only start DMs with users they share a playgroup with (or who have a public profile). Admins can message anyone.

### Notification creation points

A shared helper `createNotification(userId, type, title, body, link)` defined in `backend/routes/notifications.js` and imported where needed:

| Event | Where called | Type |
|-------|-------------|------|
| Price alert triggers | `server.js` price update logic | `price_alert` |
| Borrow request sent | `backend/routes/playgroups.js` borrow endpoint | `borrow_request` |
| Playgroup invite sent | `backend/routes/playgroups.js` invite endpoint | `playgroup_invite` |
| Game night created | `backend/routes/playgroups.js` game night endpoint | `game_night` |
| Game room invite | `backend/routes/gameRooms.js` join endpoint | `game_room` |
| DM / modmail received | `backend/routes/messages.js` | `direct_message` / `modmail` |

### Register in `backend/server.js`

```js
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
```

---

## Frontend

### Bell Icon + Dropdown (`frontend/src/components/Sidebar.js`)

- Bell icon (`Bell` from lucide-react) added near the top of the sidebar, next to the user avatar area.
- On mount and every 60 seconds: fetch `/api/notifications/unread-count` → show red badge if `count > 0`.
- Click bell → opens `NotificationDropdown` panel (positioned absolute, below bell icon).
- `NotificationDropdown` fetches `/api/notifications` (20 most recent) and renders a list.
- Each notification row: icon by type · title · body (truncated) · relative time · grey background if read, white if unread.
- Clicking a notification: marks it read (`PUT /api/notifications/:id/read`), navigates to `notification.link`.
- "Mark all read" button at top of dropdown.
- Clicking outside closes the dropdown.

### New Files

**`frontend/src/components/NotificationDropdown.js`**
Dropdown panel component. Props: `notifications`, `onMarkRead`, `onMarkAllRead`, `onClose`.

**`frontend/src/components/Messages/MessagesInbox.js`**
Conversation list view. Shows each conversation with: other user's name + avatar colour, last message preview (truncated), timestamp. "New Message" button opens `NewMessageModal`.

**`frontend/src/components/Messages/ConversationThread.js`**
Full thread view. Message bubbles (right = you, left = them). Reply textarea at bottom (Enter sends, Shift+Enter newlines). Scroll to bottom on new message.

**`frontend/src/components/Messages/NewMessageModal.js`**
Modal with username input + message body textarea. Submits to `POST /api/messages`.

### Routing

In `App.js`, add routes:
- `/messages` → `<MessagesInbox>`
- `/messages/:id` → `<ConversationThread>`

Add "Messages" nav item to the sidebar (existing pattern — under Community section).

### "Send Message" on User Profiles

`UserProfile.js` gets a "✉ Message" button in the profile header. `onClick` → navigates to `/messages` with a `?to=username` param → `MessagesInbox` detects the param and auto-opens `NewMessageModal` pre-filled with that username.

### Admin Modmail

In `AdminPanel.js`, add a "📨 Compose Modmail" button in the Users tab toolbar. Opens `NewMessageModal` with `type: 'modmail'` set and a note: "This message will be sent as official modmail."

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/Notification.js` | Create |
| `backend/models/Conversation.js` | Create |
| `backend/models/DirectMessage.js` | Create |
| `backend/routes/notifications.js` | Create — all notification routes + `createNotification` helper |
| `backend/routes/messages.js` | Create — all DM/modmail routes |
| `backend/server.js` | Register new routes; import + call `createNotification` at price alert trigger points |
| `backend/routes/playgroups.js` | Call `createNotification` at borrow/invite/game-night trigger points |
| `backend/routes/gameRooms.js` | Call `createNotification` when player joins a room |
| `frontend/src/components/Sidebar.js` | Add bell icon + unread badge + polling |
| `frontend/src/components/NotificationDropdown.js` | Create |
| `frontend/src/components/Messages/MessagesInbox.js` | Create |
| `frontend/src/components/Messages/ConversationThread.js` | Create |
| `frontend/src/components/Messages/NewMessageModal.js` | Create |
| `frontend/src/App.js` | Add `/messages` and `/messages/:id` routes; add Messages nav item |
| `frontend/src/components/UserProfile.js` | Add "Message" button |
| `frontend/src/components/admin/user-management/UsersTab.js` | Add "Compose Modmail" button |

---

## Verification

1. Trigger a price alert → bell badge increments → open dropdown → notification appears with link to collection
2. Send a borrow request in a playgroup → recipient sees bell badge → notification in dropdown
3. Navigate to `/messages` → "New Message" → enter a valid username + message → conversation appears in inbox
4. Recipient opens `/messages` → sees conversation → replies → sender sees reply in thread
5. Admin opens Users tab → "Compose Modmail" → sends → recipient sees modmail notification with `[Modmail]` label
6. "Mark all read" → badge clears, all rows go grey
7. Notification older than 30 days → MongoDB TTL index deletes it automatically

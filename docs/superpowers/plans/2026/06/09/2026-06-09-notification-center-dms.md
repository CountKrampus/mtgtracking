# Notification Center + Direct Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bell icon with unread badge to the sidebar, a notification dropdown showing recent events, a `/messages` inbox for direct messages, and full DM conversation threads between users. Admins can send modmail to any user.

**Architecture:** Three new Mongoose models (Notification, Conversation, DirectMessage). Two new route files (`notifications.js`, `messages.js`) registered in `server.js`. Sidebar gets a `Bell` icon with 60s polling. `NotificationDropdown.js` fetches and displays notifications. Three new Messages components handle the inbox, thread, and compose modal. New routes in `App.js` for `/messages` and `/messages/:id`. `UserProfile.js` gets a "Message" button.

**Tech Stack:** Mongoose (TTL index), Express, React hooks, axios, Tailwind CSS, lucide-react `Bell`

---

## File Map

| File | Action |
|------|--------|
| `backend/models/Notification.js` | Create |
| `backend/models/Conversation.js` | Create |
| `backend/models/DirectMessage.js` | Create |
| `backend/routes/notifications.js` | Create — all notification routes + `createNotification` helper |
| `backend/routes/messages.js` | Create — all DM/modmail routes |
| `backend/server.js` | Modify — require and register 2 new route files |
| `frontend/src/components/Sidebar.js` | Modify — add Bell icon + unread badge + polling |
| `frontend/src/components/NotificationDropdown.js` | Create |
| `frontend/src/components/Messages/MessagesInbox.js` | Create |
| `frontend/src/components/Messages/ConversationThread.js` | Create |
| `frontend/src/components/Messages/NewMessageModal.js` | Create |
| `frontend/src/App.js` | Modify — add `/messages` and `/messages/:id` routes; lazy-import Messages components |
| `frontend/src/components/UserProfile.js` | Modify — add "Message" button |
| `frontend/src/components/admin/user-management/UsersTab.js` | Modify — add "Compose Modmail" button |

---

### Task 1: Create backend models

**Files:**
- Create: `backend/models/Notification.js`
- Create: `backend/models/Conversation.js`
- Create: `backend/models/DirectMessage.js`

- [ ] **Step 1: Create `backend/models/Notification.js`**

```js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'price_alert', 'borrow_request', 'playgroup_invite',
      'game_night', 'game_room', 'direct_message', 'modmail',
    ],
    required: true,
  },
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, default: '', maxlength: 300 },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);
```

- [ ] **Step 2: Create `backend/models/Conversation.js`**

```js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  type: { type: String, enum: ['dm', 'modmail'], default: 'dm' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
```

- [ ] **Step 3: Create `backend/models/DirectMessage.js`**

```js
const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  body: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('DirectMessage', directMessageSchema);
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/Notification.js backend/models/Conversation.js backend/models/DirectMessage.js
git commit -m "feat: add Notification, Conversation, DirectMessage models"
```

---

### Task 2: Create notifications route file

**Files:**
- Create: `backend/routes/notifications.js`

- [ ] **Step 1: Create the file**

```js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const { getUserId } = require('../middleware/multiUser');

// Exported helper for creating notifications from other route files
async function createNotification(userId, type, title, body, link) {
  try {
    await Notification.create({ userId, type, title, body: body || '', link: link || '' });
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
}

// GET /api/notifications — most recent 20 for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const query = { userId };
    if (req.query.unreadOnly === 'true') query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: getUserId(req), read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: getUserId(req) },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: getUserId(req), read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
```

- [ ] **Step 2: Verify file created**

Run: `ls backend/routes/notifications.js`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add backend/routes/notifications.js
git commit -m "feat: add notifications routes with createNotification helper"
```

---

### Task 3: Create messages route file

**Files:**
- Create: `backend/routes/messages.js`

- [ ] **Step 1: Create the file**

```js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getUserId } = require('../middleware/multiUser');
const { createNotification } = require('./notifications');

// GET /api/messages — all conversations for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversations = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .lean();

    // For each conversation, get last message + other participant's info
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const otherId = conv.participants.find((p) => String(p) !== String(userId));
        const [other, lastMsg] = await Promise.all([
          otherId ? User.findById(otherId).select('username displayName').lean() : null,
          DirectMessage.findOne({ conversationId: conv._id })
            .sort({ createdAt: -1 })
            .lean(),
        ]);
        return {
          ...conv,
          otherParticipant: other || { username: 'Unknown', displayName: 'Unknown' },
          lastMessage: lastMsg || null,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error('GET /messages error:', err.message);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// POST /api/messages — start a new conversation
// Body: { recipientUsername, body, type? }
// type: 'modmail' requires requireAdmin
router.post('/', requireAuth, async (req, res) => {
  try {
    const senderId = getUserId(req);
    const { recipientUsername, body, type } = req.body;

    if (!recipientUsername || !body) {
      return res.status(400).json({ message: 'recipientUsername and body are required' });
    }

    // Modmail requires admin role
    if (type === 'modmail') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can send modmail' });
      }
    }

    const recipient = await User.findOne({
      username: { $regex: new RegExp(`^${recipientUsername}$`, 'i') },
      isActive: true,
    }).lean();

    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(recipient._id) === String(senderId)) {
      return res.status(400).json({ message: 'Cannot send a message to yourself' });
    }

    // Check for existing conversation between these two
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipient._id] },
      type: type === 'modmail' ? 'modmail' : 'dm',
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipient._id],
        type: type === 'modmail' ? 'modmail' : 'dm',
      });
    }

    const sender = await User.findById(senderId).select('username displayName').lean();
    const message = await DirectMessage.create({
      conversationId: conversation._id,
      senderId,
      senderName: sender?.displayName || sender?.username || 'Unknown',
      body,
    });

    await Conversation.updateOne({ _id: conversation._id }, { lastMessageAt: new Date() });

    // Notify recipient
    const notifType = type === 'modmail' ? 'modmail' : 'direct_message';
    const notifTitle =
      type === 'modmail'
        ? `[Modmail] from ${sender?.displayName || sender?.username}`
        : `Message from ${sender?.displayName || sender?.username}`;
    await createNotification(
      recipient._id,
      notifType,
      notifTitle,
      body.substring(0, 100),
      `/messages/${conversation._id}`
    );

    res.status(201).json({ conversationId: conversation._id, message });
  } catch (err) {
    console.error('POST /messages error:', err.message);
    res.status(500).json({ message: 'Failed to start conversation' });
  }
});

// GET /api/messages/:conversationId — full thread
router.get('/:conversationId', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await DirectMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    const otherId = conversation.participants.find((p) => String(p) !== String(userId));
    const other = otherId
      ? await User.findById(otherId).select('username displayName').lean()
      : null;

    res.json({ conversation, messages, otherParticipant: other });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch thread' });
  }
});

// POST /api/messages/:conversationId/reply — send a reply
router.post('/:conversationId/reply', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { body } = req.body;

    if (!body) return res.status(400).json({ message: 'body is required' });

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: userId,
    });

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const sender = await User.findById(userId).select('username displayName').lean();
    const message = await DirectMessage.create({
      conversationId: conversation._id,
      senderId: userId,
      senderName: sender?.displayName || sender?.username || 'Unknown',
      body,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Notify the other participant
    const otherId = conversation.participants.find((p) => String(p) !== String(userId));
    if (otherId) {
      const notifType = conversation.type === 'modmail' ? 'modmail' : 'direct_message';
      await createNotification(
        otherId,
        notifType,
        `Reply from ${sender?.displayName || sender?.username}`,
        body.substring(0, 100),
        `/messages/${conversation._id}`
      );
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Failed to send reply' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/messages.js
git commit -m "feat: add DM/modmail conversation routes"
```

---

### Task 4: Register new routes in server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add require statements**

Find the block of route requires near the top of `backend/server.js`:
```js
const deckRoutes = require('./routes/decks');
const authRoutes = require('./routes/auth');
```

Add after the existing route requires:
```js
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
```

- [ ] **Step 2: Register the routes**

Find where the other routes are registered with `app.use`, e.g.:
```js
app.use('/api/decks', deckRoutes);
```

Add:
```js
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
```

- [ ] **Step 3: Restart backend and smoke-test**

Restart backend: `cd backend && npm run dev`

Test with curl (replace token with real value):
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/notifications/unread-count
```
Expected: `{"count":0}`

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/messages
```
Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: register notifications and messages routes in server.js"
```

---

### Task 5: Create NotificationDropdown component

**Files:**
- Create: `frontend/src/components/NotificationDropdown.js`

- [ ] **Step 1: Create the component**

```js
import React from 'react';
import { X, Bell } from 'lucide-react';

const TYPE_ICONS = {
  price_alert: '💰',
  borrow_request: '📤',
  playgroup_invite: '👥',
  game_night: '🌙',
  game_room: '🎮',
  direct_message: '✉️',
  modmail: '📨',
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationDropdown({ notifications, onMarkRead, onMarkAllRead, onClose }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">Notifications</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllRead}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Mark all read
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/40 text-sm">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n._id}
              onClick={() => {
                onMarkRead(n._id);
                if (n.link) window.location.href = n.link;
              }}
              className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                !n.read ? 'bg-white/5' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${n.read ? 'text-white/60' : 'text-white'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-white/40 truncate mt-0.5">{n.body}</p>
                  )}
                  <p className="text-xs text-white/30 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-1.5" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NotificationDropdown.js
git commit -m "feat: add NotificationDropdown component"
```

---

### Task 6: Add bell icon + polling to Sidebar.js

**Files:**
- Modify: `frontend/src/components/Sidebar.js`

- [ ] **Step 1: Add Bell import**

In `frontend/src/components/Sidebar.js`, find the lucide-react import block at the top. `Bell` is not currently imported. Add `Bell` to the existing import:

```js
import {
  // ... existing icons ...
  Bell,
} from 'lucide-react';
```

- [ ] **Step 2: Add axios import if not already present**

At the top of `Sidebar.js`, check if `import axios from 'axios';` is already there. If not, add it.

Also add:
```js
const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
```

near the top of the file if it's not already there.

- [ ] **Step 3: Add unread count state and polling**

In the `Sidebar` component function body, add after the existing `useState` hooks:

```js
const [unreadCount, setUnreadCount] = useState(0);
const [showNotifications, setShowNotifications] = useState(false);
const [notifications, setNotifications] = useState([]);

useEffect(() => {
  const fetchUnreadCount = () => {
    const token = localStorage.getItem('mtg_access_token');
    if (!token) return;
    axios
      .get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setUnreadCount(r.data.count || 0))
      .catch(() => {});
  };

  fetchUnreadCount();
  const interval = setInterval(fetchUnreadCount, 60000);
  return () => clearInterval(interval);
}, []);

const fetchNotifications = () => {
  const token = localStorage.getItem('mtg_access_token');
  if (!token) return;
  axios
    .get(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => setNotifications(r.data))
    .catch(() => {});
};

const handleMarkRead = (id) => {
  const token = localStorage.getItem('mtg_access_token');
  axios
    .put(`${API_URL}/notifications/${id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(() => {
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    })
    .catch(() => {});
};

const handleMarkAllRead = () => {
  const token = localStorage.getItem('mtg_access_token');
  axios
    .put(`${API_URL}/notifications/read-all`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    })
    .catch(() => {});
};
```

- [ ] **Step 4: Add NotificationDropdown import**

At the top of `Sidebar.js`, add:
```js
import NotificationDropdown from './NotificationDropdown';
```

- [ ] **Step 5: Add bell icon button in the sidebar JSX**

In the Sidebar component's JSX, find the user avatar area or the top of the sidebar content. Add a bell icon button with the unread badge and conditional dropdown:

```jsx
{/* Bell / Notifications */}
<div className="relative">
  <button
    onClick={() => {
      setShowNotifications((v) => !v);
      if (!showNotifications) fetchNotifications();
    }}
    className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
    title="Notifications"
  >
    <Bell size={18} className="text-white/70" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-0.5">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </button>
  {showNotifications && (
    <NotificationDropdown
      notifications={notifications}
      onMarkRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
      onClose={() => setShowNotifications(false)}
    />
  )}
</div>
```

Place this button in a logical position — near the user avatar area or at the top of the sidebar action buttons, where it's always visible.

- [ ] **Step 6: Test bell in UI**

Start frontend: `cd frontend && npm start`

1. Confirm bell icon appears in sidebar
2. No badge initially (unread count = 0)
3. Click bell → dropdown opens with "No notifications yet"
4. Click "Mark all read" → no error
5. Click outside bell icon → dropdown should close (add a useEffect with `document.addEventListener('mousedown', ...)` if needed for click-outside behavior)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Sidebar.js frontend/src/components/NotificationDropdown.js
git commit -m "feat: add bell icon with unread badge and notification dropdown to sidebar"
```

---

### Task 7: Create Messages components

**Files:**
- Create: `frontend/src/components/Messages/NewMessageModal.js`
- Create: `frontend/src/components/Messages/ConversationThread.js`
- Create: `frontend/src/components/Messages/MessagesInbox.js`

- [ ] **Step 1: Create Messages directory**

Run: `mkdir -p frontend/src/components/Messages`

- [ ] **Step 2: Create `frontend/src/components/Messages/NewMessageModal.js`**

```js
import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

export default function NewMessageModal({ onClose, onSent, defaultRecipient = '', isModmail = false }) {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!recipient.trim() || !body.trim()) {
      setError('Recipient and message are required.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const payload = { recipientUsername: recipient.trim(), body: body.trim() };
      if (isModmail) payload.type = 'modmail';
      const r = await axios.post(`${API_URL}/messages`, payload);
      onSent?.(r.data.conversationId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-white/10 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold">
            {isModmail ? '📨 Compose Modmail' : '✉️ New Message'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X size={18} />
          </button>
        </div>
        {isModmail && (
          <p className="text-xs text-yellow-400/80 mb-3 bg-yellow-400/10 px-3 py-2 rounded-lg">
            This message will be sent as official modmail.
          </p>
        )}
        <label className="block text-xs text-white/60 mb-1">To (username)</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={!!defaultRecipient}
          placeholder="username"
          className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm mb-3 border border-white/10 focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
        <label className="block text-xs text-white/60 mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Write your message... (Enter to send, Shift+Enter for newline)"
          rows={4}
          className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm mb-3 border border-white/10 focus:outline-none focus:border-purple-500 resize-none"
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-white/60 hover:text-white px-4 py-1.5 text-sm rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 text-sm rounded-lg disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/Messages/ConversationThread.js`**

```js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ArrowLeft, Send } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

function getAvatarColor(name) {
  const colors = ['bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-yellow-600', 'bg-pink-600'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export default function ConversationThread({ conversationId, onBack }) {
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const myId = (() => {
    try {
      const t = localStorage.getItem('mtg_access_token');
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1])).userId;
    } catch { return null; }
  })();

  useEffect(() => {
    axios.get(`${API_URL}/messages/${conversationId}`)
      .then((r) => { setThread(r.data); setLoading(false); })
      .catch((err) => { setError(err.response?.data?.message || 'Failed to load thread'); setLoading(false); });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const r = await axios.post(`${API_URL}/messages/${conversationId}/reply`, { body: reply.trim() });
      setThread((prev) => ({ ...prev, messages: [...(prev?.messages || []), r.data] }));
      setReply('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-white/60">Loading...</div>;
  if (error) return <div className="text-red-400 p-4">{error}</div>;

  const other = thread?.otherParticipant;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onBack} className="text-white/60 hover:text-white"><ArrowLeft size={18} /></button>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(other?.displayName || other?.username)}`}>
          {(other?.displayName || other?.username || '?')[0].toUpperCase()}
        </div>
        <span className="text-white font-medium text-sm">{other?.displayName || other?.username || 'Unknown'}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {(thread?.messages || []).map((msg) => {
          const isMe = String(msg.senderId) === String(myId);
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm ${
                isMe ? 'bg-purple-600 text-white' : 'bg-white/10 text-white'
              }`}>
                {!isMe && <p className="text-xs text-white/50 mb-1">{msg.senderName}</p>}
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className="text-xs opacity-50 mt-1 text-right">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-white/10 flex gap-2 items-end">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Reply... (Enter to send)"
          rows={2}
          className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-purple-500 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/Messages/MessagesInbox.js`**

```js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import ConversationThread from './ConversationThread';
import NewMessageModal from './NewMessageModal';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

function getAvatarColor(name) {
  const colors = ['bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-yellow-600', 'bg-pink-600'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MessagesInbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  // Check for ?to= param to auto-open compose modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to');
    if (to) setShowNewMessage(true);
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/messages`)
      .then((r) => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Pre-fill recipient from ?to= param
  const defaultRecipient = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('to') || '';
  })();

  if (activeConvId) {
    return (
      <div className="flex-1 h-full">
        <ConversationThread
          conversationId={activeConvId}
          onBack={() => setActiveConvId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Messages</h1>
        <button
          onClick={() => setShowNewMessage(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm"
        >
          <Plus size={16} /> New Message
        </button>
      </div>

      {loading ? (
        <div className="text-white/60 text-center py-8">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-white/40 text-center py-12">
          <p className="text-4xl mb-3">✉️</p>
          <p>No messages yet.</p>
          <button
            onClick={() => setShowNewMessage(true)}
            className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
          >
            Start a conversation →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const other = conv.otherParticipant;
            const name = other?.displayName || other?.username || 'Unknown';
            return (
              <button
                key={conv._id}
                onClick={() => setActiveConvId(conv._id)}
                className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(name)} flex-shrink-0`}>
                  {name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-sm truncate">{name}</span>
                    {conv.lastMessageAt && (
                      <span className="text-white/30 text-xs flex-shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-white/50 text-xs truncate mt-0.5">{conv.lastMessage.body}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNewMessage && (
        <NewMessageModal
          onClose={() => setShowNewMessage(false)}
          defaultRecipient={defaultRecipient}
          onSent={(convId) => {
            setActiveConvId(convId);
            // Remove ?to= from URL
            window.history.replaceState({}, '', '/messages');
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Messages/
git commit -m "feat: add MessagesInbox, ConversationThread, NewMessageModal components"
```

---

### Task 8: Add Messages routes in App.js

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add lazy import for MessagesInbox**

In `App.js`, find the block of `React.lazy` imports (around line 36–53). Add:

```js
const MessagesInbox = React.lazy(() => import('./components/Messages/MessagesInbox'));
```

- [ ] **Step 2: Add route matches in App.js**

In `App.js`, find the public route matching block (around line 3879–3903). After the `deckCheckMatch` block (or after the `roomMatch` block), add:

```js
// Messages inbox
const messagesMatch = pathname.match(/^\/messages(\/[a-f0-9]+)?$/i);
if (messagesMatch) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>}>
      <MessagesInbox />
    </Suspense>
  );
}
```

Note: `MessagesInbox` handles the `/messages/:id` sub-route internally via its `activeConvId` state. If a direct link `/messages/<id>` is needed, the component can extract the ID from `window.location.pathname`.

- [ ] **Step 3: Add "Messages" nav item to Sidebar**

In `frontend/src/components/Sidebar.js`, find the navigation items array (look for `{ id: 'chat', label: 'Chat', ... }` or the Community section). Add a Messages item:

```js
{ id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' }
```

Or add a direct navigation button in the Community section of the sidebar that calls `window.location.href = '/messages'`.

`MessageSquare` is already imported in `Sidebar.js`.

- [ ] **Step 4: Test Messages routing**

Navigate to `http://localhost:3000/messages` — MessagesInbox renders with "No messages yet."

Click "New Message" → compose modal opens → enter a test username and message → send → conversation appears in inbox → click it → thread opens.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.js frontend/src/components/Sidebar.js
git commit -m "feat: add /messages route and sidebar nav item for DMs"
```

---

### Task 9: Add "Message" button to UserProfile and "Compose Modmail" to UsersTab

**Files:**
- Modify: `frontend/src/components/UserProfile.js`
- Modify: `frontend/src/components/admin/user-management/UsersTab.js`

- [ ] **Step 1: Add Message button to UserProfile.js**

In `frontend/src/components/UserProfile.js`, find the profile header section (around line 67–90 where the username and bio are displayed). After the username/displayName heading, add:

```jsx
{/* Only show if not viewing own profile */}
{profile.username !== currentUsername && (
  <button
    onClick={() => window.location.href = `/messages?to=${profile.username}`}
    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
  >
    ✉️ Message
  </button>
)}
```

To get `currentUsername`, read it from localStorage or the auth context. In `UserProfile.js`, add at the top of the component:

```js
const currentUsername = (() => {
  try {
    const t = localStorage.getItem('mtg_access_token');
    if (!t) return null;
    return JSON.parse(atob(t.split('.')[1])).username;
  } catch { return null; }
})();
```

- [ ] **Step 2: Add "Compose Modmail" button to UsersTab.js**

In `frontend/src/components/admin/user-management/UsersTab.js`, find the toolbar/header area. Add a button that opens a `NewMessageModal` with `isModmail={true}`:

First add import:
```js
import NewMessageModal from '../../Messages/NewMessageModal';
```

Then add state and JSX:
```js
const [showModmail, setShowModmail] = useState(false);
const [modmailRecipient, setModmailRecipient] = useState('');
```

In the toolbar JSX:
```jsx
<button
  onClick={() => { setModmailRecipient(''); setShowModmail(true); }}
  className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-3 py-1.5 rounded-lg"
>
  📨 Compose Modmail
</button>

{showModmail && (
  <NewMessageModal
    isModmail
    defaultRecipient={modmailRecipient}
    onClose={() => setShowModmail(false)}
    onSent={() => {}}
  />
)}
```

Also, in the user rows table, add a "Modmail" action button per user row:
```jsx
<button
  onClick={() => { setModmailRecipient(user.username); setShowModmail(true); }}
  className="text-xs text-yellow-400 hover:text-yellow-300 px-2 py-0.5 rounded"
  title="Send modmail"
>
  📨
</button>
```

- [ ] **Step 3: Test end-to-end**

1. Visit a public profile → "Message" button appears in header → click → navigates to `/messages?to=<username>` → compose modal pre-filled with that username
2. As admin → Admin Panel → Users tab → "Compose Modmail" button → compose and send → recipient gets a modmail notification

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UserProfile.js frontend/src/components/admin/user-management/UsersTab.js
git commit -m "feat: add Message button on profiles and Compose Modmail in admin Users tab"
```

---

## Verification Checklist

- [ ] Bell icon visible in sidebar with red badge when unread count > 0
- [ ] Badge shows correct unread count, polls every 60 seconds
- [ ] Click bell → notification dropdown opens with recent notifications
- [ ] Each notification row shows icon, title, body snippet, relative time
- [ ] Clicking a notification marks it read + navigates to `notification.link`
- [ ] "Mark all read" clears badge and greys all notifications
- [ ] `/messages` route renders MessagesInbox
- [ ] "New Message" compose modal sends and creates conversation
- [ ] Reply in thread creates new message, scrolls to bottom, notifies other user
- [ ] Enter key sends message, Shift+Enter adds newline
- [ ] Public user profile shows "Message" button (hidden on own profile)
- [ ] Message button pre-fills compose modal with that user's username
- [ ] Admin can send modmail from Users tab
- [ ] Modmail notification shows `[Modmail]` label in recipient's dropdown
- [ ] MongoDB TTL index auto-deletes notifications after 30 days

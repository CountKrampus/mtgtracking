# Forum Final Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement remaining forum features: thread deletion (admin), activity feed, DMs, and integrated notifications.

**Architecture:**
- **Thread Deletion:** DELETE /api/forum/threads/:id (admin only) + frontend button
- **Activity Feed:** GET /api/forum/feed (user activity + thread/post listing)
- **DMs:** Notification system integrated with forum mentions/replies
- **Notifications:** Real-time notification tracking for mentions, replies, upvotes, new DMs

**Tech Stack:** Node.js/Express (backend), MongoDB (data), React (frontend)

---

## Task 1: Delete Thread Route (Admin)

**Files:**
- Modify: `backend/routes/forum.js`
- Modify: `frontend/src/components/Forum/ThreadView.js`

**Backend Implementation:**
- Add `DELETE /api/forum/threads/:threadId` route (admin only, cascade delete posts)
- Check auth, verify admin or owner, delete thread + all posts
- Return 200 success or appropriate error

**Frontend Implementation:**
- Add "Delete" button in ThreadView (visible to admins only)
- Confirm dialog before deletion
- Redirect to category view after successful deletion

---

## Task 2: Fix Create Thread in Sub-Category

**Files:**
- Modify: `backend/routes/forum.js` (POST /api/forum/threads)
- Modify: `frontend/src/components/Forum/ThreadComposer.js`

**Implementation:**
- Verify POST /api/forum/threads accepts categoryId (including sub-categories)
- Test thread creation in both parent and child categories
- Frontend: Allow category selection from flattened category list (parents + children)

---

## Task 3: Activity Feed (Recent Threads/Posts)

**Files:**
- Modify: `backend/routes/forum.js`
- Create: `frontend/src/components/Forum/ForumFeed.js`
- Modify: `frontend/src/components/Forum/ForumHome.js`

**Backend:**
- Add `GET /api/forum/feed?limit=50` route
- Returns: Last 50 threads + posts combined, sorted by createdAt descending
- Include: title, author, category, snippet (first 100 chars), timestamp

**Frontend:**
- Create ForumFeed component showing recent activity
- Add tab in ForumHome to toggle between Categories and Feed views
- Display threads and posts in chronological order with clickable links

---

## Task 4: Notification Model + API

**Files:**
- Create: `backend/models/Notification.js`
- Modify: `backend/routes/notifications.js` (create if doesn't exist)

**Schema:**
```javascript
{
  userId: ObjectId (recipient),
  type: 'mention'|'reply'|'upvote'|'dm', 
  fromUserId: ObjectId (sender),
  threadId: ObjectId (for forum notifications),
  postId: ObjectId (for reply/mention),
  messageId: ObjectId (for DMs),
  content: String (preview),
  isRead: Boolean (default false),
  createdAt: Date,
  readAt: Date
}
```

**Routes:**
- `GET /api/notifications` - List user's notifications (unread first)
- `POST /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

---

## Task 5: Direct Messages + DM Notifications

**Files:**
- Create: `backend/models/DirectMessage.js`
- Create: `backend/routes/messages.js`
- Create: `frontend/src/components/Messages/DMThread.js`
- Modify: `frontend/src/App.js` (add DM section to sidebar)

**Schema:**
```javascript
DirectMessage {
  fromUserId: ObjectId,
  toUserId: ObjectId,
  content: String,
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
}
```

**Routes:**
- `GET /api/messages/:userId` - Get DM thread with user
- `POST /api/messages` - Send DM (creates notification)
- `POST /api/messages/:id/read` - Mark as read

---

## Task 6: Forum Notifications (Mentions & Replies)

**Files:**
- Modify: `backend/routes/forum.js` (POST /api/forum/posts)
- Modify: `backend/routes/notifications.js`

**Implementation:**
- When a post is created:
  - Check for @mentions in body, create mention notifications
  - If reply to existing post, create reply notification
  - Create upvote notification when post is upvoted
- Helper function to parse mentions from text: `extractMentions('@username text @otheruser')`

---

## Task 7: Notification Bell + Real-time Updates

**Files:**
- Create: `frontend/src/components/NotificationBell.js`
- Modify: `frontend/src/App.js` (add bell to header)
- Modify: `frontend/src/hooks/useAuth.js` (fetch notifications on login)

**Frontend:**
- Show notification bell in header with unread count badge
- Click bell opens dropdown with recent notifications
- Mark as read on click
- Real-time polling: fetch notifications every 30 seconds
- Delete old notifications (older than 7 days)

---

## Implementation Order

1. Task 1: Delete Thread Route
2. Task 2: Fix Create Thread in Sub-Category  
3. Task 3: Activity Feed
4. Task 4: Notification Model + API
5. Task 5: Direct Messages
6. Task 6: Forum Notifications
7. Task 7: Notification Bell UI

Each task is independent after Task 1-2 are complete.

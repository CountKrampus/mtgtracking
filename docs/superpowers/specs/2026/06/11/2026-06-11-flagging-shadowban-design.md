# Content Flagging & Shadow Ban — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

## Overview

Users can flag forum posts, forum threads, and chat messages for moderator review. Content auto-hides after 3 unique flags from different users and notifies all admins. Moderators review flags in a dedicated admin queue and can apply a shadow ban to repeat offenders — shadow-banned users continue posting normally but their content is invisible to everyone else.

## Decisions

| Question | Decision |
|---|---|
| Flagging scope | Forum threads, forum posts, chat messages |
| Auto-hide threshold | 3 unique flags from different users |
| Admin notification | Yes — in-app notification to all admin/editor users when threshold is reached |
| Flag reasons | Required: Spam, Harassment, Inappropriate, Off-topic |
| Shadow ban trigger | Manual by admin only; system suggests it when user has 3+ confirmed violations |
| Architecture | Unified `ContentFlag` model; `isShadowBanned` boolean on User |

---

## Data Models

### New: `ContentFlag` (`backend/models/ContentFlag.js`)

```
targetType:   'forum_thread' | 'forum_post' | 'chat_message'  (required, indexed)
targetId:     ObjectId  (required, indexed)
reportedBy:   ObjectId → User  (required)
reason:       'spam' | 'harassment' | 'inappropriate' | 'off_topic'  (required)
status:       'pending' | 'approved' | 'dismissed'  (default: 'pending', indexed)
reviewedBy:   ObjectId → User  (null until reviewed)
reviewNotes:  String  (optional, max 500 chars)
createdAt:    Date  (indexed)
resolvedAt:   Date  (null until reviewed)
```

Indexes:
- `{ targetType: 1, targetId: 1 }` — fast flag count lookups per content item
- `{ targetType: 1, targetId: 1, reportedBy: 1 }` unique — one flag per user per item
- `{ status: 1, createdAt: -1 }` — flag queue pagination

### Modified: `User`
```
isShadowBanned:  Boolean  (default false)
```

### Modified: `ForumThread`, `ForumPost`
```
isFlagHidden:    Boolean  (default false)  — hidden pending mod review
isShadowHidden:  Boolean  (default false)  — hidden because author is shadow banned
```

### Modified: `Message` (chat)
```
isFlagHidden:    Boolean  (default false)
isShadowHidden:  Boolean  (default false)
```

**Visibility rule for all GET routes:**  
Exclude content where `isFlagHidden: true` OR `(isShadowHidden: true AND authorId !== req.user?._id)`.  
Shadow-banned users always see their own content.

---

## API Routes

### User-facing (`backend/routes/forum.js` + `backend/routes/messages.js`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/forum/threads/:id/flag` | requireAuth | Flag a forum thread |
| POST | `/api/forum/posts/:id/flag` | requireAuth | Flag a forum reply |
| POST | `/api/messages/:id/flag` | requireAuth | Flag a chat message |

**Flag POST handler logic:**
1. Validate `reason` is one of the four allowed values
2. Upsert `ContentFlag` (unique index prevents double-flagging; return 409 if already flagged)
3. Count pending flags for this `(targetType, targetId)` pair
4. If count >= 3 and content not already hidden:
   - Set `isFlagHidden: true` on the content document
   - Create an in-app `Notification` for each user with role `admin` or `editor`: `"Content flagged: [title/preview]"`
5. Return `{ flagged: true, alreadyFlagged: false }`

### Admin (`backend/routes/admin.js`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/flags` | requireAdmin | Flag queue — `?status=pending&page=1&limit=50` |
| PUT | `/api/admin/flags/:id/review` | requireAdmin | Review a flag: `{ action: 'approve'|'dismiss', notes? }` |
| POST | `/api/admin/users/:id/shadow-ban` | requireAdmin | Apply shadow ban |
| DELETE | `/api/admin/users/:id/shadow-ban` | requireAdmin | Lift shadow ban |

**Flag review logic (`PUT /api/admin/flags/:id/review`):**
- `action: 'approve'` — set flag `status: 'approved'`, `resolvedAt: now`. Content stays `isFlagHidden: true`. Log to `ModerationHistory`.
- `action: 'dismiss'` — set flag `status: 'dismissed'`, `resolvedAt: now`. Re-count remaining pending flags for the content; if < 3, set `isFlagHidden: false`. Log to `ModerationHistory`.

**Shadow ban apply (`POST /api/admin/users/:id/shadow-ban`):**
1. Set `User.isShadowBanned = true`
2. `ForumThread.updateMany({ authorId }, { isShadowHidden: true })`
3. `ForumPost.updateMany({ authorId }, { isShadowHidden: true })`
4. `Message.updateMany({ senderId: userId }, { isShadowHidden: true })`
5. Log to `ModerationHistory` with `actionType: 'shadow_ban'`

**Shadow ban lift (`DELETE /api/admin/users/:id/shadow-ban`):**
1. Set `User.isShadowBanned = false`
2. Bulk-set `isShadowHidden: false` on all three content types for this user
3. Log to `ModerationHistory` with `actionType: 'shadow_ban_lifted'`

**New posts from shadow-banned users:**  
In `POST /api/forum/threads`, `POST /api/forum/posts`, and `POST /api/messages`:  
After creating the document, if `req.user.isShadowBanned`, set `isShadowHidden: true` before saving.

**`GET /api/admin/flags` response shape:**
```json
{
  "flags": [
    {
      "_id": "...",
      "targetType": "forum_post",
      "targetId": "...",
      "contentPreview": "Cut Deepglow Skate — Vorinclex...",
      "reason": "harassment",
      "status": "pending",
      "reportedBy": { "username": "...", "displayName": "..." },
      "authorId": "...",
      "authorUsername": "SpamUser99",
      "authorFlagCount": 3,
      "createdAt": "..."
    }
  ],
  "total": 4,
  "suggestShadowBan": ["SpamUser99"]
}
```
`suggestShadowBan` lists usernames with 3+ approved flags who are not yet shadow banned.

---

## Frontend Components

### Flag button (inline — forum posts, forum threads, chat messages)

Added to the actions row of each content item:
- Small 🚩 icon button, grey by default
- Greyed out + tooltip "Already reported" if the current user has already flagged this item
- Not shown to unauthenticated users
- Clicking opens `FlagModal`

### `FlagModal` (new component: `frontend/src/components/Forum/FlagModal.js`)

Simple modal:
- Title: "Report this content"
- Four radio-style option buttons (Spam, Harassment, Inappropriate, Off-topic)
- Submit and Cancel buttons
- On submit: POST to the relevant flag endpoint
- On success: closes modal, shows brief toast: "Reported. Thanks for keeping the community safe."
- On 409 (already flagged): shows "You've already reported this."

### Hidden content placeholder

When `isFlagHidden: true`, the post/thread/message body is replaced with:
```
🚩 This content has been hidden pending moderator review.
```
Shown as a muted italic row, same height as a normal post to avoid layout shift.  
Admins see the full content with a red "FLAGGED" badge instead of the placeholder.

### `FlagQueueTab` (new admin component: `frontend/src/components/admin/community/FlagQueueTab.js`)

Lives in Admin Panel → Community group alongside Content Moderation.

- Toggle: Pending / Reviewed
- Search input (by author username or content preview)
- Table columns: Type pill, Content preview, Author, Reason, Flagged at, Actions
- Row actions: **Approve** (validate flag — content stays hidden; use existing delete controls to remove permanently) | **Dismiss** (flag was incorrect — restores content visibility)
- Shadow ban suggestion banner: red banner above the table when `suggestShadowBan` is non-empty, with a "Shadow Ban" button per user
- Clicking "Shadow Ban" calls `POST /api/admin/users/:id/shadow-ban` with confirmation dialog

### Shadow ban controls

The existing **Users tab** in the admin panel gains:
- A "Shadow Ban" / "Lift Shadow Ban" toggle button on each user row (only visible when `isShadowBanned` differs)
- Shadow-banned users shown with a 👻 badge next to their username

---

## ModerationHistory action types added

The existing `actionType` enum in `ModerationHistory.js` must be extended with:

```
'shadow_ban'
'shadow_ban_lifted'
'flag_approved'
'flag_dismissed'
```

Add these four values to the enum array in the schema before using them.

---

## Out of Scope

- Flagging card collection entries or deck comments
- User-visible flag history ("you have been warned X times")
- Automatic shadow ban based on flag count (manual only)
- Email notifications for flag events
- Flag appeal workflow

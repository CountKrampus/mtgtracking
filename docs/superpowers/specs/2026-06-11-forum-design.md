# Forum Design Spec

**Date:** 2026-06-11  
**Status:** Approved

## Overview

A classic threaded forum added to the MTG Tracker app. Sits alongside existing chat, direct messages, and per-card/deck comments as the organized, persistent community discussion layer. Accessible via a "Forum" sidebar entry under Community.

## Decisions Made

| Question | Decision |
|---|---|
| Purpose | All categories — deck help, trading, general MTG, community |
| Reply structure | Threaded / nested (Reddit-style, max 3 levels deep) |
| Upvotes | Yes — on threads and posts |
| App integration | Full — deck links, `[[Card Name]]` hover previews, playgroup tags |
| Navigation | Sidebar entry, own full page (Categories → Thread list → Thread view) |
| Category management | Admins can create / edit / delete / reorder categories |
| Moderation | Reuse existing ban/warning system + new ForumMute for forum silencing |

---

## Data Models

### `ForumCategory`
```
name         String (required)
slug         String (required, unique, url-safe)
description  String
icon         String (emoji, e.g. "🃏")
order        Number (sort order)
createdAt    Date
```
Seeded with 4 defaults: Deck Help (`deck-help`), Trading (`trading`), General Discussion (`general`), Community (`community`). All are editable/deletable by admins.

### `ForumThread`
```
categoryId   ObjectId → ForumCategory (required, indexed)
authorId     ObjectId → User (required, indexed)
title        String (required, max 200 chars)
body         String (required, max 10000 chars)
isPinned     Boolean (default false)
isLocked     Boolean (default false)
upvotes      [ObjectId] → User (userId array, toggle on/off)
viewCount    Number (default 0)
replyCount   Number (default 0, denormalized)
lastReplyAt  Date (denormalized, indexed for sorting)
deckRef      { id, name, commander, format } (optional snapshot)
cardRefs     [{ scryfallId, name }] (parsed from [[Card Name]] in body)
playgroupRef { id, name } (optional tag)
createdAt    Date (indexed)
updatedAt    Date
```

### `ForumPost`
```
threadId     ObjectId → ForumThread (required, indexed)
parentPostId ObjectId → ForumPost (null = top-level reply, indexed)
authorId     ObjectId → User (required, indexed)
body         String (required, max 5000 chars)
upvotes      [ObjectId] → User
deckRef      { id, name, commander, format } (optional)
cardRefs     [{ scryfallId, name }]
createdAt    Date (indexed)
updatedAt    Date
```
Nesting depth is capped at 3 levels on the frontend — deeper replies render flat under the level-3 parent.

### `ForumMute`
```
userId       ObjectId → User (required, indexed)
reason       String (required, max 1000 chars)
mutedBy      ObjectId → User (admin who issued mute)
createdAt    Date
expiresAt    Date or null (null = permanent mute)
```
Full site bans and warnings continue to use the existing `UserBan` and `UserWarning` models.

---

## API Routes

File: `backend/routes/forum.js`

### Public (no auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/forum/categories` | All categories with thread counts |
| GET | `/api/forum/categories/:slug/threads` | Paginated thread list (query: `sort=latest\|hot\|new`, `page`, `limit=20`) |
| GET | `/api/forum/threads/:id` | Thread + all nested posts in one response |

### Authenticated (requireEditor)
| Method | Path | Description |
|---|---|---|
| POST | `/api/forum/threads` | Create thread |
| PUT | `/api/forum/threads/:id` | Edit own thread (or admin) |
| DELETE | `/api/forum/threads/:id` | Delete own thread (or admin) — cascades to delete all ForumPosts in the thread |
| POST | `/api/forum/threads/:id/upvote` | Toggle upvote on thread |
| POST | `/api/forum/posts` | Create reply or nested reply |
| PUT | `/api/forum/posts/:id` | Edit own post (or admin) |
| DELETE | `/api/forum/posts/:id` | Delete own post (or admin) |
| POST | `/api/forum/posts/:id/upvote` | Toggle upvote on post |

### Admin only (requireAdmin)
| Method | Path | Description |
|---|---|---|
| POST | `/api/forum/categories` | Create category |
| PUT | `/api/forum/categories/:id` | Edit category (name, slug, description, icon, order) |
| DELETE | `/api/forum/categories/:id` | Delete category (only if empty — no threads) |
| PUT | `/api/forum/threads/:id/pin` | Toggle pin |
| PUT | `/api/forum/threads/:id/lock` | Toggle lock |
| POST | `/api/forum/mutes` | Mute user from forum (`userId`, `reason`, `expiresAt`) |
| DELETE | `/api/forum/mutes/:userId` | Unmute user |
| GET | `/api/forum/mutes` | List active mutes |

**Middleware applied to all POST/PUT on threads and posts:**
1. Check `UserBan` — reject if user is banned and ban has not expired
2. Check `ForumMute` — reject if user is muted and mute has not expired

**Thread list sort logic:**
- `latest` — sort by `lastReplyAt DESC` (default)
- `new` — sort by `createdAt DESC`
- `hot` — sort by `upvotes.length DESC` within last 7 days

**`GET /api/forum/threads/:id` response shape:**
```json
{
  "thread": { ...threadFields, "upvoteCount": 18, "hasUpvoted": true },
  "posts": [
    {
      ...postFields,
      "upvoteCount": 9,
      "hasUpvoted": false,
      "replies": [ { ...nestedPost, "replies": [ ...level3 ] } ]
    }
  ]
}
```
Posts nested server-side before sending. Depth beyond 3 is flattened to level 3. `hasUpvoted` is always `false` for unauthenticated requests.

---

## Frontend Components

All new files under `frontend/src/components/`.

### `Forum.js`
Top-level router component. Reads URL path to decide which sub-view to render:
- `/forum` → `ForumCategoryList`
- `/forum/threads/:id` → `ForumThreadView` (matched before slug route)
- `/forum/:slug` → `ForumCategoryView`

Note: `"threads"` is a reserved word and must be rejected as a category slug in `ForumCategoriesTab.js` and the `POST /api/forum/categories` route.

Registered in `App.js` alongside existing route checks (`/shared/deck/:code`, `/u/:username`).  
Sidebar entry added in `Sidebar.js` under the Community section.

### `ForumCategoryList.js`
- 2×2 responsive grid of category cards
- Each card: icon, name, description, thread count, last thread preview
- "New Thread" button (opens composer modal — user selects category from dropdown)

### `ForumCategoryView.js`
- Breadcrumb: Forum › Category Name
- Sort dropdown: Latest Reply / Hot / New
- "New Thread" button
- Paginated thread list table: Title (with pinned/locked badges), Replies, Upvotes, Last Reply
- Deck-attached threads show a deck chip under the title

### `ForumThreadView.js`
- Breadcrumb: Forum › Category › Thread Title
- OP post rendered prominently (purple border), deck attachment card if present
- Nested reply tree (max 3 levels, indent via left border + margin)
- Each post: avatar, username, timestamp, body, `[[Card Name]]` rendered as hover-preview chips, upvote button, Reply button
- "OP" badge on original poster's replies
- Locked banner when `isLocked: true` (hides reply composer)
- Reply composer at bottom of thread

### `ForumPostComposer.js`
Shared composer used for new threads and replies.
- Textarea with `[[Card Name]]` autocomplete (reuses existing Scryfall autocomplete logic)
- "Attach Deck" button → opens modal listing user's decks, stores snapshot `{id, name, commander, format}`
- "Tag Playgroup" optional dropdown (user's playgroups)
- Title field (threads only, hidden for replies)
- Category select (new thread from category list, pre-filled from category view)
- Submit button

### `ForumModerationTab.js` (Admin Panel)
- Lives in Admin Panel → Community group (alongside Content Moderation tab)
- Table of active mutes: User, Reason, Muted By, Expires, Unmute button
- "Mute User" form: username search, reason, optional expiry date
- Full bans remain in the existing Bans tab

### Admin: `ForumCategoriesTab.js`
- Lives in Admin Panel → Community group
- Table: icon, name, slug, description, order, thread count, Edit / Delete buttons
- "New Category" form: icon (emoji picker or text), name (slug auto-generated), description, order
- Delete disabled (grayed out with tooltip) if category has any threads

---

## Integration Details

### `[[Card Name]]` syntax
- Typed in any composer body field
- On `]]` (double close bracket) keypress, triggers Scryfall autocomplete to confirm card name
- Stored as plain text `[[Card Name]]` in the DB
- On render, parsed with regex `/\[\[([^\]]+)\]\]/g`
- Each match rendered as a blue underlined chip with existing card hover-preview behavior (same as collection table)
- `cardRefs` array on thread/post populated from parsed names at save time

### Deck attachment
- Button opens a modal listing the current user's decks (name, commander, format)
- On select, stores a snapshot `{ id, name, commander, format }` — not a live reference
- Rendered as a purple card in the post body with a "View Deck →" link to `/shared/deck/:shareCode` (if deck is shared) or disabled if not shared

### Playgroup tag
- Optional dropdown on composer populated from the user's playgroups
- Stored as `{ id, name }` snapshot on the thread
- Displayed as a small badge under the thread title in list and thread views

---

## Sidebar Change

`Sidebar.js` — add under Community section:
```
📋 Forum
```
Uses same nav item pattern as Chat, Playgroups, Messages.

---

## Out of Scope

- Per-playgroup forums (global only)
- Markdown formatting (plain text only — `[[Card]]` syntax is the only special parsing)
- Image uploads in posts
- Thread search (can add later)
- User reputation / karma system
- Email notifications for thread replies

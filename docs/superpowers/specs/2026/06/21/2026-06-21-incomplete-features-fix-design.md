# Incomplete Features Fix — Design Spec
**Date:** 2026-06-21

## Overview

Four incomplete or stub implementations identified in a codebase audit. All are isolated fixes with no shared state or ordering dependencies.

---

## 1. `onNewThread` Callback Wiring

**Problem:** `onNewThread` prop passed in `App.js` (~line 5605) is an empty function. Clicking "New Thread" in the forum does nothing.

**Fix:**
- Add `showThreadComposer` boolean state in `App.js`
- Set `onNewThread={() => setShowThreadComposer(true)}`
- Conditionally render `<ThreadComposer>` modal using the same pattern as other modals in App.js (e.g. showWishlist, showDeckBuilder)
- Pass `onClose={() => setShowThreadComposer(false)}` and the relevant `categoryId`/`onThreadCreated` props that ThreadComposer already accepts

**Files:** `frontend/src/App.js`

---

## 2. Content Moderation Admin Endpoints

**Problem:** `ContentModerationTab.js` calls three endpoints that don't exist on the backend, making the entire admin content moderation panel non-functional.

**Missing endpoints:**
- `GET /api/forum/admin/forum-content` — lists flagged/hidden posts and threads
- `DELETE /api/forum/admin/posts/:postId` — hard-deletes a post
- `DELETE /api/forum/admin/threads/:threadId` — hard-deletes a thread and all its posts

**Design:**

`GET /api/forum/admin/forum-content?type=posts|threads&page=1&limit=20`
- Requires admin auth
- Queries `ForumPost` where `isHidden: true` or `ForumThread` where `isHidden: true`
- Populates `authorId` (username, displayName)
- Returns `{ items: [...], total, page, totalPages }`

`DELETE /api/forum/admin/posts/:postId`
- Requires admin auth
- Hard-deletes the `ForumPost` document
- Removes the post's `_id` from its parent thread's `replies` array (recursive search needed since replies are nested)
- Returns `{ success: true }`

`DELETE /api/forum/admin/threads/:threadId`
- Requires admin auth
- Deletes the `ForumThread` document
- Deletes all `ForumPost` documents where `threadId` matches
- Returns `{ success: true }`

**Files:** `backend/routes/forum.js`

---

## 3. Interaction Checker — Scryfall Rulings

**Problem:** `POST /api/interactions/check` in `backend/server.js` returns hardcoded fake text. The `InteractionChecker` component is fully built but never gets real data.

**Design:**

Replace stub with a real implementation:

1. Fetch both cards from Scryfall: `GET https://api.scryfall.com/cards/named?fuzzy={name}`
   - Extract: `id`, `name`, `oracle_text`, `keywords`, `type_line`, `image_uris`
2. Fetch rulings for each card: `GET https://api.scryfall.com/cards/{id}/rulings`
3. Find shared keywords: intersection of both cards' `keywords` arrays + scan `oracle_text` of each card for words that appear in the other card's `oracle_text` (lowercase, filtered to MTG-relevant terms)
4. Return shape:
```json
{
  "card1": { "name", "oracle_text", "keywords", "type_line", "image_uri" },
  "card2": { "name", "oracle_text", "keywords", "type_line", "image_uri" },
  "rulings1": [{ "published_at", "comment" }],
  "rulings2": [{ "published_at", "comment" }],
  "sharedKeywords": ["flying", "sacrifice"]
}
```

**Frontend update (`InteractionChecker.js`):**
- Display both cards side-by-side with oracle text, bolding any word that appears in `sharedKeywords`
- List rulings beneath each card
- Replace the current fake "how_they_interact" narrative section with the real data layout

**Files:** `backend/server.js`, `frontend/src/components/Learn/InteractionChecker.js`

---

## 4. Global Thread Listing Endpoint

**Problem:** No endpoint exists to list threads across all categories. The content moderation admin and potentially other views need this.

**Design:**

`GET /api/forum/threads?page=1&limit=20&sort=new|top&categoryId=optional`

- No auth required (public threads)
- If `categoryId` provided, filters to that category (same as existing endpoint)
- If omitted, returns threads across all categories
- Sort options: `new` (default, by `createdAt` desc), `top` (by reply count desc)
- Populates `authorId` (username, displayName, avatarUrl), `categoryId` (name, slug)
- Returns `{ threads: [...], total, page, totalPages }`
- Register before more-specific routes to avoid conflicts

**Files:** `backend/routes/forum.js`

---

## Scope

These four fixes are independent — each can be built and tested without the others being complete. No new dependencies required. All use existing models (`ForumPost`, `ForumThread`, `ForumLevel`, `Cosmetic`).

## Out of Scope

- Soft-delete / archive behavior for posts/threads (hard delete only for now)
- AI-generated interaction analysis
- Combo database integration (Commander Spellbook, etc.)

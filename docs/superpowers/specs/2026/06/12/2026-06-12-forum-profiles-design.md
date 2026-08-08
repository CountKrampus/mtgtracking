# Forum Profiles Design Spec

**Date:** 2026-06-12  
**Status:** Approved

## Overview

The existing `/u/:username` public profile page gains a "Forum Activity" section showing reputation score, badges, activity stats (posts, threads, upvotes received), recent posts, and top posts. Visibility is controlled by a new `showForum` privacy toggle. The existing `UserProfile.js` component is extended — no new page or route.

## Decisions

| Question | Decision |
|---|---|
| Page location | Extend existing `/u/:username` (UserProfile.js) |
| Sections | Rep + badges, activity stats, recent posts, top posts |
| Privacy control | New `showForum: Boolean` toggle in User.privacy |

---

## Data Models

### Modified: `User.privacy`

Add one field to the existing `privacy` sub-object:

```javascript
showForum: { type: Boolean, default: false }
```

Existing fields (`isPublic`, `showCollection`, `showDecks`, `showWishlist`, `bio`) are unchanged.

---

## API Routes

### New

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/forum/users/:username/activity` | public | Forum activity for a user's public profile |

**`GET /api/forum/users/:username/activity` logic:**
1. Find user by username
2. If `!user.privacy.isPublic || !user.privacy.showForum` → return 404
3. Query and return:

```json
{
  "reputation": 1204,
  "badges": [{ "name": "First Post", "earnedAt": "..." }],
  "stats": {
    "postCount": 347,
    "threadCount": 42,
    "upvotesReceived": 1108,
    "memberSince": "2025-01-15T..."
  },
  "recentPosts": [
    {
      "_id": "...",
      "body": "Cut Deepglow Skate...",
      "threadId": "...",
      "threadTitle": "cEDH Budget Staples",
      "createdAt": "..."
    }
  ],
  "topPosts": [
    {
      "_id": "...",
      "body": "Aesi, Tyrant of Gyre Strait...",
      "threadId": "...",
      "threadTitle": "Best budget commander...",
      "upvoteCount": 12,
      "createdAt": "..."
    }
  ]
}
```

**Query details:**
- `recentPosts`: last 10 ForumPost documents by this user (sorted by `createdAt: -1`), with `threadTitle` populated via a ForumThread lookup on each post's `threadId`
- `topPosts`: top 5 ForumPost by `upvotes.length` (sorted descending), same thread title population
- `upvotesReceived`: `ForumPost.aggregate` summing `upvotes.length` for all posts by this user
- Posts with `isFlagHidden: true` or `isShadowHidden: true` are excluded from both lists

### Modified

- `GET /api/users/profile/:username` — no change to this route; forum activity fetched separately by frontend
- `PUT /api/users/me` — already accepts `privacy` sub-object; `showForum` persists automatically once added to schema

---

## Frontend Changes

### `UserProfile.js`

After the existing profile sections (collection stats, decks, wishlist), add a conditional "Forum Activity" section:

```jsx
{profile.showForum && forumActivity && (
  <ForumActivitySection activity={forumActivity} />
)}
```

`forumActivity` is fetched from `GET /api/forum/users/:username/activity` in a separate `useEffect` after the main profile loads. If the endpoint returns 404, the section is simply not rendered (no error shown).

**Section layout:**
1. **Reputation row** — `⚡ {reputation}` in amber, followed by badge chips (emoji + name, up to 5 visible)
2. **Stats grid** — 4 tiles: Posts, Threads, Upvotes received, Member since
3. **Recent Posts** — list of up to 10 posts, each showing truncated body + thread title link + date
4. **Top Posts** — list of up to 5 posts, each showing upvote count + body + thread title link

Thread title links navigate to `/forum/thread/:threadId` (using existing in-app routing).

### Settings modal — Privacy & Sharing tab

Add a new toggle below the existing `showWishlist` toggle:

```
[toggle] Show forum activity
Show your reputation, badges, and recent posts on your public profile.
```

Persists via the existing `PUT /api/users/me` call with `{ privacy: { showForum: true/false } }`.

---

## Out of Scope

- Forum activity feed visible to non-public profiles
- Separate `/u/:username/forum` route
- Following users or activity subscriptions
- Private messaging from profile page


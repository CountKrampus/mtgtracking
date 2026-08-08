# Gamification — Reputation & Badges Design Spec

**Date:** 2026-06-12  
**Status:** Approved

## Overview

Users earn reputation points through activity and community upvotes. Milestone badges are auto-awarded at thresholds. Admins can grant custom badges. Reputation and badges display inline on forum posts, in a hover card on usernames, on user profiles, and on a top-contributors leaderboard.

## Decisions

| Question | Decision |
|---|---|
| Rep model | Both: activity points + upvote points |
| Badge types | Milestone (auto) + Admin-awarded (manual) |
| Display locations | Inline on posts, hover card, profile page, leaderboard |

---

## Data Models

### Modified: `User`

`reputation` already exists as a `Number` field — **repurpose from 0–5 float to integer point accumulation** (existing data zeroed or migrated). No schema type change needed, just semantics change.

`badges` already exists as an embedded array `[{ name, earnedAt, description }]` — no schema change needed.

### Existing: `Badge` collection

Already exists with `name`, `description`, `color`, `icon`, `isCustom`, `createdBy`. Used for admin-granted badges. No schema change needed.

---

## Reputation Point Values

| Action | Points |
|---|---|
| Post a reply (ForumPost created) | +1 |
| Create a thread (ForumThread created) | +2 |
| Share a deck (Deck created with isPublic or shareCode) | +3 |
| Receive an upvote on a post | +5 |
| Receive an upvote on a thread | +10 |
| Post becomes top answer in Q&A thread (≥3 upvotes, first time only) | +15 |

Rep is **never deducted** (upvote removal does not subtract).

Rep changes are applied as side effects inside existing route handlers — no new reputation-specific endpoint needed.

---

## Milestone Badges

Auto-awarded server-side after the action that crosses each threshold. Checked inside the same route handler that earns the rep. One-time only — badge not re-awarded if already present in `User.badges`.

| Badge | Trigger |
|---|---|
| 📝 First Post | First ForumPost created |
| 💬 Century | 100th ForumPost created |
| 🧵 Thread Starter | First ForumThread created |
| 🃏 Deck Builder | First deck shared (shareCode set or isPublic = true) |
| 📦 Collector | 500th card added to collection |
| 🗓️ Veteran | Account age ≥ 365 days (checked on login) |

A `checkAndAwardBadges(userId)` helper in `backend/utils/badgeHelpers.js` handles all checks. Called after each relevant action.

---

## API Routes

### New

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/forum/leaderboard` | public | Top 10 users by reputation |
| POST | `/api/admin/badges/:badgeId/grant/:userId` | requireAdmin | Grant a badge to a user |
| DELETE | `/api/admin/badges/:badgeId/revoke/:userId` | requireAdmin | Revoke a badge from a user |

### Modified (side effects added)

- `POST /api/forum/posts` — add +1 rep, check badges
- `POST /api/forum/threads` — add +2 rep, check badges
- `POST /api/forum/posts/:id/upvote` — add +5 rep to post author (when upvoting, not removing)
- `POST /api/forum/threads/:id/upvote` — add +10 rep to thread author (when upvoting)
- `POST /api/decks` — add +3 rep when deck is shared publicly
- Login route — check Veteran badge

**`GET /api/forum/leaderboard` response:**
```json
{
  "leaderboard": [
    { "username": "KingSlayer99", "displayName": "...", "reputation": 1204, "badges": [...] }
  ]
}
```

---

## Frontend Changes

### ForumThreadView / PostNode

In each post's author row, after the username, add:
- Rep score: `⚡ {reputation}` in amber
- Up to 3 badge icons (emoji from badge name lookup), each with a tooltip

### Username hover card

On `mouseEnter` on any username in the forum, show a small popup:
- Avatar initial + username
- Rep score
- Badges (up to 5)
- Post count, member since date
- Links to `/u/:username`

Positioned using fixed coordinates from the hover event. Dismissed on `mouseLeave`.

### Leaderboard tab

New tab in the Forum top nav (alongside Categories). Fetches `GET /api/forum/leaderboard`. Shows rank, username, rep score, top 3 badges. All-time (no monthly reset for simplicity).

### Admin — Badge Grant

In Admin Panel → Users tab, each user row gets a "Grant Badge" button opening a modal:
- Dropdown of existing badges from `GET /api/admin/badges` (verify this exists; if not, add it alongside the grant/revoke routes)
- Submit calls `POST /api/admin/badges/:badgeId/grant/:userId`
- Revoke button per badge in user detail

---

## Out of Scope

- Rep decay or time-weighted scoring
- Rep-gated permissions (e.g., "must have 100 rep to post in X category")
- Monthly leaderboard resets
- Reputation history / event log


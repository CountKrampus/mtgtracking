# Q&A Format Design Spec

**Date:** 2026-06-12  
**Status:** Approved

## Overview

Forum threads can be marked as Q&A-type. In Q&A threads, the highest-upvoted reply (≥3 upvotes) is automatically highlighted as the "Best Answer" at the top of the reply list. Thread lists show ✅ Answered / ❓ Unanswered badges. The best-answer author earns a one-time +15 reputation bonus.

## Decisions

| Question | Decision |
|---|---|
| Q&A scope | Category-level default + per-thread override |
| Best answer selection | Automatic — highest upvoted reply with ≥3 upvotes |
| Manual marking | None — fully upvote-driven |
| Rep bonus | +15 to best-answer author (one-time, first time threshold crossed) |

---

## Data Models

### Modified: `ForumCategory`

Check whether a `ForumCategory` model exists at `backend/models/ForumCategory.js` or if categories are defined inline in the routes file. Either way, add the field to the schema:

```javascript
isQA: { type: Boolean, default: false }
```

### Modified: `ForumThread`

Add:

```javascript
isQA: { type: Boolean, default: false }
bestAnswerPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', default: null }
```

`bestAnswerPostId` is set server-side when a post first crosses the ≥3 upvote threshold as the top post in a Q&A thread. Used to efficiently look up the best answer without re-sorting on every fetch.

---

## Logic

### Thread creation

When `POST /api/forum/threads` is called:
1. Fetch the parent category
2. If `category.isQA === true`, default `thread.isQA = true`
3. If the request body includes `isQA: false`, override to false (per-thread opt-out)
4. If the request body includes `isQA: true` (and category is not Q&A), set to true (per-thread opt-in)

### Best answer detection

Triggered every time `POST /api/forum/posts/:id/upvote` is called and the thread `isQA === true`:

1. Find the ForumPost with the most upvotes in this thread (`upvotes.length` descending)
2. If that post has ≥3 upvotes:
   - Set `thread.bestAnswerPostId = post._id`
   - If this is the **first time** this post crosses the threshold (i.e., `thread.bestAnswerPostId` was previously null or different): award +15 rep to `post.authorId`
3. If no post has ≥3 upvotes, set `thread.bestAnswerPostId = null`

### Answered status

A Q&A thread is "answered" when `thread.bestAnswerPostId !== null`.

---

## API Routes

### Modified

- `POST /api/forum/threads` — inherit `isQA` from category, accept `isQA` override in body
- `GET /api/forum/categories/:slug/threads` — include `isQA` and `bestAnswerPostId` in thread list response
- `GET /api/forum/threads/:id` — include `isQA`, `bestAnswerPostId` in response; place best-answer post first in the sorted reply list
- `POST /api/forum/posts/:id/upvote` — run best-answer detection after upvote toggle

### New

| Method | Path | Auth | Description |
|---|---|---|---|
| PUT | `/api/admin/categories/:id` | requireAdmin | Update category (add `isQA` toggle) |

---

## Frontend Changes

### ForumPostComposer

When creating a thread, show a toggle below the title field:
```
[ ] This is a question (Q&A format)
```
Toggle defaults to on if the current category is a Q&A category. Sends `isQA: true/false` in the POST body.

### Thread list (ForumCategoryView)

On each thread row, show a status pill:
- `✅ Answered` (green) — `isQA && bestAnswerPostId`
- `❓ Unanswered` (blue) — `isQA && !bestAnswerPostId`
- `💬 Discussion` (gray) — `!isQA`

### Thread view (ForumThreadView)

When `thread.isQA && thread.bestAnswerPostId`:
- Pin the best-answer post at the very top of the reply list, above all others
- Render it with a distinct green border and a `✅ BEST ANSWER — N upvotes` label
- The post still appears in its chronological position in the full list below (with a small ✅ marker)

### Admin — Category Editor

In the Admin Panel (or wherever categories are managed), add an `isQA` toggle per category.

---

## Out of Scope

- Manual best-answer marking by OP or moderators
- Multiple accepted answers
- Q&A-only voting (separate upvote system for Q&A vs discussions)
- Bounties or featured questions


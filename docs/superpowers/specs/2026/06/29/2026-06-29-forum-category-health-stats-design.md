# Forum Category Health Stats — Design Spec

**Goal:** Add a "Category Health" tab to ForumAdminPanel showing per-category metrics (post velocity, spam rate, engagement) with a 7-day / 30-day toggle.

**Audience:** Admins and moderators only (existing role check on admin routes).

**Approach:** On-demand MongoDB aggregation endpoint, 5-minute in-memory cache, no new models or background jobs.

---

## Backend

### New route

`GET /api/admin/forum/category-stats?window=7|30`

- Requires admin or moderator role. Use `requireAdmin` for admin-only or apply both: `router.get('/forum/category-stats', requireAuth, async (req, res) => { if (!['admin','moderator'].includes(req.user?.role)) return res.status(403)... })`. Middleware imports: `{ requireAuth, requireAdmin, requireModerator }` from `'../middleware/auth'`.
- `window` param defaults to `7`; only values `7` and `30` are accepted (400 otherwise).
- Response is cached in a module-level `Map` keyed by window value; cache entries expire after 5 minutes (`Date.now()` comparison).

### Aggregation

Two parallel queries:

**Thread query** — `ForumThread.aggregate`:
```
match: { createdAt: { $gte: windowStart }, isHidden: { $ne: true } }
group: { _id: '$categoryId', newThreads: { $sum: 1 } }
```

**Post query** — `ForumPost.aggregate`:
```
match: { createdAt: { $gte: windowStart } }
group: {
  _id: '$threadId'  // need categoryId — must $lookup ForumThread or store categoryId on post
}
```

Because `ForumPost` stores `threadId` but not `categoryId`, the post aggregation uses a `$lookup` to join `ForumThread` and group by `thread.categoryId`:

```
[
  { $match: { createdAt: { $gte: windowStart } } },
  { $lookup: { from: 'forumthreads', localField: 'threadId', foreignField: '_id', as: 'thread' } },
  { $unwind: '$thread' },
  { $group: {
      _id: '$thread.categoryId',
      newPosts:      { $sum: 1 },
      hiddenPosts:   { $sum: { $cond: ['$isHidden', 1, 0] } },
      uniqueAuthors: { $addToSet: '$authorId' }
  }}
]
```

**Merge** results by categoryId. Also fetch all `ForumCategory` docs to get names and slugs.

### Response shape

```json
{
  "window": 7,
  "generatedAt": "2026-06-29T12:00:00Z",
  "categories": [
    {
      "categoryId": "...",
      "name": "General Discussion",
      "slug": "general",
      "newThreads": 12,
      "newPosts": 87,
      "postsPerDay": 12.4,
      "hiddenPosts": 3,
      "spamRate": 0.034,
      "uniqueAuthors": 21,
      "avgRepliesPerThread": 7.25
    }
  ]
}
```

`spamRate` = `hiddenPosts / newPosts` (0 if `newPosts === 0`).
`avgRepliesPerThread` = `newPosts / newThreads` (0 if `newThreads === 0`).
`postsPerDay` = `newPosts / window`.

---

## Frontend

### Component: `CategoryHealthTab.js`

New file at `frontend/src/components/admin/forum/CategoryHealthTab.js`.

- Fetches `GET /api/admin/forum/category-stats?window=${window}` on mount and on window toggle.
- Local state: `window` (7 or 30), `stats` array, `loading`, `error`.
- Renders a toggle button group (7d / 30d) above the table.
- Table columns: Category, New Threads, New Posts, Posts/Day, Unique Authors, Avg Replies/Thread, Spam Rate.
- Spam rate cell uses a colored badge:
  - Green (`bg-green-900/40 text-green-300`): < 5%
  - Yellow (`bg-yellow-900/40 text-yellow-300`): 5–15%
  - Red (`bg-red-900/40 text-red-300`): > 15%
- Rows sorted by `newPosts` descending (most active first).
- Shows `generatedAt` timestamp as "Stats as of X" below the table (so mods know the cache age).

### Wiring into ForumAdminPanel

`frontend/src/components/Forum/ForumAdminPanel.js` already has tabs. Add a "Category Health" tab that renders `<CategoryHealthTab />`.

---

## File Changes

| File | Action |
|------|--------|
| `backend/routes/admin.js` | Add `GET /forum/category-stats` route with aggregation + 5-min cache |
| `frontend/src/components/admin/forum/CategoryHealthTab.js` | New component |
| `frontend/src/components/Forum/ForumAdminPanel.js` | Add "Category Health" tab |

---

## Testing

- `GET /api/admin/forum/category-stats?window=7` returns array with correct shape
- `?window=99` returns 400
- Cache: second request within 5 min returns same `generatedAt`
- Unauthenticated request returns 401
- Non-moderator user returns 403

# Auto-Moderation Queue — Design Spec

**Goal:** A unified review queue fed by user reports and automated spam detection. Moderators see flagged content with rule-based suggested actions and can hide, warn, or dismiss in one click.

---

## Model

### `backend/models/ContentReport.js`

```js
{
  contentId:       { type: ObjectId, required: true },         // ForumPost or ForumThread _id
  contentType:     { type: String, enum: ['post','thread'], required: true },
  reportedBy:      { type: Mixed, required: true },            // ObjectId (user) or string 'system'
  reason:          { type: String, enum: ['spam','harassment','off-topic','other'], required: true },
  source:          { type: String, enum: ['user','automated'], required: true },
  triggeredRule:   { type: String, default: '' },              // spam filter rule name, automated only
  status:          { type: String, enum: ['pending','actioned','dismissed'], default: 'pending' },
  suggestedAction: { type: String, enum: ['hide_post','hide_and_warn','review'], required: true },
  reviewedBy:      { type: ObjectId, ref: 'User', default: null },
  reviewedAt:      { type: Date, default: null },
  createdAt:       { type: Date, default: Date.now }
}
```

Index: `{ contentId: 1, status: 1 }` — used by duplicate-report check and suggested action aggregation.

### Suggested action helper (module-level function, reused by both report sources)

```js
function computeSuggestedAction(source, reason, pendingCountForContent) {
  if (source === 'automated') return 'hide_post';
  if (reason === 'harassment' || reason === 'spam') return 'hide_and_warn';
  if (pendingCountForContent >= 3) return 'hide_post';
  return 'review';
}
```

---

## Backend Routes

### `POST /api/forum/report`

Added to `backend/routes/forum.js`. Middleware: `requireAuth`.

Body: `{ contentId, contentType, reason }`

- Rate-limit: check `ContentReport.countDocuments({ reportedBy: req.user._id, createdAt: { $gte: oneHourAgo } }) >= 5` → 429.
- Check for existing pending report from same user on same content → 409 "Already reported."
- Count current pending reports for `contentId`.
- Compute `suggestedAction` via helper.
- Create and save `ContentReport`.
- If new total pending count ≥ 3 and content not already hidden: auto-hide the content (`isHidden: true`, `hiddenReason: 'Auto-hidden: multiple reports'`) and upgrade all pending reports' `suggestedAction` to `'hide_post'` via `updateMany`.
- Return 201.

### `GET /api/admin/moderation-queue`

Added to `backend/routes/admin.js`. Middleware: `requireAuth`, role check `['admin','moderator']`.

Query params: `status` (default `pending`), `contentType` (optional filter), `limit` (default 50), `offset` (default 0).

- Aggregation: group by `contentId` to get report count, most severe `suggestedAction`, list of reasons, earliest `createdAt`.
- Populate content preview: for each unique contentId, fetch first 200 chars of post body or thread title.
- Populate content author username.
- Return sorted by report count desc, then createdAt asc.

Response shape per item:
```json
{
  "contentId": "...",
  "contentType": "post",
  "contentPreview": "...",
  "authorUsername": "...",
  "authorId": "...",
  "reportCount": 3,
  "reasons": ["spam", "spam", "other"],
  "suggestedAction": "hide_and_warn",
  "sources": ["user", "automated"],
  "oldestReportAt": "..."
}
```

### `POST /api/admin/moderation-queue/:contentId/action`

Added to `backend/routes/admin.js`. Middleware: `requireAuth`, role check `['admin','moderator']`.

Body: `{ action: 'hide' | 'hide_and_warn' | 'dismiss', contentType: 'post' | 'thread' }`

- `hide` or `hide_and_warn`:
  - Set `isHidden: true`, `hiddenReason: 'Moderator action'` on the ForumPost or ForumThread.
  - If `hide_and_warn`: create a `UserWarning` for the content author (`reason: 'Content removed by moderator'`, `warnedBy: req.user._id`, `escalationLevel: 1`).
- `dismiss`: no content change.
- Mark all pending `ContentReport` docs for this `contentId` as `status: action === 'dismiss' ? 'dismissed' : 'actioned'`, set `reviewedBy` and `reviewedAt`.
- Log one `ModerationHistory` entry: `{ actionType: 'content_moderation', actionDetails: { contentId, contentType, action }, performedBy: req.user._id }`.
- Return `{ ok: true }`.

### Spam filter integration

In `backend/middleware/muteEnforcer.js` or wherever the spam filter currently runs, after flagging content add:

```js
const pendingCount = await ContentReport.countDocuments({ contentId, status: 'pending' });
const suggestedAction = computeSuggestedAction('automated', 'spam', pendingCount);
await ContentReport.create({
  contentId, contentType, reportedBy: 'system', reason: 'spam',
  source: 'automated', triggeredRule: ruleName, suggestedAction
});
```

Import `ContentReport` and `computeSuggestedAction` (exported from the model file).

---

## Frontend

### Report button on posts/threads

In `frontend/src/components/Forum/ThreadView.js` and any post rendering component:

- Add a `<Flag size={14} />` icon button (gray, subtle) at the bottom-right of each post/thread card. Visible to all logged-in users.
- Clicking opens `ReportModal` (defined above `ThreadView` at module scope).
- `ReportModal`: dropdown for reason (Spam / Harassment / Off-topic / Other), optional note field (not sent to backend, UX only), Submit button.
- On 409: show "You've already reported this." On 429: show "You're reporting too frequently."

### `AutoModQueue.js`

New file at `frontend/src/components/Forum/AutoModQueue.js`.

- Fetches `GET /api/admin/moderation-queue` on mount. Refresh button.
- Filter bar: All / Posts / Threads toggle; Status: Pending / Actioned / Dismissed.
- Table columns: Content Preview | Type | Author | Reports | Reasons | Suggested Action | Actions.
- Suggested action badge colors:
  - `hide_and_warn` → red (`bg-red-900/40 text-red-300`)
  - `hide_post` → orange (`bg-orange-900/40 text-orange-300`)
  - `review` → yellow (`bg-yellow-900/40 text-yellow-300`)
- Action buttons per row: **Hide** (orange), **Hide + Warn** (red), **Dismiss** (gray). Disabled after action taken.

### Wiring into ForumAdminPanel

Add "Mod Queue" tab to `frontend/src/components/Forum/ForumAdminPanel.js` rendering `<AutoModQueue />`. Add pending-count badge (fetched alongside queue data).

---

## File Changes

| File | Action |
|------|--------|
| `backend/models/ContentReport.js` | New model + `computeSuggestedAction` export |
| `backend/routes/forum.js` | Add `POST /report` |
| `backend/routes/admin.js` | Add `GET /moderation-queue` and `POST /moderation-queue/:id/action` |
| Spam filter middleware | Import ContentReport, create automated report on flag |
| `frontend/src/components/Forum/ThreadView.js` | Add Report button + `ReportModal` (defined above component) |
| `frontend/src/components/Forum/AutoModQueue.js` | New component |
| `frontend/src/components/Forum/ForumAdminPanel.js` | Add Mod Queue tab |

---

## Testing

- `POST /report` rate limit: 6th report in 1 hour → 429
- `POST /report` duplicate → 409
- `POST /report` 3rd report on same content → content auto-hidden
- `GET /moderation-queue` unauthenticated → 401, non-mod → 403
- `POST /action` hide → post isHidden = true, reports actioned
- `POST /action` hide_and_warn → UserWarning created for author
- `POST /action` dismiss → reports dismissed, content unchanged
- Automated spam flag creates ContentReport with source='automated'

# User Feedback System — Design

**Status:** Approved, ready for implementation planning
**Date:** 2026-08-07

## Problem

The admin panel's "Feedback" tab (`frontend/src/components/admin/community/FeedbackTab.js`) already has a complete table UI — submitter, message, category badge, date, status badge, mark-reviewed action — but it's entirely a stub: it 404s against `GET /api/admin/feedback` (which doesn't exist) and shows a "No feedback system implemented" notice. There is also no user-facing way to submit feedback anywhere in the app. Notably, the permissions catalog (`backend/utils/permissions.js`) already defines `feedback:manage` and `feedback:read` permission keys, unused by any route — this feature was clearly planned but never finished.

## Goal

A complete, working feedback loop: a logged-in user can submit a bug/feature/other report from anywhere in the app via a header button, and admins/moderators with the right permission can view and triage submissions (mark reviewed or closed) from the existing admin table.

## Data Model

New `backend/models/Feedback.js`:
```js
{
  submitter: { type: ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['bug', 'feature', 'other'], default: 'other' },
  status: { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
  pageUrl: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

## Backend Routes

New `backend/routes/feedback.js`, mounted at `/api/feedback` and `/api/admin/feedback` (the admin routes can live in this same file and be mounted under both prefixes, or be added directly to `admin.js` — implementation plan decides based on which is cleaner given how other admin sub-resources are organized in this codebase).

- `POST /api/feedback` — `requireAuth`. Body: `{ message, category, pageUrl, userAgent }`. Creates a `Feedback` doc with `submitter` set from `req.user`. `message` is required (400 if blank/missing); `category` defaults to `'other'` if omitted/invalid.
- `GET /api/admin/feedback` — `requirePermission('feedback:read')`. Returns `{ feedback: [...] }`, populated `submitter` (username/displayName — matches `FeedbackTab.js`'s existing rendering, which already handles `submitter` as either an object or a plain string), sorted newest first.
- `PATCH /api/admin/feedback/:id` — `requirePermission('feedback:manage')`. Body: `{ status }`, validated against the enum (400 on an invalid value). Returns the updated doc.

## Frontend: Submission

New button in `frontend/src/components/AppHeader.js`, alongside the existing Notifications (`NotificationBell.js`) and Messages icon buttons — same icon-button styling convention. Opens a new `FeedbackModal.js`:
- Category select: Bug / Feature / Other.
- Message textarea (required).
- On submit, auto-attaches `window.location.pathname` as `pageUrl` and `navigator.userAgent` as `userAgent` — no user input needed for either.
- Submits via the app's existing `axios`/`authFetch` pattern (matching how other authenticated POSTs are made elsewhere in the app), shows a success toast/alert, closes the modal.
- No page-level entry point (e.g. a Settings section) — brainstorming explicitly chose header-button-only for this iteration.

## Frontend: Admin Table Fix

`FeedbackTab.js` changes:
- `fetchFeedback` already handles a 404 (`notImplemented` state) — once the real route exists, this becomes dead code but is harmless to leave (defensive: if the route is ever removed/renamed, the UI degrades gracefully instead of crashing). No change needed there.
- `handleMarkReviewed` currently only does a local `setFeedback` state mutation — replace with a real `PATCH /api/admin/feedback/:id` call, then update local state from the response (not an optimistic-only update).
- Add a second action button for "Close" (using the existing `StatusBadge`'s `closed` styling, currently unused), next to the existing reviewed checkmark — same `PATCH` call with `status: 'closed'`.
- Both action buttons should be hidden once a row is already in that target status (e.g. no "mark reviewed" button on an already-reviewed row) — matching the existing `{item.status !== 'reviewed' && (...)}` pattern, extended for `closed`.

## Error Handling

Matches this codebase's established conventions: routes wrap logic in try/catch returning `{ message }` on error; the frontend's existing `ErrorState`/retry pattern in `FeedbackTab.js` already handles a failed `GET` — no changes needed there. The new submission modal shows an inline error message (not a full-page error state, since it's a modal) if `POST /api/feedback` fails, and lets the user retry without losing their typed message.

## Testing

Backend: TDD via jest, new `backend/__tests__/feedback.test.js` covering: `POST /api/feedback` creates a doc with the submitting user, rejects an empty message, defaults an invalid/missing category to `'other'`; `GET /api/admin/feedback` requires `feedback:read` permission (403 without it), returns submitter info; `PATCH /api/admin/feedback/:id` requires `feedback:manage`, rejects an invalid status value, updates correctly.

Frontend: no test infrastructure in this repo (established convention) — verified via `npm run build` plus manual click-through: submit feedback from the header button, confirm it appears in the admin table, mark it reviewed then closed, confirm both persist across a page refresh.

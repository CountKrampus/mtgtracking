# Bulk User Actions — Design Spec

**Goal:** Let admins select multiple users in the user management table and perform batch operations (email blast, badge grant, 2FA reset) with confirmation and full audit trail.

---

## Backend Routes

All three routes added to `backend/routes/admin.js`. All require `requireAuth` + `requireAdmin` (not just moderator).

### `POST /api/admin/users/bulk-email`

Body: `{ userIds: string[], subject: string, body: string }`

- Validate: `userIds` non-empty array (max 500), `subject` ≤ 200 chars, `body` ≤ 5000 chars.
- Fetch email addresses for all userIds in one query: `User.find({ _id: { $in: userIds } }, 'email username')`.
- Send via nodemailer (reuse existing transport from `backend/utils/email.js` or equivalent). If no transport configured, return 503 "Email not configured."
- Log one `ModerationHistory` entry per user: `{ actionType: 'bulk_email', actionDetails: { subject }, performedBy: req.user._id, userId: each user's _id }`.
- Return `{ sent: N, failed: N, errors: [...] }`.

### `POST /api/admin/users/bulk-badge`

Body: `{ userIds: string[], badgeId: string }`

- Validate: `userIds` non-empty (max 500), `badgeId` exists in `Badge` collection → 404 if not.
- `User.updateMany({ _id: { $in: userIds } }, { $addToSet: { badges: badgeId } })`.
- Log one `ModerationHistory` entry per user: `{ actionType: 'bulk_badge_grant', actionDetails: { badgeId }, performedBy: req.user._id, userId: each user's _id }`. Use `ModerationHistory.insertMany`.
- Return `{ updated: result.modifiedCount }`.

### `POST /api/admin/users/bulk-2fa-reset`

Body: `{ userIds: string[] }`

- Validate: `userIds` non-empty (max 500).
- `User.updateMany({ _id: { $in: userIds } }, { $set: { twoFactorSecret: null, twoFactorEnabled: false } })`.
- Log one `ModerationHistory` entry per user: `{ actionType: 'bulk_2fa_reset', actionDetails: {}, performedBy: req.user._id, userId: each user's _id }`.
- Return `{ updated: result.modifiedCount }`.

### `GET /api/admin/users/bulk-select`

Body/query: current filter params (same as `GET /api/admin/users` — `search`, `role`, `status`).

- Returns only `_id` array of all matching users (no pagination limit). Used by "Select all matching" button.
- Same `requireAdmin` guard.

---

## Frontend

### Checkbox column in `UserManagement.js`

- Add a checkbox as the first column in the user table.
- State: `selectedUserIds` (Set of string IDs).
- Header checkbox: "select all on current page."
- Below the search/filter bar: when any filter is active, show "Select all N users matching this filter" button — calls `GET /api/admin/users/bulk-select` with current filters, merges returned IDs into `selectedUserIds`.

### Floating action bar

Appears (fixed bottom) when `selectedUserIds.size > 0`. Shows:
- "{N} users selected" label
- **Clear selection** link
- **Email** button (envelope icon, blue)
- **Grant Badge** button (award icon, purple)
- **Reset 2FA** button (shield icon, orange)

### Confirmation modals

Three separate inline modal components defined above `UserManagement` (not inside it):

**`BulkEmailModal`** — subject input, body textarea, preview of first 3 usernames affected, "Send to {N} users" confirm button.

**`BulkBadgeModal`** — badge dropdown (fetches `GET /api/admin/badges`), preview badge icon + name, "Grant to {N} users" confirm button.

**`Bulk2FAResetModal`** — warning text "This will force {N} users to re-enroll in 2FA on next login.", "Confirm Reset" button (red).

Each modal calls its respective endpoint, shows inline success/error, then closes and clears selection on success.

---

## File Changes

| File | Action |
|------|--------|
| `backend/routes/admin.js` | Add 4 new routes: bulk-email, bulk-badge, bulk-2fa-reset, bulk-select |
| `frontend/src/components/admin/UserManagement.js` | Add checkbox column, selection state, "select all matching" button, floating action bar |
| `frontend/src/components/admin/BulkEmailModal.js` | New component (defined at module scope, imported by UserManagement) |
| `frontend/src/components/admin/BulkBadgeModal.js` | New component |
| `frontend/src/components/admin/Bulk2FAResetModal.js` | New component |

---

## Testing

- `POST /bulk-email` with no email configured → 503
- `POST /bulk-email` with valid config → sends, returns sent/failed counts
- `POST /bulk-badge` with invalid badgeId → 404
- `POST /bulk-badge` → modifiedCount matches, badges upserted (idempotent)
- `POST /bulk-2fa-reset` → twoFactorEnabled becomes false for all userIds
- `GET /bulk-select` → returns full ID list ignoring pagination
- Non-admin calling any bulk route → 403
- ModerationHistory entries created for each user in each operation

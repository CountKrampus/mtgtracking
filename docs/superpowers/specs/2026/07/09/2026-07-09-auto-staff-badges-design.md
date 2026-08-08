# Auto-Badge Grant on Staff Promotion — Design

## Problem

Promoting a user to a staff role (`PUT /api/admin/users/:userId/role` in `backend/routes/admin.js`) updates `role` and `staffSince`, but never touches `badges`. Staff badges have to be granted by hand today. Canonical badge definitions already exist in the `Badge` collection for **Moderator**, **Content Manager**, and a generic **Site Staff**, plus **Site Owner** — but the `admin` role's actual badge on existing users is named "Owner", not "Site Owner" (a naming drift), and `community_manager`/`support` have no dedicated badge at all.

## Goals

- Role changes automatically grant/revoke the matching staff badge — no manual step.
- Every staff role (`admin`, `moderator`, `content_manager`, `community_manager`, `support`) gets its own dedicated badge.
- Fix the `Owner` vs `Site Owner` naming mismatch so `admin` promotions grant a consistently-named badge.
- One-time backfill grants the correct badge to everyone currently holding a staff role.
- Losing a staff role removes the badge immediately.

## Non-goals

- No change to how `role` itself is assigned or validated (that's the custom-roles project).
- No UI to preview/customize which badge maps to which role — the mapping is a fixed table for now.

## Design

### Badge → role mapping

A new fixed map, `STAFF_ROLE_BADGES`, in `backend/utils/permissions.js` (co-located with `STAFF_ROLES`, which it mirrors 1:1):

```js
const STAFF_ROLE_BADGES = {
  admin: { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown' },
  moderator: { name: 'Moderator', description: '', icon: 'lucide:Flame' },
  content_manager: { name: 'Content Manager', description: '', icon: 'lucide:Flame' },
  community_manager: { name: 'Community Manager', description: '', icon: 'lucide:Flame' },
  support: { name: 'Support', description: '', icon: 'lucide:Flame' },
};
```

`admin` maps to the existing `Site Owner` Badge record (fixing the drift — see Migration below). Two new `Badge` documents are created for `community_manager` ("Community Manager") and `support` ("Support"), matching the existing icon/description style of the other role badges.

### Grant/revoke hook

Both live in the existing `PUT /api/admin/users/:userId/role` handler, right after `targetUser.role = newRole` is set and before `.save()`:

1. **Revoke:** if the user's *previous* role had an entry in `STAFF_ROLE_BADGES` and the new role's badge is different (or the new role isn't staff at all), remove that badge object from `targetUser.badges` (match by `name`).
2. **Grant:** if the *new* role has an entry in `STAFF_ROLE_BADGES` and the user doesn't already have that badge, push it onto `targetUser.badges` with `earnedAt: new Date()`.

This reuses the existing embedded-badge-on-user pattern (`user.badges: [{name, description, icon, earnedAt}]`) already used by `checkAndGrantBadge` in `utils/milestoneAwards.js` — no new grant mechanism, just a new call site. A small shared helper, `syncStaffBadge(user, oldRole, newRole)`, exported from `permissions.js`, keeps this logic out of the route handler and unit-testable in isolation.

### Backfill migration

A one-off script, `backend/scripts/backfillStaffBadges.js`, run manually once after deploy:
- Finds every `User` with `role` in `STAFF_ROLES`.
- For each, grants the matching `STAFF_ROLE_BADGES` entry if missing.
- Also fixes existing `admin` users whose badge array has `"Owner"` instead of `"Site Owner"` — renames in place (updates the embedded badge's `name` field) rather than adding a duplicate.
- Logs a summary (users checked / badges granted / names fixed) to stdout. Not wired into app startup — run once by hand (`node scripts/backfillStaffBadges.js`), matching how `backend/scripts/` one-offs are already used elsewhere in this repo (verify at implementation time whether a `scripts/` directory convention already exists; if not, this is the first entry in it).

### Data model changes

- Two new `Badge` documents: `Community Manager`, `Support` (seeded by the backfill script or a small seed step — implementation plan should decide which, based on how the existing four were originally created).
- No schema changes — `User.badges` and `Badge` already support this shape.

## Testing

- Unit tests for `syncStaffBadge()`: promotion grants the right badge; demotion revokes it; re-promoting to the same role doesn't duplicate the badge; promoting from one staff role directly to another swaps badges (old removed, new added) in one call.
- Route-level test on `PUT /api/admin/users/:userId/role` confirming the badge array changes as expected end to end.
- Backfill script tested against a small seeded set of users including one with the legacy `"Owner"` badge name, asserting it becomes `"Site Owner"` with no duplicate.

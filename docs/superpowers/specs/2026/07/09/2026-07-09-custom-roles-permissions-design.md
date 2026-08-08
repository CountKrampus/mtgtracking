# Custom Roles & Permissions System — Design

## Problem

Today, `role` is a fixed enum (`admin`/`moderator`/`content_manager`/`community_manager`/`support`/`user`, plus legacy `editor`/`viewer`) and every protected route checks role names directly via `requireRole('admin', 'moderator')`. A `ROLE_PERMISSIONS` map and `hasPermission()` function already exist in `backend/utils/permissions.js` — but **`hasPermission()` is never actually called anywhere in the codebase**. It's a fully-built but unwired permission layer sitting next to the real (role-name-based) authorization system.

This matters a lot for scope: building a "custom roles" UI on top of `ROLE_PERMISSIONS` without also rewiring route protection to check permissions would produce roles that *look* configurable in the admin UI but don't actually control access to anything. This design treats making permissions real as part of the work, not a follow-up.

## Goals

- Admins can create new named roles with a hand-picked set of permissions, stored in the DB.
- The 6 existing roles become editable rows in the same system — not protected/hardcoded.
- Real route protection is driven by permission checks, not hardcoded role-name lists, so a custom role's permissions actually gate real functionality.
- A fixed, discoverable permission catalog (existing catalog + new additions covering currently-role-gated-but-not-permission-gated routes) backs a checkbox-list UI.
- Guardrails so an admin can't lock the site out of its own admin functionality.

## Non-goals

- No per-user permission overrides on top of a role (rejected option — roles are the only grouping mechanism).
- No permission "inheritance"/role hierarchy (e.g. no built-in notion that `admin` implies everything `moderator` can do beyond what's explicitly listed) — `admin` keeps its existing special-cased `'all'` bypass in `hasPermission()`, everything else is an explicit list.
- No retroactive audit of every single `requireRole()` call site in one pass if the codebase turns out to have many more than expected — the implementation plan should inventory them, but migrating low-traffic/rarely-touched routes can be sequenced as follow-up work rather than blocking the whole project.

## Design

### Data model: `Role` collection

```js
{
  name: String,           // unique, e.g. "admin", "moderator", "event_coordinator"
  displayName: String,    // e.g. "Event Coordinator"
  permissions: [String],  // permission strings from the catalog, or ['all'] for admin
  isBuiltIn: Boolean,     // true for the 6 migrated roles — informational only, doesn't block edits (see Guardrails)
  createdAt: Date,
  updatedAt: Date,
}
```

Migration seeds this collection from the current `ROLE_PERMISSIONS` map (one `Role` doc per existing key, `isBuiltIn: true`). `User.role` stays a `String` (not a ref) for backward compatibility — it now matches against `Role.name` instead of a hardcoded enum. The Mongoose schema's `enum` validator on `User.role` is removed (validation moves to "does a `Role` with this name exist," checked at assignment time in the route handler, not at the schema level).

### Permission catalog

`getPermissionsCatalog()` replaces the frozen `ROLE_PERMISSIONS` map as the source of truth for *what permissions exist* (role→permission assignment moves into the `Role` collection above). Two tiers:

**Existing (already defined, now enforced):** `chat:moderate`, `comments:moderate`, `user:warn`, `user:mute`, `content:flag`, `cards:audit`, `prices:manage`, `data:export`, `community:events`, `announcements:manage`, `feedback:manage`, `playgroups:manage`, `user:view`, `feedback:read`, `ticket:manage`, `collection:manage`, `deck:create`, `community:chat`, `collection:view`, plus `all` (admin wildcard, handled as a special case, not assignable to custom roles).

**New, proposed to cover routes currently gated only by hardcoded role name** (verify each against the actual route during implementation — this list is derived from the admin/forum route domains seen in this codebase, not an exhaustive route audit):
- `user:ban` — ban/unban users (`UserBan` model)
- `user:appeal:review` — review ban appeals (`BanAppeal` model)
- `user:role:manage` — assign roles to users (meta-permission gating the role-assignment endpoint itself)
- `roles:manage` — create/edit/delete custom roles (meta-permission gating this new feature's own admin UI)
- `forum:moderate` — pin/lock/delete threads and posts
- `badges:manage` — grant/revoke/create badges and cosmetics
- `system:settings:manage` — `SystemSettings` (maintenance mode, registration toggle, etc.)
- `decks:moderate` — unpublish/moderate community decks
- `trades:moderate` — moderate trading board listings/offers
- `prices:force-update` — trigger the admin bulk price-update job (distinct from `prices:manage`, which is about correcting individual prices)

### Route protection

New `requirePermission(...permissionStrings)` middleware (in `backend/middleware/auth.js`, alongside the existing `requireRole`/`requireEditor`) — looks up the user's `Role` doc by `user.role`, checks if any required permission is present (or the role has `'all'`).

Each existing `requireRole(...)` call site is migrated to `requirePermission(...)` with the matching permission(s) from the catalog above (e.g. a route currently gated `requireRole('admin', 'moderator')` for banning users becomes `requirePermission('user:ban')`, and both `admin` and `moderator`'s `Role` docs are seeded with `user:ban`). `requireRole` itself stays for the handful of places that should genuinely never be permission-configurable (see Guardrails).

### Guardrails against lockout

Since every role (including `admin`) is editable:
- **Last-admin-equivalent check**: before saving changes to any `Role` that currently has `'all'`, if it would remove `'all'` and no *other* role in the system currently grants `'all'`, block the save with a clear error. Mirrors the existing "can't demote the only admin" check already in `PUT /api/admin/users/:userId/role`.
- **`roles:manage` self-lock check**: a user editing a `Role` cannot remove `roles:manage` from their *own current role* if it's the only role with that permission — otherwise they'd lock themselves out of the role editor with no way back in short of a DB edit.
- These two checks are the only hardcoded safety rails; everything else about role editing is fully open, matching the "make everything editable" decision.

### Frontend

New `RoleManagement.js` admin view (the existing role-assignment UI already references a "RoleManagement" component per a comment in `admin.js` — check whether this already exists as a stub or needs to be built from scratch):
- Table of all roles (built-in and custom) with permission checkboxes grouped by domain (User Management, Forum, Pricing, Collection, etc.).
- Create/rename/delete custom roles (delete blocked if any user currently holds that role — reassign first).
- Permission catalog rendered from `getPermissionsCatalog()` so the UI never drifts from what the backend actually enforces.

## Testing

- `requirePermission()` middleware unit tests: grants access when role has the permission or `'all'`, denies otherwise.
- Guardrail tests: attempting to strip `'all'` from the last all-access role fails; attempting to strip `roles:manage` from your own only-role-with-it fails.
- Migration test: seeding from the current `ROLE_PERMISSIONS` map produces 6 `Role` docs whose permissions exactly match today's hardcoded map (regression safety — promotions/demotions shouldn't silently change what anyone can do on migration day).
- Route-level smoke tests for a sample of migrated routes (ban user, force-price-update, pin thread) confirming permission-based gating behaves identically to the old role-based gating for the 6 built-in roles.

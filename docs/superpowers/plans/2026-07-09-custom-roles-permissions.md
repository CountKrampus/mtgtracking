# Custom Roles & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed, hardcoded role system (`requireRole('admin', 'moderator')` scattered across routes, plus a dead `hasPermission()` function that nothing calls) with a real, DB-backed `Role` collection and `requirePermission(...)` middleware, so admins can create custom roles with hand-picked permissions that actually gate real functionality — not just look configurable.

**Architecture:** A new `Role` Mongoose collection (`backend/models/Role.js`) is seeded from the existing `ROLE_PERMISSIONS` map on server startup. `backend/utils/permissions.js` is refactored so `getPermissionsForRole()`/`hasPermission()` read from an in-memory cache backed by that collection (kept in-memory because `User.toSafeObject()` calls `getPermissionsForRole()` synchronously on every authenticated request). A new `requirePermission(...)` middleware (`backend/middleware/auth.js`) checks that cache. Existing `requireRole()`/`requireModerator()`/`requireContentManager()`/`requireAdmin` call sites are migrated to `requirePermission(...)` domain by domain, with guardrails preventing an admin from locking the site out of its own admin functionality. A new `backend/routes/roles.js` provides CRUD for the `Role` collection, and the frontend gets a new `PermissionsManagement.js` admin view.

**Tech Stack:** Node/Express/Mongoose backend, React/Tailwind frontend, Jest + `mongodb-memory-server` + `supertest` for backend tests (this repo has no frontend test infrastructure — verified via `Glob frontend/src/**/*.test.js` returning zero files, so Phase 3 ends in a manual verification checklist, not automated tests).

---

## Route Inventory (verified by grep, not assumed from the spec)

This is the actual, current state of every `requireRole`-family call site in the backend, found via:
- `grep -rn "requireRole(\|requireModerator(\|requireContentManager(\|requireCommunityManager(\|requireSupport(\|requireEditor\|requireAdmin" backend/`
- `grep -rn "hasPermission(" backend/` — **confirmed zero call sites outside its own definition/doc-comment in `backend/utils/permissions.js:47,62`.** The spec's core claim is correct: `hasPermission()` is dead code today.
- `grep -rn "user\.role ===\|user\.role !==\|req\.user\.role" backend/routes backend/server.js` — to catch inline role checks that bypass the middleware helpers entirely.

### Dead middleware (defined, zero call sites)
- `requireCommunityManager()` (`backend/middleware/auth.js:143`) — **never called anywhere.** The `community_manager` role currently gates nothing at the route level.
- `requireSupport()` (`backend/middleware/auth.js:149`) — imported in `backend/routes/admin.js:19` but **never invoked as middleware anywhere.** The `support` role currently gates nothing at the route level either.

### `requireAdmin` call sites — `backend/routes/admin.js` (29 routes)
Lines: 32, 73, 112, 206, 274, 327, 335, 348, 365, 374, 394, 412, 438, 467, 584, 616, 705, 719, 755, 791, 1846, 1882, 1895, 1934, 1976, 2021, 2070, 2089, 2109.

### `requireModerator()` call sites — `backend/routes/admin.js` (21 routes)
Lines: 821, 879, 901, 923, 965, 1001, 1038, 1077, 1119, 1132, 1153, 1174, 1248, 1291, 1320, 1349, 1377, 1459, 1483, 1511, 1562.

### `requireContentManager()` call sites — `backend/routes/admin.js` (6 routes)
Lines: 1586, 1666, 1677, 1774, 1791, 1809.

### `requireAdmin` call sites — `backend/routes/forum.js` (16 routes)
Lines: 27, 52, 76, 788, 808, 828, 1043, 1098, 1138, 1222, 1779, 1823, 1845, 1856, 1887, 1923.

### `requireEditor` call sites — `backend/server.js` (32 routes) and `backend/routes/decks.js` (7 routes)
`server.js` lines: 642, 739, 853, 1004, 1084, 1167, 1211, 1249, 1264, 1283, 1645, 1671, 1699, 1752, 1788, 1813, 1838, 1878, 1975, 2001, 2023, 2062, 2076, 2092, 2106, 2180, 2215, 2285, 2495, 2773, 2797, 2818.
`decks.js` lines: 119, 134, 213, 226, 435, 591, 631.
`requireEditor = requireRole('admin', 'editor')` — these gate ordinary per-user collection/deck/tag/location/wishlist CRUD (create/update/delete a card, deck, tag, etc.), not admin-domain functionality.

### Inline role checks that bypass the middleware helpers entirely
- `backend/server.js:3141` — `if (req.user.role !== 'admin')` inside `GET /api/admin/collection-audit/:userId`. This route lives in `server.js`, not `admin.js`, and was never wired through `requireAdmin` at all.
- `backend/routes/forum.js:767` — `const isAdmin = req.user.role === 'admin' || req.user.isAdmin;` inside `PUT /threads/:threadId` (author-or-admin edit check).
- `backend/routes/forum.js:941` — same pattern inside `DELETE /posts/:postId` (author-or-admin delete check).
- `backend/routes/admin.js:137, 218, 290` and `backend/routes/users.js:236` and `backend/middleware/auth.js:164` (`checkMaintenanceMode`) and `backend/routes/auth.js:237` — all `role === 'admin'` / `role !== 'admin'` checks, but these are **"last admin" lockout-prevention guardrails and maintenance-mode bootstrap checks**, not authorization gates on a feature. Per the design spec's Route Protection section ("`requireRole` itself stays for the handful of places that should genuinely never be permission-configurable"), these are intentionally left as literal `role === 'admin'` checks and are **not migrated** in this plan.

### Corrections to the spec's proposed permission catalog, based on the routes actually found

1. **`decks:moderate` and `trades:moderate` have no backing route today.** `backend/routes/decks.js` has no unpublish/moderate endpoint (only the deck owner's own `PATCH /:id/visibility`, gated `requireEditor`). `backend/routes/trades.js` has no admin/moderation endpoint at all — every route is `requireAuth` only (self-service trading, no moderation surface exists yet). These two permissions are added to the catalog as **reserved, unassigned, not wired to any route** — a correction to the spec's implication that they map to real routes.
2. **`data:export` is not currently enforced anywhere.** `ROLE_PERMISSIONS.content_manager` already lists `data:export` today, but the only routes that plausibly match it — `backend/routes/admin.js` `POST /backup`, `GET /backup/:id/download`, `POST /restore`, `POST /export`, `POST /cleanup` — are all `requireAdmin`-only, and the per-user `GET /api/export/json` / `GET /api/export/csv` in `server.js:1299,1312` are `requireAuth`-only (any user can export their own collection; no role check at all). There is no clean migration target for `data:export` that doesn't either (a) silently grant `content_manager` first-time access to full-system backup/restore/wipe, or (b) invent a new permission not in the spec's proposed list. This plan deliberately does **not** migrate the backup/restore/export/cleanup routes (see "Explicitly out of scope" below) rather than risk a silent privilege escalation.
3. **`user:mute` is already listed for both `moderator` and `support` in the live `ROLE_PERMISSIONS` map**, but the only route that does anything with mutes (`POST/DELETE /mute/:userId`, `GET /mutes`, `GET /mutes/:userId`) is `requireModerator()`-gated today — `support` has never actually been able to mute anyone via any route (since `requireSupport()` is dead code, per above). Migrating to `requirePermission('user:mute')` **will** give `support` real mute access for the first time. This is flagged here explicitly (not silently) as an intentional, documented consequence of making the existing catalog real — consistent with `support`'s stated purpose (`user:view`, `feedback:read`, `user:mute`, `ticket:manage`) and the design's stated goal of making permissions real, not a bug.
4. **`user:ban` and `user:appeal:review` are new permissions** (matching the spec's proposal) that don't exist in the current `ROLE_PERMISSIONS` map at all. Since `moderator` currently has route access to account-bans and appeals via `requireModerator()`, the migration must explicitly grant `moderator`'s seeded `Role` doc these two new permissions, or moderator loses access it has today. See `Role.grantMigrationPermissions()` in Task 5.
5. **`prices:force-update` is a new permission** not in `ROLE_PERMISSIONS`. `content_manager` currently has route access via `requireContentManager()`, so the migration must explicitly grant it — same mechanism as #4.
6. **`forum:moderate`, `badges:manage`, `system:settings:manage`, `user:role:manage`, `roles:manage`** are all genuinely new permissions gating routes that are **`requireAdmin`-only today with zero non-admin access** (verified: no `requireModerator()` call sites exist in `forum.js` at all — every forum moderation route uses `requireAdmin` directly). Since `admin` always passes any `requirePermission()` check via its `'all'` permission, migrating these routes to the new permission strings requires **no seed changes** to preserve today's exact behavior — no other built-in role gains access.
7. **The spec says "6 existing roles become editable rows"** but `ROLE_PERMISSIONS` (and `User.role`'s current schema `enum`, `backend/models/User.js:33-44`) actually has **8 keys**: `admin`, `moderator`, `content_manager`, `community_manager`, `support`, `user`, plus two live legacy aliases, `editor` and `viewer` (`User.role`'s schema `default` is literally `'editor'` — this is not a hypothetical unused value). The migration seed and its regression test cover all **8**, not 6.

### Explicitly out of scope for this plan (documented, not silently dropped)
- The 39 `requireEditor` call sites (`server.js` ×32, `decks.js` ×7) gate ordinary per-user CRUD (add a card, edit a deck, etc.). Both `user` and `editor` roles already carry identical permissions (`collection:manage`, `deck:create`, `community:chat`) in the catalog, and no custom-role use case for these routes was described in the spec. Migrating 39 mechanical call sites for zero behavioral difference on the 6-8 built-in roles is deferred, consistent with the spec's own non-goal ("migrating low-traffic/rarely-touched routes can be sequenced as follow-up work rather than blocking the whole project").
- `backend/routes/admin.js` `requireAdmin` routes NOT migrated in Phase 2, and why:
  - `GET/PUT/DELETE /users`, `GET /users/:id` (lines 32, 73, 112, 206) — no existing catalog permission cleanly maps to "full user CRUD" without either inventing new scope beyond the spec's proposed catalog or risking privilege escalation for `support`'s existing (but currently unenforced) `user:view`.
  - `GET /role-history/:userId` (438), `POST /migrate` (467), `GET /activity` (584), `GET /health` (616) — read-only audit/system-diagnostic tools, admin-only by design, low value to make custom-role-configurable.
  - `POST /backup`, `GET /backup/:id/download`, `POST /restore`, `POST /export`, `POST /cleanup` (1846, 1882, 1895, 1934, 1976) — see correction #2 above.
  - `GET /forum-content`, `DELETE /forum-posts/:id`, `DELETE /forum-threads/:id`, `GET /performance` (2021, 2070, 2089, 2109) — bundled with the backup/restore/export admin-panel tooling above; same reasoning.

---

## File Structure

New files:
- `backend/models/Role.js` — the `Role` Mongoose model, plus `seedBuiltInRoles()` and `grantMigrationPermissions()` statics.
- `backend/routes/roles.js` — CRUD for the `Role` collection, mounted at `/api/admin/roles`.
- `frontend/src/components/admin/PermissionsManagement.js` — new admin UI for creating/editing/deleting roles and their permissions.

Modified files:
- `backend/utils/permissions.js` — add `getPermissionsCatalog()` and `refreshRoleCache()`; make `getPermissionsForRole()`/`hasPermission()` cache-backed.
- `backend/middleware/auth.js` — add `requirePermission(...)`.
- `backend/models/User.js` — remove the `role` field's `enum` validator.
- `backend/models/ActivityLog.js` — add `role_create`/`role_update`/`role_delete` actions and a `role` `targetType`.
- `backend/routes/admin.js` — validate role names dynamically against the `Role` collection; migrate the User Moderation, Pricing/Audit, Badges, and System Settings route domains to `requirePermission`.
- `backend/routes/forum.js` — migrate the Forum Moderation route domain to `requirePermission`; update the two inline author-or-admin checks.
- `backend/server.js` — seed roles + load the permission cache on startup; mount `backend/routes/roles.js`; migrate the one inline admin check.
- `frontend/src/components/admin/RoleManagement.js` — fetch the role list from `GET /api/admin/roles` instead of a hardcoded array.
- `frontend/src/components/admin/AdminPanel.js` — add a "Permissions" tab, gated by a real permission check instead of a hardcoded role name.

---

## Phase 1: Foundation (Role model, seeding, `requirePermission`, guardrails)

### Task 1: `Role` model — schema only

**Files:**
- Create: `backend/models/Role.js`
- Test: `backend/__tests__/role-model.test.js`

- [ ] **Step 1: Write the failing test**

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Role model', () => {
  test('creates a role with required fields and sensible defaults', async () => {
    const role = await Role.create({
      name: 'event_coordinator',
      displayName: 'Event Coordinator',
      permissions: ['community:events']
    });

    expect(role.isBuiltIn).toBe(false);
    expect(role.createdAt).toBeInstanceOf(Date);
    expect(role.updatedAt).toBeInstanceOf(Date);
  });

  test('rejects duplicate names', async () => {
    await Role.create({ name: 'dup_role', displayName: 'Dup', permissions: [] });
    await expect(
      Role.create({ name: 'dup_role', displayName: 'Dup 2', permissions: [] })
    ).rejects.toThrow();
  });

  test('requires displayName', async () => {
    await expect(
      Role.create({ name: 'no_display', permissions: [] })
    ).rejects.toThrow();
  });

  test('rejects a name with uppercase or spaces', async () => {
    await expect(
      Role.create({ name: 'Bad Name', displayName: 'Bad', permissions: [] })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest role-model.test.js`
Expected: FAIL with `Cannot find module '../models/Role'`

- [ ] **Step 3: Write the model**

```js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_]+$/, 'Role name can only contain lowercase letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  permissions: {
    type: [String],
    default: []
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

roleSchema.index({ isBuiltIn: 1 });

module.exports = mongoose.model('Role', roleSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest role-model.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/Role.js backend/__tests__/role-model.test.js
git commit -m "feat: add Role model for custom roles/permissions"
```

---

### Task 2: `getPermissionsCatalog()`

**Files:**
- Modify: `backend/utils/permissions.js`
- Test: `backend/__tests__/permissions-catalog.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { getPermissionsCatalog } = require('../utils/permissions');

describe('getPermissionsCatalog', () => {
  test('returns permissions grouped by domain, including the new admin-domain permissions', () => {
    const catalog = getPermissionsCatalog();
    const allKeys = Object.values(catalog).flat().map(p => p.key);

    expect(Object.keys(catalog)).toEqual(
      expect.arrayContaining([
        'User Management', 'Roles & Permissions', 'Forum & Community',
        'Pricing & Data', 'System', 'Collection & Decks', 'Chat'
      ])
    );

    expect(allKeys).toEqual(expect.arrayContaining([
      'user:ban', 'user:appeal:review', 'user:role:manage', 'roles:manage',
      'forum:moderate', 'badges:manage', 'system:settings:manage', 'prices:force-update',
      'decks:moderate', 'trades:moderate',
      'chat:moderate', 'comments:moderate', 'user:warn', 'user:mute', 'content:flag',
      'cards:audit', 'prices:manage', 'data:export', 'community:events',
      'announcements:manage', 'feedback:manage', 'playgroups:manage',
      'user:view', 'feedback:read', 'ticket:manage',
      'collection:manage', 'deck:create', 'community:chat', 'collection:view'
    ]));
  });

  test('every catalog entry has a string key and label', () => {
    const catalog = getPermissionsCatalog();
    for (const group of Object.values(catalog)) {
      for (const entry of group) {
        expect(typeof entry.key).toBe('string');
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest permissions-catalog.test.js`
Expected: FAIL with `getPermissionsCatalog is not a function`

- [ ] **Step 3: Add the catalog to `backend/utils/permissions.js`**

Add this block after the `STAFF_ROLES` declaration (after line 43) and before `getPermissionsForRole`:

```js
// Full permission catalog, grouped by domain, for the Permissions Management
// admin UI (frontend/src/components/admin/PermissionsManagement.js). This is
// the single source of truth for "what permissions exist" — the UI renders
// its checkbox list from GET /api/admin/roles/permissions-catalog, which
// calls getPermissionsCatalog() below, so the UI can never drift from what
// requirePermission() actually enforces.
//
// 'decks:moderate' and 'trades:moderate' are reserved: verified during the
// route audit (see docs/superpowers/plans/2026-07-09-custom-roles-permissions.md)
// that no route currently exists for community-deck or trade moderation —
// they're catalog-only until such a route is built.
const PERMISSIONS_CATALOG = {
  'User Management': [
    { key: 'user:view', label: 'View user list & profiles' },
    { key: 'user:warn', label: 'Issue warnings to users' },
    { key: 'user:mute', label: 'Mute/unmute users' },
    { key: 'user:ban', label: 'Ban/suspend user accounts' },
    { key: 'user:appeal:review', label: 'Review ban & mute appeals' },
    { key: 'user:role:manage', label: 'Assign roles to users' }
  ],
  'Roles & Permissions': [
    { key: 'roles:manage', label: 'Create, edit, and delete custom roles' }
  ],
  'Forum & Community': [
    { key: 'forum:moderate', label: 'Pin, lock, move, merge, and delete threads/posts' },
    { key: 'chat:moderate', label: 'Moderate chat messages and spam filters' },
    { key: 'comments:moderate', label: 'Moderate comments' },
    { key: 'content:flag', label: 'Flag content for review' },
    { key: 'community:events', label: 'Manage community events' },
    { key: 'announcements:manage', label: 'Post and manage announcements' },
    { key: 'feedback:manage', label: 'Manage user feedback' },
    { key: 'feedback:read', label: 'Read user feedback' },
    { key: 'playgroups:manage', label: 'Manage playgroups' },
    { key: 'badges:manage', label: 'Grant, revoke, and create badges/cosmetics' },
    { key: 'ticket:manage', label: 'Manage support tickets' }
  ],
  'Pricing & Data': [
    { key: 'cards:audit', label: 'Run and review collection audits' },
    { key: 'prices:manage', label: 'Correct individual card prices' },
    { key: 'prices:force-update', label: 'Trigger bulk price-update jobs' },
    { key: 'data:export', label: 'Export collection/system data' }
  ],
  'System': [
    { key: 'system:settings:manage', label: 'Manage system settings & maintenance mode' }
  ],
  'Collection & Decks': [
    { key: 'collection:manage', label: 'Add/edit/delete own collection cards' },
    { key: 'collection:view', label: 'View own collection (read-only)' },
    { key: 'deck:create', label: 'Create and edit decks' },
    { key: 'decks:moderate', label: 'Unpublish/moderate community decks (reserved — not yet wired to a route)' },
    { key: 'trades:moderate', label: 'Moderate trading board listings/offers (reserved — not yet wired to a route)' }
  ],
  'Chat': [
    { key: 'community:chat', label: 'Participate in community chat' }
  ]
};

/**
 * Returns the full permission catalog grouped by domain.
 * @returns {Object<string, Array<{key: string, label: string}>>}
 */
function getPermissionsCatalog() {
  return PERMISSIONS_CATALOG;
}
```

Add `getPermissionsCatalog` to the `module.exports` at the bottom of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest permissions-catalog.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/permissions.js backend/__tests__/permissions-catalog.test.js
git commit -m "feat: add getPermissionsCatalog for the Permissions Management UI"
```

---

### Task 3: Cache-backed `getPermissionsForRole()` / `hasPermission()` + `refreshRoleCache()`

**Files:**
- Modify: `backend/utils/permissions.js`
- Test: `backend/__tests__/permissions-cache.test.js`

- [ ] **Step 1: Write the failing test**

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { getPermissionsForRole, hasPermission, refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('permission cache', () => {
  test('getPermissionsForRole reads from the DB-backed cache after refreshRoleCache()', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    expect(getPermissionsForRole('event_coordinator')).toEqual(['community:events']);
  });

  test('hasPermission grants access when the role has the exact permission, denies otherwise', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(true);
    expect(hasPermission({ role: 'event_coordinator' }, 'roles:manage')).toBe(false);
  });

  test("hasPermission grants every permission when the role has 'all'", async () => {
    await Role.create({ name: 'super_admin', displayName: 'Super Admin', permissions: ['all'], isBuiltIn: true });
    await refreshRoleCache();

    expect(hasPermission({ role: 'super_admin' }, 'roles:manage')).toBe(true);
    expect(hasPermission({ role: 'super_admin' }, 'literally:anything')).toBe(true);
  });

  test('reflects permission changes after a role is updated and the cache is refreshed', async () => {
    const role = await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: [] });
    await refreshRoleCache();
    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(false);

    role.permissions = ['community:events'];
    await role.save();
    await refreshRoleCache();

    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(true);
  });

  test('falls back to the "user" default permissions for an unrecognized role once the cache is loaded', async () => {
    await refreshRoleCache(); // cache loaded, but empty (no roles seeded in this test)
    expect(getPermissionsForRole('totally_unknown_role')).toEqual(['collection:manage', 'deck:create', 'community:chat']);
  });

  test('hasPermission returns false for a missing user or missing role', () => {
    expect(hasPermission(null, 'roles:manage')).toBe(false);
    expect(hasPermission({}, 'roles:manage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest permissions-cache.test.js`
Expected: FAIL with `refreshRoleCache is not a function` (or similar — `getPermissionsForRole` still reads the frozen static map, so the first assertion mismatches)

- [ ] **Step 3: Replace the cache logic in `backend/utils/permissions.js`**

Replace the existing `getPermissionsForRole` and `hasPermission` functions (current lines 45-67) with:

```js
const Role = require('../models/Role');

// In-memory cache of role name -> permissions[], loaded from the Role
// collection. null until the first refreshRoleCache() call (e.g. at server
// startup in server.js, or explicitly in tests). Kept in memory (rather than
// hitting the DB on every request) because getPermissionsForRole() is called
// synchronously from User.toSafeObject() (backend/models/User.js), which
// itself runs on every authenticated request via verifyToken
// (backend/middleware/auth.js) — making it async would require reworking the
// entire auth pipeline.
let roleCache = null;

/**
 * Reloads the in-memory role permission cache from the Role collection.
 * Must be called after any Role document is created/updated/deleted
 * (see backend/routes/roles.js) and once at server startup (see server.js).
 * @returns {Promise<Map<string, string[]>>}
 */
async function refreshRoleCache() {
  const roles = await Role.find().lean();
  const map = new Map();
  for (const role of roles) {
    map.set(role.name, role.permissions);
  }
  roleCache = map;
  return roleCache;
}

/**
 * Returns the permission strings for a given role.
 * Reads from the in-memory cache once refreshRoleCache() has run; falls back
 * to the static ROLE_PERMISSIONS map before the cache is loaded, or for an
 * unrecognized role once the cache IS loaded, so the app stays functional
 * during startup and in tests that don't call refreshRoleCache().
 * @param {string} role
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  if (roleCache && roleCache.has(role)) {
    return roleCache.get(role);
  }
  if (roleCache) {
    return ROLE_PERMISSIONS['user'];
  }
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
}

/**
 * Returns true if the user object has a given permission.
 * A role with 'all' (by convention, only 'admin') passes every check.
 * @param {{ role: string }} user
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const perms = getPermissionsForRole(user.role);
  return perms.includes('all') || perms.includes(permission);
}
```

Add `const Role = require('../models/Role');` at the very top of the file (below any existing requires — there are none currently). Add `refreshRoleCache` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest permissions-cache.test.js`
Expected: PASS (6 tests)

Also re-run the Task 2 test to confirm nothing broke: `cd backend && npx jest permissions-catalog.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/permissions.js backend/__tests__/permissions-cache.test.js
git commit -m "feat: make getPermissionsForRole/hasPermission read from a DB-backed cache"
```

---

### Task 4: `Role.seedBuiltInRoles()`

**Files:**
- Modify: `backend/models/Role.js`
- Test: `backend/__tests__/role-seed.test.js`

- [ ] **Step 1: Write the failing test**

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { ROLE_PERMISSIONS } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Role.seedBuiltInRoles', () => {
  test('creates one Role doc per ROLE_PERMISSIONS key (8 built-in roles) with matching permissions', async () => {
    await Role.seedBuiltInRoles();

    const roles = await Role.find().lean();
    expect(roles).toHaveLength(8);

    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const doc = roles.find(r => r.name === name);
      expect(doc).toBeDefined();
      expect(doc.isBuiltIn).toBe(true);
      expect(doc.permissions).toEqual(permissions);
    }
  });

  test('sets a human-readable displayName for every built-in role', async () => {
    await Role.seedBuiltInRoles();
    const contentManager = await Role.findOne({ name: 'content_manager' });
    expect(contentManager.displayName).toBe('Content Manager');
  });

  test('is idempotent and does not clobber a manually-edited built-in role', async () => {
    await Role.seedBuiltInRoles();
    await Role.updateOne({ name: 'moderator' }, { $set: { permissions: ['chat:moderate'] } });

    await Role.seedBuiltInRoles(); // re-run, e.g. simulating a server restart

    const moderator = await Role.findOne({ name: 'moderator' });
    expect(moderator.permissions).toEqual(['chat:moderate']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest role-seed.test.js`
Expected: FAIL with `Role.seedBuiltInRoles is not a function`

- [ ] **Step 3: Add the static to `backend/models/Role.js`**

Add before `module.exports`:

```js
/**
 * Seeds the Role collection from the historical ROLE_PERMISSIONS map
 * (backend/utils/permissions.js), one Role doc per key, isBuiltIn: true.
 * Idempotent (upsert with $setOnInsert, mirroring
 * SystemSettings.initializeDefaults() in backend/models/SystemSettings.js) —
 * safe to call on every server start; never overwrites an admin's
 * subsequent edits to a built-in role's permissions.
 */
roleSchema.statics.seedBuiltInRoles = async function() {
  const { ROLE_PERMISSIONS } = require('../utils/permissions');

  const displayNames = {
    admin: 'Admin',
    moderator: 'Moderator',
    content_manager: 'Content Manager',
    community_manager: 'Community Manager',
    support: 'Support',
    user: 'User',
    editor: 'Editor',
    viewer: 'Viewer'
  };

  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await this.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          displayName: displayNames[name] || name,
          permissions: [...permissions],
          isBuiltIn: true
        }
      },
      { upsert: true }
    );
  }
};
```

Note: `require('../utils/permissions')` is deliberately *inside* the function body, not at the top of the file — `utils/permissions.js` requires `../models/Role` at its own top level (Task 3), so a top-level require here would be circular. Requiring it lazily, only when the static is actually called, avoids that.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest role-seed.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models/Role.js backend/__tests__/role-seed.test.js
git commit -m "feat: add Role.seedBuiltInRoles() migration"
```

---

### Task 5: `Role.grantMigrationPermissions()`

**Files:**
- Modify: `backend/models/Role.js`
- Test: `backend/__tests__/role-seed.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/__tests__/role-seed.test.js`:

```js
describe('Role.grantMigrationPermissions', () => {
  test('adds user:ban and user:appeal:review to moderator, prices:force-update to content_manager', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();

    const moderator = await Role.findOne({ name: 'moderator' });
    expect(moderator.permissions).toEqual(expect.arrayContaining(['user:ban', 'user:appeal:review']));

    const contentManager = await Role.findOne({ name: 'content_manager' });
    expect(contentManager.permissions).toEqual(expect.arrayContaining(['prices:force-update']));
  });

  test('does not touch roles that need no migration grant', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();

    const admin = await Role.findOne({ name: 'admin' });
    expect(admin.permissions).toEqual(['all']);
  });

  test('is idempotent — does not duplicate permissions when run twice', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.grantMigrationPermissions();

    const moderator = await Role.findOne({ name: 'moderator' });
    const banCount = moderator.permissions.filter(p => p === 'user:ban').length;
    expect(banCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest role-seed.test.js`
Expected: FAIL with `Role.grantMigrationPermissions is not a function`

- [ ] **Step 3: Add the static to `backend/models/Role.js`**

Add after `seedBuiltInRoles`:

```js
/**
 * Grants a small number of NEW catalog permissions — introduced when route
 * protection was migrated from requireRole()/requireModerator()/
 * requireContentManager() to requirePermission() (Phase 2 of
 * docs/superpowers/plans/2026-07-09-custom-roles-permissions.md) — to the
 * built-in roles that already had route-level access via the old
 * requireRole()-family middleware, so migrating route protection does not
 * silently take access away from anyone.
 *
 * Deliberately NOT folded into seedBuiltInRoles()/ROLE_PERMISSIONS, so the
 * seed-from-ROLE_PERMISSIONS regression test (role-seed.test.js,
 * 'creates one Role doc per ROLE_PERMISSIONS key... with matching
 * permissions') stays an exact-match check against the historical map.
 *
 * Idempotent ($addToSet) — safe to call on every server start.
 */
roleSchema.statics.grantMigrationPermissions = async function() {
  // moderator gained the account-ban and appeal-review routes
  // (backend/routes/admin.js account-bans + /appeals + /ban-appeals
  // endpoints, previously requireModerator()) when migrated to
  // requirePermission('user:ban') / requirePermission('user:appeal:review').
  await this.updateOne(
    { name: 'moderator' },
    { $addToSet: { permissions: { $each: ['user:ban', 'user:appeal:review'] } } }
  );

  // content_manager gained the force-price-update job endpoints
  // (backend/routes/admin.js POST/GET /force-price-update*, previously
  // requireContentManager()) when migrated to
  // requirePermission('prices:force-update').
  await this.updateOne(
    { name: 'content_manager' },
    { $addToSet: { permissions: 'prices:force-update' } }
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest role-seed.test.js`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add backend/models/Role.js backend/__tests__/role-seed.test.js
git commit -m "feat: add Role.grantMigrationPermissions() to preserve access on route migration"
```

---

### Task 6: Wire seeding + cache load into `server.js` startup

**Files:**
- Modify: `backend/server.js:1-27` (requires), `backend/server.js:81-90` (connect block)

- [ ] **Step 1: Add requires**

In `backend/server.js`, after line 27 (`const User = require('./models/User');`):

```js
const Role = require('./models/Role');
const { refreshRoleCache } = require('./utils/permissions');
```

- [ ] **Step 2: Update the MongoDB connect block**

Replace `backend/server.js:81-90`:

```js
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('MongoDB connected successfully');
  // Initialize system settings if multi-user mode is enabled
  if (isMultiUserEnabled()) {
    await SystemSettings.initializeDefaults();
    console.log('Multi-user mode enabled - system settings initialized');
  }
})
.catch(err => console.error('MongoDB connection error:', err));
```

with:

```js
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('MongoDB connected successfully');
  // Initialize system settings if multi-user mode is enabled
  if (isMultiUserEnabled()) {
    await SystemSettings.initializeDefaults();
    console.log('Multi-user mode enabled - system settings initialized');
  }
  // Seed built-in roles (Role collection) and load the in-memory permission
  // cache used by getPermissionsForRole()/hasPermission()
  // (backend/utils/permissions.js). Runs regardless of multi-user mode so
  // the Role collection and cache are always consistent.
  await Role.seedBuiltInRoles();
  await Role.grantMigrationPermissions();
  await refreshRoleCache();
  console.log('Roles seeded and permission cache loaded');
})
.catch(err => console.error('MongoDB connection error:', err));
```

- [ ] **Step 3: Manually verify the server boots cleanly**

Run: `cd backend && node -e "require('./server.js')"` against a local/test MongoDB URI (or start it normally per `start-both-servers.bat` per project convention) and confirm the console prints `Roles seeded and permission cache loaded` with no errors, then stop the process (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: seed roles and load permission cache on server startup"
```

---

### Task 7: `requirePermission(...)` middleware

**Files:**
- Modify: `backend/middleware/auth.js`
- Test: `backend/__tests__/require-permission-middleware.test.js`

- [ ] **Step 1: Write the failing test**

```js
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');
const { requirePermission } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = jest.fn(code => { res.statusCode = code; return res; });
  res.json = jest.fn(body => { res.body = body; return res; });
  return res;
}

describe('requirePermission middleware', () => {
  test("calls next() when the user's role has the exact permission", async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    const middleware = requirePermission('community:events');
    const req = { user: { role: 'event_coordinator' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("calls next() when the user's role has 'all'", async () => {
    await Role.create({ name: 'admin', displayName: 'Admin', permissions: ['all'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('roles:manage');
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 403 FORBIDDEN when the role lacks all required permissions', async () => {
    await Role.create({ name: 'viewer', displayName: 'Viewer', permissions: ['collection:view'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('roles:manage');
    const req = { user: { role: 'viewer' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.requiredPermissions).toEqual(['roles:manage']);
  });

  test('passes when the role has ANY of several required permissions (OR semantics)', async () => {
    await Role.create({ name: 'moderator', displayName: 'Moderator', permissions: ['user:ban'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('user:ban', 'user:appeal:review');
    const req = { user: { role: 'moderator' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 401 UNAUTHORIZED when there is no authenticated user', () => {
    const middleware = requirePermission('roles:manage');
    const req = { user: null };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest require-permission-middleware.test.js`
Expected: FAIL with `requirePermission is not a function`

- [ ] **Step 3: Add `requirePermission` to `backend/middleware/auth.js`**

Add `const { hasPermission } = require('../utils/permissions');` after the existing requires at the top of the file (line 3, after `const SystemSettings = ...`).

Add after `requireRole` (after line 115, before the `requireEditor` definition):

```js
/**
 * Require specific permission(s) — passes if the user's role has ANY of the
 * listed permissions (or 'all'). Must be used after requireAuth.
 * Looks up the user's permissions via hasPermission()
 * (backend/utils/permissions.js), which reads the in-memory Role cache —
 * refreshed whenever a Role document changes (see backend/routes/roles.js).
 * @param {...string} permissions - Any one of these grants access
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    // If multi-user is not enabled, allow all requests
    if (!isMultiUserEnabled()) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const allowed = permissions.some(permission => hasPermission(req.user, permission));

    if (!allowed) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredPermissions: permissions,
        currentRole: req.user.role
      });
    }

    next();
  };
};
```

Add `requirePermission` to `module.exports` at the bottom of the file (alongside `requireRole`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest require-permission-middleware.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/auth.js backend/__tests__/require-permission-middleware.test.js
git commit -m "feat: add requirePermission middleware"
```

---

### Task 8: Remove `User.role` enum validator; validate dynamically at assignment time

**Files:**
- Modify: `backend/models/User.js:31-46`
- Modify: `backend/routes/admin.js` (top requires, `PUT /users/:id` handler at lines 112-200, `PUT /users/:userId/role` handler at lines 274-322)
- Test: `backend/__tests__/user-role-validation.test.js`

**Why both handlers:** `PUT /api/admin/users/:id` (the general user-update endpoint) currently has **no explicit role validation at all** — it relies entirely on the Mongoose schema's `enum` to reject bad values on `.save()`. Removing the `enum` without adding an explicit check here would let this endpoint set `user.role` to *any* arbitrary string with zero validation, a real regression. `PUT /api/admin/users/:userId/role` (the dedicated role-assignment endpoint) already has an explicit check (`Object.keys(ROLE_PERMISSIONS)`), but that check must move from the static `ROLE_PERMISSIONS` map to the dynamic `Role` collection so newly-created custom roles are assignable.

- [ ] **Step 1: Write the failing test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('Dynamic role validation', () => {
  let app, admin, target;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    target = await User.create({ email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('PUT /users/:userId/role accepts a newly-created custom role name', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'event_coordinator' })
      .expect(200);

    expect(res.body.newRole).toBe('event_coordinator');
  });

  test('PUT /users/:userId/role rejects a role name that does not exist', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'not_a_real_role' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_ROLE');
  });

  test('PUT /users/:id (general update) rejects a role name that does not exist', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ role: 'not_a_real_role' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_ROLE');
  });

  test('PUT /users/:id (general update) accepts a valid built-in role', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ role: 'moderator' })
      .expect(200);

    expect(res.body.role).toBe('moderator');
  });

  test('User schema no longer rejects a custom role name via enum validation', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: [] });
    const user = new User({
      email: 'custom@test.com', username: 'customrole', passwordHash: 'x', role: 'event_coordinator'
    });
    await expect(user.save()).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest user-role-validation.test.js`
Expected: FAIL — the last test fails because `role` still has a Mongoose `enum` rejecting `'event_coordinator'`; the `PUT /users/:id` tests fail because there's no `INVALID_ROLE` check yet on that route.

- [ ] **Step 3a: Remove the enum from `backend/models/User.js`**

Replace `backend/models/User.js:31-46`:

```js
  role: {
    type: String,
    enum: [
      // Staff roles (Phase 2)
      'admin',
      'moderator',
      'content_manager',
      'community_manager',
      'support',
      'user',
      // Legacy roles (kept for backward compatibility — existing users)
      'editor',
      'viewer'
    ],
    default: 'editor'
  },
```

with:

```js
  role: {
    type: String,
    // No enum validator: valid role names now live in the Role collection
    // (backend/models/Role.js) so custom roles can be created without a code
    // change. Existence is validated at assignment time in the route
    // handlers (see backend/routes/admin.js PUT /users/:id and
    // PUT /users/:userId/role, and backend/routes/roles.js) — not here at
    // the schema level.
    default: 'editor'
  },
```

- [ ] **Step 3b: Add `Role` import to `backend/routes/admin.js`**

After line 18 (`const ForumCategory = require('../models/ForumCategory');`), add:

```js
const Role = require('../models/Role');
```

- [ ] **Step 3c: Add validation to `PUT /users/:id`**

In `backend/routes/admin.js`, inside the `router.put('/users/:id', requireAdmin, ...)` handler, replace:

```js
    const { role, isActive, displayName } = req.body;

    // Prevent admin from demoting themselves if they're the only admin
```

with:

```js
    const { role, isActive, displayName } = req.body;

    if (role) {
      const validRoleNames = await Role.distinct('name');
      if (!validRoleNames.includes(role)) {
        return res.status(400).json({ message: 'Invalid role', code: 'INVALID_ROLE' });
      }
    }

    // Prevent admin from demoting themselves if they're the only admin
```

- [ ] **Step 3d: Switch `PUT /users/:userId/role` to the dynamic role list**

In `backend/routes/admin.js:279`, replace:

```js
    const validRoles = Object.keys(ROLE_PERMISSIONS);
```

with:

```js
    const validRoles = await Role.distinct('name');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest user-role-validation.test.js`
Expected: PASS (5 tests)

Also re-run everything touched so far to confirm no regression:
Run: `cd backend && npx jest role-model role-seed permissions-catalog permissions-cache require-permission-middleware user-role-validation`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models/User.js backend/routes/admin.js backend/__tests__/user-role-validation.test.js
git commit -m "feat: validate role assignment against the Role collection instead of a fixed enum"
```

---

### Task 9: `ActivityLog` — add role CRUD actions

**Files:**
- Modify: `backend/models/ActivityLog.js:14-81`

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/activity-log-role-actions.test.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('ActivityLog role actions', () => {
  test('accepts role_create, role_update, role_delete actions with targetType "role"', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'a1', passwordHash: 'x', role: 'admin' });
    const roleId = new mongoose.Types.ObjectId();

    for (const action of ['role_create', 'role_update', 'role_delete']) {
      const log = await ActivityLog.log({
        userId: user._id,
        action,
        category: 'admin',
        targetType: 'role',
        targetId: roleId,
        targetName: 'event_coordinator'
      });
      expect(log.action).toBe(action);
      expect(log.targetType).toBe('role');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest activity-log-role-actions.test.js`
Expected: FAIL with a Mongoose `ValidationError` (`action` and/or `targetType` not in `enum`)

- [ ] **Step 3: Update `backend/models/ActivityLog.js`**

In the `action` enum (lines 17-72), after `'user_activate',` (line 63), add:

```js
      'role_create',
      'role_update',
      'role_delete',
```

In the `targetType` enum (line 81), replace:

```js
    enum: ['card', 'deck', 'wishlist', 'location', 'tag', 'user', 'session', 'settings', null]
```

with:

```js
    enum: ['card', 'deck', 'wishlist', 'location', 'tag', 'user', 'session', 'settings', 'role', null]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest activity-log-role-actions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models/ActivityLog.js backend/__tests__/activity-log-role-actions.test.js
git commit -m "feat: add role_create/role_update/role_delete ActivityLog actions"
```

---

### Task 10: `backend/routes/roles.js` — CRUD + guardrails

**Files:**
- Create: `backend/routes/roles.js`
- Test: `backend/__tests__/admin-roles-routes.test.js`

**Design note on the two guardrails:** implemented inside `PUT /:id`, matching the "last admin" guardrail style already in `backend/routes/admin.js:126-134` (400 status, `message` + machine-readable `code`).

**Design note on `GET /`:** the existing role-*assignment* UI (`RoleManagement.js`, Task 17) needs to list role names for its dropdown but does not need full `roles:manage` CRUD access — so `GET /` (list) accepts *either* `roles:manage` or `user:role:manage`, while every other route in this file requires `roles:manage` specifically.

- [ ] **Step 1: Write the failing test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/roles', require('../routes/roles'));
  return app;
}

describe('Admin roles routes', () => {
  let app, admin, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('GET / lists all 8 seeded built-in roles for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.roles).toHaveLength(8);
    expect(res.body.roles.map(r => r.name)).toEqual(
      expect.arrayContaining(['admin', 'moderator', 'content_manager', 'community_manager', 'support', 'user', 'editor', 'viewer'])
    );
  });

  test('GET / is denied for a role without roles:manage or user:role:manage (moderator, before any grant)', async () => {
    await request(app)
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('GET /permissions-catalog returns the catalog grouped by domain', async () => {
    const res = await request(app)
      .get('/api/admin/roles/permissions-catalog')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.catalog).toHaveProperty('User Management');
  });

  test('POST / creates a custom role', async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] })
      .expect(201);

    expect(res.body.role.name).toBe('event_coordinator');
    expect(res.body.role.isBuiltIn).toBe(false);

    const stored = await Role.findOne({ name: 'event_coordinator' });
    expect(stored.permissions).toEqual(['community:events']);
  });

  test("POST / rejects assigning 'all' to a custom role", async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'super_role', displayName: 'Super Role', permissions: ['all'] })
      .expect(400);

    expect(res.body.code).toBe('CANNOT_ASSIGN_ALL');
  });

  test('POST / rejects a duplicate role name', async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'moderator', displayName: 'Duplicate', permissions: [] })
      .expect(409);

    expect(res.body.code).toBe('ROLE_NAME_EXISTS');
  });

  test("PUT /:id blocks removing 'all' from the last all-access role", async () => {
    const adminRole = await Role.findOne({ name: 'admin' });

    const res = await request(app)
      .put(`/api/admin/roles/${adminRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ permissions: [] })
      .expect(400);

    expect(res.body.code).toBe('LAST_ALL_ACCESS_ROLE');
  });

  test('PUT /:id blocks removing roles:manage from your own only-role-with-it', async () => {
    const modRole = await Role.findOne({ name: 'moderator' });
    modRole.permissions = [...modRole.permissions, 'roles:manage'];
    await modRole.save();
    await refreshRoleCache();

    const withoutRolesManage = modRole.permissions.filter(p => p !== 'roles:manage');

    const res = await request(app)
      .put(`/api/admin/roles/${modRole._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ permissions: withoutRolesManage })
      .expect(400);

    expect(res.body.code).toBe('LAST_ROLES_MANAGE_HOLDER');
  });

  test('PUT /:id allows editing a built-in role when the guardrails do not apply', async () => {
    const supportRole = await Role.findOne({ name: 'support' });

    const res = await request(app)
      .put(`/api/admin/roles/${supportRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ displayName: 'Support Staff', permissions: [...supportRole.permissions, 'ticket:manage'] })
      .expect(200);

    expect(res.body.role.displayName).toBe('Support Staff');
  });

  test('DELETE /:id blocks deleting a built-in role', async () => {
    const modRole = await Role.findOne({ name: 'moderator' });
    const res = await request(app)
      .delete(`/api/admin/roles/${modRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(400);
    expect(res.body.code).toBe('CANNOT_DELETE_BUILT_IN');
  });

  test('DELETE /:id blocks deleting a custom role that a user still holds', async () => {
    const custom = await Role.create({ name: 'temp_role', displayName: 'Temp Role', permissions: [], isBuiltIn: false });
    await refreshRoleCache();
    await User.create({ email: 'holder@test.com', username: 'holder', passwordHash: 'x', role: 'temp_role' });

    const res = await request(app)
      .delete(`/api/admin/roles/${custom._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(400);
    expect(res.body.code).toBe('ROLE_IN_USE');
  });

  test('DELETE /:id deletes an unused custom role', async () => {
    const custom = await Role.create({ name: 'temp_role2', displayName: 'Temp Role 2', permissions: [], isBuiltIn: false });
    await refreshRoleCache();

    await request(app)
      .delete(`/api/admin/roles/${custom._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(await Role.findById(custom._id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest admin-roles-routes.test.js`
Expected: FAIL with `Cannot find module '../routes/roles'`

- [ ] **Step 3: Create `backend/routes/roles.js`**

```js
const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const User = require('../models/User');
const { verifyToken, requireAuth, requirePermission } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');
const { getPermissionsCatalog, refreshRoleCache } = require('../utils/permissions');

router.use(verifyToken);
router.use(requireAuth);

/**
 * GET /api/admin/roles - list all roles (built-in and custom)
 * Accepts either roles:manage (full role editor) or user:role:manage (the
 * existing role-ASSIGNMENT UI, which only needs the name/displayName list to
 * populate its dropdown) — see RoleManagement.js vs PermissionsManagement.js.
 */
router.get('/', requirePermission('roles:manage', 'user:role:manage'), async (req, res) => {
  try {
    const roles = await Role.find().sort({ isBuiltIn: -1, name: 1 });
    res.json({ roles });
  } catch (error) {
    console.error('List roles error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/roles/permissions-catalog - full permission catalog grouped by domain
router.get('/permissions-catalog', requirePermission('roles:manage'), (req, res) => {
  res.json({ catalog: getPermissionsCatalog() });
});

// POST /api/admin/roles - create a custom role
router.post('/', requirePermission('roles:manage'), async (req, res) => {
  try {
    const { name, displayName, permissions = [] } = req.body;

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
      return res.status(400).json({
        message: 'name is required and can only contain lowercase letters, numbers, and underscores',
        code: 'INVALID_ROLE_NAME'
      });
    }
    if (!displayName) {
      return res.status(400).json({ message: 'displayName is required', code: 'MISSING_DISPLAY_NAME' });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'permissions must be an array', code: 'INVALID_PERMISSIONS' });
    }
    if (permissions.includes('all')) {
      return res.status(400).json({
        message: "'all' cannot be assigned to a custom role",
        code: 'CANNOT_ASSIGN_ALL'
      });
    }

    const existing = await Role.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: `Role '${name}' already exists`, code: 'ROLE_NAME_EXISTS' });
    }

    const role = await Role.create({
      name: name.toLowerCase(),
      displayName,
      permissions,
      isBuiltIn: false
    });

    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_create',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      details: { permissions },
      ipAddress: getClientIp(req)
    });

    res.status(201).json({ role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/admin/roles/:id - update a role's displayName/permissions (built-in roles included)
router.put('/:id', requirePermission('roles:manage'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });
    }

    const { displayName, permissions } = req.body;

    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: 'permissions must be an array', code: 'INVALID_PERMISSIONS' });
      }
      if (!role.isBuiltIn && permissions.includes('all')) {
        return res.status(400).json({
          message: "'all' cannot be assigned to a custom role",
          code: 'CANNOT_ASSIGN_ALL'
        });
      }

      // Guardrail 1: can't remove 'all' from the last role that has it
      if (role.permissions.includes('all') && !permissions.includes('all')) {
        const otherAllCount = await Role.countDocuments({
          _id: { $ne: role._id },
          permissions: 'all'
        });
        if (otherAllCount === 0) {
          return res.status(400).json({
            message: "Cannot remove 'all' access from the last role that grants it. Assign 'all' to another role first.",
            code: 'LAST_ALL_ACCESS_ROLE'
          });
        }
      }

      // Guardrail 2: can't remove roles:manage from your OWN current role if no other role has it
      const editingOwnRole = req.user.role === role.name;
      const hadRolesManage = role.permissions.includes('roles:manage') || role.permissions.includes('all');
      const willHaveRolesManage = permissions.includes('roles:manage') || permissions.includes('all');
      if (editingOwnRole && hadRolesManage && !willHaveRolesManage) {
        const otherHolders = await Role.countDocuments({
          _id: { $ne: role._id },
          $or: [{ permissions: 'roles:manage' }, { permissions: 'all' }]
        });
        if (otherHolders === 0) {
          return res.status(400).json({
            message: "Cannot remove 'roles:manage' from your own role — no other role would be able to manage roles.",
            code: 'LAST_ROLES_MANAGE_HOLDER'
          });
        }
      }

      role.permissions = permissions;
    }

    if (displayName !== undefined) {
      role.displayName = displayName;
    }

    await role.save();
    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_update',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      details: { displayName, permissions },
      ipAddress: getClientIp(req)
    });

    res.json({ role });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/admin/roles/:id - delete a custom role
router.delete('/:id', requirePermission('roles:manage'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });
    }
    if (role.isBuiltIn) {
      return res.status(400).json({ message: 'Cannot delete a built-in role', code: 'CANNOT_DELETE_BUILT_IN' });
    }

    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role '${role.name}' — ${usersWithRole} user(s) currently hold it. Reassign them first.`,
        code: 'ROLE_IN_USE'
      });
    }

    await role.deleteOne();
    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_delete',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      ipAddress: getClientIp(req)
    });

    res.json({ message: `Role '${role.name}' deleted` });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest admin-roles-routes.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/roles.js backend/__tests__/admin-roles-routes.test.js
git commit -m "feat: add /api/admin/roles CRUD routes with lockout guardrails"
```

---

### Task 11: Mount the roles router

**Files:**
- Modify: `backend/server.js:9` (requires), `backend/server.js:148` (mounts)

- [ ] **Step 1: Add the require**

After `backend/server.js:9` (`const adminRoutes = require('./routes/admin');`), add:

```js
const rolesRoutes = require('./routes/roles');
```

- [ ] **Step 2: Mount it**

After `backend/server.js:148` (`app.use('/api/admin', adminRoutes);`), add:

```js
app.use('/api/admin/roles', rolesRoutes);
```

- [ ] **Step 3: Manually verify**

Start the backend per project convention (`start-both-servers.bat`), then with a valid admin JWT:

```bash
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/admin/roles
```

Expected: JSON body with `{ "roles": [ ...8 built-in roles... ] }`.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: mount /api/admin/roles router"
```

---

**End of Phase 1.** At this point the system has a working, fully-tested `Role` collection, `requirePermission` middleware, and a role-management API — but no existing route yet uses `requirePermission`. Phase 2 wires it in.

---

## Phase 2: Migrate route call sites, domain by domain

Each task below is a mechanical, one-line-per-route middleware swap (`requireModerator()` → `requirePermission('x')`, etc.) followed by a smoke test confirming the swap preserves (or, where explicitly noted in the Route Inventory corrections, intentionally changes) access for the built-in roles. Per the spec's own testing guidance ("route-level smoke tests for **a sample** of migrated routes"), each task tests 2-4 representative routes per domain rather than re-testing every single line (the `requirePermission` grant/deny logic itself is already exhaustively unit-tested in Task 7).

### Task 12: Domain 1 — User moderation actions (`backend/routes/admin.js`)

**Files:**
- Modify: `backend/routes/admin.js` (imports at line 19, and the 22 route lines below)
- Test: `backend/__tests__/admin-user-moderation-permissions.test.js`

**Middleware swaps** (all in `backend/routes/admin.js`):

| Line | Route | Old | New |
|---|---|---|---|
| 274 | `PUT /users/:userId/role` | `requireAdmin` | `requirePermission('user:role:manage')` |
| 821 | `POST /mute/:userId` | `requireModerator()` | `requirePermission('user:mute')` |
| 879 | `POST /unmute/:userId` | `requireModerator()` | `requirePermission('user:mute')` |
| 901 | `DELETE /mute/:userId` | `requireModerator()` | `requirePermission('user:mute')` |
| 923 | `GET /mutes` | `requireModerator()` | `requirePermission('user:mute')` |
| 965 | `GET /mutes/:userId` | `requireModerator()` | `requirePermission('user:mute')` |
| 1001 | `GET /appeals` | `requireModerator()` | `requirePermission('user:appeal:review')` |
| 1038 | `POST /appeals/:banId/approve` | `requireModerator()` | `requirePermission('user:appeal:review')` |
| 1077 | `POST /appeals/:banId/reject` | `requireModerator()` | `requirePermission('user:appeal:review')` |
| 1119 | `GET /spam-config` | `requireModerator()` | `requirePermission('chat:moderate')` |
| 1132 | `PUT /spam-config` | `requireModerator()` | `requirePermission('chat:moderate')` |
| 1153 | `POST /spam-config/test` | `requireModerator()` | `requirePermission('chat:moderate')` |
| 1174 | `POST /modmail` | `requireModerator()` | `requirePermission('chat:moderate')` |
| 1248 | `POST /account-bans` | `requireModerator()` | `requirePermission('user:ban')` |
| 1291 | `GET /account-bans` | `requireModerator()` | `requirePermission('user:ban')` |
| 1320 | `PUT /account-bans/:id` | `requireModerator()` | `requirePermission('user:ban')` |
| 1349 | `DELETE /account-bans/:id` | `requireModerator()` | `requirePermission('user:ban')` |
| 1377 | `POST /warnings` | `requireModerator()` | `requirePermission('user:warn')` |
| 1459 | `GET /warnings/:userId` | `requireModerator()` | `requirePermission('user:warn')` |
| 1483 | `GET /ban-appeals` | `requireModerator()` | `requirePermission('user:appeal:review')` |
| 1511 | `PUT /ban-appeals/:id` | `requireModerator()` | `requirePermission('user:appeal:review')` |
| 1562 | `GET /moderation-history/:userId` | `requireModerator()` | `requirePermission('user:ban', 'user:appeal:review', 'user:warn')` |

For each row, the edit is: find `router.<method>('<route>', <Old>, async (req, res) => {` and replace `<Old>` with `<New>`. For example, line 821 changes from:

```js
router.post('/mute/:userId', requireModerator(), async (req, res) => {
```

to:

```js
router.post('/mute/:userId', requirePermission('user:mute'), async (req, res) => {
```

- [ ] **Step 1: Update the import line**

`backend/routes/admin.js:19` currently reads:

```js
const { verifyToken, requireAuth, requireAdmin, requireModerator, requireContentManager, requireSupport, isMultiUserEnabled } = require('../middleware/auth');
```

`requireModerator` becomes fully unused after this task's swaps (all 21 call sites migrate), and `requireSupport` was already dead code (Route Inventory). `requireContentManager` is still used by Task 13 (Domain 2), so keep it for now. Replace with:

```js
const { verifyToken, requireAuth, requireAdmin, requireContentManager, requirePermission, isMultiUserEnabled } = require('../middleware/auth');
```

- [ ] **Step 2: Write the failing smoke test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('User moderation route permissions', () => {
  let app, admin, moderator, viewer;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    viewer = await User.create({ email: 'viewer@test.com', username: 'viewer1', passwordHash: 'x', role: 'viewer' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('moderator (with user:ban via grantMigrationPermissions) can list account bans', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
  });

  test('viewer (no user:ban permission) cannot list account bans', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .expect(403);
  });

  test('admin (via "all") can list account bans and mutes', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .get('/api/admin/mutes')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
  });

  test('moderator (with user:appeal:review via grantMigrationPermissions) can list ban appeals', async () => {
    await request(app)
      .get('/api/admin/ban-appeals')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
  });

  test('only a role with user:role:manage can reassign a user role', async () => {
    const target = await User.create({ email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user' });

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ newRole: 'support' })
      .expect(403);

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'support' })
      .expect(200);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest admin-user-moderation-permissions.test.js`
Expected: FAIL — `moderator` currently passes `requireModerator()` for account-bans (200 already), but `viewer` also currently gets 401/403 either way, so the most informative failure is the `user:role:manage` test: today `PUT /users/:userId/role` is `requireAdmin`, so moderator already gets 403 there too. The real signal is: run this test file *before* Step 4 against the *current* (unmigrated) code and confirm `GET /api/admin/account-bans` for `moderator` still passes (it does, via the old `requireModerator()`) — the point of Step 3 here is to confirm the test suite runs and exercises real routes; most assertions will already pass against the old code because `moderator`'s access is unchanged. Confirm this by running the suite once now and noting the count, then re-run after Step 4's edits and confirm the count is unchanged (this documents "no regression," which is the actual goal of this task, not "prove a bug exists").

- [ ] **Step 4: Apply all 22 middleware swaps from the table above**

Use the exact old-string/new-string pairs from the table. After all edits, `requireModerator` must have zero remaining call sites in `backend/routes/admin.js`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest admin-user-moderation-permissions.test.js`
Expected: PASS (5 tests)

Also re-run the full admin-routes-adjacent suite to confirm nothing else broke:
Run: `cd backend && npx jest admin-roles-routes user-role-validation admin-user-moderation-permissions`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/admin-user-moderation-permissions.test.js
git commit -m "refactor: migrate user moderation routes to requirePermission"
```

---

### Task 13: Domain 2 — Pricing / content audit (`backend/routes/admin.js`, `backend/server.js`)

**Files:**
- Modify: `backend/routes/admin.js` (imports, 6 route lines)
- Modify: `backend/server.js:16` (imports), `backend/server.js:3140-3143`
- Test: `backend/__tests__/admin-pricing-audit-permissions.test.js`

**Middleware swaps in `backend/routes/admin.js`:**

| Line | Route | Old | New |
|---|---|---|---|
| 1586 | `POST /force-price-update` | `requireContentManager()` | `requirePermission('prices:force-update')` |
| 1666 | `GET /force-price-update/:jobId` | `requireContentManager()` | `requirePermission('prices:force-update')` |
| 1677 | `POST /audits/run` | `requireContentManager()` | `requirePermission('cards:audit')` |
| 1774 | `GET /audits` | `requireContentManager()` | `requirePermission('cards:audit')` |
| 1791 | `GET /audits/:id` | `requireContentManager()` | `requirePermission('cards:audit')` |
| 1809 | `PUT /audits/:id/action` | `requireContentManager()` | `requirePermission('cards:audit')` |

- [ ] **Step 1: Update the `backend/routes/admin.js` import line**

`requireContentManager` becomes fully unused after this task. Replace the line from Task 12's Step 1:

```js
const { verifyToken, requireAuth, requireAdmin, requireContentManager, requirePermission, isMultiUserEnabled } = require('../middleware/auth');
```

with:

```js
const { verifyToken, requireAuth, requireAdmin, requirePermission, isMultiUserEnabled } = require('../middleware/auth');
```

- [ ] **Step 2: Write the failing smoke test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('Pricing/audit route permissions', () => {
  let app, contentManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    contentManager = await User.create({ email: 'cm@test.com', username: 'cm1', passwordHash: 'x', role: 'content_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('content_manager (with prices:force-update via grantMigrationPermissions) can start a force-price-update job', async () => {
    const res = await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .expect(200);

    expect(res.body.jobId).toBeDefined();
  });

  test('moderator (no prices:force-update or cards:audit) cannot start a force-price-update job or audit', async () => {
    await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);

    await request(app)
      .post('/api/admin/audits/run')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('content_manager can run a collection audit (cards:audit, unchanged by migration)', async () => {
    await request(app)
      .post('/api/admin/audits/run')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .expect(201);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest admin-pricing-audit-permissions.test.js`
Expected: FAIL — since these routes are still `requireContentManager()`-gated, `moderator` currently already gets 403 (that part passes), but confirm the file runs cleanly against the pre-migration code as a baseline.

- [ ] **Step 4: Apply the 6 middleware swaps in `backend/routes/admin.js`**

- [ ] **Step 5: Migrate the `server.js` inline check**

Add `requirePermission` to `backend/server.js:16`'s destructure:

```js
const { isMultiUserEnabled, verifyToken, requireAuth, requireEditor, requirePermission, checkMaintenanceMode } = require('./middleware/auth');
```

Replace `backend/server.js:3140-3143`:

```js
app.get('/api/admin/collection-audit/:userId', verifyToken, requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }

  try {
```

with:

```js
app.get('/api/admin/collection-audit/:userId', verifyToken, requireAuth, requirePermission('cards:audit'), async (req, res) => {
  try {
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest admin-pricing-audit-permissions.test.js`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/routes/admin.js backend/server.js backend/__tests__/admin-pricing-audit-permissions.test.js
git commit -m "refactor: migrate pricing/audit routes to requirePermission"
```

---

### Task 14: Domain 3 — Forum moderation (`backend/routes/forum.js`)

**Files:**
- Modify: `backend/routes/forum.js` (imports at lines 8, 767, 941, and the 10 route lines below)
- Test: `backend/__tests__/forum-moderation-permissions.test.js`

**Middleware swaps:**

| Line | Route | Old | New |
|---|---|---|---|
| 27 | `POST /categories` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 52 | `PUT /categories/:id` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 76 | `DELETE /categories/:id` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 788 | `PUT /threads/:threadId/pin` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 808 | `PUT /threads/:threadId/lock` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 828 | `PUT /threads/:threadId/move` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 1043 | `GET /admin/flagged-posts` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 1098 | `POST /threads/:threadId/merge` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 1138 | `POST /threads/:threadId/merge-request/reject` | `requireAdmin` | `requirePermission('forum:moderate')` |
| 1222 | `DELETE /threads/:threadId` | `requireAdmin` | `requirePermission('forum:moderate')` |

`requireAdmin` stays imported — it's still used by the badges/cosmetics routes (Task 15) in this same file.

- [ ] **Step 1: Update imports**

`backend/routes/forum.js:8` currently reads:

```js
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth');
```

Replace with:

```js
const { verifyToken, requireAuth, requireAdmin, requirePermission } = require('../middleware/auth');
```

Add, right after (new line, before `const { checkMute } = ...` on line 9):

```js
const { hasPermission } = require('../utils/permissions');
```

- [ ] **Step 2: Write the failing smoke test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('Forum moderation route permissions', () => {
  let app, admin, moderator, eventCoordinator, category, thread;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'forum_mod', displayName: 'Forum Mod', permissions: ['forum:moderate'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    eventCoordinator = await User.create({ email: 'fm@test.com', username: 'fm1', passwordHash: 'x', role: 'forum_mod' });

    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: eventCoordinator._id, content: 'hello'
    });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test("admin (via 'all') can pin a thread", async () => {
    await request(app)
      .put(`/api/forum/threads/${thread._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ isPinned: true })
      .expect(200);
  });

  test('a custom role granted forum:moderate can pin a thread', async () => {
    await request(app)
      .put(`/api/forum/threads/${thread._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(eventCoordinator)}`)
      .send({ isPinned: true })
      .expect(200);
  });

  test('moderator (no forum:moderate — unchanged by migration, was never requireModerator-gated) cannot pin a thread', async () => {
    await request(app)
      .put(`/api/forum/threads/${thread._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ isPinned: true })
      .expect(403);
  });

  test('admin can create a forum category', async () => {
    await request(app)
      .post('/api/forum/categories')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'New Category' })
      .expect(201);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest forum-moderation-permissions.test.js`
Expected: FAIL — the "custom role granted forum:moderate can pin a thread" test fails against the pre-migration code (`requireAdmin` doesn't know about `forum:moderate` at all, so `eventCoordinator` gets 403).

- [ ] **Step 4: Apply the 10 middleware swaps in `backend/routes/forum.js`**

- [ ] **Step 5: Update the two inline author-or-admin checks**

`backend/routes/forum.js:767` (inside `PUT /threads/:threadId`), replace:

```js
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
```

with:

```js
    const isAdmin = hasPermission(req.user, 'forum:moderate') || req.user.isAdmin;
```

`backend/routes/forum.js:941` (inside `DELETE /posts/:postId`), apply the identical replacement.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest forum-moderation-permissions.test.js`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/routes/forum.js backend/__tests__/forum-moderation-permissions.test.js
git commit -m "refactor: migrate forum moderation routes to requirePermission"
```

---

### Task 15: Domain 4 — Badges & cosmetics (`backend/routes/admin.js`, `backend/routes/forum.js`)

**Files:**
- Modify: `backend/routes/admin.js` (7 route lines)
- Modify: `backend/routes/forum.js` (6 route lines)
- Test: `backend/__tests__/admin-badges-permissions.test.js`

**Middleware swaps in `backend/routes/admin.js`:**

| Line | Route | Old | New |
|---|---|---|---|
| 327 | `GET /badges` | `requireAdmin` | `requirePermission('badges:manage')` |
| 335 | `POST /badges` | `requireAdmin` | `requirePermission('badges:manage')` |
| 348 | `PUT /badges/:id` | `requireAdmin` | `requirePermission('badges:manage')` |
| 365 | `DELETE /badges/:id` | `requireAdmin` | `requirePermission('badges:manage')` |
| 374 | `POST /badges/:badgeId/grant/:userId` | `requireAdmin` | `requirePermission('badges:manage')` |
| 394 | `DELETE /badges/:badgeId/revoke/:userId` | `requireAdmin` | `requirePermission('badges:manage')` |
| 412 | `POST /badges/sync-icons` | `requireAdmin` | `requirePermission('badges:manage')` |

**Middleware swaps in `backend/routes/forum.js`** (broadened slightly beyond the spec's literal "badges and cosmetics" wording to also cover the XP/coin admin-grant tools, which are gated identically to the cosmetics routes and have no separate catalog permission proposed for them — documented here rather than silently expanding scope):

| Line | Route | Old | New |
|---|---|---|---|
| 1779 | `POST /level/award-xp` | `requireAdmin` | `requirePermission('badges:manage')` |
| 1823 | `POST /level/coins/earn` | `requireAdmin` | `requirePermission('badges:manage')` |
| 1845 | `GET /admin/cosmetics` | `requireAdmin` | `requirePermission('badges:manage')` |
| 1856 | `POST /admin/cosmetics` | `requireAdmin` | `requirePermission('badges:manage')` |
| 1887 | `PUT /admin/cosmetics/:cosmeticId` | `requireAdmin` | `requirePermission('badges:manage')` |
| 1923 | `DELETE /admin/cosmetics/:cosmeticId` | `requireAdmin` | `requirePermission('badges:manage')` |

`requireAdmin` remains imported in both files (still used elsewhere).

- [ ] **Step 1: Write the failing smoke test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('Badges/cosmetics route permissions', () => {
  let app, admin, badgeManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'badge_manager', displayName: 'Badge Manager', permissions: ['badges:manage'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    badgeManager = await User.create({ email: 'bm@test.com', username: 'bm1', passwordHash: 'x', role: 'badge_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('a custom role granted badges:manage can list badges', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(badgeManager)}`)
      .expect(200);
  });

  test('moderator (no badges:manage) cannot list badges or admin cosmetics', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
    await request(app)
      .get('/api/forum/admin/cosmetics')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('admin can list badges and admin cosmetics', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .get('/api/forum/admin/cosmetics')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest admin-badges-permissions.test.js`
Expected: FAIL — `badgeManager` gets 403 against pre-migration `requireAdmin`.

- [ ] **Step 3: Apply the 7 + 6 middleware swaps**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest admin-badges-permissions.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/admin.js backend/routes/forum.js backend/__tests__/admin-badges-permissions.test.js
git commit -m "refactor: migrate badges/cosmetics routes to requirePermission"
```

---

### Task 16: Domain 5 — System settings (`backend/routes/admin.js`)

**Files:**
- Modify: `backend/routes/admin.js` (4 route lines)
- Test: `backend/__tests__/admin-settings-permissions.test.js`

**Middleware swaps:**

| Line | Route | Old | New |
|---|---|---|---|
| 705 | `GET /settings` | `requireAdmin` | `requirePermission('system:settings:manage')` |
| 719 | `PUT /settings/:key` | `requireAdmin` | `requirePermission('system:settings:manage')` |
| 755 | `POST /maintenance` | `requireAdmin` | `requirePermission('system:settings:manage')` |
| 791 | `POST /init` | `requireAdmin` | `requirePermission('system:settings:manage')` |

- [ ] **Step 1: Write the failing smoke test**

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('System settings route permissions', () => {
  let app, admin, systemManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'system_manager', displayName: 'System Manager', permissions: ['system:settings:manage'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    systemManager = await User.create({ email: 'sm@test.com', username: 'sm1', passwordHash: 'x', role: 'system_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('a custom role granted system:settings:manage can read settings', async () => {
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${makeToken(systemManager)}`)
      .expect(200);
  });

  test('moderator (no system:settings:manage) cannot read settings or toggle maintenance', async () => {
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
    await request(app)
      .post('/api/admin/maintenance')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ enabled: true })
      .expect(403);
  });

  test('admin can toggle maintenance mode', async () => {
    await request(app)
      .post('/api/admin/maintenance')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ enabled: true })
      .expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest admin-settings-permissions.test.js`
Expected: FAIL — `systemManager` gets 403 against pre-migration `requireAdmin`.

- [ ] **Step 3: Apply the 4 middleware swaps**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest admin-settings-permissions.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend suite to confirm nothing else regressed**

Run: `cd backend && npx jest`
Expected: all test files PASS (existing suites — `pricing.test.js`, `archidekt-import.test.js`, `forum-thread-deletion.test.js`, etc. — untouched by this plan, plus every new file from Tasks 1-16).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/admin-settings-permissions.test.js
git commit -m "refactor: migrate system settings routes to requirePermission"
```

---

**End of Phase 2.** Every route domain the spec's catalog additions target is now real: creating a custom role and granting it e.g. `forum:moderate` or `user:ban` actually changes what that role's users can do. Phase 3 exposes this in the admin UI.

---

## Phase 3: Frontend — Permissions Management UI

### Task 17: `RoleManagement.js` — fetch roles dynamically instead of a hardcoded list

**Files:**
- Modify: `frontend/src/components/admin/RoleManagement.js:1-37` (imports/constants), `:121-138` (data fetching), `:240-258` (role `<select>`)

**Why:** `VALID_ROLES`/`ROLE_LABELS` are currently a hardcoded array of the 8 built-in role names (lines 6-26). Once admins can create custom roles (Task 10), this dropdown must include them or newly-created roles would be unassignable through this UI. `GET /api/admin/roles` (Task 10) already accepts `user:role:manage`, which is exactly the permission this component's own action (`PUT /users/:userId/role`) requires — so no new backend permission is needed here.

- [ ] **Step 1: Replace the hardcoded constants**

Replace `frontend/src/components/admin/RoleManagement.js:6-37`:

```js
const VALID_ROLES = [
  'admin',
  'moderator',
  'content_manager',
  'community_manager',
  'support',
  'user',
  'editor',
  'viewer',
];

const ROLE_LABELS = {
  admin: 'Admin',
  moderator: 'Moderator',
  content_manager: 'Content Manager',
  community_manager: 'Community Manager',
  support: 'Support',
  user: 'User',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-300 border border-red-500/50',
  moderator: 'bg-orange-500/20 text-orange-300 border border-orange-500/50',
  content_manager: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
  community_manager: 'bg-green-500/20 text-green-300 border border-green-500/50',
  support: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
  user: 'bg-gray-500/20 text-gray-300 border border-gray-500/50',
  editor: 'bg-purple-500/20 text-purple-300 border border-purple-500/50',
  viewer: 'bg-slate-500/20 text-slate-300 border border-slate-500/50',
};
```

with:

```js
// Known built-in role color classes — custom roles fall back to
// DEFAULT_ROLE_COLOR below. Roles themselves (names, display labels) are now
// fetched from GET /api/admin/roles (see fetchRoles below) so newly-created
// custom roles show up here without a code change.
const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-300 border border-red-500/50',
  moderator: 'bg-orange-500/20 text-orange-300 border border-orange-500/50',
  content_manager: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
  community_manager: 'bg-green-500/20 text-green-300 border border-green-500/50',
  support: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
  user: 'bg-gray-500/20 text-gray-300 border border-gray-500/50',
  editor: 'bg-purple-500/20 text-purple-300 border border-purple-500/50',
  viewer: 'bg-slate-500/20 text-slate-300 border border-slate-500/50',
};
const DEFAULT_ROLE_COLOR = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50';
```

- [ ] **Step 2: Update `RoleBadge` to take a label instead of looking one up by hardcoded name**

Replace `frontend/src/components/admin/RoleManagement.js:45-54`:

```js
// RoleBadge at module scope — prevents DOM remount on every render
function RoleBadge({ role }) {
  const colorClass = ROLE_COLORS[role] || ROLE_COLORS.user;
  const label = ROLE_LABELS[role] || role;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
```

with:

```js
// RoleBadge at module scope — prevents DOM remount on every render
function RoleBadge({ role, roleLabels }) {
  const colorClass = ROLE_COLORS[role] || DEFAULT_ROLE_COLOR;
  const label = roleLabels[role] || role;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Update `HistoryPanel` to take `roleLabels` too**

`frontend/src/components/admin/RoleManagement.js:85-86` currently reads:

```js
            const oldLabel = ROLE_LABELS[entry.details?.oldRole] || entry.details?.oldRole || '?';
            const newLabel = ROLE_LABELS[entry.details?.newRole] || entry.details?.newRole || '?';
```

Replace the `HistoryPanel` function signature at line 57 from `function HistoryPanel({ selectedUser, history, loading }) {` to `function HistoryPanel({ selectedUser, history, loading, roleLabels }) {`, and replace the two lines above with:

```js
            const oldLabel = roleLabels[entry.details?.oldRole] || entry.details?.oldRole || '?';
            const newLabel = roleLabels[entry.details?.newRole] || entry.details?.newRole || '?';
```

- [ ] **Step 4: Fetch roles alongside users**

Replace `frontend/src/components/admin/RoleManagement.js:113-138`:

```js
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleHistory, setRoleHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(null); // userId string while saving

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/users?limit=100`);
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
```

with:

```js
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleHistory, setRoleHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(null); // userId string while saving

  const roleLabels = useMemo(
    () => roles.reduce((acc, r) => ({ ...acc, [r.name]: r.displayName }), {}),
    [roles]
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        authFetch(`${API_URL}/admin/users?limit=100`),
        authFetch(`${API_URL}/admin/roles`)
      ]);
      if (!usersRes.ok) throw new Error(`Failed to load users (${usersRes.status})`);
      if (!rolesRes.ok) throw new Error(`Failed to load roles (${rolesRes.status})`);
      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
```

Add `useMemo` to the React import at line 1: change `import React, { useState, useEffect, useCallback } from 'react';` to `import React, { useState, useEffect, useCallback, useMemo } from 'react';`.

- [ ] **Step 5: Use `roles`/`roleLabels` in the render**

Replace `frontend/src/components/admin/RoleManagement.js:236` (`<RoleBadge role={user.role} />`) with:

```js
                        <RoleBadge role={user.role} roleLabels={roleLabels} />
```

Replace `frontend/src/components/admin/RoleManagement.js:242-253`:

```js
                          <select
                            value={user.role}
                            disabled={isUpdating}
                            onChange={e => handleRoleChange(user._id, e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1 text-sm disabled:opacity-50 focus:outline-none focus:border-purple-500"
                          >
                            {VALID_ROLES.map(role => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
```

with:

```js
                          <select
                            value={user.role}
                            disabled={isUpdating}
                            onChange={e => handleRoleChange(user._id, e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1 text-sm disabled:opacity-50 focus:outline-none focus:border-purple-500"
                          >
                            {roles.map(role => (
                              <option key={role.name} value={role.name}>
                                {role.displayName}
                              </option>
                            ))}
                          </select>
```

Replace `frontend/src/components/admin/RoleManagement.js:296-301` (the `<HistoryPanel .../>` call) with:

```js
        <HistoryPanel
          selectedUser={selectedUser}
          history={roleHistory}
          loading={historyLoading}
          roleLabels={roleLabels}
        />
```

- [ ] **Step 6: Manual verification**

Start both servers (per project convention: `start-both-servers.bat`). Log in as an admin, open Admin Panel → Roles. Confirm:
1. The role table still loads and shows all users with correct role badges/labels.
2. The "Change Role" dropdown lists all 8 built-in roles with their display names.
3. Changing a user's role still works and updates the badge.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/RoleManagement.js
git commit -m "refactor: fetch roles dynamically in RoleManagement instead of a hardcoded list"
```

---

### Task 18: `PermissionsManagement.js` — new role CRUD + permission editor

**Files:**
- Create: `frontend/src/components/admin/PermissionsManagement.js`

- [ ] **Step 1: Create the component**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

// EditableRolePanel at module scope — prevents DOM remount on every render
function EditableRolePanel({ role, catalog, onSave, onCancel, saving }) {
  const [displayName, setDisplayName] = useState(role.displayName);
  const [permissions, setPermissions] = useState(new Set(role.permissions));

  const togglePermission = (key) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-gray-900 border border-purple-500/50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1 mr-2"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ displayName, permissions: Array.from(permissions) })}
            disabled={saving}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
          >
            <Save size={14} /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {Object.entries(catalog).map(([domain, entries]) => (
          <div key={domain} className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{domain}</h4>
            {entries.map(entry => (
              <label key={entry.key} className="flex items-start gap-2 text-sm text-gray-200 py-0.5">
                <input
                  type="checkbox"
                  checked={permissions.has(entry.key)}
                  onChange={() => togglePermission(entry.key)}
                  className="mt-1"
                />
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// NewRolePanel at module scope — prevents DOM remount on every render
function NewRolePanel({ catalog, onCreate, onCancel, saving }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [permissions, setPermissions] = useState(new Set());

  const togglePermission = (key) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-gray-900 border border-green-500/50 rounded-lg p-4 space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          placeholder="role_name (lowercase, underscores)"
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1"
        />
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Display Name"
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {Object.entries(catalog).map(([domain, entries]) => (
          <div key={domain} className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{domain}</h4>
            {entries.map(entry => (
              <label key={entry.key} className="flex items-start gap-2 text-sm text-gray-200 py-0.5">
                <input
                  type="checkbox"
                  checked={permissions.has(entry.key)}
                  onChange={() => togglePermission(entry.key)}
                  className="mt-1"
                />
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCreate({ name, displayName, permissions: Array.from(permissions) })}
          disabled={saving || !name || !displayName}
          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
        >
          <Plus size={14} /> Create Role
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

export function PermissionsManagement() {
  const { authFetch } = useAuthContext();

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        authFetch(`${API_URL}/admin/roles`),
        authFetch(`${API_URL}/admin/roles/permissions-catalog`)
      ]);
      if (!rolesRes.ok) throw new Error(`Failed to load roles (${rolesRes.status})`);
      if (!catalogRes.ok) throw new Error(`Failed to load permission catalog (${catalogRes.status})`);
      const rolesData = await rolesRes.json();
      const catalogData = await catalogRes.json();
      setRoles(rolesData.roles || []);
      setCatalog(catalogData.catalog || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async (roleId, updates) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setEditingRoleId(null);
      await fetchAll();
    } catch (err) {
      alert(`Failed to save role: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setCreating(false);
      await fetchAll();
    } catch (err) {
      alert(`Failed to create role: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.displayName}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`${API_URL}/admin/roles/${role._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      await fetchAll();
    } catch (err) {
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-center space-y-3">
        <p className="text-red-300 text-sm">{error}</p>
        <button
          onClick={fetchAll}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield size={18} className="text-purple-400" /> Roles & Permissions
        </h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <Plus size={14} /> New Role
          </button>
        )}
      </div>

      {creating && (
        <NewRolePanel
          catalog={catalog}
          saving={saving}
          onCreate={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="space-y-2">
        {roles.map(role => (
          <div key={role._id}>
            {editingRoleId === role._id ? (
              <EditableRolePanel
                role={role}
                catalog={catalog}
                saving={saving}
                onSave={updates => handleSave(role._id, updates)}
                onCancel={() => setEditingRoleId(null)}
              />
            ) : (
              <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{role.displayName}</span>
                    {role.isBuiltIn && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">Built-in</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {role.permissions.includes('all') ? 'All permissions' : `${role.permissions.length} permission(s)`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingRoleId(role._id)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  {!role.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(role)}
                      className="flex items-center gap-1 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PermissionsManagement;
```

- [ ] **Step 2: Manual verification**

With both servers running and logged in as admin, temporarily import and render `PermissionsManagement` in a scratch route or the browser console isn't sufficient here — proceed to Task 19 first (wiring it into `AdminPanel.js`), then do the full manual verification pass described in Task 20, which supersedes a standalone check of this component in isolation.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/PermissionsManagement.js
git commit -m "feat: add PermissionsManagement admin UI for custom roles"
```

---

### Task 19: Wire `PermissionsManagement` into `AdminPanel.js`

**Files:**
- Modify: `frontend/src/components/admin/AdminPanel.js:1-2` (imports), `:25-38` (tabs), `:77-82` (`canSeeTab`), `:84-105` (`renderContent`)

- [ ] **Step 1: Add the import**

`frontend/src/components/admin/AdminPanel.js:5` currently reads:

```js
import RoleManagement from './RoleManagement';
```

Add, right after:

```js
import PermissionsManagement from './PermissionsManagement';
```

- [ ] **Step 2: Add a tab entry**

Replace `frontend/src/components/admin/AdminPanel.js:31-37`:

```js
    tabs: [
      { id: 'users', label: 'Users', icon: Users, requiresRole: 'admin' },
      { id: 'roles', label: 'Roles', icon: Shield, requiresRole: 'admin' },
      { id: 'bans', label: 'Bans', icon: Shield, requiresRole: 'moderator' },
      { id: 'warnings', label: 'Warnings', icon: AlertTriangle, requiresRole: 'moderator' },
      { id: 'appeals', label: 'Appeals', icon: MessageSquare, requiresRole: 'moderator' }
    ]
```

with:

```js
    tabs: [
      { id: 'users', label: 'Users', icon: Users, requiresRole: 'admin' },
      { id: 'roles', label: 'Roles', icon: Shield, requiresRole: 'admin' },
      { id: 'permissions', label: 'Permissions', icon: Shield, requiresPermission: 'roles:manage' },
      { id: 'bans', label: 'Bans', icon: Shield, requiresRole: 'moderator' },
      { id: 'warnings', label: 'Warnings', icon: AlertTriangle, requiresRole: 'moderator' },
      { id: 'appeals', label: 'Appeals', icon: MessageSquare, requiresRole: 'moderator' }
    ]
```

- [ ] **Step 3: Extend `canSeeTab` to understand `requiresPermission`**

Replace `frontend/src/components/admin/AdminPanel.js:77-82`:

```js
function canSeeTab(tab, user) {
  if (!tab.requiresRole) return true;
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  return user.role === tab.requiresRole;
}
```

with:

```js
function canSeeTab(tab, user) {
  if (tab.requiresPermission) {
    if (!user || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes('all') || user.permissions.includes(tab.requiresPermission);
  }
  if (!tab.requiresRole) return true;
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  return user.role === tab.requiresRole;
}
```

This relies on `user.permissions` already being present on the authenticated user object — confirmed in `backend/models/User.js:132` (`toSafeObject()` includes `permissions: getPermissionsForRole(this.role)`), which is unchanged by this plan.

- [ ] **Step 4: Add the render case**

Replace `frontend/src/components/admin/AdminPanel.js:86-87`:

```js
    case 'users':      return <UsersTab />;
    case 'roles':      return <RoleManagement />;
```

with:

```js
    case 'users':       return <UsersTab />;
    case 'roles':       return <RoleManagement />;
    case 'permissions': return <PermissionsManagement />;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/AdminPanel.js
git commit -m "feat: add Permissions tab to Admin Panel, gated by roles:manage"
```

---

### Task 20: Manual verification (no frontend automated test infrastructure exists in this repo)

**Files:** none (verification only)

This repo has zero frontend test files (`Glob frontend/src/**/*.test.js` → no results) and no test runner configured beyond CRA's default `npm test` (unused). Rather than introduce new test infrastructure as a side effect of this plan, this task is a manual QA checklist, run against the running app per project convention (`start-both-servers.bat`).

- [ ] **Step 1: Log in as an admin user**, open Admin Panel → confirm both "Roles" and "Permissions" tabs are visible.

- [ ] **Step 2: On the "Permissions" tab**, click "New Role", create a role named `event_coordinator` with display name "Event Coordinator" and only the `community:events` permission checked. Save. Confirm it appears in the role list with "1 permission(s)".

- [ ] **Step 3: On the "Roles" tab**, confirm the new `Event Coordinator` role now appears in the "Change Role" dropdown for any user, and assign it to a test user.

- [ ] **Step 4: Log in as that test user** (or use its token directly against the API). Confirm:
   - A request to a `forum:moderate`-gated endpoint (e.g. `PUT /api/forum/threads/:id/pin`) returns 403.
   - A request to `community:events`-relevant functionality (if a UI surface exists) behaves as a `community_manager`-equivalent would for that one permission.

- [ ] **Step 5: Back on the "Permissions" tab as admin**, attempt to edit the `admin` role and remove `all` from its permissions. Confirm the save is rejected with the `LAST_ALL_ACCESS_ROLE` error message surfaced via `alert(...)`.

- [ ] **Step 6: Attempt to delete the `event_coordinator` role while the test user still holds it.** Confirm it's rejected with the `ROLE_IN_USE` error message. Reassign the test user back to `user`, then delete `event_coordinator` successfully.

- [ ] **Step 7: Confirm the full backend suite still passes** (final regression check before considering this plan done):

Run: `cd backend && npx jest`
Expected: all test files PASS.

No commit for this task (verification only, no file changes).

---

## Self-Review Notes

- **Spec coverage:** Data model (`Role` schema — Task 1), permission catalog (Task 2), route protection via `requirePermission` (Task 7, migrated in Tasks 12-16), guardrails (Task 10), frontend (Tasks 17-19), and all four Testing-section bullet points (middleware unit tests — Task 7; guardrail tests — Task 10; migration regression test — Task 4; route-level smoke tests — Tasks 12-16) are each covered by a concrete task.
- **Placeholder scan:** every task shows exact file paths, line numbers, and complete before/after code (or, for the 40+ mechanical one-line middleware swaps across Tasks 12-16, an explicit table naming the exact old and new text for every single line rather than a vague "update the routes" instruction).
- **Name consistency:** `requirePermission`, `hasPermission`, `getPermissionsForRole`, `getPermissionsCatalog`, `refreshRoleCache`, `Role.seedBuiltInRoles`, `Role.grantMigrationPermissions` are each introduced exactly once (Tasks 2-3, 4-5, 7) and referenced identically by name in every later task — no drift between e.g. `requirePermission` and a hypothetical `checkPermission`.
- **Corrections made to the spec**, all backed by direct grep/read evidence rather than assumption: `hasPermission()` dead-code claim verified; 8 (not 6) built-in roles; `requireCommunityManager()`/`requireSupport()` are dead code; `decks:moderate`/`trades:moderate` have no backing route; `data:export` and the general user-CRUD/backup/restore endpoints deliberately left unmigrated to avoid silent privilege escalation; `user:mute` widening to `support` flagged as an intentional, documented consequence rather than a silent change; `RoleManagement.js` already exists as a complete role-*assignment* feature (not a stub) and is adapted rather than replaced, with a new, separate `PermissionsManagement.js` built for the actual custom-roles-and-permissions editor the spec describes.

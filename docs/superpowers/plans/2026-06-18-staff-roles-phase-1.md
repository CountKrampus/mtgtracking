# Staff Roles System — Phase 1: Permission System Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the User model with staff roles, create a permissions utility, and add role-specific middleware so Phase 2 (frontend role management) has a complete backend permission system to build on.

**Architecture:** Phase 1 is purely additive — no existing routes or middleware are removed. We extend the User role enum with staff roles (`moderator`, `content_manager`, `community_manager`, `support`, `user`), add a `staffSince` field, create `backend/utils/permissions.js` with a role→permissions map and helper functions, and add `requireModerator()` / `requireContentManager()` / `requireCommunityManager()` / `requireSupport()` factory functions to `auth.js`. The existing `editor`/`viewer` roles and `requireAdmin`/`requireEditor` middleware are kept intact for backward compatibility.

**Tech Stack:** Node.js + Express + Mongoose, existing `backend/middleware/auth.js` pattern (`requireRole` factory), existing `backend/models/User.js` + `toSafeObject()`.

---

## Context: What Already Exists

Before writing code, understand what is already in place so nothing is accidentally duplicated:

- **`backend/models/User.js`** — Has `role: { enum: ['admin', 'editor', 'viewer'], default: 'editor' }`. Has `toSafeObject()` that returns `role` but NOT `staffSince` or `permissions`.
- **`backend/middleware/auth.js`** — Has `requireRole(...roles)` factory, `requireAdmin = requireRole('admin')`, `requireEditor = requireRole('admin', 'editor')`. No staff-specific helpers.
- **`backend/models/ActivityLog.js`** — Already exists with `user_role_change` action, `category: 'admin'`, `targetId`, `targetName`, `details` (Mixed). **Phase 2 Task 1 code uses wrong field names** — see Task 4 for the correct call pattern.
- **`backend/utils/permissions.js`** — Does **not** exist. Phase 2 references it as "Phase 1 complete" — we must create it.

---

## File Structure

**Create:**
- `backend/utils/permissions.js` — Role→permissions map, `getPermissionsForRole()`, `hasPermission()`, `isStaffRole()`

**Modify:**
- `backend/models/User.js` — Add new role values to enum, add `staffSince` field, update `toSafeObject()`
- `backend/middleware/auth.js` — Add `requireModerator`, `requireContentManager`, `requireCommunityManager`, `requireSupport` factory functions + exports

---

## Task 1: Create `backend/utils/permissions.js`

**Files:**
- Create: `backend/utils/permissions.js`

- [ ] **Step 1: Create the file**

```bash
touch backend/utils/permissions.js
```

- [ ] **Step 2: Write the permissions module**

```javascript
// Role → permission strings mapping.
// These match the labels shown in Phase 2's RoleManagement UI component.
const ROLE_PERMISSIONS = {
  admin: [
    'all'
  ],
  moderator: [
    'chat:moderate',
    'comments:moderate',
    'user:warn',
    'user:mute',
    'content:flag'
  ],
  content_manager: [
    'cards:audit',
    'prices:manage',
    'data:export',
    'content:flag'
  ],
  community_manager: [
    'community:events',
    'announcements:manage',
    'feedback:manage',
    'playgroups:manage'
  ],
  support: [
    'user:view',
    'feedback:read',
    'user:mute',
    'ticket:manage'
  ],
  // Standard user roles (new and legacy)
  user:   ['collection:manage', 'deck:create', 'community:chat'],
  editor: ['collection:manage', 'deck:create', 'community:chat'], // legacy alias for user
  viewer: ['collection:view']
};

// Staff roles that get a staffSince timestamp when assigned
const STAFF_ROLES = ['admin', 'moderator', 'content_manager', 'community_manager', 'support'];

/**
 * Returns the permission strings for a given role.
 * Admin always gets ['all'] — check with hasPermission() which expands it.
 * @param {string} role
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
}

/**
 * Returns true if the user object has a given permission.
 * Admins pass every check (they have 'all').
 * @param {{ role: string }} user
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  const perms = getPermissionsForRole(user.role);
  return perms.includes(permission);
}

/**
 * Returns true for roles that receive a staffSince timestamp.
 * @param {string} role
 * @returns {boolean}
 */
function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

module.exports = { ROLE_PERMISSIONS, STAFF_ROLES, getPermissionsForRole, hasPermission, isStaffRole };
```

- [ ] **Step 3: Verify the module loads without errors**

```bash
node -e "const p = require('./backend/utils/permissions'); console.log(p.getPermissionsForRole('moderator')); console.log(p.hasPermission({ role: 'admin' }, 'anything')); console.log(p.isStaffRole('content_manager'));"
```

Expected output:
```
[ 'chat:moderate', 'comments:moderate', 'user:warn', 'user:mute', 'content:flag' ]
true
true
```

- [ ] **Step 4: Commit**

```bash
git add backend/utils/permissions.js
git commit -m "feat: add permissions utility with role permissions map and helpers"
```

---

## Task 2: Extend User Model with Staff Roles

**Files:**
- Modify: `backend/models/User.js`

Three changes: (1) expand the role enum, (2) add `staffSince` field, (3) update `toSafeObject()` to include both plus derived `permissions`.

- [ ] **Step 1: Expand the role enum**

In `backend/models/User.js`, find the `role` field (currently lines 30-34):

```javascript
role: {
  type: String,
  enum: ['admin', 'editor', 'viewer'],
  default: 'editor'
},
```

Replace with:

```javascript
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

- [ ] **Step 2: Add the `staffSince` field**

After the `role` field, add:

```javascript
staffSince: {
  type: Date,
  default: null
},
```

The full block in context:

```javascript
role: {
  type: String,
  enum: [
    'admin', 'moderator', 'content_manager', 'community_manager', 'support', 'user',
    'editor', 'viewer'
  ],
  default: 'editor'
},
staffSince: {
  type: Date,
  default: null
},
isActive: {
  type: Boolean,
  default: true
},
```

- [ ] **Step 3: Update `toSafeObject()` to include `staffSince` and `permissions`**

At the top of `User.js`, add the import (before `const mongoose = require(...)` is fine, or after — just before the schema):

```javascript
const { getPermissionsForRole } = require('../utils/permissions');
```

Then find `toSafeObject()` (currently around line 89) and update it:

```javascript
userSchema.methods.toSafeObject = function() {
  return {
    _id: this._id,
    email: this.email,
    username: this.username,
    displayName: this.displayName,
    role: this.role,
    permissions: getPermissionsForRole(this.role),
    staffSince: this.staffSince,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLoginAt: this.lastLoginAt,
    privacy: this.privacy,
    reputation: this.reputation,
    badges: this.badges,
    avatarUrl: this.avatarUrl
  };
};
```

- [ ] **Step 4: Verify the model loads and the new fields are accepted**

```bash
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker').then(async () => {
  const User = require('./backend/models/User');
  const user = new User({
    email: 'phase1test@example.com',
    username: 'phase1test',
    passwordHash: 'x',
    role: 'moderator',
    staffSince: new Date()
  });
  await user.validate();
  console.log('Validation passed');
  console.log('toSafeObject:', JSON.stringify(user.toSafeObject(), null, 2));
  mongoose.disconnect();
}).catch(err => { console.error(err); process.exit(1); });
"
```

Expected: prints `Validation passed` and a JSON object that includes `role: 'moderator'`, `staffSince: ...`, and `permissions: ['chat:moderate', ...]`.

- [ ] **Step 5: Commit**

```bash
git add backend/models/User.js
git commit -m "feat: add staff roles and staffSince to User model, include permissions in toSafeObject"
```

---

## Task 3: Add Staff Middleware to `auth.js`

**Files:**
- Modify: `backend/middleware/auth.js`

Phase 2 calls these as factory functions with parens: `requireModerator()`, `requireContentManager()`, etc. Each returns the middleware produced by `requireRole(...)`.

- [ ] **Step 1: Add the four factory functions**

Find the block near the bottom of `auth.js` where `requireAdmin` is defined (currently around line 122):

```javascript
const requireAdmin = requireRole('admin');
```

Add immediately after it:

```javascript
/**
 * Require moderator or admin role.
 * Called as requireModerator() — returns middleware.
 */
const requireModerator = () => requireRole('admin', 'moderator');

/**
 * Require content_manager or admin role.
 * Called as requireContentManager() — returns middleware.
 */
const requireContentManager = () => requireRole('admin', 'content_manager');

/**
 * Require community_manager or admin role.
 * Called as requireCommunityManager() — returns middleware.
 */
const requireCommunityManager = () => requireRole('admin', 'community_manager');

/**
 * Require support or admin role.
 * Called as requireSupport() — returns middleware.
 */
const requireSupport = () => requireRole('admin', 'support');
```

- [ ] **Step 2: Export the new functions**

Find the `module.exports` block at the bottom of `auth.js`. It currently exports:

```javascript
module.exports = {
  isMultiUserEnabled,
  verifyToken,
  requireAuth,
  requireRole,
  requireEditor,
  requireAdmin,
  checkMaintenanceMode
};
```

Add the four new exports:

```javascript
module.exports = {
  isMultiUserEnabled,
  verifyToken,
  requireAuth,
  requireRole,
  requireEditor,
  requireAdmin,
  requireModerator,
  requireContentManager,
  requireCommunityManager,
  requireSupport,
  checkMaintenanceMode
};
```

- [ ] **Step 3: Verify the middleware works correctly**

```bash
node -e "
const { requireModerator, requireContentManager, requireSupport } = require('./backend/middleware/auth');

// Each should return a function (the middleware)
const modMiddleware = requireModerator();
const cmMiddleware = requireContentManager();
const suppMiddleware = requireSupport();

console.log('requireModerator() is function:', typeof modMiddleware === 'function');
console.log('requireContentManager() is function:', typeof cmMiddleware === 'function');
console.log('requireSupport() is function:', typeof suppMiddleware === 'function');
"
```

Expected:
```
requireModerator() is function: true
requireContentManager() is function: true
requireSupport() is function: true
```

- [ ] **Step 4: Verify middleware blocks wrong roles**

```bash
node -e "
process.env.MULTI_USER_ENABLED = 'true';
const { requireModerator } = require('./backend/middleware/auth');
const middleware = requireModerator();

// Simulate a non-moderator user hitting a protected route
const req = { user: { role: 'user' } };
const res = {
  status: (code) => ({ json: (body) => console.log('Status:', code, body) })
};
const next = () => console.log('next() called — should NOT happen for user role');

middleware(req, res, next);
// Expected: Status: 403 { message: 'Insufficient permissions', ... }

// Now try with admin
const req2 = { user: { role: 'admin' } };
const next2 = () => console.log('next() called for admin — CORRECT');
middleware(req2, res, next2);
"
```

Expected:
```
Status: 403 { message: 'Insufficient permissions', code: 'FORBIDDEN', requiredRoles: [ 'admin', 'moderator' ], currentRole: 'user' }
next() called for admin — CORRECT
```

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat: add requireModerator, requireContentManager, requireCommunityManager, requireSupport middleware"
```

---

## Task 4: ActivityLog Compatibility Reference

**Files:**
- None (documentation task — no code changes)

Phase 2's Task 1 contains `ActivityLog.create()` calls with **wrong field names** for this codebase's schema. Record the correct call pattern here so Phase 2 implementers use it instead of the code shown in the Phase 2 plan.

**Phase 2 plan Task 1 code (WRONG — will throw validation errors):**
```javascript
// ❌ Do NOT use this — wrong field names + missing required field
await ActivityLog.create({
  userId: req.user._id,
  username: req.user.username,      // ← field doesn't exist on schema
  action: 'role_change',            // ← not in enum, use 'user_role_change'
  targetUserId: userId,             // ← field doesn't exist on schema
  targetUsername: targetUser.username, // ← field doesn't exist on schema
  details: { oldRole: targetUser.role, newRole }
  // ← missing required 'category' field
});
```

**Correct call pattern for this codebase:**
```javascript
// ✅ Use this pattern in Phase 2 Task 1 instead
await ActivityLog.log({
  userId: req.user._id,
  action: 'user_role_change',       // matches schema enum
  category: 'admin',                // required field
  targetType: 'user',
  targetId: targetUser._id,
  targetName: targetUser.username,
  details: {
    oldRole: targetUser.role,
    newRole: newRole,
    changedBy: req.user.username
  }
});
```

The `ActivityLog.log()` static method already exists on the model and handles the `new this({...}).save()` call internally.

- [ ] **Step 1: Add a comment to ActivityLog.js documenting the role change pattern**

At the top of `backend/models/ActivityLog.js`, after the opening `const mongoose = require(...)` line, add:

```javascript
// Usage note for role change logging (called from admin.js):
// ActivityLog.log({ userId, action: 'user_role_change', category: 'admin',
//   targetType: 'user', targetId, targetName: username, details: { oldRole, newRole } })
```

- [ ] **Step 2: Commit**

```bash
git add backend/models/ActivityLog.js
git commit -m "docs: add usage comment for role change logging pattern in ActivityLog"
```

---

## Task 5: Verify Phase 2 Readiness

**Files:**
- None (verification only)

Run this checklist before handing off to Phase 2:

- [ ] **Step 1: Confirm all three files load without errors**

```bash
node -e "
require('./backend/utils/permissions');
require('./backend/models/User');
require('./backend/middleware/auth');
console.log('All three modules load cleanly');
"
```

Expected: `All three modules load cleanly`

- [ ] **Step 2: Confirm a moderator user round-trips correctly**

Start the backend server, register a user, then update their role to `moderator` directly in MongoDB, and call `GET /api/auth/me` (or the equivalent profile endpoint). Verify the response includes:

```json
{
  "role": "moderator",
  "staffSince": null,
  "permissions": ["chat:moderate", "comments:moderate", "user:warn", "user:mute", "content:flag"]
}
```

- [ ] **Step 3: Confirm new middleware is exported**

```bash
node -e "
const auth = require('./backend/middleware/auth');
const needed = ['requireModerator', 'requireContentManager', 'requireCommunityManager', 'requireSupport'];
needed.forEach(fn => {
  if (typeof auth[fn] !== 'function') throw new Error(fn + ' not exported');
});
console.log('All staff middleware exported correctly');
"
```

Expected: `All staff middleware exported correctly`

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "docs: Phase 1 complete — staff roles, permissions utility, and middleware ready for Phase 2"
```

---

## Phase 2 Handoff Notes

When executing Phase 2 (`2026-06-04-staff-roles-phase-2.md`), make these corrections to the plan:

1. **Task 1, ActivityLog call:** Replace the `ActivityLog.create({...})` block with `ActivityLog.log({...})` using the correct fields (see Task 4 above).

2. **Task 2, RoleManagement component:** Replace `localStorage.getItem('token')` with `localStorage.getItem('mtg_access_token')` and refactor to use `const { authFetch } = useAuthContext()` from `'../../contexts/AuthContext'` (note: `RoleManagement.js` is one level up from the user-management subfolder, so the path is `'../../contexts/AuthContext'`, not `'../../../contexts/AuthContext'`).

3. **Task 3, AdminPanel.js:** The AdminPanel was completely restructured in the admin expansion (June 2026) and now has a grouped sidebar layout with 14 tabs. The tab addition must add a `roles` entry to the `groups` array in the User Management group, not a flat tabs array. Read `AdminPanel.js` carefully before modifying.

4. **Task 7, endpoint permission checks:** `requireModerator` etc. are now factory functions — use them with parens: `router.delete('/messages/:id', requireModerator(), ...)`. Ensure they are destructured from `../middleware/auth` at the top of `admin.js`.

5. **`staffSince` must be wired in Task 1's role update endpoint:** `isStaffRole()` is exported from `permissions.js` but has no callers yet. The PUT `/api/admin/users/:userId/role` route in Task 1 must set `staffSince = new Date()` when assigning a staff role and `null` when demoting to `user`/`editor`/`viewer`. Use `isStaffRole(newRole)` from `../utils/permissions`.

6. **Registration default is still `'editor'`, not `'user'`:** New registrations get `role: 'editor'` from SystemSettings. Phase 2 code that checks `role === 'user'` will not match any user who registered through the existing auth flow. Either update the SystemSettings default to `'user'`, or treat `editor` and `user` as equivalent where permission checks apply.

7. **`requireEditor` does not admit `user`-role accounts:** `requireEditor = requireRole('admin', 'editor')` was defined before the `user` role existed. Any endpoint guarded by `requireEditor` will reject `user`-role accounts even though they have the same permission set. Update `requireEditor` in `auth.js` to `requireRole('admin', 'editor', 'user')` before shipping Phase 2 to non-editor users.

---

## Self-Review

**Spec Coverage:**
- ✅ `backend/utils/permissions.js` created with role map, `getPermissionsForRole`, `hasPermission`, `isStaffRole`
- ✅ `User.js` role enum extended with 6 Phase 2 roles + 2 legacy roles preserved
- ✅ `User.js` `staffSince` field added
- ✅ `toSafeObject()` returns `permissions` (derived) and `staffSince`
- ✅ `auth.js` has `requireModerator()`, `requireContentManager()`, `requireCommunityManager()`, `requireSupport()` exported
- ✅ ActivityLog schema differences documented; correct call pattern provided
- ✅ Phase 2 handoff notes enumerate all corrections needed to Phase 2 plan

**Backward Compatibility:**
- `editor` and `viewer` roles remain valid in the enum — existing users unaffected
- `requireAdmin` and `requireEditor` untouched
- No routes modified — purely additive

**No Placeholders:** All code blocks are complete and runnable.

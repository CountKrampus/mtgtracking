# Auto-Badge Grant on Staff Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Role changes on `PUT /api/admin/users/:userId/role` automatically grant/revoke the matching staff badge, every staff role gets a dedicated badge (fixing the `Owner` vs `Site Owner` naming drift), and a one-off script backfills badges for existing staff users.

**Architecture:** A new `STAFF_ROLE_BADGES` map and pure `syncStaffBadge(user, oldRole, newRole)` helper live in `backend/utils/permissions.js`, mirroring the existing `STAFF_ROLES` array. The admin role-change route calls this helper to mutate `targetUser.badges` before saving — reusing the same array-reassignment pattern already used by the badge grant/revoke routes in `backend/routes/admin.js`. A standalone script, `backend/scripts/backfillStaffBadges.js`, exports its core logic as testable functions and only runs as a CLI entrypoint when invoked directly (`require.main === module`), so it can be both `node`-run by hand and unit tested.

**Tech Stack:** Node.js, Express, Mongoose, Jest, Supertest, mongodb-memory-server (existing backend test stack — see `backend/__tests__/achievements.test.js` and `backend/__tests__/pricing.test.js` for established patterns).

---

## File Structure

- **Modify** `backend/utils/permissions.js` — add `STAFF_ROLE_BADGES` map (co-located with `STAFF_ROLES`) and `syncStaffBadge()` helper; export both.
- **Modify** `backend/routes/admin.js` — import `syncStaffBadge` and call it inside the `PUT /users/:userId/role` handler, right after `staffSince` is set and before `.save()`.
- **Create** `backend/scripts/backfillStaffBadges.js` — one-off backfill script with testable exports (`ensureStaffBadgesExist`, `backfillStaffBadges`) plus a CLI entrypoint guarded by `require.main === module`.
- **Create** `backend/__tests__/staff-badges.test.js` — unit tests for `syncStaffBadge()` (pure function, no DB).
- **Create** `backend/__tests__/admin-role-badges.test.js` — route-level test for `PUT /api/admin/users/:userId/role` confirming badges change end to end (MongoMemoryServer + Supertest, mirroring `backend/__tests__/achievements.test.js`).
- **Create** `backend/__tests__/backfill-staff-badges.test.js` — tests for the backfill script against a seeded MongoMemoryServer database.

No schema changes. `User.badges` (`backend/models/User.js:91-96`) and `Badge` (`backend/models/Badge.js`) already support this shape.

---

## Task 1: `STAFF_ROLE_BADGES` map and `syncStaffBadge()` helper

**Files:**
- Modify: `backend/utils/permissions.js:43` (insert after `STAFF_ROLES`), `backend/utils/permissions.js:78` (module.exports)
- Test: `backend/__tests__/staff-badges.test.js`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/__tests__/staff-badges.test.js`:

```js
const { syncStaffBadge, STAFF_ROLE_BADGES } = require('../utils/permissions');

describe('STAFF_ROLE_BADGES', () => {
  test('has one entry per staff role with the fixed Site Owner naming', () => {
    expect(STAFF_ROLE_BADGES).toEqual({
      admin: { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown' },
      moderator: { name: 'Moderator', description: '', icon: 'lucide:Flame' },
      content_manager: { name: 'Content Manager', description: '', icon: 'lucide:Flame' },
      community_manager: { name: 'Community Manager', description: '', icon: 'lucide:Flame' },
      support: { name: 'Support', description: '', icon: 'lucide:Flame' },
    });
  });
});

describe('syncStaffBadge', () => {
  test('promotion grants the matching staff badge', () => {
    const user = { badges: [] };
    syncStaffBadge(user, 'user', 'moderator');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0]).toMatchObject({ name: 'Moderator', description: '', icon: 'lucide:Flame' });
    expect(user.badges[0].earnedAt).toBeInstanceOf(Date);
  });

  test('promoting to admin grants "Site Owner", not the legacy "Owner" name', () => {
    const user = { badges: [] };
    syncStaffBadge(user, 'user', 'admin');
    expect(user.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('demotion from a staff role revokes the badge', () => {
    const user = { badges: [{ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'moderator', 'user');
    expect(user.badges).toEqual([]);
  });

  test('re-promoting to the same role does not duplicate the badge', () => {
    const user = { badges: [{ name: 'Support', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'support', 'support');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0].name).toBe('Support');
  });

  test('swapping directly between two staff roles removes the old badge and adds the new one', () => {
    const user = { badges: [{ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'moderator', 'content_manager');
    expect(user.badges.map(b => b.name)).toEqual(['Content Manager']);
  });

  test('non-staff to non-staff role change is a no-op', () => {
    const user = { badges: [{ name: 'Century Collector', description: '', icon: 'lucide:Package', earnedAt: new Date() }] };
    syncStaffBadge(user, 'user', 'viewer');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0].name).toBe('Century Collector');
  });

  test('handles a user with no existing badges array', () => {
    const user = {};
    syncStaffBadge(user, 'user', 'support');
    expect(user.badges.map(b => b.name)).toEqual(['Support']);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run (from `backend/`): `npx jest __tests__/staff-badges.test.js`
Expected: FAIL — `TypeError: (0 , _permissions.syncStaffBadge) is not a function` (and `STAFF_ROLE_BADGES` is `undefined`).

- [ ] **Step 3: Implement `STAFF_ROLE_BADGES` and `syncStaffBadge()`**

In `backend/utils/permissions.js`, insert immediately after line 43 (`const STAFF_ROLES = [...]`):

```js

// Badge granted/revoked for each staff role — mirrors STAFF_ROLES 1:1.
// `admin` maps to the existing "Site Owner" Badge record (fixes the legacy
// "Owner" naming drift — see backend/scripts/backfillStaffBadges.js).
const STAFF_ROLE_BADGES = {
  admin: { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown' },
  moderator: { name: 'Moderator', description: '', icon: 'lucide:Flame' },
  content_manager: { name: 'Content Manager', description: '', icon: 'lucide:Flame' },
  community_manager: { name: 'Community Manager', description: '', icon: 'lucide:Flame' },
  support: { name: 'Support', description: '', icon: 'lucide:Flame' },
};

/**
 * Sync a user's staff badge to match a role change.
 * Revokes the badge tied to oldRole (if any, and if newRole doesn't grant the
 * same badge) and grants the badge tied to newRole (if any, and not already
 * present). Mutates user.badges in place using the same array-reassignment
 * pattern as the badge grant/revoke routes in backend/routes/admin.js.
 * Does not save — caller is responsible for persisting the user.
 * @param {{ badges?: Array<{name: string}> }} user
 * @param {string} oldRole
 * @param {string} newRole
 */
function syncStaffBadge(user, oldRole, newRole) {
  const oldBadge = STAFF_ROLE_BADGES[oldRole];
  const newBadge = STAFF_ROLE_BADGES[newRole];

  user.badges = user.badges || [];

  // Revoke: previous role had a staff badge that the new role doesn't also grant
  if (oldBadge && (!newBadge || oldBadge.name !== newBadge.name)) {
    user.badges = user.badges.filter(b => b.name !== oldBadge.name);
  }

  // Grant: new role has a staff badge the user doesn't already have
  if (newBadge && !user.badges.some(b => b.name === newBadge.name)) {
    user.badges.push({
      name: newBadge.name,
      description: newBadge.description,
      icon: newBadge.icon,
      earnedAt: new Date()
    });
  }
}
```

Then replace the `module.exports` line (line 78):

```js
module.exports = {
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  STAFF_ROLE_BADGES,
  getPermissionsForRole,
  hasPermission,
  isStaffRole,
  syncStaffBadge
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run (from `backend/`): `npx jest __tests__/staff-badges.test.js`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/utils/permissions.js backend/__tests__/staff-badges.test.js
git commit -m "feat: add STAFF_ROLE_BADGES map and syncStaffBadge helper"
```

---

## Task 2: Wire `syncStaffBadge` into the role-change route

**Files:**
- Modify: `backend/routes/admin.js:21` (import), `backend/routes/admin.js:300-304` (handler body)
- Test: `backend/__tests__/admin-role-badges.test.js`

- [ ] **Step 1: Write the failing route-level test**

Create `backend/__tests__/admin-role-badges.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
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

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString() }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const adminRouter = require('../routes/admin');
  app.use('/api/admin', adminRouter);
  return app;
}

describe('PUT /api/admin/users/:userId/role — staff badge sync', () => {
  let app, admin, target;

  beforeEach(async () => {
    app = buildApp();
    admin = await User.create({
      email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin'
    });
    target = await User.create({
      email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user'
    });
  });

  test('promoting a user to moderator grants the Moderator badge', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'moderator' })
      .expect(200);

    expect(res.body.newRole).toBe('moderator');

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Moderator']);
  });

  test('demoting a staff user back to "user" revokes the badge', async () => {
    target.role = 'moderator';
    target.badges.push({ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() });
    await target.save();

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'user' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).not.toContain('Moderator');
  });

  test('swapping between two staff roles removes the old badge and adds the new one', async () => {
    target.role = 'content_manager';
    target.badges.push({ name: 'Content Manager', description: '', icon: 'lucide:Flame', earnedAt: new Date() });
    await target.save();

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'support' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Support']);
  });

  test('promoting to admin grants "Site Owner"', async () => {
    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'admin' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run (from `backend/`): `npx jest __tests__/admin-role-badges.test.js`
Expected: FAIL — all four tests fail because `updated.badges` is `[]` (the route doesn't touch badges yet).

- [ ] **Step 3: Wire `syncStaffBadge` into the route handler**

In `backend/routes/admin.js`, change line 21 from:

```js
const { isStaffRole, ROLE_PERMISSIONS } = require('../utils/permissions');
```

to:

```js
const { isStaffRole, ROLE_PERMISSIONS, syncStaffBadge } = require('../utils/permissions');
```

Then in the `PUT /users/:userId/role` handler, change lines 300-304 from:

```js
    const oldRole = targetUser.role;
    targetUser.role = newRole;
    targetUser.staffSince = isStaffRole(newRole) ? (targetUser.staffSince || new Date()) : null;

    await targetUser.save();
```

to:

```js
    const oldRole = targetUser.role;
    targetUser.role = newRole;
    targetUser.staffSince = isStaffRole(newRole) ? (targetUser.staffSince || new Date()) : null;
    syncStaffBadge(targetUser, oldRole, newRole);

    await targetUser.save();
```

- [ ] **Step 4: Run the test and verify it passes**

Run (from `backend/`): `npx jest __tests__/admin-role-badges.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run (from `backend/`): `npx jest`
Expected: PASS — all existing suites (including `__tests__/achievements.test.js`, `__tests__/milestones.test.js`) still pass alongside the two new files.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/admin-role-badges.test.js
git commit -m "feat: sync staff badge on role change in admin route"
```

---

## Task 3: Backfill script for existing staff users

**Files:**
- Create: `backend/scripts/backfillStaffBadges.js`
- Test: `backend/__tests__/backfill-staff-badges.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/backfill-staff-badges.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { backfillStaffBadges, ensureStaffBadgesExist } = require('../scripts/backfillStaffBadges');

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

describe('ensureStaffBadgesExist', () => {
  test('creates Community Manager and Support Badge docs if missing', async () => {
    await ensureStaffBadgesExist();
    const communityManager = await Badge.findOne({ name: 'Community Manager' });
    const support = await Badge.findOne({ name: 'Support' });
    expect(communityManager).not.toBeNull();
    expect(support).not.toBeNull();
  });

  test('is idempotent — running twice does not create duplicates', async () => {
    await ensureStaffBadgesExist();
    await ensureStaffBadgesExist();
    const count = await Badge.countDocuments({ name: 'Support' });
    expect(count).toBe(1);
  });
});

describe('backfillStaffBadges', () => {
  test('grants the matching badge to every staff user missing it, and skips non-staff users', async () => {
    const mod = await User.create({
      email: 'mod@test.com', username: 'moduser', passwordHash: 'x', role: 'moderator'
    });
    const nonStaff = await User.create({
      email: 'plain@test.com', username: 'plainuser', passwordHash: 'x', role: 'user'
    });

    const summary = await backfillStaffBadges();

    expect(summary).toEqual({ usersChecked: 1, badgesGranted: 1, namesFixed: 0 });

    const updatedMod = await User.findById(mod._id);
    expect(updatedMod.badges.map(b => b.name)).toEqual(['Moderator']);

    const updatedNonStaff = await User.findById(nonStaff._id);
    expect(updatedNonStaff.badges).toHaveLength(0);
  });

  test('renames the legacy "Owner" badge to "Site Owner" without creating a duplicate', async () => {
    const admin = await User.create({
      email: 'admin@test.com', username: 'adminuser', passwordHash: 'x', role: 'admin',
      badges: [{ name: 'Owner', description: 'Old label', icon: 'lucide:Crown', earnedAt: new Date() }]
    });

    const summary = await backfillStaffBadges();

    expect(summary).toEqual({ usersChecked: 1, badgesGranted: 0, namesFixed: 1 });

    const updated = await User.findById(admin._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('drops the legacy "Owner" entry instead of duplicating when "Site Owner" is already present', async () => {
    const admin = await User.create({
      email: 'admin2@test.com', username: 'adminuser2', passwordHash: 'x', role: 'admin',
      badges: [
        { name: 'Owner', description: 'Old label', icon: 'lucide:Crown', earnedAt: new Date() },
        { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown', earnedAt: new Date() }
      ]
    });

    await backfillStaffBadges();

    const updated = await User.findById(admin._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('running twice does not grant duplicate badges', async () => {
    await User.create({
      email: 'mod2@test.com', username: 'moduser2', passwordHash: 'x', role: 'moderator'
    });

    await backfillStaffBadges();
    const summary2 = await backfillStaffBadges();

    expect(summary2).toEqual({ usersChecked: 1, badgesGranted: 0, namesFixed: 0 });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run (from `backend/`): `npx jest __tests__/backfill-staff-badges.test.js`
Expected: FAIL — `Cannot find module '../scripts/backfillStaffBadges'`.

- [ ] **Step 3: Implement the backfill script**

Create `backend/scripts/backfillStaffBadges.js`:

```js
const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { STAFF_ROLES, STAFF_ROLE_BADGES } = require('../utils/permissions');

/**
 * Ensure a Badge document exists for every entry in STAFF_ROLE_BADGES.
 * Upserts by name so re-running is idempotent (existing docs are untouched).
 */
async function ensureStaffBadgesExist() {
  for (const badge of Object.values(STAFF_ROLE_BADGES)) {
    await Badge.findOneAndUpdate(
      { name: badge.name },
      { $setOnInsert: { name: badge.name, description: badge.description, icon: badge.icon } },
      { upsert: true }
    );
  }
}

/**
 * Grant the correct staff badge to every user currently holding a staff role,
 * and fix the legacy "Owner" badge name to "Site Owner" on existing admins
 * (dropping the legacy entry instead of duplicating if "Site Owner" is
 * already present). Idempotent — safe to run more than once.
 * @returns {Promise<{usersChecked: number, badgesGranted: number, namesFixed: number}>}
 */
async function backfillStaffBadges() {
  await ensureStaffBadgesExist();

  const staffUsers = await User.find({ role: { $in: STAFF_ROLES } });

  let usersChecked = 0;
  let badgesGranted = 0;
  let namesFixed = 0;

  for (const user of staffUsers) {
    usersChecked++;
    let changed = false;

    const legacyIndex = user.badges.findIndex(b => b.name === 'Owner');
    if (legacyIndex !== -1) {
      const alreadyHasSiteOwner = user.badges.some(b => b.name === 'Site Owner');
      if (alreadyHasSiteOwner) {
        user.badges.splice(legacyIndex, 1);
      } else {
        user.badges[legacyIndex].name = 'Site Owner';
      }
      namesFixed++;
      changed = true;
    }

    const badge = STAFF_ROLE_BADGES[user.role];
    if (badge && !user.badges.some(b => b.name === badge.name)) {
      user.badges.push({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: new Date()
      });
      badgesGranted++;
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  return { usersChecked, badgesGranted, namesFixed };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const summary = await backfillStaffBadges();

  console.log(`Users checked: ${summary.usersChecked}`);
  console.log(`Badges granted: ${summary.badgesGranted}`);
  console.log(`Names fixed (Owner -> Site Owner): ${summary.namesFixed}`);

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}

module.exports = { backfillStaffBadges, ensureStaffBadgesExist };
```

Note: unlike `backend/scripts/seedForumCategories.js` (which connects and calls `process.exit()` unconditionally at module scope), this script guards its CLI entrypoint behind `require.main === module` so `backend/__tests__/backfill-staff-badges.test.js` can `require()` it against its own MongoMemoryServer connection without the script trying to connect to `process.env.MONGODB_URI` or calling `process.exit()` mid test run.

- [ ] **Step 4: Run the tests and verify they pass**

Run (from `backend/`): `npx jest __tests__/backfill-staff-badges.test.js`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run (from `backend/`): `npx jest`
Expected: PASS — all suites green, including Task 1 and Task 2's new files.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/backfillStaffBadges.js backend/__tests__/backfill-staff-badges.test.js
git commit -m "feat: add backfillStaffBadges script for existing staff users"
```

---

## Manual follow-up (not part of automated tests)

After this plan is merged and deployed, run the backfill once by hand against the real database:

```bash
cd backend
node scripts/backfillStaffBadges.js
```

This is a one-time operation per the design spec — it is not wired into app startup, `npm start`, or any migration runner.

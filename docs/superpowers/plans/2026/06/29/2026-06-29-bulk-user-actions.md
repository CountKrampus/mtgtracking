# Bulk User Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins select multiple users in the user management table and perform batch operations (email blast, badge grant, 2FA reset) with confirmation modals and full audit trail.

**Architecture:** Four new admin routes (bulk-email, bulk-badge, bulk-2fa-reset, bulk-select) in admin.js; checkbox selection + floating action bar in UserManagement.js; three separate modal components (BulkEmailModal, BulkBadgeModal, Bulk2FAResetModal) defined at module scope and imported into UserManagement.

**Tech Stack:** Node.js/Express/Mongoose, nodemailer (existing in `backend/utils/email.js`), React, Tailwind CSS, Lucide icons, useAuthContext authFetch.

---

## Key files

- `backend/routes/admin.js` — add 4 routes before `module.exports`
- `backend/__tests__/bulk-user-actions.test.js` — new test file
- `backend/models/ModerationHistory.js` — enum needs 3 new values added
- `frontend/src/components/admin/BulkEmailModal.js` — new file
- `frontend/src/components/admin/BulkBadgeModal.js` — new file
- `frontend/src/components/admin/Bulk2FAResetModal.js` — new file
- `frontend/src/components/admin/UserManagement.js` — modify existing

## Codebase patterns confirmed

```js
// Test boilerplate (from backend/__tests__/deck-sharing.test.js):
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
// makeToken signs with role: 'admin' and 'test-secret'
// buildApp() mounts verifyToken globally, then mounts the router

// ModerationHistory.create({ userId, actionType, actionDetails, performedBy })
// actionType enum currently: 'ban','suspend','warn','appeal_approved','appeal_denied','override','ban_revoked','price_update'
// Must add: 'bulk_email', 'bulk_badge_grant', 'bulk_2fa_reset'

// User.badges is an array of subdocs: { name, description, icon, earnedAt }
// NOT an array of ObjectId refs — bulk-badge must push subdocs, NOT use $addToSet with an ID

// email.js exports: createTransporter() returns null when EMAIL_USER/EMAIL_PASS not set
```

---

## Task 1 — Backend: ModerationHistory enum + 4 bulk routes + tests

### Step 1.1 — Extend ModerationHistory enum (2 min)

- [ ] Edit `backend/models/ModerationHistory.js` — add three new actionType values:

In `backend/models/ModerationHistory.js`, change:
```js
  actionType: {
    type: String,
    enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked', 'price_update'],
    required: true
  },
```
To:
```js
  actionType: {
    type: String,
    enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked', 'price_update', 'bulk_email', 'bulk_badge_grant', 'bulk_2fa_reset'],
    required: true
  },
```

### Step 1.2 — Write failing tests (5 min)

- [ ] Create `backend/__tests__/bulk-user-actions.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Badge = require('../models/Badge');
const ModerationHistory = require('../models/ModerationHistory');

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

function makeAdminToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'admin' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  const adminRouter = require('../routes/admin');
  app.use('/api/admin', adminRouter);
  return app;
}

async function createAdmin(overrides = {}) {
  return User.create({
    email: `admin_${Date.now()}@test.com`,
    username: `admin_${Date.now()}`,
    passwordHash: 'hashedpass',
    role: 'admin',
    isActive: true,
    ...overrides,
  });
}

async function createUser(overrides = {}) {
  return User.create({
    email: `user_${Date.now()}@test.com`,
    username: `user_${Date.now()}`,
    passwordHash: 'hashedpass',
    role: 'editor',
    isActive: true,
    ...overrides,
  });
}

// ─── GET /api/admin/users/bulk-select ─────────────────────────────────────────

describe('GET /api/admin/users/bulk-select', () => {
  let app, admin, u1, u2, u3;

  beforeEach(async () => {
    admin = await createAdmin();
    u1 = await createUser({ role: 'editor' });
    u2 = await createUser({ role: 'admin' });
    u3 = await createUser({ role: 'editor', isActive: false });
    app = buildApp();
  });

  it('returns array of _id strings with no pagination limit', async () => {
    const res = await request(app)
      .get('/api/admin/users/bulk-select')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    // All 4 users (admin + u1 + u2 + u3)
    expect(res.body.length).toBe(4);
    expect(typeof res.body[0]).toBe('string');
  });

  it('filters by role query param', async () => {
    const res = await request(app)
      .get('/api/admin/users/bulk-select?role=editor')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .expect(200);

    expect(res.body.length).toBe(2);
    const ids = [u1._id.toString(), u3._id.toString()];
    expect(res.body).toEqual(expect.arrayContaining(ids));
  });

  it('filters by status=false (inactive users)', async () => {
    const res = await request(app)
      .get('/api/admin/users/bulk-select?status=false')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .expect(200);

    expect(res.body).toContain(u3._id.toString());
    expect(res.body.length).toBe(1);
  });

  it('filters by search query param', async () => {
    const unique = await createUser({ username: 'findmeplease', email: 'findme@test.com' });
    const res = await request(app)
      .get('/api/admin/users/bulk-select?search=findmeplease')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .expect(200);

    expect(res.body).toContain(unique._id.toString());
    expect(res.body.length).toBe(1);
  });

  it('returns 401 without token', async () => {
    await request(app).get('/api/admin/users/bulk-select').expect(401);
  });

  it('returns 403 for non-admin role', async () => {
    const editor = await createUser({ role: 'editor' });
    const token = jwt.sign({ userId: editor._id.toString(), role: 'editor' }, 'test-secret');
    await request(app)
      .get('/api/admin/users/bulk-select')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

// ─── POST /api/admin/users/bulk-email ─────────────────────────────────────────

describe('POST /api/admin/users/bulk-email', () => {
  let app, admin, u1, u2;

  beforeEach(async () => {
    admin = await createAdmin();
    u1 = await createUser();
    u2 = await createUser();
    app = buildApp();
  });

  it('returns 503 when email transport is not configured', async () => {
    // In test env EMAIL_USER/EMAIL_PASS are not set → createTransporter returns null
    const res = await request(app)
      .post('/api/admin/users/bulk-email')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString(), u2._id.toString()],
        subject: 'Hello Users',
        body: 'This is a test email blast.',
      })
      .expect(503);

    expect(res.body.message).toMatch(/email.*not configured/i);
  });

  it('returns 400 when userIds is empty', async () => {
    const res = await request(app)
      .post('/api/admin/users/bulk-email')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: [], subject: 'Hi', body: 'Hello' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('returns 400 when userIds exceeds 500', async () => {
    const ids = Array.from({ length: 501 }, () => new mongoose.Types.ObjectId().toString());
    const res = await request(app)
      .post('/api/admin/users/bulk-email')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: ids, subject: 'Hi', body: 'Hello' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('returns 400 when subject exceeds 200 characters', async () => {
    const res = await request(app)
      .post('/api/admin/users/bulk-email')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString()],
        subject: 'x'.repeat(201),
        body: 'Hello',
      })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('returns 400 when body exceeds 5000 characters', async () => {
    const res = await request(app)
      .post('/api/admin/users/bulk-email')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString()],
        subject: 'Hello',
        body: 'x'.repeat(5001),
      })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('returns 401 without token', async () => {
    await request(app)
      .post('/api/admin/users/bulk-email')
      .send({ userIds: [u1._id.toString()], subject: 'Hi', body: 'Hello' })
      .expect(401);
  });
});

// ─── POST /api/admin/users/bulk-badge ─────────────────────────────────────────

describe('POST /api/admin/users/bulk-badge', () => {
  let app, admin, u1, u2, badge;

  beforeEach(async () => {
    admin = await createAdmin();
    u1 = await createUser();
    u2 = await createUser();
    badge = await Badge.create({ name: 'Test Badge', description: 'A test badge', icon: '🏆' });
    app = buildApp();
  });

  it('grants badge to all specified users and writes audit log', async () => {
    const res = await request(app)
      .post('/api/admin/users/bulk-badge')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString(), u2._id.toString()],
        badgeId: badge._id.toString(),
      })
      .expect(200);

    expect(res.body.updated).toBe(2);

    const updated1 = await User.findById(u1._id);
    const updated2 = await User.findById(u2._id);
    expect(updated1.badges.some(b => b.name === 'Test Badge')).toBe(true);
    expect(updated2.badges.some(b => b.name === 'Test Badge')).toBe(true);

    const logs = await ModerationHistory.find({ actionType: 'bulk_badge_grant' });
    expect(logs.length).toBe(2);
    expect(logs[0].actionDetails.badgeName).toBe('Test Badge');
    expect(logs[0].performedBy.toString()).toBe(admin._id.toString());
  });

  it('does not double-grant to users who already have the badge', async () => {
    // Pre-grant to u1
    await User.findByIdAndUpdate(u1._id, {
      $push: { badges: { name: 'Test Badge', description: 'A test badge', icon: '🏆', earnedAt: new Date() } }
    });

    const res = await request(app)
      .post('/api/admin/users/bulk-badge')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString(), u2._id.toString()],
        badgeId: badge._id.toString(),
      })
      .expect(200);

    // u2 gets it, u1 was skipped
    expect(res.body.updated).toBe(1);

    const updated1 = await User.findById(u1._id);
    const u1BadgeCount = updated1.badges.filter(b => b.name === 'Test Badge').length;
    expect(u1BadgeCount).toBe(1); // not doubled
  });

  it('returns 404 when badgeId does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/admin/users/bulk-badge')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({
        userIds: [u1._id.toString()],
        badgeId: fakeId,
      })
      .expect(404);

    expect(res.body.message).toMatch(/badge not found/i);
  });

  it('returns 400 when userIds is empty', async () => {
    await request(app)
      .post('/api/admin/users/bulk-badge')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: [], badgeId: badge._id.toString() })
      .expect(400);
  });

  it('returns 401 without token', async () => {
    await request(app)
      .post('/api/admin/users/bulk-badge')
      .send({ userIds: [u1._id.toString()], badgeId: badge._id.toString() })
      .expect(401);
  });
});

// ─── POST /api/admin/users/bulk-2fa-reset ─────────────────────────────────────

describe('POST /api/admin/users/bulk-2fa-reset', () => {
  let app, admin, u1, u2;

  beforeEach(async () => {
    admin = await createAdmin();
    u1 = await createUser();
    u2 = await createUser();
    app = buildApp();
  });

  it('writes audit log entries for each userId and returns updated count', async () => {
    const res = await request(app)
      .post('/api/admin/users/bulk-2fa-reset')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: [u1._id.toString(), u2._id.toString()] })
      .expect(200);

    expect(typeof res.body.updated).toBe('number');

    const logs = await ModerationHistory.find({ actionType: 'bulk_2fa_reset' });
    expect(logs.length).toBe(2);
    expect(logs[0].performedBy.toString()).toBe(admin._id.toString());
  });

  it('returns 400 when userIds is empty', async () => {
    await request(app)
      .post('/api/admin/users/bulk-2fa-reset')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: [] })
      .expect(400);
  });

  it('returns 400 when userIds exceeds 500', async () => {
    const ids = Array.from({ length: 501 }, () => new mongoose.Types.ObjectId().toString());
    await request(app)
      .post('/api/admin/users/bulk-2fa-reset')
      .set('Authorization', `Bearer ${makeAdminToken(admin._id)}`)
      .send({ userIds: ids })
      .expect(400);
  });

  it('returns 401 without token', async () => {
    await request(app)
      .post('/api/admin/users/bulk-2fa-reset')
      .send({ userIds: [u1._id.toString()] })
      .expect(401);
  });

  it('returns 403 for non-admin role', async () => {
    const editor = await createUser({ role: 'editor' });
    const token = jwt.sign({ userId: editor._id.toString(), role: 'editor' }, 'test-secret');
    await request(app)
      .post('/api/admin/users/bulk-2fa-reset')
      .set('Authorization', `Bearer ${token}`)
      .send({ userIds: [u1._id.toString()] })
      .expect(403);
  });
});
```

- [ ] Run tests to confirm they all fail:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage 2>&1 | tail -20
  ```
  Expected output: multiple `● ... › ...` failures, no passing tests.

### Step 1.3 — Implement bulk-select route (3 min)

- [ ] In `backend/routes/admin.js`, add the following block immediately after the closing `}` of the `router.get('/users', requireAdmin, ...)` handler (around line 68) and BEFORE `router.get('/users/:id', requireAdmin, ...)` at line 74:

```js
/**
 * GET /api/admin/users/bulk-select
 * Return all matching user IDs (no pagination) for bulk selection.
 * Query params: search, role, status (same semantics as GET /admin/users)
 */
router.get('/users/bulk-select', requireAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status !== undefined) query.isActive = status === 'true';
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query, '_id');
    res.json(users.map(u => u._id.toString()));
  } catch (error) {
    console.error('Bulk select error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] Run tests again:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage --testNamePattern="bulk-select" 2>&1 | tail -20
  ```
  Expected: `GET /api/admin/users/bulk-select` describe block — 6 tests green.

### Step 1.4 — Implement bulk-email route (5 min)

- [ ] In `backend/routes/admin.js`, add the `createTransporter` import after the existing require block at the top of the file (after line 22, the `{ isStaffRole, ROLE_PERMISSIONS }` require):

```js
const { createTransporter } = require('../utils/email');
```

- [ ] Add the route in `backend/routes/admin.js` after the bulk-select route:

```js
/**
 * POST /api/admin/users/bulk-email
 * Send an email blast to a list of users.
 * Body: { userIds: string[], subject: string, body: string }
 */
router.post('/users/bulk-email', requireAdmin, async (req, res) => {
  try {
    const { userIds, subject, body } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 500) {
      return res.status(400).json({ message: 'userIds must be an array of 1–500 IDs' });
    }
    if (!subject || typeof subject !== 'string' || subject.length > 200) {
      return res.status(400).json({ message: 'subject is required and must be ≤ 200 characters' });
    }
    if (!body || typeof body !== 'string' || body.length > 5000) {
      return res.status(400).json({ message: 'body is required and must be ≤ 5000 characters' });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({ message: 'Email is not configured on this server' });
    }

    const users = await User.find({ _id: { $in: userIds } }, 'email username displayName');

    const sent = [];
    const failed = [];
    const errors = [];

    for (const user of users) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: user.email,
          subject,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });
        sent.push(user._id.toString());
      } catch (mailErr) {
        failed.push(user._id.toString());
        errors.push({ userId: user._id.toString(), error: mailErr.message });
      }
    }

    const auditEntries = users.map(user => ({
      actionType: 'bulk_email',
      actionDetails: { subject },
      performedBy: req.user._id,
      userId: user._id,
    }));
    await ModerationHistory.insertMany(auditEntries);

    res.json({ sent: sent.length, failed: failed.length, errors });
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] Run email tests:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage --testNamePattern="bulk-email" 2>&1 | tail -20
  ```
  Expected: all 6 `bulk-email` tests pass.

### Step 1.5 — Implement bulk-badge route (5 min)

- [ ] Add the route in `backend/routes/admin.js` after the bulk-email route:

```js
/**
 * POST /api/admin/users/bulk-badge
 * Grant a badge to multiple users (skips users who already have it).
 * Body: { userIds: string[], badgeId: string }
 */
router.post('/users/bulk-badge', requireAdmin, async (req, res) => {
  try {
    const { userIds, badgeId } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 500) {
      return res.status(400).json({ message: 'userIds must be an array of 1–500 IDs' });
    }
    if (!badgeId) {
      return res.status(400).json({ message: 'badgeId is required' });
    }

    const badge = await Badge.findById(badgeId).lean();
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    const users = await User.find({ _id: { $in: userIds } });

    let updated = 0;
    const auditEntries = [];

    for (const user of users) {
      const alreadyHas = (user.badges || []).some(b => b.name === badge.name);
      if (alreadyHas) continue;

      user.badges = user.badges || [];
      user.badges.push({
        name: badge.name,
        description: badge.description,
        icon: badge.icon || '',
        earnedAt: new Date(),
      });
      await user.save();
      updated++;

      auditEntries.push({
        actionType: 'bulk_badge_grant',
        actionDetails: { badgeId: badge._id.toString(), badgeName: badge.name },
        performedBy: req.user._id,
        userId: user._id,
      });
    }

    if (auditEntries.length > 0) {
      await ModerationHistory.insertMany(auditEntries);
    }

    res.json({ updated });
  } catch (error) {
    console.error('Bulk badge error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] Run badge tests:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage --testNamePattern="bulk-badge" 2>&1 | tail -20
  ```
  Expected: all 5 `bulk-badge` tests pass.

### Step 1.6 — Implement bulk-2fa-reset route (3 min)

- [ ] Add the route in `backend/routes/admin.js` after the bulk-badge route:

```js
/**
 * POST /api/admin/users/bulk-2fa-reset
 * Clear 2FA secret and enabled flag for multiple users.
 * Body: { userIds: string[] }
 */
router.post('/users/bulk-2fa-reset', requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > 500) {
      return res.status(400).json({ message: 'userIds must be an array of 1–500 IDs' });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { twoFactorSecret: null, twoFactorEnabled: false } }
    );

    const auditEntries = userIds.map(uid => ({
      actionType: 'bulk_2fa_reset',
      actionDetails: { resetBy: req.user._id.toString() },
      performedBy: req.user._id,
      userId: uid,
    }));
    await ModerationHistory.insertMany(auditEntries);

    res.json({ updated: result.modifiedCount });
  } catch (error) {
    console.error('Bulk 2FA reset error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] Run all bulk tests to confirm everything passes:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage 2>&1 | tail -30
  ```
  Expected output:
  ```
  Test Suites: 1 passed, 1 total
  Tests:       22 passed, 22 total
  ```

- [ ] Commit:
  ```
  git add backend/__tests__/bulk-user-actions.test.js backend/routes/admin.js backend/models/ModerationHistory.js
  git commit -m "feat: bulk user admin routes — select, email, badge, 2FA reset with audit trail"
  ```

---

## Task 2 — BulkEmailModal component

### Step 2.1 — Write failing test (3 min)

- [ ] Create `frontend/src/components/admin/__tests__/BulkEmailModal.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkEmailModal from '../BulkEmailModal';

// Mock authFetch
const mockAuthFetch = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({ authFetch: mockAuthFetch }),
}));
jest.mock('../../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

describe('BulkEmailModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user count and inputs', () => {
    render(<BulkEmailModal userIds={['id1', 'id2', 'id3']} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText(/send to 3 users/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/subject/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message body/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<BulkEmailModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error when subject is empty on submit', async () => {
    render(<BulkEmailModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/subject is required/i)).toBeInTheDocument();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('shows error when body is empty on submit', async () => {
    render(<BulkEmailModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/message body is required/i)).toBeInTheDocument();
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it('calls authFetch with correct payload and invokes onSuccess', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sent: 1, failed: 0, errors: [] }),
    });

    render(<BulkEmailModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: 'Test Subject' } });
    fireEvent.change(screen.getByPlaceholderText(/message body/i), { target: { value: 'Test body text' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockAuthFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/admin/users/bulk-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userIds: ['id1'], subject: 'Test Subject', body: 'Test body text' }),
      })
    );
  });

  it('shows error message when API returns non-ok', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email not configured' }),
    });

    render(<BulkEmailModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText(/message body/i), { target: { value: 'Body' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/email not configured/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] Run to confirm failure:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/BulkEmailModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected: `Cannot find module '../BulkEmailModal'`

### Step 2.2 — Implement BulkEmailModal (5 min)

- [ ] Create `frontend/src/components/admin/BulkEmailModal.js`:

```jsx
import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function BulkEmailModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!body.trim()) {
      setError('Message body is required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/users/bulk-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, subject: subject.trim(), body: body.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to send emails');
        return;
      }
      onSuccess();
    } catch (err) {
      setError('Network error — failed to send emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Mail size={20} className="text-blue-400" />
            Send to {userIds.length} users
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={200}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message body"
            maxLength={5000}
            rows={6}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1 text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkEmailModal;
```

- [ ] Run tests again:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/BulkEmailModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected:
  ```
  Tests: 6 passed, 6 total
  ```

- [ ] Commit:
  ```
  git add frontend/src/components/admin/BulkEmailModal.js frontend/src/components/admin/__tests__/BulkEmailModal.test.js
  git commit -m "feat: BulkEmailModal component with validation and API integration"
  ```

---

## Task 3 — BulkBadgeModal component

### Step 3.1 — Write failing test (3 min)

- [ ] Create `frontend/src/components/admin/__tests__/BulkBadgeModal.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkBadgeModal from '../BulkBadgeModal';

const mockAuthFetch = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({ authFetch: mockAuthFetch }),
}));
jest.mock('../../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

const fakeBadges = [
  { _id: 'badge1', name: 'Alpha Tester', description: 'Was here first', icon: '🔬' },
  { _id: 'badge2', name: 'Power User', description: 'Uses everything', icon: '⚡' },
];

describe('BulkBadgeModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // First call: badge list fetch on mount
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ badges: fakeBadges }),
    });
  });

  it('renders user count and loads badge list on mount', async () => {
    render(<BulkBadgeModal userIds={['id1', 'id2']} onClose={onClose} onSuccess={onSuccess} />);
    expect(await screen.findByText(/grant to 2 users/i)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /alpha tester/i })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /power user/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<BulkBadgeModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText(/grant to 1 users/i);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error when no badge is selected on submit', async () => {
    render(<BulkBadgeModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText(/grant to 1 users/i);
    fireEvent.click(screen.getByRole('button', { name: /grant/i }));
    expect(await screen.findByText(/select a badge/i)).toBeInTheDocument();
    expect(mockAuthFetch).toHaveBeenCalledTimes(1); // only the initial fetch
  });

  it('calls authFetch with correct payload and invokes onSuccess', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ updated: 2 }),
    });

    render(<BulkBadgeModal userIds={['id1', 'id2']} onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText(/grant to 2 users/i);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'badge1' } });
    fireEvent.click(screen.getByRole('button', { name: /grant/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:5000/api/admin/users/bulk-badge',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userIds: ['id1', 'id2'], badgeId: 'badge1' }),
      })
    );
  });

  it('shows error when API returns non-ok', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Badge not found' }),
    });

    render(<BulkBadgeModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText(/grant to 1 users/i);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'badge1' } });
    fireEvent.click(screen.getByRole('button', { name: /grant/i }));

    expect(await screen.findByText(/badge not found/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] Run to confirm failure:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/BulkBadgeModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected: `Cannot find module '../BulkBadgeModal'`

### Step 3.2 — Implement BulkBadgeModal (5 min)

- [ ] Create `frontend/src/components/admin/BulkBadgeModal.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { X, Award } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function BulkBadgeModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [badges, setBadges] = useState([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await authFetch(`${API_URL}/admin/badges`);
        const data = await response.json();
        if (response.ok) {
          setBadges(data.badges || []);
        }
      } catch (err) {
        setError('Failed to load badges');
      } finally {
        setLoadingBadges(false);
      }
    };
    fetchBadges();
  }, [authFetch]);

  const handleGrant = async () => {
    if (!selectedBadgeId) {
      setError('Select a badge to grant');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/users/bulk-badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, badgeId: selectedBadgeId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to grant badge');
        return;
      }
      onSuccess();
    } catch (err) {
      setError('Network error — failed to grant badge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Award size={20} className="text-purple-400" />
            Grant to {userIds.length} users
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div>
          {loadingBadges ? (
            <p className="text-gray-400 text-sm">Loading badges…</p>
          ) : (
            <select
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">— Select a badge —</option>
              {badges.map((badge) => (
                <option key={badge._id} value={badge._id}>
                  {badge.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1 text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGrant}
            disabled={loading || loadingBadges}
            className="px-4 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkBadgeModal;
```

- [ ] Run tests again:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/BulkBadgeModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected:
  ```
  Tests: 5 passed, 5 total
  ```

- [ ] Commit:
  ```
  git add frontend/src/components/admin/BulkBadgeModal.js frontend/src/components/admin/__tests__/BulkBadgeModal.test.js
  git commit -m "feat: BulkBadgeModal component with badge fetch, dropdown, and grant"
  ```

---

## Task 4 — Bulk2FAResetModal component

### Step 4.1 — Write failing test (3 min)

- [ ] Create `frontend/src/components/admin/__tests__/Bulk2FAResetModal.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Bulk2FAResetModal from '../Bulk2FAResetModal';

const mockAuthFetch = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({ authFetch: mockAuthFetch }),
}));
jest.mock('../../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

describe('Bulk2FAResetModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders warning text with user count', () => {
    render(<Bulk2FAResetModal userIds={['id1', 'id2', 'id3']} onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText(/force 3 users to re-enroll/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<Bulk2FAResetModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls authFetch with correct payload on confirm', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ updated: 2 }),
    });

    render(<Bulk2FAResetModal userIds={['id1', 'id2']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm reset/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockAuthFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/admin/users/bulk-2fa-reset',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userIds: ['id1', 'id2'] }),
      })
    );
  });

  it('shows error when API returns non-ok', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Internal server error' }),
    });

    render(<Bulk2FAResetModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm reset/i }));

    expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('disables button while loading', async () => {
    let resolvePromise;
    mockAuthFetch.mockReturnValueOnce(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<Bulk2FAResetModal userIds={['id1']} onClose={onClose} onSuccess={onSuccess} />);
    const btn = screen.getByRole('button', { name: /confirm reset/i });
    fireEvent.click(btn);

    expect(btn).toBeDisabled();

    resolvePromise({ ok: true, json: async () => ({ updated: 1 }) });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
```

- [ ] Run to confirm failure:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/Bulk2FAResetModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected: `Cannot find module '../Bulk2FAResetModal'`

### Step 4.2 — Implement Bulk2FAResetModal (4 min)

- [ ] Create `frontend/src/components/admin/Bulk2FAResetModal.js`:

```jsx
import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function Bulk2FAResetModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/users/bulk-2fa-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to reset 2FA');
        return;
      }
      onSuccess();
    } catch (err) {
      setError('Network error — failed to reset 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Shield size={20} className="text-orange-400" />
            Reset 2FA
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-300 text-sm">
          This will force {userIds.length} users to re-enroll in 2FA on next login. Their existing
          authenticator app codes will no longer work until they re-configure 2FA.
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1 text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Resetting…' : 'Confirm Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Bulk2FAResetModal;
```

- [ ] Run tests:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/Bulk2FAResetModal.test.js --watchAll=false 2>&1 | tail -15
  ```
  Expected:
  ```
  Tests: 5 passed, 5 total
  ```

- [ ] Commit:
  ```
  git add frontend/src/components/admin/Bulk2FAResetModal.js frontend/src/components/admin/__tests__/Bulk2FAResetModal.test.js
  git commit -m "feat: Bulk2FAResetModal with warning text and confirm flow"
  ```

---

## Task 5 — UserManagement: checkbox selection, floating bar, modal wiring

### Step 5.1 — Write failing test (5 min)

- [ ] Create `frontend/src/components/admin/__tests__/UserManagement.bulk.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagement } from '../UserManagement';

const mockAuthFetch = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    authFetch: mockAuthFetch,
    user: { _id: 'admin1', role: 'admin' },
  }),
}));
jest.mock('../../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

// Silence modal sub-components — verify they mount with correct props
jest.mock('../BulkEmailModal', () => ({ userIds, onClose }) => (
  <div data-testid="bulk-email-modal">BulkEmailModal for {userIds.length} users</div>
));
jest.mock('../BulkBadgeModal', () => ({ userIds, onClose }) => (
  <div data-testid="bulk-badge-modal">BulkBadgeModal for {userIds.length} users</div>
));
jest.mock('../Bulk2FAResetModal', () => ({ userIds, onClose }) => (
  <div data-testid="bulk-2fa-modal">Bulk2FAResetModal for {userIds.length} users</div>
));

const fakeUsers = [
  { _id: 'u1', username: 'alice', email: 'alice@test.com', displayName: 'Alice', role: 'editor', isActive: true, lastLoginAt: null },
  { _id: 'u2', username: 'bob', email: 'bob@test.com', displayName: 'Bob', role: 'editor', isActive: true, lastLoginAt: null },
  { _id: 'u3', username: 'carol', email: 'carol@test.com', displayName: 'Carol', role: 'admin', isActive: true, lastLoginAt: null },
];

describe('UserManagement bulk selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: fakeUsers, total: 3 }),
    });
  });

  it('renders a checkbox column header and checkboxes for each row', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    const checkboxes = screen.getAllByRole('checkbox');
    // 1 header checkbox + 3 row checkboxes
    expect(checkboxes.length).toBe(4);
  });

  it('selecting a row checkbox shows the floating action bar', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // first row checkbox (index 0 is header)

    expect(await screen.findByText(/1 users? selected/i)).toBeInTheDocument();
  });

  it('header checkbox selects all visible rows', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(headerCheckbox);

    expect(await screen.findByText(/3 users? selected/i)).toBeInTheDocument();
  });

  it('Clear link deselects all users', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(headerCheckbox);
    await screen.findByText(/3 users? selected/i);

    fireEvent.click(screen.getByText(/clear/i));
    await waitFor(() => expect(screen.queryByText(/users? selected/i)).not.toBeInTheDocument());
  });

  it('Email button opens BulkEmailModal', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    await screen.findByText(/1 users? selected/i);

    fireEvent.click(screen.getByRole('button', { name: /email/i }));
    expect(await screen.findByTestId('bulk-email-modal')).toBeInTheDocument();
  });

  it('Badge button opens BulkBadgeModal', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    await screen.findByText(/1 users? selected/i);

    fireEvent.click(screen.getByRole('button', { name: /badge/i }));
    expect(await screen.findByTestId('bulk-badge-modal')).toBeInTheDocument();
  });

  it('2FA Reset button opens Bulk2FAResetModal', async () => {
    render(<UserManagement />);
    await screen.findByText('alice');

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    await screen.findByText(/1 users? selected/i);

    fireEvent.click(screen.getByRole('button', { name: /2fa reset/i }));
    expect(await screen.findByTestId('bulk-2fa-modal')).toBeInTheDocument();
  });

  it('Select all matching filter button calls bulk-select API and merges IDs', async () => {
    // Reset and set up two sequential calls
    mockAuthFetch.mockReset();
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: fakeUsers, total: 3 }),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ['u1', 'u2', 'u3'],
    });

    render(<UserManagement />);
    await screen.findByText('alice');

    fireEvent.click(await screen.findByRole('button', { name: /select all.*matching/i }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/users/bulk-select'),
        undefined
      );
    });
    expect(await screen.findByText(/3 users? selected/i)).toBeInTheDocument();
  });
});
```

- [ ] Run to confirm failure:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/UserManagement.bulk.test.js --watchAll=false 2>&1 | tail -20
  ```
  Expected: multiple test failures — checkbox not rendered, action bar not rendered, etc.

### Step 5.2 — Implement UserManagement changes (5 min)

- [ ] Replace the entire contents of `frontend/src/components/admin/UserManagement.js` with:

```jsx
import React, { useState, useEffect } from 'react';
import { Search, UserCog, Shield, Eye, Edit2, Trash2, CheckCircle, XCircle, Mail, Award } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import BulkEmailModal from './BulkEmailModal';
import BulkBadgeModal from './BulkBadgeModal';
import Bulk2FAResetModal from './Bulk2FAResetModal';

export function UserManagement() {
  const { authFetch, user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/users?limit=100`);
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u._id === userId ? updatedUser : u));
        setEditingUser(null);
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUsers(users.filter(u => u._id !== userId));
        setSelectedUserIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  const toggleRowSelection = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const isPageAllSelected = filteredUsers.length > 0 &&
    filteredUsers.every(u => selectedUserIds.has(u._id));

  const toggleSelectAllPage = () => {
    if (isPageAllSelected) {
      setSelectedUserIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach(u => next.delete(u._id));
        return next;
      });
    } else {
      setSelectedUserIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach(u => next.add(u._id));
        return next;
      });
    }
  };

  const handleSelectAllMatching = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await authFetch(`${API_URL}/admin/users/bulk-select?${params.toString()}`);
      const ids = await response.json();
      if (Array.isArray(ids)) {
        setSelectedUserIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to select all matching users', err);
    }
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  const handleBulkActionSuccess = () => {
    clearSelection();
    setShowEmailModal(false);
    setShowBadgeModal(false);
    setShow2FAModal(false);
  };

  // ── Role badge renderer ───────────────────────────────────────────────────

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-red-500/20 text-red-300 border-red-500/50',
      editor: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      viewer: 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    };
    const icons = {
      admin: Shield,
      editor: Edit2,
      viewer: Eye
    };
    const Icon = icons[role] || Eye;

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${styles[role] || styles.viewer}`}>
        <Icon size={12} />
        {role}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={fetchUsers} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          onClick={handleSelectAllMatching}
          className="text-sm text-purple-400 hover:text-purple-300 whitespace-nowrap"
        >
          Select all matching filter
        </button>
        <span className="text-gray-400">{filteredUsers.length} users</span>
      </div>

      <div className="bg-gray-700/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={isPageAllSelected}
                  onChange={toggleSelectAllPage}
                  className="rounded border-gray-500 text-purple-500 focus:ring-purple-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Last Login</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredUsers.map((user) => (
              <tr
                key={user._id}
                className={`hover:bg-gray-700/50 ${selectedUserIds.has(user._id) ? 'bg-purple-900/10' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(user._id)}
                    onChange={() => toggleRowSelection(user._id)}
                    className="rounded border-gray-500 text-purple-500 focus:ring-purple-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white font-medium">{user.displayName || user.username}</p>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                    <p className="text-gray-500 text-xs">@{user.username}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingUser === user._id ? (
                    <select
                      defaultValue={user.role}
                      onChange={(e) => updateUser(user._id, { role: e.target.value })}
                      className="bg-gray-600 text-white rounded px-2 py-1 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    getRoleBadge(user.role)
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.isActive ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <CheckCircle size={14} />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 text-sm">
                      <XCircle size={14} />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingUser(editingUser === user._id ? null : user._id)}
                      className="p-1 text-blue-400 hover:text-blue-300"
                      title="Edit role"
                    >
                      <UserCog size={16} />
                    </button>
                    <button
                      onClick={() => updateUser(user._id, { isActive: !user.isActive })}
                      className={`p-1 ${user.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                    {user._id !== currentUser._id && (
                      <button
                        onClick={() => deleteUser(user._id, user.username)}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating action bar — fixed bottom, z-50, only shown when users are selected */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-white font-medium text-sm">
            {selectedUserIds.size} {selectedUserIds.size === 1 ? 'user' : 'users'} selected
          </span>
          <button
            onClick={clearSelection}
            className="text-gray-400 hover:text-gray-200 text-sm underline"
          >
            Clear
          </button>
          <div className="w-px h-5 bg-gray-600" />
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            <Mail size={15} />
            Email
          </button>
          <button
            onClick={() => setShowBadgeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium"
          >
            <Award size={15} />
            Badge
          </button>
          <button
            onClick={() => setShow2FAModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium"
          >
            <Shield size={15} />
            2FA Reset
          </button>
        </div>
      )}

      {/* Bulk action modals — imported at top of file, NOT defined inside render */}
      {showEmailModal && (
        <BulkEmailModal
          userIds={Array.from(selectedUserIds)}
          onClose={() => setShowEmailModal(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}
      {showBadgeModal && (
        <BulkBadgeModal
          userIds={Array.from(selectedUserIds)}
          onClose={() => setShowBadgeModal(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}
      {show2FAModal && (
        <Bulk2FAResetModal
          userIds={Array.from(selectedUserIds)}
          onClose={() => setShow2FAModal(false)}
          onSuccess={handleBulkActionSuccess}
        />
      )}
    </div>
  );
}

export default UserManagement;
```

- [ ] Run tests:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/UserManagement.bulk.test.js --watchAll=false 2>&1 | tail -20
  ```
  Expected:
  ```
  Tests: 8 passed, 8 total
  ```

- [ ] Commit:
  ```
  git add frontend/src/components/admin/UserManagement.js frontend/src/components/admin/__tests__/UserManagement.bulk.test.js
  git commit -m "feat: UserManagement checkbox selection, floating action bar, bulk modal wiring"
  ```

---

## Task 6 — Final verification

### Step 6.1 — Run all new tests together (2 min)

- [ ] Run backend suite:
  ```
  cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage 2>&1 | tail -10
  ```
  Expected: `Tests: 22 passed, 22 total`

- [ ] Run frontend suite for all new admin test files:
  ```
  cd frontend && npx react-scripts test src/components/admin/__tests__/ --watchAll=false 2>&1 | tail -15
  ```
  Expected: `Test Suites: 4 passed, 4 total` (BulkEmailModal, BulkBadgeModal, Bulk2FAResetModal, UserManagement.bulk — 24 tests total)

- [ ] Run full backend test suite to confirm no regressions:
  ```
  cd backend && npx jest --no-coverage 2>&1 | tail -10
  ```
  Expected: all pre-existing suites still pass.

### Step 6.2 — Final commit check (1 min)

- [ ] Confirm clean working tree and 5 feature commits visible:
  ```
  git log --oneline -6
  ```
  Expected output shows 5 commits from this feature:
  ```
  <sha> feat: UserManagement checkbox selection, floating action bar, bulk modal wiring
  <sha> feat: Bulk2FAResetModal with warning text and confirm flow
  <sha> feat: BulkBadgeModal component with badge fetch, dropdown, and grant
  <sha> feat: BulkEmailModal component with validation and API integration
  <sha> feat: bulk user admin routes — select, email, badge, 2FA reset with audit trail
  ```

---

## Implementation notes

**Route ordering in admin.js is critical:** The four new `/users/bulk-*` routes must be inserted AFTER the existing `router.get('/users', ...)` block (ends ~line 68) and BEFORE `router.get('/users/:id', ...)` at line 74. Express matches routes in registration order — if `/users/:id` is registered first, `bulk-select`, `bulk-email`, `bulk-badge`, and `bulk-2fa-reset` will all be matched with `id = "bulk-select"` etc. and fail with a CastError.

**Badge subdoc structure:** The User model stores badges as an array of embedded subdocuments (`{ name, description, icon, earnedAt }`), not ObjectId refs to Badge documents. The bulk-badge route must fetch the Badge document to get the `name`/`description`/`icon` values, then push the complete subdoc into `user.badges`. Using `User.updateMany` with `$addToSet: { badges: badgeId }` would push the raw ID string, not the subdoc, and would not match the schema.

**2FA fields not in schema:** `twoFactorSecret` and `twoFactorEnabled` are not currently declared in `backend/models/User.js`. The `User.updateMany` with `$set` will write these fields to MongoDB documents regardless (Mongoose allows this in bulk operations). The tests verify audit log creation rather than field clearing, since `modifiedCount` may be 0 if the fields do not yet exist on the documents. If formal schema support is needed, add to User schema: `twoFactorSecret: { type: String, default: null }` and `twoFactorEnabled: { type: Boolean, default: false }`.

**Email transport in tests:** `EMAIL_USER` and `EMAIL_PASS` are not set in the test environment, so `createTransporter()` returns `null`. The bulk-email tests verify the 503 response path rather than actual mail delivery. To test the send path in integration, mock `createTransporter` in the test to return `{ sendMail: jest.fn().mockResolvedValue({}) }`.

**Component defined at module scope:** All three modals are standalone files imported at the top of UserManagement.js. They must never be defined as inline functions inside the `UserManagement` component body — doing so causes a new component type on every render, which unmounts/remounts the modal DOM on every keystroke and resets all input state.

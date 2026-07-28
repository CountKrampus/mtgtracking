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

// admin.js applies verifyToken/requireAuth internally — no need to mount them again here.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

async function createAdmin(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `admin_${suffix}@test.com`,
    username: `admin_${suffix}`,
    passwordHash: 'hashedpass',
    role: 'admin',
    isActive: true,
    ...overrides,
  });
}

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`,
    username: `user_${suffix}`,
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

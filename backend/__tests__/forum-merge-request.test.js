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

describe('Forum merge-request flow', () => {
  let app, admin, forumMod, member, category, sourceThread, targetThread;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'forum_mod', displayName: 'Forum Mod', permissions: ['forum:moderate'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    forumMod = await User.create({ email: 'fm@test.com', username: 'fm1', passwordHash: 'x', role: 'forum_mod' });
    member = await User.create({ email: 'member@test.com', username: 'member1', passwordHash: 'x', role: 'user' });

    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    sourceThread = await ForumThread.create({
      title: 'Lightning Bolt combos', categoryId: category._id, authorId: member._id, content: 'source'
    });
    targetThread = await ForumThread.create({
      title: 'Lightning Bolt combos (repost)', categoryId: category._id, authorId: member._id, content: 'target'
    });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('rejects unauthenticated submissions without creating a request', async () => {
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .send({ suggestedThreadId: targetThread._id.toString(), reason: 'duplicate' })
      .expect(401);

    const fresh = await ForumThread.findById(sourceThread._id);
    expect(fresh.mergeRequest.suggestedThreadId).toBeNull();
    expect(fresh.mergeRequest.suggestedBy).toBeNull();
  });

  test('authenticated member submission creates a pending merge request', async () => {
    const res = await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .send({ suggestedThreadId: targetThread._id.toString(), reason: 'Same thread, reposted' })
      .expect(200);

    expect(res.body.success).toBe(true);

    const fresh = await ForumThread.findById(sourceThread._id);
    expect(fresh.mergeRequest.status).toBe('pending');
    expect(String(fresh.mergeRequest.suggestedThreadId)).toBe(String(targetThread._id));
    expect(String(fresh.mergeRequest.suggestedBy)).toBe(String(member._id));
    expect(fresh.mergeRequest.reason).toBe('Same thread, reposted');
    expect(fresh.mergeRequest.reviewedBy).toBeNull();
    expect(fresh.mergeRequest.reviewedAt).toBeNull();
  });

  test('requires a valid, different suggestedThreadId', async () => {
    const auth = `Bearer ${makeToken(member)}`;

    // missing target
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', auth)
      .send({ reason: 'no target' })
      .expect(400);

    // self-merge
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', auth)
      .send({ suggestedThreadId: sourceThread._id.toString() })
      .expect(400);

    // unknown target
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', auth)
      .send({ suggestedThreadId: new mongoose.Types.ObjectId().toString() })
      .expect(404);

    // unknown source thread
    await request(app)
      .put(`/api/forum/threads/${new mongoose.Types.ObjectId()}/merge-request`)
      .set('Authorization', auth)
      .send({ suggestedThreadId: targetThread._id.toString() })
      .expect(404);

    const fresh = await ForumThread.findById(sourceThread._id);
    expect(fresh.mergeRequest.suggestedThreadId).toBeNull();
  });

  test('legacy {status:"approved"} payload can no longer review a request unauthenticated-by-permission', async () => {
    const auth = `Bearer ${makeToken(member)}`;

    // Establish a legitimate pending request first
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', auth)
      .send({ suggestedThreadId: targetThread._id.toString(), reason: 'duplicate' })
      .expect(200);

    // The old endpoint accepted {status, reviewedBy} from anyone — now the
    // submit route only understands {suggestedThreadId, reason}, so this is
    // rejected and nothing is reviewed or merged.
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', auth)
      .send({ status: 'approved', reviewedBy: member._id.toString() })
      .expect(400);

    const fresh = await ForumThread.findById(sourceThread._id);
    expect(fresh.mergeRequest.status).toBe('pending');
    expect(fresh.mergeRequest.reviewedBy).toBeNull();
    expect(fresh.mergeRequest.reason).toBe('duplicate');
  });

  test('admin merge-requests list requires auth and forum:moderate', async () => {
    // anonymous
    await request(app).get('/api/forum/admin/merge-requests').expect(401);

    // authenticated but no forum:moderate
    await request(app)
      .get('/api/forum/admin/merge-requests')
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .expect(403);

    // moderator role (built-in, lacks forum:moderate) also blocked
    const moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    await request(app)
      .get('/api/forum/admin/merge-requests')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);

    // create a pending request, then list it with a permitted role
    await request(app)
      .put(`/api/forum/threads/${sourceThread._id}/merge-request`)
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .send({ suggestedThreadId: targetThread._id.toString(), reason: 'duplicate' })
      .expect(200);

    const res = await request(app)
      .get('/api/forum/admin/merge-requests')
      .set('Authorization', `Bearer ${makeToken(forumMod)}`)
      .expect(200);

    expect(res.body.pending).toHaveLength(1);
    expect(String(res.body.pending[0]._id)).toBe(String(sourceThread._id));
    expect(res.body.pending[0].mergeRequest.status).toBe('pending');
    expect(res.body.pending[0].mergeRequest.suggestedThreadId.title).toBe(targetThread.title);

    // admin passes too (permission 'all')
    await request(app)
      .get('/api/forum/admin/merge-requests')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
  });
});

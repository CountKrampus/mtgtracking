process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const ContentReport = require('../models/ContentReport');
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const UserWarning = require('../models/UserWarning');
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

describe('GET /api/admin/moderation-queue', () => {
  let app, moderator, category, thread, author;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'forum_mod', displayName: 'Forum Mod', permissions: ['forum:moderate'], isBuiltIn: false });
    await refreshRoleCache();

    moderator = await User.create({ email: 'fm@test.com', username: 'fm1', passwordHash: 'x', role: 'forum_mod' });
    author = await User.create({ email: 'author@test.com', username: 'author1', passwordHash: 'x', role: 'user' });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: author._id, content: 'hello'
    });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns 200 with grouped results', async () => {
    const post = await ForumPost.create({ threadId: thread._id, authorId: author._id, body: 'spammy post' });
    await ContentReport.insertMany([
      {
        contentId: post._id, contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(), reason: 'spam', source: 'user',
        status: 'pending', suggestedAction: 'hide_and_warn',
      },
      {
        contentId: post._id, contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(), reason: 'harassment', source: 'user',
        status: 'pending', suggestedAction: 'hide_and_warn',
      },
    ]);

    const res = await request(app)
      .get('/api/admin/moderation-queue')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    const item = res.body.items.find(i => i.contentId === post._id.toString());
    expect(item).toBeDefined();
    expect(item.reportCount).toBe(2);
    expect(item.contentPreview).toBe('spammy post');
    expect(item.authorUsername).toBe('author1');
  });

  test('filters by status query param', async () => {
    const post = await ForumPost.create({ threadId: thread._id, authorId: author._id, body: 'actioned post' });
    await ContentReport.create({
      contentId: post._id, contentType: 'post',
      reportedBy: new mongoose.Types.ObjectId(), reason: 'other', source: 'user',
      status: 'actioned', suggestedAction: 'review',
    });

    const res = await request(app)
      .get('/api/admin/moderation-queue?status=actioned')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
    const item = res.body.items.find(i => i.contentId === post._id.toString());
    expect(item).toBeDefined();
  });

  test('filters by contentType query param', async () => {
    const post = await ForumPost.create({ threadId: thread._id, authorId: author._id, body: 'a post' });
    await ContentReport.insertMany([
      {
        contentId: post._id, contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(), reason: 'other', source: 'user',
        status: 'pending', suggestedAction: 'review',
      },
      {
        contentId: thread._id, contentType: 'thread',
        reportedBy: new mongoose.Types.ObjectId(), reason: 'spam', source: 'user',
        status: 'pending', suggestedAction: 'hide_and_warn',
      },
    ]);

    const res = await request(app)
      .get('/api/admin/moderation-queue?contentType=thread')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
    const postItem = res.body.items.find(i => i.contentId === post._id.toString());
    const threadItem = res.body.items.find(i => i.contentId === thread._id.toString());
    expect(postItem).toBeUndefined();
    expect(threadItem).toBeDefined();
  });

  test('returns 403 for a role without forum:moderate', async () => {
    const viewer = await User.create({ email: 'v@test.com', username: 'viewer1', passwordHash: 'x', role: 'viewer' });
    await request(app)
      .get('/api/admin/moderation-queue')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .expect(403);
  });
});

describe('POST /api/admin/moderation-queue/:contentId/action', () => {
  let app, moderator, category, thread, author, post;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'forum_mod', displayName: 'Forum Mod', permissions: ['forum:moderate'], isBuiltIn: false });
    await refreshRoleCache();

    moderator = await User.create({ email: 'fm@test.com', username: 'fm1', passwordHash: 'x', role: 'forum_mod' });
    author = await User.create({ email: 'author@test.com', username: 'author1', passwordHash: 'x', role: 'user' });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: author._id, content: 'hello'
    });
    post = await ForumPost.create({ threadId: thread._id, authorId: author._id, body: 'Test post body content' });
    await ContentReport.create({
      contentId: post._id, contentType: 'post',
      reportedBy: new mongoose.Types.ObjectId(), reason: 'spam', source: 'user',
      status: 'pending', suggestedAction: 'hide_and_warn',
    });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('hide action sets isHidden=true on content', async () => {
    const res = await request(app)
      .post(`/api/admin/moderation-queue/${post._id}/action`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ action: 'hide', contentType: 'post' })
      .expect(200);
    expect(res.body.ok).toBe(true);

    const updated = await ForumPost.findById(post._id);
    expect(updated.isHidden).toBe(true);
    expect(updated.hiddenReason).toBe('Moderator action');
  });

  test('hide_and_warn action creates a UserWarning', async () => {
    await request(app)
      .post(`/api/admin/moderation-queue/${post._id}/action`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ action: 'hide_and_warn', contentType: 'post' })
      .expect(200);

    const warnings = await UserWarning.find({ userId: author._id });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].escalationLevel).toBe(1);
    expect(warnings[0].warnedBy.toString()).toBe(moderator._id.toString());
  });

  test('dismiss action marks reports as dismissed', async () => {
    await request(app)
      .post(`/api/admin/moderation-queue/${post._id}/action`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ action: 'dismiss', contentType: 'post' })
      .expect(200);

    const reports = await ContentReport.find({ contentId: post._id });
    expect(reports.every(r => r.status === 'dismissed')).toBe(true);
  });

  test('all actions mark pending reports as actioned with reviewedBy/reviewedAt', async () => {
    await request(app)
      .post(`/api/admin/moderation-queue/${post._id}/action`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ action: 'hide', contentType: 'post' })
      .expect(200);

    const reports = await ContentReport.find({ contentId: post._id });
    expect(reports.every(r => r.status === 'actioned')).toBe(true);
    expect(reports.every(r => r.reviewedBy?.toString() === moderator._id.toString())).toBe(true);
    expect(reports.every(r => r.reviewedAt !== null)).toBe(true);
  });
});

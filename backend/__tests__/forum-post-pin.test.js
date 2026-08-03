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
const ForumPost = require('../models/ForumPost');
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

describe('PUT /api/forum/posts/:postId/pin', () => {
  let app, admin, regularUser, category, thread, post;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    regularUser = await User.create({ email: 'user@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({ title: 'Test thread', categoryId: category._id, authorId: regularUser._id, content: 'hello' });
    post = await ForumPost.create({ threadId: thread._id, authorId: regularUser._id, body: 'a reply' });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('admin (via forum:moderate) can pin a reply', async () => {
    const res = await request(app)
      .put(`/api/forum/posts/${post._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.post.isPinned).toBe(true);
  });

  test('pinning again unpins it (toggle)', async () => {
    await request(app).put(`/api/forum/posts/${post._id}/pin`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);
    const res = await request(app).put(`/api/forum/posts/${post._id}/pin`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);

    expect(res.body.post.isPinned).toBe(false);
  });

  test('a regular user (no forum:moderate) cannot pin a reply', async () => {
    await request(app)
      .put(`/api/forum/posts/${post._id}/pin`)
      .set('Authorization', `Bearer ${makeToken(regularUser)}`)
      .expect(403);
  });

  test('404 for a non-existent post', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .put(`/api/forum/posts/${fakeId}/pin`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(404);
  });
});

describe('GET /api/forum/threads/:threadId sorts pinned replies first', () => {
  test('a pinned reply appears before unpinned replies regardless of creation order', async () => {
    const app2 = buildApp();
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'x', role: 'editor' });
    const cat = await ForumCategory.create({ name: 'General', slug: 'general-sort-test', description: '' });
    const thr = await ForumThread.create({ title: 'Sort test', categoryId: cat._id, authorId: user._id, content: 'hi' });

    const first = await ForumPost.create({ threadId: thr._id, authorId: user._id, body: 'first reply, oldest' });
    const second = await ForumPost.create({ threadId: thr._id, authorId: user._id, body: 'second reply, pin this one' });
    await ForumPost.findByIdAndUpdate(second._id, { isPinned: true });

    const res = await request(app2).get(`/api/forum/threads/${thr._id}`).expect(200);

    expect(res.body.posts[0]._id).toBe(second._id.toString());
    expect(res.body.posts[1]._id).toBe(first._id.toString());
  });
});

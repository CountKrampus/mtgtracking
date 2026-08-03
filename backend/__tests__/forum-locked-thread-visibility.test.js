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

describe('Locking a thread does not hide it from listings', () => {
  let app, admin, user, category;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    user = await User.create({ email: 'user@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    category = await ForumCategory.create({ name: 'General', slug: 'general-lock-test', description: '' });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('a locked thread still appears in the category thread listing', async () => {
    const thread = await ForumThread.create({ title: 'Locked but visible', categoryId: category._id, authorId: user._id, content: 'hi' });
    await request(app).put(`/api/forum/threads/${thread._id}/lock`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);

    const res = await request(app).get(`/api/forum/categories/${category._id}/threads`).expect(200);

    expect(res.body.threads.map(t => t._id)).toContain(thread._id.toString());
    expect(res.body.pagination.total).toBe(1);
  });

  test('a locked thread still appears in the site-wide feed', async () => {
    const thread = await ForumThread.create({ title: 'Locked but visible in feed', categoryId: category._id, authorId: user._id, content: 'hi' });
    await request(app).put(`/api/forum/threads/${thread._id}/lock`).set('Authorization', `Bearer ${makeToken(admin)}`).expect(200);

    const res = await request(app).get('/api/forum/feed').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    const threadIds = res.body.items.filter(i => i.type === 'thread').map(t => t._id.toString());
    expect(threadIds).toContain(thread._id.toString());
  });

  test('a genuinely hidden thread is still excluded from the feed', async () => {
    const visible = await ForumThread.create({ title: 'Visible thread', categoryId: category._id, authorId: user._id, content: 'hi' });
    const hidden = await ForumThread.create({ title: 'Hidden thread', categoryId: category._id, authorId: user._id, content: 'hi', isHidden: true });

    const res = await request(app).get('/api/forum/feed').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    const threadIds = res.body.items.filter(i => i.type === 'thread').map(t => t._id.toString());
    expect(threadIds).toContain(visible._id.toString());
    expect(threadIds).not.toContain(hidden._id.toString());
  });
});

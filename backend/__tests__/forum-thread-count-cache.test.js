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
const forumCache = require('../cache/forumCache');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  // forumCache is a module-level singleton, not reset between tests the way
  // the database is - without this, a later test's "before" GET /categories
  // call can serve a stale tree cached by an earlier test in this same file.
  forumCache.del('categories:tree');
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
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

describe('POST /api/forum/threads invalidates the categories:tree cache', () => {
  test('a newly created thread\'s count is visible immediately via GET /categories, not just after the cache TTL expires', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'poster@test.com', username: 'poster', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-cache-test', description: '' });

    // Populate the cache with the pre-creation state (threadCount: 0).
    const before = await request(app).get('/api/forum/categories').expect(200);
    const findCount = (nodes) => {
      for (const n of nodes) {
        if (n._id === category._id.toString()) return n.threadCount;
        if (n.children) {
          const found = findCount(n.children);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };
    expect(findCount(before.body)).toBe(0);

    await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'A totally unique thread title xyz123', content: 'hello world' })
      .expect(201);

    const after = await request(app).get('/api/forum/categories').expect(200);
    expect(findCount(after.body)).toBe(1);
  });
});

describe('DELETE /api/forum/threads/:threadId invalidates the categories:tree cache', () => {
  test('a deleted thread\'s count is visible immediately via GET /categories', async () => {
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    const app = buildApp();
    const admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-cache-delete-test', description: '', threadCount: 1 });
    const thread = await ForumThread.create({ title: 'To be deleted', categoryId: category._id, authorId: admin._id, content: 'bye' });

    const findCount = (nodes) => {
      for (const n of nodes) {
        if (n._id === category._id.toString()) return n.threadCount;
        if (n.children) {
          const found = findCount(n.children);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };

    // Populate the cache with the pre-deletion state (threadCount: 1).
    const before = await request(app).get('/api/forum/categories').expect(200);
    expect(findCount(before.body)).toBe(1);

    await request(app)
      .delete(`/api/forum/threads/${thread._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    const after = await request(app).get('/api/forum/categories').expect(200);
    expect(findCount(after.body)).toBe(0);
  });
});

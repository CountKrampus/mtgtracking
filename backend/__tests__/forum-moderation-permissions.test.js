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
    await Role.syncIndexes();
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

process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
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

describe('User moderation route permissions', () => {
  let app, admin, moderator, viewer;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    viewer = await User.create({ email: 'viewer@test.com', username: 'viewer1', passwordHash: 'x', role: 'viewer' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('moderator (with user:ban via grantMigrationPermissions) can list account bans', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
  });

  test('viewer (no user:ban permission) cannot list account bans', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .expect(403);
  });

  test('admin (via "all") can list account bans and mutes', async () => {
    await request(app)
      .get('/api/admin/account-bans')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .get('/api/admin/mutes')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
  });

  test('moderator (with user:appeal:review via grantMigrationPermissions) can list ban appeals', async () => {
    await request(app)
      .get('/api/admin/ban-appeals')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);
  });

  test('only a role with user:role:manage can reassign a user role', async () => {
    const target = await User.create({ email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user' });

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ newRole: 'support' })
      .expect(403);

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'support' })
      .expect(200);
  });
});

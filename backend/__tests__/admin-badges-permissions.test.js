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
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('Badges/cosmetics route permissions', () => {
  let app, admin, badgeManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'badge_manager', displayName: 'Badge Manager', permissions: ['badges:manage'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    badgeManager = await User.create({ email: 'bm@test.com', username: 'bm1', passwordHash: 'x', role: 'badge_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('a custom role granted badges:manage can list badges', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(badgeManager)}`)
      .expect(200);
  });

  test('moderator (no badges:manage) cannot list badges or admin cosmetics', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
    await request(app)
      .get('/api/forum/admin/cosmetics')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('admin can list badges and admin cosmetics', async () => {
    await request(app)
      .get('/api/admin/badges')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .get('/api/forum/admin/cosmetics')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
  });
});

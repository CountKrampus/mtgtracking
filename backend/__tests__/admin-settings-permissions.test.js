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

describe('System settings route permissions', () => {
  let app, admin, systemManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'system_manager', displayName: 'System Manager', permissions: ['system:settings:manage'], isBuiltIn: false });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    systemManager = await User.create({ email: 'sm@test.com', username: 'sm1', passwordHash: 'x', role: 'system_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('a custom role granted system:settings:manage can read settings', async () => {
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${makeToken(systemManager)}`)
      .expect(200);
  });

  test('moderator (no system:settings:manage) cannot read settings or toggle maintenance', async () => {
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
    await request(app)
      .post('/api/admin/maintenance')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ enabled: true })
      .expect(403);
  });

  test('admin can toggle maintenance mode', async () => {
    await request(app)
      .post('/api/admin/maintenance')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ enabled: true })
      .expect(200);
  });
});

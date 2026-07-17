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

describe('Pricing/audit route permissions', () => {
  let app, contentManager, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    contentManager = await User.create({ email: 'cm@test.com', username: 'cm1', passwordHash: 'x', role: 'content_manager' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('content_manager (with prices:force-update via grantMigrationPermissions) can start a force-price-update job', async () => {
    const res = await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .expect(200);

    expect(res.body.jobId).toBeDefined();
  });

  test('moderator (no prices:force-update or cards:audit) cannot start a force-price-update job or audit', async () => {
    await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);

    await request(app)
      .post('/api/admin/audits/run')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('content_manager can run a collection audit (cards:audit, unchanged by migration)', async () => {
    await request(app)
      .post('/api/admin/audits/run')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .expect(201);
  });
});

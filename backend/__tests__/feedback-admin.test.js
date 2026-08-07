process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Feedback = require('../models/Feedback');
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

describe('Admin feedback routes', () => {
  let app, admin, supportAgent, regularUser;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'support_agent', displayName: 'Support Agent', permissions: ['feedback:read', 'feedback:manage'] });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    supportAgent = await User.create({ email: 'sa@test.com', username: 'sa1', passwordHash: 'x', role: 'support_agent' });
    regularUser = await User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('feedback:read can list feedback with submitter info', async () => {
    await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });

    const res = await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .expect(200);

    expect(res.body.feedback).toHaveLength(1);
    expect(res.body.feedback[0].submitter.username).toBe('user1');
  });

  test('a role without feedback:read cannot list feedback', async () => {
    await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(regularUser)}`)
      .expect(403);
  });

  test('feedback:manage can update status, rejects an invalid status value', async () => {
    const item = await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });

    const res = await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .send({ status: 'reviewed' })
      .expect(200);
    expect(res.body.feedback.status).toBe('reviewed');

    await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .send({ status: 'not-a-real-status' })
      .expect(400);
  });

  test('admin (has "all" permissions) can list and update feedback', async () => {
    const item = await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });
    await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ status: 'closed' })
      .expect(200);
  });
});

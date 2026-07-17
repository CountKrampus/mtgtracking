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

describe('Dynamic role validation', () => {
  let app, admin, target;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    target = await User.create({ email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('PUT /users/:userId/role accepts a newly-created custom role name', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'event_coordinator' })
      .expect(200);

    expect(res.body.newRole).toBe('event_coordinator');
  });

  test('PUT /users/:userId/role rejects a role name that does not exist', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ newRole: 'not_a_real_role' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_ROLE');
  });

  test('PUT /users/:id (general update) rejects a role name that does not exist', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ role: 'not_a_real_role' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_ROLE');
  });

  test('PUT /users/:id (general update) accepts a valid built-in role', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ role: 'moderator' })
      .expect(200);

    expect(res.body.role).toBe('moderator');
  });

  test('User schema no longer rejects a custom role name via enum validation', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: [] });
    const user = new User({
      email: 'custom@test.com', username: 'customrole', passwordHash: 'x', role: 'event_coordinator'
    });
    await expect(user.save()).resolves.toBeDefined();
  });
});

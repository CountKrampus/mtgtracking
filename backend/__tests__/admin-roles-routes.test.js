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
  app.use('/api/admin/roles', require('../routes/roles'));
  return app;
}

describe('Admin roles routes', () => {
  let app, admin, moderator;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('GET / lists all 8 seeded built-in roles for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.roles).toHaveLength(8);
    expect(res.body.roles.map(r => r.name)).toEqual(
      expect.arrayContaining(['admin', 'moderator', 'content_manager', 'community_manager', 'support', 'user', 'editor', 'viewer'])
    );
  });

  test('GET / is denied for a role without roles:manage or user:role:manage (moderator, before any grant)', async () => {
    await request(app)
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });

  test('GET /permissions-catalog returns the catalog grouped by domain', async () => {
    const res = await request(app)
      .get('/api/admin/roles/permissions-catalog')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.catalog).toHaveProperty('User Management');
  });

  test('POST / creates a custom role', async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] })
      .expect(201);

    expect(res.body.role.name).toBe('event_coordinator');
    expect(res.body.role.isBuiltIn).toBe(false);

    const stored = await Role.findOne({ name: 'event_coordinator' });
    expect(stored.permissions).toEqual(['community:events']);
  });

  test("POST / rejects assigning 'all' to a custom role", async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'super_role', displayName: 'Super Role', permissions: ['all'] })
      .expect(400);

    expect(res.body.code).toBe('CANNOT_ASSIGN_ALL');
  });

  test('POST / rejects a duplicate role name', async () => {
    const res = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ name: 'moderator', displayName: 'Duplicate', permissions: [] })
      .expect(409);

    expect(res.body.code).toBe('ROLE_NAME_EXISTS');
  });

  test("PUT /:id blocks removing 'all' from the last all-access role", async () => {
    const adminRole = await Role.findOne({ name: 'admin' });

    const res = await request(app)
      .put(`/api/admin/roles/${adminRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ permissions: [] })
      .expect(400);

    expect(res.body.code).toBe('LAST_ALL_ACCESS_ROLE');
  });

  test('PUT /:id blocks removing roles:manage from your own only-role-with-it', async () => {
    const modRole = await Role.findOne({ name: 'moderator' });
    modRole.permissions = [...modRole.permissions, 'roles:manage'];
    await modRole.save();
    await refreshRoleCache();

    const withoutRolesManage = modRole.permissions.filter(p => p !== 'roles:manage');

    const res = await request(app)
      .put(`/api/admin/roles/${modRole._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ permissions: withoutRolesManage })
      .expect(400);

    expect(res.body.code).toBe('LAST_ROLES_MANAGE_HOLDER');
  });

  test('PUT /:id allows editing a built-in role when the guardrails do not apply', async () => {
    const supportRole = await Role.findOne({ name: 'support' });

    const res = await request(app)
      .put(`/api/admin/roles/${supportRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ displayName: 'Support Staff', permissions: [...supportRole.permissions, 'ticket:manage'] })
      .expect(200);

    expect(res.body.role.displayName).toBe('Support Staff');
  });

  test('DELETE /:id blocks deleting a built-in role', async () => {
    const modRole = await Role.findOne({ name: 'moderator' });
    const res = await request(app)
      .delete(`/api/admin/roles/${modRole._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(400);
    expect(res.body.code).toBe('CANNOT_DELETE_BUILT_IN');
  });

  test('DELETE /:id blocks deleting a custom role that a user still holds', async () => {
    const custom = await Role.create({ name: 'temp_role', displayName: 'Temp Role', permissions: [], isBuiltIn: false });
    await refreshRoleCache();
    await User.create({ email: 'holder@test.com', username: 'holder', passwordHash: 'x', role: 'temp_role' });

    const res = await request(app)
      .delete(`/api/admin/roles/${custom._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(400);
    expect(res.body.code).toBe('ROLE_IN_USE');
  });

  test('DELETE /:id deletes an unused custom role', async () => {
    const custom = await Role.create({ name: 'temp_role2', displayName: 'Temp Role 2', permissions: [], isBuiltIn: false });
    await refreshRoleCache();

    await request(app)
      .delete(`/api/admin/roles/${custom._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(await Role.findById(custom._id)).toBeNull();
  });
});

process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');
const { requirePermission } = require('../middleware/auth');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = jest.fn(code => { res.statusCode = code; return res; });
  res.json = jest.fn(body => { res.body = body; return res; });
  return res;
}

describe('requirePermission middleware', () => {
  test("calls next() when the user's role has the exact permission", async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    const middleware = requirePermission('community:events');
    const req = { user: { role: 'event_coordinator' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("calls next() when the user's role has 'all'", async () => {
    await Role.create({ name: 'admin', displayName: 'Admin', permissions: ['all'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('roles:manage');
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 403 FORBIDDEN when the role lacks all required permissions', async () => {
    await Role.create({ name: 'viewer', displayName: 'Viewer', permissions: ['collection:view'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('roles:manage');
    const req = { user: { role: 'viewer' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.requiredPermissions).toEqual(['roles:manage']);
  });

  test('passes when the role has ANY of several required permissions (OR semantics)', async () => {
    await Role.create({ name: 'moderator', displayName: 'Moderator', permissions: ['user:ban'], isBuiltIn: true });
    await refreshRoleCache();

    const middleware = requirePermission('user:ban', 'user:appeal:review');
    const req = { user: { role: 'moderator' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 401 UNAUTHORIZED when there is no authenticated user', () => {
    const middleware = requirePermission('roles:manage');
    const req = { user: null };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

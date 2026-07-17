const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { getPermissionsForRole, hasPermission, refreshRoleCache } = require('../utils/permissions');

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

describe('permission cache', () => {
  test('getPermissionsForRole reads from the DB-backed cache after refreshRoleCache()', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    expect(getPermissionsForRole('event_coordinator')).toEqual(['community:events']);
  });

  test('hasPermission grants access when the role has the exact permission, denies otherwise', async () => {
    await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: ['community:events'] });
    await refreshRoleCache();

    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(true);
    expect(hasPermission({ role: 'event_coordinator' }, 'roles:manage')).toBe(false);
  });

  test("hasPermission grants every permission when the role has 'all'", async () => {
    await Role.create({ name: 'super_admin', displayName: 'Super Admin', permissions: ['all'], isBuiltIn: true });
    await refreshRoleCache();

    expect(hasPermission({ role: 'super_admin' }, 'roles:manage')).toBe(true);
    expect(hasPermission({ role: 'super_admin' }, 'literally:anything')).toBe(true);
  });

  test('reflects permission changes after a role is updated and the cache is refreshed', async () => {
    const role = await Role.create({ name: 'event_coordinator', displayName: 'Event Coordinator', permissions: [] });
    await refreshRoleCache();
    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(false);

    role.permissions = ['community:events'];
    await role.save();
    await refreshRoleCache();

    expect(hasPermission({ role: 'event_coordinator' }, 'community:events')).toBe(true);
  });

  test('falls back to the "user" default permissions for an unrecognized role once the cache is loaded', async () => {
    await refreshRoleCache(); // cache loaded, but empty (no roles seeded in this test)
    expect(getPermissionsForRole('totally_unknown_role')).toEqual(['collection:manage', 'deck:create', 'community:chat']);
  });

  test('hasPermission returns false for a missing user or missing role', () => {
    expect(hasPermission(null, 'roles:manage')).toBe(false);
    expect(hasPermission({}, 'roles:manage')).toBe(false);
  });
});

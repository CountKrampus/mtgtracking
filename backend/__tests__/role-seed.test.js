const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');
const { ROLE_PERMISSIONS } = require('../utils/permissions');

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

describe('Role.seedBuiltInRoles', () => {
  test('creates one Role doc per ROLE_PERMISSIONS key (8 built-in roles) with matching permissions', async () => {
    await Role.seedBuiltInRoles();

    const roles = await Role.find().lean();
    expect(roles).toHaveLength(8);

    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const doc = roles.find(r => r.name === name);
      expect(doc).toBeDefined();
      expect(doc.isBuiltIn).toBe(true);
      expect(doc.permissions).toEqual(permissions);
    }
  });

  test('sets a human-readable displayName for every built-in role', async () => {
    await Role.seedBuiltInRoles();
    const contentManager = await Role.findOne({ name: 'content_manager' });
    expect(contentManager.displayName).toBe('Content Manager');
  });

  test('is idempotent and does not clobber a manually-edited built-in role', async () => {
    await Role.seedBuiltInRoles();
    await Role.updateOne({ name: 'moderator' }, { $set: { permissions: ['chat:moderate'] } });

    await Role.seedBuiltInRoles(); // re-run, e.g. simulating a server restart

    const moderator = await Role.findOne({ name: 'moderator' });
    expect(moderator.permissions).toEqual(['chat:moderate']);
  });
});

describe('Role.grantMigrationPermissions', () => {
  test('adds user:ban and user:appeal:review to moderator, prices:force-update to content_manager', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();

    const moderator = await Role.findOne({ name: 'moderator' });
    expect(moderator.permissions).toEqual(expect.arrayContaining(['user:ban', 'user:appeal:review']));

    const contentManager = await Role.findOne({ name: 'content_manager' });
    expect(contentManager.permissions).toEqual(expect.arrayContaining(['prices:force-update']));
  });

  test('does not touch roles that need no migration grant', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();

    const admin = await Role.findOne({ name: 'admin' });
    expect(admin.permissions).toEqual(['all']);
  });

  test('is idempotent — does not duplicate permissions when run twice', async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.grantMigrationPermissions();

    const moderator = await Role.findOne({ name: 'moderator' });
    const banCount = moderator.permissions.filter(p => p === 'user:ban').length;
    expect(banCount).toBe(1);
  });
});

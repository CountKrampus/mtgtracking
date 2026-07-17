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

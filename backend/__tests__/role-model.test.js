const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../models/Role');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await Role.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Role model', () => {
  test('creates a role with required fields and sensible defaults', async () => {
    const role = await Role.create({
      name: 'event_coordinator',
      displayName: 'Event Coordinator',
      permissions: ['community:events']
    });

    expect(role.isBuiltIn).toBe(false);
    expect(role.createdAt).toBeInstanceOf(Date);
    expect(role.updatedAt).toBeInstanceOf(Date);
  });

  test('rejects duplicate names', async () => {
    await Role.create({ name: 'dup_role', displayName: 'Dup', permissions: [] });
    await expect(
      Role.create({ name: 'dup_role', displayName: 'Dup 2', permissions: [] })
    ).rejects.toThrow();
  });

  test('requires displayName', async () => {
    await expect(
      Role.create({ name: 'no_display', permissions: [] })
    ).rejects.toThrow();
  });

  test('rejects a name with uppercase or spaces', async () => {
    await expect(
      Role.create({ name: 'Bad Name', displayName: 'Bad', permissions: [] })
    ).rejects.toThrow();
  });
});

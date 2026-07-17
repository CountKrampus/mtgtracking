const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

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

describe('ActivityLog role actions', () => {
  test('accepts role_create, role_update, role_delete actions with targetType "role"', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'auser1', passwordHash: 'x', role: 'admin' });
    const roleId = new mongoose.Types.ObjectId();

    for (const action of ['role_create', 'role_update', 'role_delete']) {
      const log = await ActivityLog.log({
        userId: user._id,
        action,
        category: 'admin',
        targetType: 'role',
        targetId: roleId,
        targetName: 'event_coordinator'
      });
      expect(log.action).toBe(action);
      expect(log.targetType).toBe('role');
    }
  });
});

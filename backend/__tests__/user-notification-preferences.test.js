const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
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

describe('User.notificationPreferences', () => {
  test('healthReportEnabled defaults to false', async () => {
    const user = await User.create({
      email: 'defaults@test.com',
      username: 'defaultsuser',
      passwordHash: 'hash',
      role: 'user'
    });
    expect(user.notificationPreferences.healthReportEnabled).toBe(false);
  });

  test('toSafeObject includes notificationPreferences', async () => {
    const user = await User.create({
      email: 'safeobj@test.com',
      username: 'safeobjuser',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    const safe = user.toSafeObject();
    expect(safe.notificationPreferences.healthReportEnabled).toBe(true);
  });
});

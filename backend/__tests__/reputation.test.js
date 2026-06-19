const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

const User = require('../models/User');

test('reputation defaults to 0', async () => {
  const user = await User.create({
    email: 'a@test.com',
    username: 'testuser',
    passwordHash: 'hash'
  });
  expect(user.reputation).toBe(0);
});

test('reputation can be set above 5', async () => {
  const user = await User.create({
    email: 'b@test.com',
    username: 'repuser',
    passwordHash: 'hash',
    reputation: 42
  });
  expect(user.reputation).toBe(42);
});

test('communityStats.postCount defaults to 0', async () => {
  const user = await User.create({
    email: 'c@test.com',
    username: 'statuser',
    passwordHash: 'hash'
  });
  expect(user.communityStats.postCount).toBe(0);
  expect(user.communityStats.threadCount).toBe(0);
});

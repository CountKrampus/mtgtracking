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

test('User.privacy.showForum defaults to false', async () => {
  const user = await User.create({
    email: 'fp@test.com', username: 'fpuser', passwordHash: 'hash'
  });
  expect(user.privacy.showForum).toBe(false);
});

test('User.privacy.showForum can be set to true', async () => {
  const user = await User.create({
    email: 'fp2@test.com', username: 'fpuser2', passwordHash: 'hash',
    privacy: { showForum: true }
  });
  expect(user.privacy.showForum).toBe(true);
});

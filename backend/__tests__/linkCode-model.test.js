const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const LinkCode = require('../models/LinkCode');
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
  await LinkCode.deleteMany({});
  await User.deleteMany({});
});

test('generateForUser creates a 6-character uppercase-hex code expiring in ~10 minutes', async () => {
  const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
  const linkCode = await LinkCode.generateForUser(user._id);

  expect(linkCode.code).toMatch(/^[0-9A-F]{6}$/);
  const msUntilExpiry = linkCode.expiresAt.getTime() - Date.now();
  expect(msUntilExpiry).toBeGreaterThan(9 * 60 * 1000);
  expect(msUntilExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
});

test('generateForUser removes any previous unused code for that user', async () => {
  const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
  const first = await LinkCode.generateForUser(user._id);
  const second = await LinkCode.generateForUser(user._id);

  expect(await LinkCode.findById(first._id)).toBeNull();
  expect(await LinkCode.findById(second._id)).not.toBeNull();
});

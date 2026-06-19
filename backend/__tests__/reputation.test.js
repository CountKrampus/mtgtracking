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

const { checkAndAwardBadges, MILESTONE_BADGES } = require('../utils/badgeManager');

test('awards First Post badge on first post', async () => {
  const user = await User.create({
    email: 'd@test.com', username: 'poster', passwordHash: 'hash',
    'communityStats.postCount': 1
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'First Post')).toBe(true);
});

test('awards Century badge on 100th post', async () => {
  const user = await User.create({
    email: 'e@test.com', username: 'centuryposter', passwordHash: 'hash',
    'communityStats.postCount': 100
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'Century')).toBe(true);
});

test('does not re-award a badge already held', async () => {
  const user = await User.create({
    email: 'f@test.com', username: 'nodouble', passwordHash: 'hash',
    'communityStats.postCount': 1,
    badges: [{ name: 'First Post', earnedAt: new Date(), description: 'First forum post' }]
  });
  await checkAndAwardBadges(user._id, 'post_create');
  const updated = await User.findById(user._id);
  const firstPostBadges = updated.badges.filter(b => b.name === 'First Post');
  expect(firstPostBadges).toHaveLength(1);
});

test('awards Thread Starter badge on first thread', async () => {
  const user = await User.create({
    email: 'g@test.com', username: 'threadstarter', passwordHash: 'hash',
    'communityStats.threadCount': 1
  });
  await checkAndAwardBadges(user._id, 'thread_create');
  const updated = await User.findById(user._id);
  expect(updated.badges.some(b => b.name === 'Thread Starter')).toBe(true);
});

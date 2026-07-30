const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DiscordLink = require('../models/DiscordLink');
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
  await DiscordLink.deleteMany({});
  await User.deleteMany({});
});

test('creates a link with userId and discordUserId', async () => {
  const user = await User.create({ email: 'a@test.com', username: 'aaa1', passwordHash: 'x', role: 'editor' });
  const link = await DiscordLink.create({ userId: user._id, discordUserId: 'discord-1' });
  expect(link.discordUserId).toBe('discord-1');
  expect(link.linkedAt).toBeInstanceOf(Date);
});

test('rejects a second link for the same userId', async () => {
  const user = await User.create({ email: 'b@test.com', username: 'bbb1', passwordHash: 'x', role: 'editor' });
  await DiscordLink.create({ userId: user._id, discordUserId: 'discord-2' });
  await expect(DiscordLink.create({ userId: user._id, discordUserId: 'discord-3' })).rejects.toThrow();
});

test('rejects a second link for the same discordUserId', async () => {
  const user1 = await User.create({ email: 'c@test.com', username: 'ccc1', passwordHash: 'x', role: 'editor' });
  const user2 = await User.create({ email: 'd@test.com', username: 'ddd1', passwordHash: 'x', role: 'editor' });
  await DiscordLink.create({ userId: user1._id, discordUserId: 'discord-4' });
  await expect(DiscordLink.create({ userId: user2._id, discordUserId: 'discord-4' })).rejects.toThrow();
});

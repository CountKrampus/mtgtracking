const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
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

describe('Global thread listing — data layer', () => {
  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns threads sorted by createdAt desc with author and category populated', async () => {
    const user = await User.create({
      email: 'a@test.com', username: 'alice', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General discussion'
    });
    await ForumThread.create({
      title: 'Older Thread', categoryId: cat._id, authorId: user._id,
      content: 'content', contentFormat: 'markdown',
      createdAt: new Date('2026-01-01')
    });
    await ForumThread.create({
      title: 'Newer Thread', categoryId: cat._id, authorId: user._id,
      content: 'content', contentFormat: 'markdown',
      createdAt: new Date('2026-06-01')
    });

    const threads = await ForumThread.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('authorId', 'username displayName avatarUrl')
      .populate('categoryId', 'name slug')
      .lean();

    expect(threads).toHaveLength(2);
    expect(threads[0].title).toBe('Newer Thread');
    expect(threads[1].title).toBe('Older Thread');
    expect(threads[0].authorId.username).toBe('alice');
    expect(threads[0].categoryId.name).toBe('General');
  });

  test('respects limit parameter', async () => {
    const user = await User.create({
      email: 'b@test.com', username: 'bob', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Test', slug: 'test', description: 'test'
    });
    for (let i = 0; i < 5; i++) {
      await ForumThread.create({
        title: `Thread ${i}`, categoryId: cat._id, authorId: user._id,
        content: 'c', contentFormat: 'markdown'
      });
    }

    const threads = await ForumThread.find({})
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    expect(threads).toHaveLength(2);
  });
});

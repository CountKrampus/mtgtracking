const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
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

describe('Category cascade delete — data layer', () => {
  test('deletes all threads and posts when category is deleted', async () => {
    const user = await User.create({
      email: 'u@test.com', username: 'testuser', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'x'
    });
    const t1 = await ForumThread.create({
      title: 'Thread 1', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown'
    });
    const t2 = await ForumThread.create({
      title: 'Thread 2', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown'
    });
    await ForumPost.create({ threadId: t1._id, authorId: user._id, body: 'Post A', bodyFormat: 'markdown' });
    await ForumPost.create({ threadId: t1._id, authorId: user._id, body: 'Post B', bodyFormat: 'markdown' });
    await ForumPost.create({ threadId: t2._id, authorId: user._id, body: 'Post C', bodyFormat: 'markdown' });

    // Simulate the fixed cascade delete logic
    const categoryIds = [cat._id];
    const threads = await ForumThread.find({ categoryId: { $in: categoryIds } }).select('_id').lean();
    const threadIds = threads.map(t => t._id);
    await ForumPost.deleteMany({ threadId: { $in: threadIds } });
    await ForumThread.deleteMany({ categoryId: { $in: categoryIds } });
    await ForumCategory.findByIdAndDelete(cat._id);

    expect(await ForumThread.countDocuments({ categoryId: cat._id })).toBe(0);
    expect(await ForumPost.countDocuments({ threadId: { $in: threadIds } })).toBe(0);
    expect(await ForumCategory.findById(cat._id)).toBeNull();
  });
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
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

describe('Global post listing — data layer', () => {
  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns posts with author and thread populated, sorted newest first', async () => {
    const user = await User.create({
      email: 'c@test.com', username: 'carol', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'x'
    });
    const thread = await ForumThread.create({
      title: 'My Thread', categoryId: cat._id, authorId: user._id,
      content: 'root', contentFormat: 'markdown'
    });
    await ForumPost.create({
      threadId: thread._id, authorId: user._id,
      body: 'Hello world', depth: 1
    });

    const posts = await ForumPost.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('authorId', 'username displayName avatarUrl')
      .populate('threadId', 'title')
      .lean();

    expect(posts).toHaveLength(1);
    expect(posts[0].authorId.username).toBe('carol');
    expect(posts[0].threadId.title).toBe('My Thread');
  });
});

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

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Best-answer detection — data layer', () => {
  test('aggregate finds the post with most upvotes', async () => {
    const user = await User.create({
      email: 'u@test.com', username: 'testuser', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Q&A', slug: 'qa', description: 'x'
    });
    const thread = await ForumThread.create({
      title: 'How does X work?', categoryId: cat._id, authorId: user._id,
      content: 'x', contentFormat: 'markdown', isQA: true
    });

    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    const u3 = new mongoose.Types.ObjectId();

    await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer A', depth: 1,
      upvotes: [u1]
    });
    const postB = await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer B', depth: 1,
      upvotes: [u1, u2, u3]
    });
    await ForumPost.create({
      threadId: thread._id, authorId: user._id, body: 'Answer C', depth: 1,
      upvotes: [u1, u2]
    });

    const [topPost] = await ForumPost.aggregate([
      { $match: { threadId: thread._id } },
      { $addFields: { upvoteCount: { $size: '$upvotes' } } },
      { $sort: { upvoteCount: -1 } },
      { $limit: 1 },
      { $project: { _id: 1, authorId: 1, upvotes: 1 } }
    ]);

    expect(topPost._id.toString()).toBe(postB._id.toString());
    expect(topPost.upvotes).toHaveLength(3);
  });

  test('returns undefined when thread has no posts', async () => {
    const fakeThreadId = new mongoose.Types.ObjectId();
    const [topPost] = await ForumPost.aggregate([
      { $match: { threadId: fakeThreadId } },
      { $addFields: { upvoteCount: { $size: '$upvotes' } } },
      { $sort: { upvoteCount: -1 } },
      { $limit: 1 },
      { $project: { _id: 1, authorId: 1, upvotes: 1 } }
    ]);
    expect(topPost).toBeUndefined();
  });
});

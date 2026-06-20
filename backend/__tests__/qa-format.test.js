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

const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');

test('ForumCategory.isQA defaults to false', async () => {
  const cat = await ForumCategory.create({ name: 'Help', slug: 'help' });
  expect(cat.isQA).toBe(false);
});

test('ForumCategory.isQA can be set to true', async () => {
  const cat = await ForumCategory.create({ name: 'Q&A', slug: 'qa', isQA: true });
  expect(cat.isQA).toBe(true);
});

test('ForumThread.isQA defaults to false and bestAnswerPostId is null', async () => {
  const cat = await ForumCategory.create({ name: 'Test', slug: 'test' });
  const User = require('../models/User');
  const author = await User.create({ email: 'a@t.com', username: 'uaa', passwordHash: 'h' });
  const thread = await ForumThread.create({
    categoryId: cat._id,
    authorId: author._id,
    title: 'T',
    content: 'B'
  });
  expect(thread.isQA).toBe(false);
  expect(thread.bestAnswerPostId).toBeNull();
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

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

test('thread inherits isQA from Q&A category', async () => {
  const cat = await ForumCategory.create({ name: 'Qs', slug: 'qs', isQA: true });
  const User = require('../models/User');
  const author = await User.create({ email: 'b@t.com', username: 'ubb', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Question', body: 'Help?' });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(true);
});

test('thread can opt out of isQA even in QA category', async () => {
  const cat = await ForumCategory.create({ name: 'Qs2', slug: 'qs2', isQA: true });
  const User = require('../models/User');
  const author = await User.create({ email: 'c@t.com', username: 'ucc', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Discussion', body: 'Talking here', isQA: false });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(false);
});

test('thread in non-QA category can opt into isQA', async () => {
  const cat = await ForumCategory.create({ name: 'Gen', slug: 'gen', isQA: false });
  const User = require('../models/User');
  const author = await User.create({ email: 'd@t.com', username: 'udd', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Q', body: 'Q?', isQA: true });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(true);
});

const ForumPost = require('../models/ForumPost');

test('best answer is set when a post crosses 3 upvotes in QA thread', async () => {
  const ForumCategory = require('../models/ForumCategory');
  const ForumThread = require('../models/ForumThread');
  const User = require('../models/User');

  const cat = await ForumCategory.create({ name: 'BQ', slug: 'bq', isQA: true });
  const author = await User.create({ email: 'e@t.com', username: 'uee', passwordHash: 'h', role: 'user' });
  const voter1 = await User.create({ email: 'v1@t.com', username: 'vv1', passwordHash: 'h' });
  const voter2 = await User.create({ email: 'v2@t.com', username: 'vv2', passwordHash: 'h' });
  const voter3 = await User.create({ email: 'v3@t.com', username: 'vv3', passwordHash: 'h' });

  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    title: 'QQ', content: 'Q?', isQA: true
  });
  const post = await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    body: 'Answer',
    upvotes: [voter1._id, voter2._id]
  });

  const app = buildApp();
  const token = makeToken(voter3._id.toString());

  const res = await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);

  const updatedThread = await ForumThread.findById(thread._id);
  expect(updatedThread.bestAnswerPostId.toString()).toBe(post._id.toString());
});

test('best answer author receives +15 rep (first time only)', async () => {
  const ForumCategory = require('../models/ForumCategory');
  const ForumThread = require('../models/ForumThread');
  const User = require('../models/User');

  const cat = await ForumCategory.create({ name: 'RQ', slug: 'rq', isQA: true });
  const postAuthor = await User.create({ email: 'pa@t.com', username: 'paa', passwordHash: 'h', reputation: 0 });
  const voter1 = await User.create({ email: 'rv1@t.com', username: 'rv1', passwordHash: 'h' });
  const voter2 = await User.create({ email: 'rv2@t.com', username: 'rv2', passwordHash: 'h' });
  const voter3 = await User.create({ email: 'rv3@t.com', username: 'rv3', passwordHash: 'h' });

  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: postAuthor._id,
    title: 'RT', content: 'Q?', isQA: true
  });
  const post = await ForumPost.create({
    threadId: thread._id, authorId: postAuthor._id,
    body: 'Rep answer',
    upvotes: [voter1._id, voter2._id]
  });

  const app = buildApp();
  const token = makeToken(voter3._id.toString());
  await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  await new Promise(r => setTimeout(r, 150));

  const updated = await User.findById(postAuthor._id);
  expect(updated.reputation).toBe(15);
});

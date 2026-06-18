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
const express = require('express');
const request = require('supertest');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

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

test('GET /api/forum/users/:username/activity returns 404 for private profile', async () => {
  await User.create({
    email: 'priv@t.com', username: 'privuser', passwordHash: 'hash',
    privacy: { isPublic: false, showForum: true }
  });
  const app = buildApp();
  const res = await request(app).get('/api/forum/users/privuser/activity');
  expect(res.status).toBe(404);
});

test('GET /api/forum/users/:username/activity returns 404 when showForum=false', async () => {
  await User.create({
    email: 'noshf@t.com', username: 'noshoforumuser', passwordHash: 'hash',
    privacy: { isPublic: true, showForum: false }
  });
  const app = buildApp();
  const res = await request(app).get('/api/forum/users/noshoforumuser/activity');
  expect(res.status).toBe(404);
});

test('GET /api/forum/users/:username/activity returns forum activity when public and showForum=true', async () => {
  const author = await User.create({
    email: 'pub@t.com', username: 'pubforumuser', passwordHash: 'hash',
    reputation: 42,
    badges: [{ name: 'First Post', description: 'First forum post', earnedAt: new Date() }],
    privacy: { isPublic: true, showForum: true }
  });
  const cat = await ForumCategory.create({ name: 'Test', slug: 'testfp' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'pubforumuser', title: 'T', content: 'B'
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'pubforumuser', body: 'My reply'
  });

  const app = buildApp();
  const res = await request(app).get('/api/forum/users/pubforumuser/activity');
  expect(res.status).toBe(200);
  expect(res.body.reputation).toBe(42);
  expect(res.body.badges).toHaveLength(1);
  expect(res.body.stats.threadCount).toBe(1);
  expect(res.body.recentPosts).toHaveLength(1);
});

test('GET /api/forum/users/:username/activity excludes flagged posts', async () => {
  const author = await User.create({
    email: 'fl@t.com', username: 'flagtestuser', passwordHash: 'hash',
    privacy: { isPublic: true, showForum: true }
  });
  const cat = await ForumCategory.create({ name: 'FlagTest', slug: 'flagtest' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'flagtestuser', title: 'T', content: 'B'
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'flagtestuser', body: 'Flagged post', isHidden: true
  });
  await ForumPost.create({
    threadId: thread._id, authorId: author._id,
    authorUsername: 'flagtestuser', body: 'Visible post'
  });

  const app = buildApp();
  const res = await request(app).get('/api/forum/users/flagtestuser/activity');
  expect(res.status).toBe(200);
  expect(res.body.recentPosts).toHaveLength(1);
  expect(res.body.recentPosts[0].body).toContain('Visible post');
});

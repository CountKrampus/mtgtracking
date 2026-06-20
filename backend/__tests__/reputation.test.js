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

const express = require('express');
const request = require('supertest');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
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

test('creating a thread adds +2 rep and threadCount to author', async () => {
  const author = await User.create({
    email: 'th@test.com', username: 'threadauthor', passwordHash: 'hash', role: 'user',
    reputation: 0
  });
  const cat = await ForumCategory.create({ name: 'General', slug: 'general' });

  const app = buildApp();
  const token = makeToken(author._id.toString(), 'user');

  await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'My Thread', body: 'Hello world' });

  // Wait briefly for fire-and-forget side effects
  await new Promise(r => setTimeout(r, 100));

  const updated = await User.findById(author._id);
  expect(updated.reputation).toBe(2);
  expect(updated.communityStats.threadCount).toBe(1);
});

test('creating a post adds +1 rep and postCount to author', async () => {
  const author = await User.create({
    email: 'pa@test.com', username: 'postauthor', passwordHash: 'hash', role: 'user',
    reputation: 0
  });
  const cat = await ForumCategory.create({ name: 'General2', slug: 'general2' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: author._id,
    authorUsername: 'postauthor', authorDisplayName: 'postauthor',
    title: 'Thread', content: 'Body'
  });

  const app = buildApp();
  const token = makeToken(author._id.toString(), 'user');

  await request(app)
    .post('/api/forum/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ threadId: thread._id, body: 'My reply' });

  // Wait briefly for fire-and-forget side effects
  await new Promise(r => setTimeout(r, 100));

  const updated = await User.findById(author._id);
  expect(updated.reputation).toBe(1);
  expect(updated.communityStats.postCount).toBe(1);
});

test('upvoting a post adds +5 rep to post author', async () => {
  const postAuthor = await User.create({
    email: 'upvpa@test.com', username: 'upvpostauthor', passwordHash: 'hash', reputation: 0
  });
  const voter = await User.create({
    email: 'voter@test.com', username: 'voter', passwordHash: 'hash'
  });
  const cat = await ForumCategory.create({ name: 'Upvote', slug: 'upvote' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: postAuthor._id,
    authorUsername: 'upvpostauthor', title: 'T', content: 'B'
  });
  const ForumPost = require('../models/ForumPost');
  const post = await ForumPost.create({
    threadId: thread._id, authorId: postAuthor._id,
    authorUsername: 'upvpostauthor', body: 'My post'
  });

  const app = buildApp();
  const token = makeToken(voter._id.toString());
  await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  await new Promise(r => setTimeout(r, 100));
  const updated = await User.findById(postAuthor._id);
  expect(updated.reputation).toBe(5);
});

test('removing an upvote does NOT deduct rep from post author', async () => {
  const postAuthor = await User.create({
    email: 'unupvpa@test.com', username: 'unupvpostauthor', passwordHash: 'hash', reputation: 5
  });
  const voter = await User.create({
    email: 'unvoter@test.com', username: 'unvoter', passwordHash: 'hash'
  });
  const cat = await ForumCategory.create({ name: 'Unupvote', slug: 'unupvote' });
  const thread = await ForumThread.create({
    categoryId: cat._id, authorId: postAuthor._id,
    authorUsername: 'unupvpostauthor', title: 'T2', content: 'B2'
  });
  const ForumPost = require('../models/ForumPost');
  const post = await ForumPost.create({
    threadId: thread._id, authorId: postAuthor._id,
    authorUsername: 'unupvpostauthor', body: 'My post',
    upvotes: [voter._id]
  });

  const app = buildApp();
  const token = makeToken(voter._id.toString());
  await request(app)
    .post(`/api/forum/posts/${post._id}/upvote`)
    .set('Authorization', `Bearer ${token}`);

  await new Promise(r => setTimeout(r, 100));
  const updated = await User.findById(postAuthor._id);
  expect(updated.reputation).toBe(5); // unchanged
});

process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');

let mongod;
let app;
let User;
let ForumCategory;
let ForumThread;
let ForumPost;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  User = require('../models/User');
  ForumCategory = require('../models/ForumCategory');
  ForumThread = require('../models/ForumThread');
  ForumPost = require('../models/ForumPost');

  // Setup minimal express app
  app = express();
  app.use(express.json());
  const forumRoutes = require('../routes/forum');
  app.use('/api/forum', forumRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Forum Profile Activity Endpoint', () => {
  test('Returns user activity when showForum is true', async () => {
    const user = await User.create({
      email: 'fpa@test.com',
      username: 'fpauser',
      passwordHash: 'hash',
      privacy: { isPublic: true, showForum: true }
    });

    const cat = await ForumCategory.create({ name: 'Test', slug: 'test' });
    const thread = await ForumThread.create({
      categoryId: cat._id,
      authorId: user._id,
      authorUsername: 'fpauser',
      title: 'Test Thread',
      content: 'Test body'
    });
    const post = await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      authorUsername: 'fpauser',
      body: 'Test post'
    });

    const res = await request(app).get('/api/forum/users/fpauser/activity');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'fpauser');
    expect(res.body).toHaveProperty('reputation');
    expect(res.body).toHaveProperty('badges');
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('posts');
    expect(res.body.stats).toHaveProperty('threads');
    expect(res.body.stats).toHaveProperty('upvotes');
    expect(res.body.stats).toHaveProperty('memberSince');
  });

  test('Returns 404 when showForum is false', async () => {
    const user = await User.create({
      email: 'fpb@test.com',
      username: 'fpbuser',
      passwordHash: 'hash',
      privacy: { isPublic: true, showForum: false }
    });

    const res = await request(app).get('/api/forum/users/fpbuser/activity');
    expect(res.status).toBe(404);
  });

  test('Returns 404 when user not found', async () => {
    const res = await request(app).get('/api/forum/users/nonexistent/activity');
    expect(res.status).toBe(404);
  });

  test('Returns correct post count', async () => {
    const user = await User.create({
      email: 'fpc@test.com',
      username: 'fpcuser',
      passwordHash: 'hash',
      privacy: { isPublic: true, showForum: true }
    });

    const cat = await ForumCategory.create({ name: 'Test', slug: 'test-c' });
    const thread = await ForumThread.create({
      categoryId: cat._id,
      authorId: user._id,
      authorUsername: 'fpcuser',
      title: 'Test Thread',
      content: 'Test body'
    });

    // Create 3 posts
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      authorUsername: 'fpcuser',
      body: 'Post 1'
    });
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      authorUsername: 'fpcuser',
      body: 'Post 2'
    });
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      authorUsername: 'fpcuser',
      body: 'Post 3'
    });

    const res = await request(app).get('/api/forum/users/fpcuser/activity');
    expect(res.status).toBe(200);
    expect(res.body.stats.posts).toBe(3);
  });

  test('Returns correct thread count', async () => {
    const user = await User.create({
      email: 'fpd@test.com',
      username: 'fpduser',
      passwordHash: 'hash',
      privacy: { isPublic: true, showForum: true }
    });

    const cat = await ForumCategory.create({ name: 'Test', slug: 'test-d' });

    // Create 2 threads
    await ForumThread.create({
      categoryId: cat._id,
      authorId: user._id,
      authorUsername: 'fpduser',
      title: 'Thread 1',
      content: 'Body 1'
    });
    await ForumThread.create({
      categoryId: cat._id,
      authorId: user._id,
      authorUsername: 'fpduser',
      title: 'Thread 2',
      content: 'Body 2'
    });

    const res = await request(app).get('/api/forum/users/fpduser/activity');
    expect(res.status).toBe(200);
    expect(res.body.stats.threads).toBe(2);
  });

  test('Returns recent posts (limited to 10)', async () => {
    const user = await User.create({
      email: 'fpe@test.com',
      username: 'fpeuser',
      passwordHash: 'hash',
      privacy: { isPublic: true, showForum: true }
    });

    const cat = await ForumCategory.create({ name: 'Test', slug: 'test-e' });
    const thread = await ForumThread.create({
      categoryId: cat._id,
      authorId: user._id,
      authorUsername: 'fpeuser',
      title: 'Test Thread',
      content: 'Test body'
    });

    // Create 15 posts
    for (let i = 0; i < 15; i++) {
      await ForumPost.create({
        threadId: thread._id,
        authorId: user._id,
        authorUsername: 'fpeuser',
        body: `Post ${i}`
      });
    }

    const res = await request(app).get('/api/forum/users/fpeuser/activity');
    expect(res.status).toBe(200);
    expect(res.body.recentPosts).toBeDefined();
    expect(res.body.recentPosts.length).toBeLessThanOrEqual(10);
  });
});

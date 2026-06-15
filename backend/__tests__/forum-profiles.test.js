const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('User Forum Privacy Settings', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker-test';
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});
    await ForumCategory.deleteMany({});
    await ForumThread.deleteMany({});
    await ForumPost.deleteMany({});
  });

  test('User.privacy defaults are set correctly', async () => {
    const user = new User({
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashedpass123'
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy).toBeDefined();
    expect(savedUser.privacy.isPublic).toBe(false);
    expect(savedUser.privacy.showCollection).toBe(false);
    expect(savedUser.privacy.showDecks).toBe(true);
    expect(savedUser.privacy.showWishlist).toBe(false);
    expect(savedUser.privacy.showForum).toBe(false);
    expect(savedUser.privacy.bio).toBe('');
  });

  test('User.privacy fields can be customized', async () => {
    const user = new User({
      email: 'test2@example.com',
      username: 'testuser2',
      passwordHash: 'hashedpass123',
      privacy: {
        isPublic: true,
        showCollection: true,
        showDecks: false,
        showWishlist: true,
        showForum: true,
        bio: 'This is my bio'
      }
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy.isPublic).toBe(true);
    expect(savedUser.privacy.showCollection).toBe(true);
    expect(savedUser.privacy.showDecks).toBe(false);
    expect(savedUser.privacy.showWishlist).toBe(true);
    expect(savedUser.privacy.showForum).toBe(true);
    expect(savedUser.privacy.bio).toBe('This is my bio');
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
      authorUsername: 'pubforumuser', title: 'T', body: 'B'
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
      authorUsername: 'flagtestuser', title: 'T', body: 'B'
    });
    await ForumPost.create({
      threadId: thread._id, authorId: author._id,
      authorUsername: 'flagtestuser', body: 'Flagged post', isFlagHidden: true
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
});

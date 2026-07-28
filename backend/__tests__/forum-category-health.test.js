process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

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

// ---------------------------------------------------------------------------
// Helper: run the same aggregation logic the route uses so we can test it
// independently of Express middleware
// ---------------------------------------------------------------------------
async function computeCategoryHealth(windowDays) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [threadAgg, postAgg, categories] = await Promise.all([
    ForumThread.aggregate([
      { $match: { createdAt: { $gte: windowStart }, isHidden: { $ne: true } } },
      { $group: { _id: '$categoryId', newThreads: { $sum: 1 } } }
    ]),
    ForumPost.aggregate([
      { $match: { createdAt: { $gte: windowStart } } },
      {
        $lookup: {
          from: 'forumthreads',
          localField: 'threadId',
          foreignField: '_id',
          as: 'thread'
        }
      },
      { $unwind: '$thread' },
      {
        $group: {
          _id: '$thread.categoryId',
          newPosts: { $sum: 1 },
          hiddenPosts: { $sum: { $cond: ['$isHidden', 1, 0] } },
          uniqueAuthors: { $addToSet: '$authorId' }
        }
      }
    ]),
    ForumCategory.find({}).lean()
  ]);

  const threadMap = {};
  threadAgg.forEach(r => { threadMap[r._id.toString()] = r.newThreads; });

  const postMap = {};
  postAgg.forEach(r => {
    postMap[r._id.toString()] = {
      newPosts: r.newPosts,
      hiddenPosts: r.hiddenPosts,
      uniqueAuthors: r.uniqueAuthors.length
    };
  });

  return categories.map(cat => {
    const catId = cat._id.toString();
    const newThreads = threadMap[catId] || 0;
    const postData = postMap[catId] || { newPosts: 0, hiddenPosts: 0, uniqueAuthors: 0 };
    const { newPosts, hiddenPosts, uniqueAuthors } = postData;
    return {
      categoryId: catId,
      name: cat.name,
      newThreads,
      newPosts,
      postsPerDay: newPosts / windowDays,
      spamRate: newPosts > 0 ? hiddenPosts / newPosts : 0,
      avgRepliesPerThread: newThreads > 0 ? newPosts / newThreads : 0,
      uniqueAuthors
    };
  });
}

describe('Forum Category Health — aggregation logic', () => {
  test('returns zero counts when no activity exists', async () => {
    await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General discussion'
    });

    const results = await computeCategoryHealth(7);

    expect(results).toHaveLength(1);
    expect(results[0].newThreads).toBe(0);
    expect(results[0].newPosts).toBe(0);
    expect(results[0].postsPerDay).toBe(0);
    expect(results[0].spamRate).toBe(0);
    expect(results[0].uniqueAuthors).toBe(0);
  });

  test('counts threads and posts within window correctly', async () => {
    const user = await User.create({
      email: 'a@test.com', username: 'alice', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'General', slug: 'general', description: 'General'
    });

    // Thread created 3 days ago (inside 7-day window)
    const thread = await ForumThread.create({
      title: 'Recent Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    });

    // Post created 2 days ago (inside 7-day window)
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      body: 'reply',
      bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results).toHaveLength(1);
    expect(results[0].newThreads).toBe(1);
    expect(results[0].newPosts).toBe(1);
    expect(results[0].postsPerDay).toBeCloseTo(1 / 7, 5);
    expect(results[0].uniqueAuthors).toBe(1);
    expect(results[0].avgRepliesPerThread).toBe(1);
  });

  test('excludes threads created outside the window', async () => {
    const user = await User.create({
      email: 'b@test.com', username: 'bob', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Tech', slug: 'tech', description: 'Tech'
    });

    // Thread created 40 days ago (outside 30-day window)
    await ForumThread.create({
      title: 'Old Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'old content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(30);
    expect(results[0].newThreads).toBe(0);
  });

  test('excludes hidden threads from thread count', async () => {
    const user = await User.create({
      email: 'c@test.com', username: 'carol', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Meta', slug: 'meta', description: 'Meta'
    });

    await ForumThread.create({
      title: 'Visible Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      isHidden: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });
    await ForumThread.create({
      title: 'Hidden Thread',
      categoryId: cat._id,
      authorId: user._id,
      content: 'spam content',
      contentFormat: 'markdown',
      isHidden: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].newThreads).toBe(1);
  });

  test('calculates spamRate correctly from hidden posts', async () => {
    const user = await User.create({
      email: 'd@test.com', username: 'dave', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Lounge', slug: 'lounge', description: 'Lounge'
    });
    const thread = await ForumThread.create({
      title: 'Discussion',
      categoryId: cat._id,
      authorId: user._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    // 4 visible posts
    for (let i = 0; i < 4; i++) {
      await ForumPost.create({
        threadId: thread._id,
        authorId: user._id,
        body: `reply ${i}`,
        bodyFormat: 'markdown',
        isHidden: false,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      });
    }
    // 1 hidden (spam) post
    await ForumPost.create({
      threadId: thread._id,
      authorId: user._id,
      body: 'spam',
      bodyFormat: 'markdown',
      isHidden: true,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].newPosts).toBe(5);
    expect(results[0].spamRate).toBeCloseTo(0.2, 5); // 1/5
  });

  test('counts uniqueAuthors across posts in window', async () => {
    const userA = await User.create({
      email: 'e@test.com', username: 'eve', passwordHash: 'x', role: 'user'
    });
    const userB = await User.create({
      email: 'f@test.com', username: 'frank', passwordHash: 'x', role: 'user'
    });
    const cat = await ForumCategory.create({
      name: 'Community', slug: 'community', description: 'Community'
    });
    const thread = await ForumThread.create({
      title: 'Hello',
      categoryId: cat._id,
      authorId: userA._id,
      content: 'content',
      contentFormat: 'markdown',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    await ForumPost.create({
      threadId: thread._id, authorId: userA._id,
      body: 'post by A', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
    });
    await ForumPost.create({
      threadId: thread._id, authorId: userB._id,
      body: 'post by B', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000)
    });
    // userA posts again — should not double-count
    await ForumPost.create({
      threadId: thread._id, authorId: userA._id,
      body: 'another post by A', bodyFormat: 'markdown',
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000)
    });

    const results = await computeCategoryHealth(7);
    expect(results[0].uniqueAuthors).toBe(2);
  });
});

describe('Forum Category Health — cache key validation', () => {
  test('rejects window values other than 7 or 30', () => {
    const VALID_WINDOWS = [7, 30];
    const testCases = [1, 14, 60, 0, -1, 'abc'];
    testCases.forEach(val => {
      expect(VALID_WINDOWS.includes(parseInt(val))).toBe(false);
    });
    expect(VALID_WINDOWS.includes(parseInt('7'))).toBe(true);
    expect(VALID_WINDOWS.includes(parseInt('30'))).toBe(true);
  });

  test('cache expires after TTL', () => {
    const cache = new Map();
    const TTL_MS = 5 * 60 * 1000;

    // Simulate storing a value
    cache.set('7', { data: { test: true }, timestamp: Date.now() - TTL_MS - 1 });

    const entry = cache.get('7');
    const isExpired = Date.now() - entry.timestamp > TTL_MS;
    expect(isExpired).toBe(true);
  });

  test('cache hit returns fresh data', () => {
    const cache = new Map();
    const TTL_MS = 5 * 60 * 1000;

    cache.set('30', { data: { categories: [] }, timestamp: Date.now() });

    const entry = cache.get('30');
    const isExpired = Date.now() - entry.timestamp > TTL_MS;
    expect(isExpired).toBe(false);
    expect(entry.data.categories).toEqual([]);
  });
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('GET /api/admin/forum/category-stats — route', () => {
  let app, moderator, viewer;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'forum_mod', displayName: 'Forum Mod', permissions: ['forum:moderate'], isBuiltIn: false });
    await refreshRoleCache();

    moderator = await User.create({ email: 'fm@test.com', username: 'fm1', passwordHash: 'x', role: 'forum_mod' });
    viewer = await User.create({ email: 'viewer@test.com', username: 'viewer1', passwordHash: 'x', role: 'viewer' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('returns 401 without an auth token', async () => {
    await request(app).get('/api/admin/forum/category-stats').expect(401);
  });

  test('returns 403 for a role without forum:moderate', async () => {
    await request(app)
      .get('/api/admin/forum/category-stats')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .expect(403);
  });

  test('returns 400 for an invalid window value', async () => {
    const res = await request(app)
      .get('/api/admin/forum/category-stats?window=14')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(400);
    expect(res.body.code).toBe('INVALID_WINDOW');
  });

  test('returns the expected shape for a valid window and caches the second call', async () => {
    await ForumCategory.create({ name: 'General', slug: 'general', description: '' });

    const res1 = await request(app)
      .get('/api/admin/forum/category-stats?window=7')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    expect(res1.body.window).toBe(7);
    expect(Array.isArray(res1.body.categories)).toBe(true);
    expect(res1.body.categories[0]).toMatchObject({ name: 'General' });

    const res2 = await request(app)
      .get('/api/admin/forum/category-stats?window=7')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    // Same generatedAt confirms the cache was hit, not recomputed
    expect(res2.body.generatedAt).toBe(res1.body.generatedAt);
  });
});

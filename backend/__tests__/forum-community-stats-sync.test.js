process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const { refreshRoleCache } = require('../utils/permissions');

// Covers the bug where deleting a thread/post never decremented the
// author's User.communityStats.threadCount/postCount, permanently
// inflating those numbers relative to actual forum content.

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('Forum deletion keeps author communityStats in sync', () => {
  let app, moderator, author, category;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'admin' });
    author = await User.create({
      email: 'author@test.com', username: 'author1', passwordHash: 'x', role: 'editor',
      communityStats: { threadCount: 1, postCount: 3 }
    });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });

    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('deleting a thread decrements the author threadCount', async () => {
    const thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: author._id, content: 'hello'
    });

    await request(app)
      .delete(`/api/forum/threads/${thread._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    const updatedAuthor = await User.findById(author._id);
    expect(updatedAuthor.communityStats.threadCount).toBe(0);
  });

  test('deleting a thread decrements each post author postCount by their post count in that thread', async () => {
    const thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: author._id, content: 'hello'
    });
    await ForumPost.create({ threadId: thread._id, body: 'one', authorId: author._id });
    await ForumPost.create({ threadId: thread._id, body: 'two', authorId: author._id });

    await request(app)
      .delete(`/api/forum/threads/${thread._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    const updatedAuthor = await User.findById(author._id);
    expect(updatedAuthor.communityStats.postCount).toBe(1);
  });

  test('deleting a single post decrements the author postCount', async () => {
    const thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: author._id, content: 'hello'
    });
    const post = await ForumPost.create({ threadId: thread._id, body: 'hi', authorId: author._id });

    await request(app)
      .delete(`/api/forum/posts/${post._id}`)
      .set('Authorization', `Bearer ${makeToken(author)}`)
      .expect(200);

    const updatedAuthor = await User.findById(author._id);
    expect(updatedAuthor.communityStats.postCount).toBe(2);
  });

  test('postCount never goes negative when it is already 0', async () => {
    const zeroStatsAuthor = await User.create({
      email: 'zero@test.com', username: 'zero1', passwordHash: 'x', role: 'editor',
      communityStats: { threadCount: 0, postCount: 0 }
    });
    const thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: zeroStatsAuthor._id, content: 'hello'
    });
    const post = await ForumPost.create({ threadId: thread._id, body: 'hi', authorId: zeroStatsAuthor._id });

    await request(app)
      .delete(`/api/forum/posts/${post._id}`)
      .set('Authorization', `Bearer ${makeToken(zeroStatsAuthor)}`)
      .expect(200);

    const updated = await User.findById(zeroStatsAuthor._id);
    expect(updated.communityStats.postCount).toBe(0);
  });
});

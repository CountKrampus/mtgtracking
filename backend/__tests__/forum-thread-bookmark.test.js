process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');

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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/forum', require('../routes/forum'));
  return app;
}

describe('PUT /api/forum/threads/:threadId/bookmark', () => {
  test('401 without auth', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm', description: '' });
    const user = await User.create({ email: 'x@test.com', username: 'userx', passwordHash: 'x', role: 'editor' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: user._id, content: 'c' });

    await request(app).put(`/api/forum/threads/${thread._id}/bookmark`).expect(401);
  });

  test('any authenticated user can bookmark a thread, and toggling again removes it', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm-2', description: '' });
    const author = await User.create({ email: 'author@test.com', username: 'author1', passwordHash: 'x', role: 'editor' });
    const bookmarker = await User.create({ email: 'bm@test.com', username: 'bookmarker1', passwordHash: 'x', role: 'editor' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: author._id, content: 'c' });

    const res1 = await request(app)
      .put(`/api/forum/threads/${thread._id}/bookmark`)
      .set('Authorization', `Bearer ${makeToken(bookmarker)}`)
      .expect(200);
    expect(res1.body.bookmarked).toBe(true);

    const afterFirst = await User.findById(bookmarker._id);
    expect(afterFirst.bookmarkedThreadIds.map(id => id.toString())).toContain(thread._id.toString());

    const res2 = await request(app)
      .put(`/api/forum/threads/${thread._id}/bookmark`)
      .set('Authorization', `Bearer ${makeToken(bookmarker)}`)
      .expect(200);
    expect(res2.body.bookmarked).toBe(false);

    const afterSecond = await User.findById(bookmarker._id);
    expect(afterSecond.bookmarkedThreadIds.map(id => id.toString())).not.toContain(thread._id.toString());
  });
});

describe('GET /api/forum/bookmarks', () => {
  test('returns only the current user\'s bookmarked threads', async () => {
    const app = buildApp();
    const category = await ForumCategory.create({ name: 'General', slug: 'general-bm-3', description: '' });
    const author = await User.create({ email: 'author2@test.com', username: 'author2', passwordHash: 'x', role: 'editor' });
    const alice = await User.create({ email: 'alice@test.com', username: 'alice1', passwordHash: 'x', role: 'editor' });
    const bob = await User.create({ email: 'bob@test.com', username: 'bob1', passwordHash: 'x', role: 'editor' });
    const threadA = await ForumThread.create({ title: 'Thread A', categoryId: category._id, authorId: author._id, content: 'a' });
    const threadB = await ForumThread.create({ title: 'Thread B', categoryId: category._id, authorId: author._id, content: 'b' });

    await request(app).put(`/api/forum/threads/${threadA._id}/bookmark`).set('Authorization', `Bearer ${makeToken(alice)}`).expect(200);
    await request(app).put(`/api/forum/threads/${threadB._id}/bookmark`).set('Authorization', `Bearer ${makeToken(bob)}`).expect(200);

    const res = await request(app).get('/api/forum/bookmarks').set('Authorization', `Bearer ${makeToken(alice)}`).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Thread A');
  });
});

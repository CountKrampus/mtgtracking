process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');

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

describe('POST /api/forum/threads invalidates the categories:tree cache', () => {
  test('a newly created thread\'s count is visible immediately via GET /categories, not just after the cache TTL expires', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'poster@test.com', username: 'poster', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-cache-test', description: '' });

    // Populate the cache with the pre-creation state (threadCount: 0).
    const before = await request(app).get('/api/forum/categories').expect(200);
    const findCount = (nodes) => {
      for (const n of nodes) {
        if (n._id === category._id.toString()) return n.threadCount;
        if (n.children) {
          const found = findCount(n.children);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };
    expect(findCount(before.body)).toBe(0);

    await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'A totally unique thread title xyz123', content: 'hello world' })
      .expect(201);

    const after = await request(app).get('/api/forum/categories').expect(200);
    expect(findCount(after.body)).toBe(1);
  });
});

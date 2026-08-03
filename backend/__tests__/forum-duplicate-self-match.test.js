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

describe('POST /api/forum/threads does not flag the newly created thread as its own duplicate', () => {
  test('a brand-new thread with a unique title reports zero suggested duplicates', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-dup-test', description: '' });

    const res = await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'A wholly unique never-before-seen title', content: 'hi' })
      .expect(201);

    expect(res.body.suggestedDuplicates).toEqual([]);
  });

  test('a real pre-existing similar thread is still correctly detected as a duplicate', async () => {
    const app = buildApp();
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'x', role: 'editor' });
    const category = await ForumCategory.create({ name: 'General', slug: 'general-dup-test-2', description: '' });

    await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'Best Commander decks for beginners', content: 'first' })
      .expect(201);

    const res = await request(app)
      .post('/api/forum/threads')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ categoryId: category._id.toString(), title: 'Best Commander decks for beginners today', content: 'second' })
      .expect(201);

    expect(res.body.suggestedDuplicates.length).toBeGreaterThan(0);
    expect(res.body.suggestedDuplicates[0].title).toBe('Best Commander decks for beginners');
  });
});

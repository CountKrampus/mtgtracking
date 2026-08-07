process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Feedback = require('../models/Feedback');

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
  app.use('/api/feedback', require('../routes/feedback'));
  return app;
}

describe('POST /api/feedback', () => {
  let app, user;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    user = await User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    app = buildApp();
  });

  test('creates a feedback doc with the submitting user, message, and category', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'The deck builder crashes on save', category: 'bug', pageUrl: '/decks/123', userAgent: 'Mozilla/5.0 Test' })
      .expect(201);

    expect(res.body.feedback.message).toBe('The deck builder crashes on save');
    expect(res.body.feedback.category).toBe('bug');
    expect(res.body.feedback.status).toBe('pending');
    expect(res.body.feedback.pageUrl).toBe('/decks/123');

    const stored = await Feedback.findOne({});
    expect(stored.submitter.toString()).toBe(user._id.toString());
  });

  test('rejects an empty or missing message', async () => {
    await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: '   ', category: 'bug' })
      .expect(400);

    await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ category: 'bug' })
      .expect(400);
  });

  test('defaults an invalid or missing category to "other"', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'General thought' })
      .expect(201);
    expect(res.body.feedback.category).toBe('other');

    const res2 = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'General thought 2', category: 'not-a-real-category' })
      .expect(201);
    expect(res2.body.feedback.category).toBe('other');
  });

  test('rejects unauthenticated requests', async () => {
    await request(app)
      .post('/api/feedback')
      .send({ message: 'Anonymous attempt', category: 'bug' })
      .expect(401);
  });
});

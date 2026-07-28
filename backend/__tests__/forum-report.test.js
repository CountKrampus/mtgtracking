process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ContentReport = require('../models/ContentReport');
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
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

describe('POST /api/forum/report', () => {
  let app, me, category, thread, post;

  beforeEach(async () => {
    app = buildApp();
    me = await User.create({ email: 'me@test.com', username: 'reporter1', passwordHash: 'x', role: 'user' });
    category = await ForumCategory.create({ name: 'General', slug: 'general', description: '' });
    thread = await ForumThread.create({
      title: 'Test thread', categoryId: category._id, authorId: me._id, content: 'hello'
    });
    post = await ForumPost.create({ threadId: thread._id, authorId: me._id, body: 'test post body' });
  });

  test('returns 201 and creates a report', async () => {
    const res = await request(app)
      .post('/api/forum/report')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .send({ contentId: post._id, contentType: 'post', reason: 'other' })
      .expect(201);

    expect(res.body.report).toBeDefined();
    const reports = await ContentReport.find({ contentId: post._id });
    expect(reports).toHaveLength(1);
    expect(reports[0].source).toBe('user');
  });

  test('returns 409 when same user already reported same content', async () => {
    await ContentReport.create({
      contentId: post._id,
      contentType: 'post',
      reportedBy: me._id,
      reason: 'other',
      source: 'user',
      status: 'pending',
      suggestedAction: 'review',
    });

    const res = await request(app)
      .post('/api/forum/report')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .send({ contentId: post._id, contentType: 'post', reason: 'other' })
      .expect(409);
    expect(res.body.message).toMatch(/already reported/i);
  });

  test('returns 429 when user exceeds 5 reports per hour', async () => {
    const reports = Array.from({ length: 5 }, () => ({
      contentId: new mongoose.Types.ObjectId(),
      contentType: 'post',
      reportedBy: me._id,
      reason: 'other',
      source: 'user',
      status: 'pending',
      suggestedAction: 'review',
      createdAt: new Date(),
    }));
    await ContentReport.insertMany(reports);

    const res = await request(app)
      .post('/api/forum/report')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .send({ contentId: post._id, contentType: 'post', reason: 'other' })
      .expect(429);
    expect(res.body.message).toMatch(/too frequently/i);
  });

  test('auto-hides post when total pending reports reaches 3', async () => {
    await ContentReport.insertMany([
      {
        contentId: post._id, contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(),
        reason: 'spam', source: 'user', status: 'pending', suggestedAction: 'hide_and_warn',
      },
      {
        contentId: post._id, contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(),
        reason: 'spam', source: 'user', status: 'pending', suggestedAction: 'hide_and_warn',
      },
    ]);

    await request(app)
      .post('/api/forum/report')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .send({ contentId: post._id, contentType: 'post', reason: 'other' })
      .expect(201);

    const updatedPost = await ForumPost.findById(post._id);
    expect(updatedPost.isHidden).toBe(true);
    expect(updatedPost.hiddenReason).toMatch(/auto-hidden/i);
  });
});

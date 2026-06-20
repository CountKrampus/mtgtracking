const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
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

const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');

test('ForumCategory.isQA defaults to false', async () => {
  const cat = await ForumCategory.create({ name: 'Help', slug: 'help' });
  expect(cat.isQA).toBe(false);
});

test('ForumCategory.isQA can be set to true', async () => {
  const cat = await ForumCategory.create({ name: 'Q&A', slug: 'qa', isQA: true });
  expect(cat.isQA).toBe(true);
});

test('ForumThread.isQA defaults to false and bestAnswerPostId is null', async () => {
  const cat = await ForumCategory.create({ name: 'Test', slug: 'test' });
  const User = require('../models/User');
  const author = await User.create({ email: 'a@t.com', username: 'uaa', passwordHash: 'h' });
  const thread = await ForumThread.create({
    categoryId: cat._id,
    authorId: author._id,
    title: 'T',
    content: 'B'
  });
  expect(thread.isQA).toBe(false);
  expect(thread.bestAnswerPostId).toBeNull();
});

test('thread inherits isQA from Q&A category', async () => {
  const cat = await ForumCategory.create({ name: 'Qs', slug: 'qs', isQA: true });
  const User = require('../models/User');
  const author = await User.create({ email: 'b@t.com', username: 'ubb', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Question', body: 'Help?' });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(true);
});

test('thread can opt out of isQA even in QA category', async () => {
  const cat = await ForumCategory.create({ name: 'Qs2', slug: 'qs2', isQA: true });
  const User = require('../models/User');
  const author = await User.create({ email: 'c@t.com', username: 'ucc', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Discussion', body: 'Talking here', isQA: false });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(false);
});

test('thread in non-QA category can opt into isQA', async () => {
  const cat = await ForumCategory.create({ name: 'Gen', slug: 'gen', isQA: false });
  const User = require('../models/User');
  const author = await User.create({ email: 'd@t.com', username: 'udd', passwordHash: 'h', role: 'user' });

  const app = buildApp();
  const token = makeToken(author._id.toString());
  const res = await request(app)
    .post('/api/forum/threads')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: cat._id, title: 'Q', body: 'Q?', isQA: true });

  expect(res.status).toBe(201);
  expect(res.body.thread.isQA).toBe(true);
});

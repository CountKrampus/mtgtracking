const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');

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

describe('Cosmetics pipeline — GET /api/forum/threads/:threadId', () => {
  it('includes authorCosmetics on thread and posts when user has equipped cosmetics', async () => {
    const author = await User.create({
      email: 'author@test.com',
      username: 'author1',
      passwordHash: 'hash',
      role: 'user'
    });

    const category = await ForumCategory.create({
      name: 'General',
      slug: 'general'
    });

    const thread = await ForumThread.create({
      categoryId: category._id,
      authorId: author._id,
      title: 'Test Thread',
      content: 'Thread body'
    });

    await ForumPost.create({
      threadId: thread._id,
      authorId: author._id,
      authorUsername: author.username,
      authorAvatarUrl: '',
      body: 'First reply',
      bodyFormat: 'markdown'
    });

    // Create a cosmetic
    const cosmetic = await Cosmetic.create({
      name: 'Gold Title',
      category: 'titleColor',
      cost: 100,
      color: '#FFD700',
      rarity: 'rare',
      isActive: true
    });

    // Equip the cosmetic for the author
    await ForumLevel.create({
      userId: author._id,
      cosmetics: {
        purchased: [cosmetic._id.toString()],
        equipped: {
          titleColor: cosmetic._id.toString()
        }
      },
      memberTitleText: 'Gold Member',
      signatureText: 'My signature'
    });

    const app = buildApp();
    const res = await request(app).get(`/api/forum/threads/${thread._id}`);

    expect(res.status).toBe(200);

    // Thread OP should have authorCosmetics
    expect(res.body.thread).toHaveProperty('authorCosmetics');
    expect(res.body.thread.authorCosmetics.titleColor).not.toBeNull();
    expect(res.body.thread.authorCosmetics.titleColor.color).toBe('#FFD700');
    expect(res.body.thread.authorCosmetics.memberTitleText).toBe('Gold Member');
    expect(res.body.thread.authorCosmetics.signatureText).toBe('My signature');

    // Each post should also have authorCosmetics
    expect(res.body.posts.length).toBeGreaterThan(0);
    const post = res.body.posts[0];
    expect(post).toHaveProperty('authorCosmetics');
    expect(post.authorCosmetics.titleColor).not.toBeNull();
    expect(post.authorCosmetics.titleColor.color).toBe('#FFD700');
    expect(post.authorCosmetics.memberTitleText).toBe('Gold Member');
  });

  it('returns empty authorCosmetics object when user has no ForumLevel', async () => {
    const author = await User.create({
      email: 'author2@test.com',
      username: 'author2',
      passwordHash: 'hash',
      role: 'user'
    });

    const category = await ForumCategory.create({
      name: 'General2',
      slug: 'general2'
    });

    const thread = await ForumThread.create({
      categoryId: category._id,
      authorId: author._id,
      title: 'No Cosmetics Thread',
      content: 'Plain content'
    });

    await ForumPost.create({
      threadId: thread._id,
      authorId: author._id,
      authorUsername: author.username,
      authorAvatarUrl: '',
      body: 'Plain reply',
      bodyFormat: 'markdown'
    });

    // No ForumLevel created for this author

    const app = buildApp();
    const res = await request(app).get(`/api/forum/threads/${thread._id}`);

    expect(res.status).toBe(200);

    // Thread OP
    expect(res.body.thread).toHaveProperty('authorCosmetics');
    expect(res.body.thread.authorCosmetics).toEqual({});

    // Posts
    expect(res.body.posts.length).toBeGreaterThan(0);
    expect(res.body.posts[0]).toHaveProperty('authorCosmetics');
    expect(res.body.posts[0].authorCosmetics).toEqual({});
  });

  it('returns null for individual cosmetic slots not equipped', async () => {
    const author = await User.create({
      email: 'author3@test.com',
      username: 'author3',
      passwordHash: 'hash',
      role: 'user'
    });

    const category = await ForumCategory.create({
      name: 'General3',
      slug: 'general3'
    });

    const thread = await ForumThread.create({
      categoryId: category._id,
      authorId: author._id,
      title: 'Partial Cosmetics Thread',
      content: 'Content'
    });

    // ForumLevel exists but nothing equipped
    await ForumLevel.create({
      userId: author._id,
      cosmetics: {
        purchased: [],
        equipped: {}
      },
      memberTitleText: '',
      signatureText: ''
    });

    const app = buildApp();
    const res = await request(app).get(`/api/forum/threads/${thread._id}`);

    expect(res.status).toBe(200);
    expect(res.body.thread.authorCosmetics.titleColor).toBeNull();
    expect(res.body.thread.authorCosmetics.avatarBorder).toBeNull();
    expect(res.body.thread.authorCosmetics.memberTitleText).toBe('');
  });
});

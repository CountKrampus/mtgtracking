process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'editor' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  const achievementsRouter = require('../routes/achievements');
  // No cards in test — inject null; route handles missing model gracefully
  achievementsRouter.injectDependencies(null);
  app.use('/api/achievements', achievementsRouter);
  return app;
}

describe('GET /api/achievements', () => {
  let app, user;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
    });
    app = buildApp();
  });

  it('returns array of achievements with earned flag', async () => {
    const res = await request(app)
      .get('/api/achievements')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('earned');
    expect(typeof res.body[0].earned).toBe('boolean');
  });

  it('requires authentication', async () => {
    await request(app).get('/api/achievements').expect(401);
  });
});

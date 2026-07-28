const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

// Mirrors the App builder in __tests__/public-profile.test.js: public users routes
// first, then the auth-protected users router, matching server.js's mount order.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/usersPublic'));
  app.use('/api/users', require('../routes/users'));
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

describe('User.notificationPreferences', () => {
  test('healthReportEnabled defaults to false', async () => {
    const user = await User.create({
      email: 'defaults@test.com',
      username: 'defaultsuser',
      passwordHash: 'hash',
      role: 'user'
    });
    expect(user.notificationPreferences.healthReportEnabled).toBe(false);
  });

  test('toSafeObject includes notificationPreferences', async () => {
    const user = await User.create({
      email: 'safeobj@test.com',
      username: 'safeobjuser',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    const safe = user.toSafeObject();
    expect(safe.notificationPreferences.healthReportEnabled).toBe(true);
  });
});

describe('PUT /api/users/me — notificationPreferences', () => {
  it('merges notificationPreferences.healthReportEnabled without touching other fields', async () => {
    const user = await User.create({
      email: 'merge@test.com',
      username: 'mergeuser',
      passwordHash: 'hash',
      role: 'user',
      displayName: 'Original Name'
    });

    const app = buildApp();
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ notificationPreferences: { healthReportEnabled: true } });

    expect(res.status).toBe(200);
    expect(res.body.notificationPreferences.healthReportEnabled).toBe(true);
    expect(res.body.displayName).toBe('Original Name');
  });
});

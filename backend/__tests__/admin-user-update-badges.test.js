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
  return jwt.sign({ userId: userId.toString() }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const adminRouter = require('../routes/admin');
  app.use('/api/admin', adminRouter);
  return app;
}

describe('PUT /api/admin/users/:id — staff badge sync', () => {
  let app, admin, target;

  beforeEach(async () => {
    app = buildApp();
    admin = await User.create({
      email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin'
    });
    target = await User.create({
      email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user'
    });
  });

  test('promoting a user to admin via the general update endpoint grants "Site Owner"', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ role: 'admin' })
      .expect(200);

    expect(res.body.role).toBe('admin');

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('demoting a staff user back to "user" via the general update endpoint revokes the badge', async () => {
    target.role = 'moderator';
    target.badges.push({ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() });
    await target.save();

    await request(app)
      .put(`/api/admin/users/${target._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ role: 'user' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).not.toContain('Moderator');
  });
});

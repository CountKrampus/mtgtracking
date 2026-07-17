process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { refreshRoleCache } = require('../utils/permissions');

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

describe('PUT /api/admin/users/:userId/role — staff badge sync', () => {
  let app, admin, target;

  beforeEach(async () => {
    app = buildApp();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();
    admin = await User.create({
      email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin'
    });
    target = await User.create({
      email: 'target@test.com', username: 'target1', passwordHash: 'x', role: 'user'
    });
  });

  test('promoting a user to moderator grants the Moderator badge', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'moderator' })
      .expect(200);

    expect(res.body.newRole).toBe('moderator');

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Moderator']);
  });

  test('demoting a staff user back to "user" revokes the badge', async () => {
    target.role = 'moderator';
    target.badges.push({ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() });
    await target.save();

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'user' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).not.toContain('Moderator');
  });

  test('swapping between two staff roles removes the old badge and adds the new one', async () => {
    target.role = 'content_manager';
    target.badges.push({ name: 'Content Manager', description: '', icon: 'lucide:Flame', earnedAt: new Date() });
    await target.save();

    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'support' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Support']);
  });

  test('promoting to admin grants "Site Owner"', async () => {
    await request(app)
      .put(`/api/admin/users/${target._id}/role`)
      .set('Authorization', `Bearer ${makeToken(admin._id)}`)
      .send({ newRole: 'admin' })
      .expect(200);

    const updated = await User.findById(target._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });
});

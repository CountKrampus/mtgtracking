process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Card = require('../models/Card');
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

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Role.syncIndexes();
  await Role.seedBuiltInRoles();
  await Role.grantMigrationPermissions();
  await refreshRoleCache();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cards', require('../routes/cards'));
  return app;
}

const card = (name, extra = {}) => ({
  name,
  set: 'Test Set',
  quantity: 1,
  condition: 'NM',
  price: 1,
  ...extra,
});

describe('personal collection backup restore', () => {
  test('previews missing cards and merges without changing existing or other users’ cards', async () => {
    const owner = await User.create({ email: 'owner@test.com', username: 'owner', passwordHash: 'x', role: 'user' });
    const otherUser = await User.create({ email: 'other@test.com', username: 'other', passwordHash: 'x', role: 'user' });
    await Card.create({ userId: owner._id, ...card('Already Owned', { quantity: 4 }) });
    await Card.create({ userId: otherUser._id, ...card('Restore Me') });
    const app = buildApp();
    const backup = [
      card('Already Owned', { quantity: 1, userId: otherUser._id.toString() }),
      card('Restore Me', { quantity: 2, userId: otherUser._id.toString() }),
    ];

    const preview = await request(app)
      .post('/api/cards/restore/preview')
      .set('Authorization', `Bearer ${makeToken(owner)}`)
      .send({ cards: backup })
      .expect(200);
    expect(preview.body).toMatchObject({ total: 2, toAdd: 1, alreadyOwned: 1, copiesToAdd: 2 });

    const restored = await request(app)
      .post('/api/cards/restore/merge')
      .set('Authorization', `Bearer ${makeToken(owner)}`)
      .send({ cards: backup, confirmation: 'MERGE_MISSING' })
      .expect(200);
    expect(restored.body).toMatchObject({ imported: 1, skipped: 1, failed: [] });

    expect(await Card.countDocuments({ userId: owner._id })).toBe(2);
    expect(await Card.countDocuments({ userId: otherUser._id })).toBe(1);
    expect((await Card.findOne({ userId: owner._id, name: 'Already Owned' })).quantity).toBe(4);
  });

  test('rejects invalid backup rows and requires explicit merge confirmation', async () => {
    const owner = await User.create({ email: 'owner@test.com', username: 'owner', passwordHash: 'x', role: 'user' });
    const app = buildApp();
    const headers = { Authorization: `Bearer ${makeToken(owner)}` };

    await request(app)
      .post('/api/cards/restore/preview')
      .set(headers)
      .send({ cards: [card('')] })
      .expect(400);

    await request(app)
      .post('/api/cards/restore/merge')
      .set(headers)
      .send({ cards: [card('Valid Card')] })
      .expect(400);

    expect(await Card.countDocuments()).toBe(0);
  });
});

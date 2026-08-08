process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PriceSourceLog = require('../models/PriceSourceLog');
const Role = require('../models/Role');
const { verifyToken } = require('../middleware/auth');
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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('GET /api/admin/price-source-health', () => {
  let app, admin;

  beforeEach(async () => {
    app = buildApp();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();
    admin = await User.create({ email: 'admin@test.com', username: 'admin', passwordHash: 'x', role: 'admin' });
  });

  test('401 without auth', async () => {
    await request(app).get('/api/admin/price-source-health').expect(401);
  });

  test('returns zeroed totals with no logs', async () => {
    const res = await request(app)
      .get('/api/admin/price-source-health')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.totalFetches).toBe(0);
    expect(res.body.bySource.Scryfall.count).toBe(0);
    expect(res.body.dailyTrend).toEqual([]);
  });

  test('computes correct counts and percentages across sources', async () => {
    await PriceSourceLog.create([
      { source: 'Scryfall' }, { source: 'Scryfall' }, { source: 'Scryfall' },
      { source: 'MTGGoldfish (backup)' },
      { source: 'None (not found)' },
    ]);

    const res = await request(app)
      .get('/api/admin/price-source-health')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.totalFetches).toBe(5);
    expect(res.body.bySource.Scryfall.count).toBe(3);
    expect(res.body.bySource.Scryfall.percentage).toBe(60);
    expect(res.body.bySource['MTGGoldfish (backup)'].count).toBe(1);
    expect(res.body.bySource['None (not found)'].count).toBe(1);
  });
});

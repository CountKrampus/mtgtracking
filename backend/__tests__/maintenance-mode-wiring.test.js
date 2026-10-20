process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { verifyToken, checkMaintenanceMode } = require('../middleware/auth');

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

// Mirrors the fixed registration order in server.js: verifyToken first (so
// req.user exists), auth routes before the gate (login/status stay reachable
// during maintenance), then the gate before every feature router.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.get('/api/auth/status', (req, res) => res.json({ ok: true }));
  app.use(checkMaintenanceMode);
  app.get('/api/things', (req, res) => res.json({ ok: true, role: req.user ? req.user.role : null }));
  return app;
}

describe('server.js maintenance-mode middleware wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const idx = (needle) => src.indexOf(needle);

  test('has the three registrations this test guards', () => {
    expect(idx('app.use(verifyToken)')).toBeGreaterThan(-1);
    expect(idx("app.use('/api/auth'")).toBeGreaterThan(-1);
    expect(idx('app.use(checkMaintenanceMode)')).toBeGreaterThan(-1);
  });

  test('verifyToken runs before the maintenance gate so req.user is populated', () => {
    expect(idx('app.use(verifyToken)')).toBeLessThan(idx('app.use(checkMaintenanceMode)'));
  });

  test('auth routes are mounted before the gate so login/status stay reachable during maintenance', () => {
    expect(idx("app.use('/api/auth'")).toBeLessThan(idx('app.use(checkMaintenanceMode)'));
  });

  test('the gate is registered before the routers it must block', () => {
    const gate = idx('app.use(checkMaintenanceMode)');
    // Regression: the gate used to sit AFTER these mounts, and since Express
    // matches middleware in registration order it never ran for them —
    // maintenance mode blocked nothing.
    for (const mount of [
      "app.use('/api/users'",
      "app.use('/api/admin'",
      "app.use('/api/forum'",
      "app.use('/api/cards'"
    ]) {
      const at = idx(mount);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(gate);
    }
  });
});

describe('checkMaintenanceMode behavior', () => {
  let app, member, admin;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    member = await User.create({ email: 'member@test.com', username: 'member1', passwordHash: 'x', role: 'user' });
    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('passes everything through while maintenance is off', async () => {
    await request(app).get('/api/things').expect(200);
    await request(app)
      .get('/api/things')
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .expect(200);
  });

  test('blocks anonymous and non-admin users while maintenance is on; admins pass', async () => {
    await SystemSettings.setValue('maintenanceMode', true);

    const anon = await request(app).get('/api/things').expect(503);
    expect(anon.body.code).toBe('MAINTENANCE_MODE');

    const nonAdmin = await request(app)
      .get('/api/things')
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .expect(503);
    expect(nonAdmin.body.code).toBe('MAINTENANCE_MODE');

    await request(app)
      .get('/api/things')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    // Auth routes mounted before the gate stay reachable for everyone —
    // this is what lets the login page read the maintenance status.
    await request(app).get('/api/auth/status').expect(200);
  });

  test('lifts the block once maintenance is disabled', async () => {
    await SystemSettings.setValue('maintenanceMode', true);
    await SystemSettings.setValue('maintenanceMode', false);

    await request(app)
      .get('/api/things')
      .set('Authorization', `Bearer ${makeToken(member)}`)
      .expect(200);
  });
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const Notification = require('../models/Notification');

// Minimal 'Card' model registered under the real name — POST /api/admin/health-reports/run-now
// (added in Task 10) requires ../jobs/weeklyHealthReport, which resolves Card lazily via
// mongoose.model('Card'), mirroring backend/jobs/dailyPriceSnapshot.js's pattern.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health-report', require('../routes/healthReport'));
  app.use('/api/admin', require('../routes/admin'));
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
  await Card.deleteMany({});
  await User.deleteMany({});
  await CollectionHealthReport.deleteMany({});
  await Notification.deleteMany({});
});

describe('GET /api/health-report', () => {
  it('returns 404 when the user has no report yet', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'hash', role: 'user' });
    const app = buildApp();
    const res = await request(app)
      .get('/api/health-report')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);
    expect(res.status).toBe(404);
  });

  it('returns the most recent report for the authenticated user', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'hash', role: 'user' });
    await CollectionHealthReport.create({
      userId: user._id,
      weekOf: new Date('2026-06-29'),
      conditionBreakdown: { NM: 1, LP: 0, MP: 0, HP: 0, DMG: 0 },
      valueChange: { from: 100, to: 90, delta: -10, deltaPercent: -10 },
      upgradeSuggestions: []
    });
    const recent = await CollectionHealthReport.create({
      userId: user._id,
      weekOf: new Date('2026-07-06'),
      conditionBreakdown: { NM: 2, LP: 0, MP: 0, HP: 0, DMG: 0 },
      valueChange: { from: 90, to: 95, delta: 5, deltaPercent: 5.5 },
      upgradeSuggestions: []
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/health-report')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(recent._id.toString());
    expect(res.body.conditionBreakdown.NM).toBe(2);
  });
});

describe('POST /api/admin/health-reports/run-now', () => {
  it('rejects non-admin users with 403', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'hash', role: 'user' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/health-reports/run-now')
      .set('Authorization', `Bearer ${makeToken(user._id, 'user')}`);
    expect(res.status).toBe(403);
  });

  it('generates a report only for opted-in users and creates a notification, skipping opted-out users entirely', async () => {
    const optedIn = await User.create({
      email: 'optedin@test.com', username: 'optedin', passwordHash: 'hash', role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    const optedOut = await User.create({
      email: 'optedout@test.com', username: 'optedout', passwordHash: 'hash', role: 'user',
      notificationPreferences: { healthReportEnabled: false }
    });
    const admin = await User.create({ email: 'admin@test.com', username: 'admin', passwordHash: 'hash', role: 'admin' });

    await Card.create({ userId: optedIn._id, name: 'Sol Ring', condition: 'HP', price: 2, quantity: 1 });
    await Card.create({ userId: optedOut._id, name: 'Lightning Bolt', condition: 'NM', price: 1, quantity: 1 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/health-reports/run-now')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.usersProcessed).toBe(1);
    expect(res.body.reportsCreated).toBe(1);

    const optedInReport = await CollectionHealthReport.findOne({ userId: optedIn._id });
    expect(optedInReport).not.toBeNull();
    expect(optedInReport.conditionBreakdown.HP).toBe(1);

    const optedOutReport = await CollectionHealthReport.findOne({ userId: optedOut._id });
    expect(optedOutReport).toBeNull();

    const notif = await Notification.findOne({ userId: optedIn._id, type: 'collection_health_report' });
    expect(notif).not.toBeNull();

    const optedOutNotif = await Notification.findOne({ userId: optedOut._id, type: 'collection_health_report' });
    expect(optedOutNotif).toBeNull();
  });
});

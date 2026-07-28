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

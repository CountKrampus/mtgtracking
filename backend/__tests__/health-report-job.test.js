const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const Notification = require('../models/Notification');

// runWeeklyHealthReport() resolves Card via mongoose.model('Card') lazily at call time,
// mirroring backend/jobs/dailyPriceSnapshot.js's runDailySnapshot() (which does the same
// because Card is registered dynamically by server.js, not a requirable file). We register
// a minimal schema under the literal name 'Card' so that lookup succeeds in this test file.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

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

const { runWeeklyHealthReport } = require('../jobs/weeklyHealthReport');

describe('runWeeklyHealthReport', () => {
  it('skips users with the preference off entirely: no report doc, no notification', async () => {
    const optedOut = await User.create({
      email: 'optedout2@test.com',
      username: 'optedout2',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: false }
    });
    await Card.create({ userId: optedOut._id, name: 'Forest', condition: 'NM', price: 0.1, quantity: 4 });

    const result = await runWeeklyHealthReport();

    expect(result.usersProcessed).toBe(0);
    expect(result.reportsCreated).toBe(0);

    const report = await CollectionHealthReport.findOne({ userId: optedOut._id });
    expect(report).toBeNull();

    const notif = await Notification.findOne({ userId: optedOut._id });
    expect(notif).toBeNull();
  });

  it('generates a report and notification for an opted-in user', async () => {
    const user = await User.create({
      email: 'optedin2@test.com',
      username: 'optedin2',
      passwordHash: 'hash',
      role: 'user',
      notificationPreferences: { healthReportEnabled: true }
    });
    await Card.create({ userId: user._id, name: 'Sol Ring', condition: 'DMG', price: 2, quantity: 1 });

    const result = await runWeeklyHealthReport();

    expect(result.usersProcessed).toBe(1);
    expect(result.reportsCreated).toBe(1);

    const report = await CollectionHealthReport.findOne({ userId: user._id });
    expect(report).not.toBeNull();
    expect(report.conditionBreakdown.DMG).toBe(1);
    expect(report.upgradeSuggestions.some(s => s.reason === 'poor_condition')).toBe(true);

    const notif = await Notification.findOne({ userId: user._id, type: 'collection_health_report' });
    expect(notif).not.toBeNull();
  });
});

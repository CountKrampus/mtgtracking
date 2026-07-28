const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const Notification = require('../models/Notification');

// runDailySnapshot() resolves Card via mongoose.model('Card') lazily at call time
// (Card is registered dynamically by server.js, not a requirable file). Register a
// minimal schema under the literal name 'Card' so the lookup succeeds in this test,
// matching the established pattern in health-report-job.test.js.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  isFoil: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  priceAlert: {
    targetPrice: Number,
    targetHigh: Number,
    emailNotification: { type: Boolean, default: false },
    lastAlertFiredAt: { type: Date, default: null },
    lastHighAlertFiredAt: { type: Date, default: null }
  }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

jest.mock('../utils/pricing', () => ({
  getPriceWithFallback: jest.fn()
}));
const { getPriceWithFallback } = require('../utils/pricing');
const { runDailySnapshot } = require('../jobs/dailyPriceSnapshot');

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
  await CardPriceSnapshot.deleteMany({});
  await Notification.deleteMany({});
  jest.clearAllMocks();
});

async function makeUser() {
  return User.create({ email: `u${Date.now()}@test.com`, username: `u${Date.now()}`, passwordHash: 'x', role: 'editor' });
}

describe('runDailySnapshot price alerts', () => {
  it('fires a low-target notification on a fresh downward crossing', async () => {
    const user = await makeUser();
    const card = await Card.create({
      userId: user._id, name: 'Cheap Card', price: 5,
      priceAlert: { targetPrice: 2 }
    });
    // Prior snapshot above target, so today's drop is a fresh crossing
    await CardPriceSnapshot.create({ cardId: card._id, userId: user._id, price: 5, createdAt: new Date(Date.now() - 86400000) });
    getPriceWithFallback.mockResolvedValue({ usd: 1.5 });

    await runDailySnapshot();

    const notif = await Notification.findOne({ userId: user._id, type: 'price_alert' });
    expect(notif).not.toBeNull();
    expect(notif.content).toContain('dropped to');
    const updated = await Card.findById(card._id);
    expect(updated.priceAlert.lastAlertFiredAt).not.toBeNull();
  });

  it('fires a high-target notification on a fresh upward crossing', async () => {
    const user = await makeUser();
    const card = await Card.create({
      userId: user._id, name: 'Rising Card', price: 5,
      priceAlert: { targetHigh: 10 }
    });
    await CardPriceSnapshot.create({ cardId: card._id, userId: user._id, price: 5, createdAt: new Date(Date.now() - 86400000) });
    getPriceWithFallback.mockResolvedValue({ usd: 15 });

    await runDailySnapshot();

    const notif = await Notification.findOne({ userId: user._id, type: 'price_alert' });
    expect(notif).not.toBeNull();
    expect(notif.content).toContain('rose to');
    const updated = await Card.findById(card._id);
    expect(updated.priceAlert.lastHighAlertFiredAt).not.toBeNull();
  });

  it('does not refire the low alert once already fired without a recovery above target', async () => {
    const user = await makeUser();
    const card = await Card.create({
      userId: user._id, name: 'Still Cheap', price: 1,
      priceAlert: { targetPrice: 2, lastAlertFiredAt: new Date(Date.now() - 86400000) }
    });
    // Yesterday's snapshot was ALSO at/below target — not a fresh crossing
    await CardPriceSnapshot.create({ cardId: card._id, userId: user._id, price: 1.5, createdAt: new Date(Date.now() - 86400000) });
    getPriceWithFallback.mockResolvedValue({ usd: 1 });

    await runDailySnapshot();

    const notif = await Notification.findOne({ userId: user._id, type: 'price_alert' });
    expect(notif).toBeNull();
  });

  it('does not fire when neither threshold is set', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'No Alert', price: 5, priceAlert: {} });
    getPriceWithFallback.mockResolvedValue({ usd: 1 });

    await runDailySnapshot();

    const notif = await Notification.findOne({ type: 'price_alert' });
    expect(notif).toBeNull();
  });
});

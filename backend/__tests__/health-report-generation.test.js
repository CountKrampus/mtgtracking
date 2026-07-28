const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ValueSnapshot = require('../models/ValueSnapshot');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { generateHealthReportForUser } = require('../utils/healthReport');

// Minimal in-memory Card model for generation tests, registered under a distinct
// name so it doesn't collide with the real 'Card' schema registered elsewhere.
// Mirrors the TestCard pattern in __tests__/milestones.test.js. generateHealthReportForUser
// takes the Card model as an explicit parameter (like utils/milestoneAwards.js does),
// so injecting this test double requires no changes to the function under test.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 }
});
const TestCard = mongoose.models.TestCard || mongoose.model('TestCard', cardSchema);

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
  await TestCard.deleteMany({});
  await ValueSnapshot.deleteMany({});
  await CardPriceSnapshot.deleteMany({});
  await CollectionHealthReport.deleteMany({});
});

describe('generateHealthReportForUser', () => {
  it('saves a CollectionHealthReport combining condition breakdown, value change, and upgrade suggestions', async () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const bolt = await TestCard.create({ userId, name: 'Lightning Bolt', condition: 'NM', price: 5, quantity: 1 });
    const ring = await TestCard.create({ userId, name: 'Sol Ring', condition: 'DMG', price: 2, quantity: 1 });

    // Value snapshots: 100 eight days ago, 120 now
    await ValueSnapshot.create({ userId, value: 100, cardCount: 2, createdAt: eightDaysAgo });
    await ValueSnapshot.create({ userId, value: 120, cardCount: 2, createdAt: now });

    // Price snapshot for Lightning Bolt eight days ago at $10 -> now $5 = 50% drop
    await CardPriceSnapshot.create({ cardId: bolt._id, userId, price: 10, createdAt: eightDaysAgo });

    const report = await generateHealthReportForUser(userId, {
      Card: TestCard, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
    });

    expect(report.conditionBreakdown.toObject()).toEqual({ NM: 1, LP: 0, MP: 0, HP: 0, DMG: 1 });
    expect(report.valueChange.toObject()).toEqual({ from: 100, to: 120, delta: 20, deltaPercent: 20 });

    const reasons = report.upgradeSuggestions.map(s => s.reason).sort();
    expect(reasons).toEqual(['poor_condition', 'price_drop']);

    const dmgSuggestion = report.upgradeSuggestions.find(s => s.cardId.toString() === ring._id.toString());
    expect(dmgSuggestion.detail).toBe('Condition: DMG');

    const dropSuggestion = report.upgradeSuggestions.find(s => s.cardId.toString() === bolt._id.toString());
    expect(dropSuggestion.detail).toContain('50%');

    const saved = await CollectionHealthReport.findById(report._id);
    expect(saved).not.toBeNull();
  });

  it('handles a user with no snapshots yet (first week) gracefully', async () => {
    const userId = new mongoose.Types.ObjectId();
    await TestCard.create({ userId, name: 'Forest', condition: 'NM', price: 0.1, quantity: 10 });

    const report = await generateHealthReportForUser(userId, {
      Card: TestCard, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
    });

    expect(report.valueChange.toObject()).toEqual({ from: 0, to: 0, delta: 0, deltaPercent: 0 });
    expect(report.upgradeSuggestions).toEqual([]);
  });
});

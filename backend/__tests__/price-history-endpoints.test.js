const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');

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
});

describe('CardPriceSnapshot model', () => {
  test('stores price snapshot with cardId and price', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const snap = await CardPriceSnapshot.create({ cardId, userId, price: 1.25 });
    expect(snap.price).toBe(1.25);
    expect(snap.cardId.toString()).toBe(cardId.toString());
    expect(snap.createdAt).toBeDefined();
  });
});

describe('ValueSnapshot model', () => {
  test('stores value snapshot with value and cardCount', async () => {
    const userId = new mongoose.Types.ObjectId();
    const snap = await ValueSnapshot.create({ userId, value: 500.50, cardCount: 42 });
    expect(snap.value).toBe(500.50);
    expect(snap.cardCount).toBe(42);
  });

  test('earliest query returns oldest createdAt', async () => {
    const userId = new mongoose.Types.ObjectId();
    const old = new Date('2026-01-01');
    const recent = new Date('2026-06-01');
    await ValueSnapshot.create({ userId, value: 100, cardCount: 10, createdAt: old });
    await ValueSnapshot.create({ userId, value: 200, cardCount: 20, createdAt: recent });

    const earliest = await ValueSnapshot.findOne({}).sort({ createdAt: 1 }).lean();
    expect(new Date(earliest.createdAt).toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  test('range query filters by from and to dates', async () => {
    const userId = new mongoose.Types.ObjectId();
    await ValueSnapshot.create({ userId, value: 100, cardCount: 10, createdAt: new Date('2026-01-15') });
    await ValueSnapshot.create({ userId, value: 200, cardCount: 20, createdAt: new Date('2026-03-15') });
    await ValueSnapshot.create({ userId, value: 300, cardCount: 30, createdAt: new Date('2026-05-15') });

    const from = new Date('2026-02-01');
    const to = new Date('2026-04-30');
    const results = await ValueSnapshot.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 });
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(200);
  });
});

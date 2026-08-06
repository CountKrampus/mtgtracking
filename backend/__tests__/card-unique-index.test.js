process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Card = require('../models/Card');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Card.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Card.deleteMany({});
});

describe('Card unique duplicate-prevention index', () => {
  test('rejects a second identical row (same user+name+set+condition+foil+collectorNumber)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await Card.create({ userId, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 1 });
    await expect(
      Card.create({ userId, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 1 })
    ).rejects.toThrow(/duplicate key/i);
  });

  test('allows same card with different collector numbers (alt arts)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await Card.create({ userId, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '1', quantity: 1 });
    await expect(
      Card.create({ userId, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '2', quantity: 1 })
    ).resolves.toBeDefined();
  });

  test('allows same card for different users', async () => {
    await Card.create({ userId: new mongoose.Types.ObjectId(), name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    await expect(
      Card.create({ userId: new mongoose.Types.ObjectId(), name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 })
    ).resolves.toBeDefined();
  });
});

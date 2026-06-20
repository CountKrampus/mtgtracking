process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Deck = require('../models/Deck');

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

beforeEach(async () => {
  await Deck.syncIndexes();
});

const testUserId = () => new mongoose.Types.ObjectId();

test('shareCode defaults to null', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.shareCode).toBeNull();
});

test('isPublic defaults to false', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.isPublic).toBe(false);
});

test('importCount defaults to 0', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Test Deck' });
  expect(deck.importCount).toBe(0);
});

test('shareCode can be set and retrieved', async () => {
  const deck = await Deck.create({ userId: testUserId(), name: 'Shared Deck', shareCode: 'abc123def456' });
  const found = await Deck.findById(deck._id);
  expect(found.shareCode).toBe('abc123def456');
});

test('two decks cannot have the same non-null shareCode', async () => {
  await Deck.create({ userId: testUserId(), name: 'Deck A', shareCode: 'uniquecode1' });
  await expect(
    Deck.create({ userId: testUserId(), name: 'Deck B', shareCode: 'uniquecode1' })
  ).rejects.toMatchObject({ code: 11000 });
});

test('multiple decks can have null shareCode', async () => {
  await Deck.create({ userId: testUserId(), name: 'Deck A' });
  await expect(
    Deck.create({ userId: testUserId(), name: 'Deck B' })
  ).resolves.toBeDefined();
});

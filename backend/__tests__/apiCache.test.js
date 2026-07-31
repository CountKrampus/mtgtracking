const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { cachedApiCall } = require('../utils/apiCache');

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

describe('cachedApiCall', () => {
  test('calls fetchFn and caches the result on first call', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ value: 42 });
    const result = await cachedApiCall('test-key-1', fetchFn);
    expect(result).toEqual({ value: 42 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('returns the cached value on a second call without calling fetchFn again', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ value: 99 });
    await cachedApiCall('test-key-2', fetchFn);
    const result = await cachedApiCall('test-key-2', fetchFn);
    expect(result).toEqual({ value: 99 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('different keys are cached independently', async () => {
    const fetchFnA = jest.fn().mockResolvedValue({ value: 'a' });
    const fetchFnB = jest.fn().mockResolvedValue({ value: 'b' });
    const resultA = await cachedApiCall('test-key-a', fetchFnA);
    const resultB = await cachedApiCall('test-key-b', fetchFnB);
    expect(resultA).toEqual({ value: 'a' });
    expect(resultB).toEqual({ value: 'b' });
  });
});

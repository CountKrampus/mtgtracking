process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const AnnouncedSet = require('../models/AnnouncedSet');
const { runSetReleaseAnnouncer } = require('../jobs/setReleaseAnnouncer');

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
  jest.clearAllMocks();
});

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function makeSet(overrides = {}) {
  return {
    code: 'abc',
    name: 'Alpha Beta Crossover',
    set_type: 'expansion',
    digital: false,
    card_count: 250,
    released_at: daysAgo(1),
    scryfall_uri: 'https://scryfall.com/sets/abc',
    ...overrides,
  };
}

async function seedAdminAndCategory() {
  const admin = await User.create({
    email: 'admin@test.com',
    username: 'admin1',
    passwordHash: 'x',
    role: 'admin',
    isActive: true,
  });
  const category = await ForumCategory.create({
    name: 'General Discussion',
    slug: 'general-discussion',
  });
  return { admin, category };
}

describe('runSetReleaseAnnouncer', () => {
  it('creates a forum thread and AnnouncedSet record for a newly released set', async () => {
    await seedAdminAndCategory();
    axios.get.mockResolvedValue({ data: { data: [makeSet()] } });

    const result = await runSetReleaseAnnouncer();

    expect(result.threadsCreated).toBe(1);
    const thread = await ForumThread.findOne({ tags: 'abc' });
    expect(thread).not.toBeNull();
    expect(thread.title).toMatch(/Alpha Beta Crossover/);
    expect(thread.title).toMatch(/ABC/);
    expect(thread.content).toMatch(/scryfall\.com\/sets\/abc/);

    const announced = await AnnouncedSet.findOne({ setCode: 'abc' });
    expect(announced).not.toBeNull();
    expect(announced.threadId.toString()).toBe(thread._id.toString());

    const category = await ForumCategory.findOne({ slug: 'general-discussion' });
    expect(category.threadCount).toBe(1);
  });

  it('does not double-post a set already announced', async () => {
    await seedAdminAndCategory();
    axios.get.mockResolvedValue({ data: { data: [makeSet()] } });

    await runSetReleaseAnnouncer();
    const second = await runSetReleaseAnnouncer();

    expect(second.threadsCreated).toBe(0);
    const threads = await ForumThread.find({ tags: 'abc' });
    expect(threads.length).toBe(1);
  });

  it('filters out digital sets, excluded set types, and sets outside the release window', async () => {
    await seedAdminAndCategory();
    axios.get.mockResolvedValue({
      data: {
        data: [
          makeSet({ code: 'dig', name: 'Digital Only', digital: true }),
          makeSet({ code: 'tok', name: 'Token Set', set_type: 'token' }),
          makeSet({ code: 'old', name: 'Too Old', released_at: daysAgo(30) }),
          makeSet({ code: 'fut', name: 'Future Set', released_at: daysAgo(-5) }),
          makeSet({ code: 'ok1', name: 'Valid Set' }),
        ],
      },
    });

    const result = await runSetReleaseAnnouncer();

    expect(result.threadsCreated).toBe(1);
    const thread = await ForumThread.findOne({ tags: 'ok1' });
    expect(thread).not.toBeNull();
  });

  it('skips gracefully when no admin user exists', async () => {
    await ForumCategory.create({ name: 'General Discussion', slug: 'general-discussion' });
    axios.get.mockResolvedValue({ data: { data: [makeSet()] } });

    const result = await runSetReleaseAnnouncer();

    expect(result.threadsCreated).toBe(0);
    expect(await ForumThread.countDocuments()).toBe(0);
  });

  it('skips gracefully when the target category does not exist', async () => {
    await User.create({
      email: 'admin@test.com',
      username: 'admin1',
      passwordHash: 'x',
      role: 'admin',
      isActive: true,
    });
    axios.get.mockResolvedValue({ data: { data: [makeSet()] } });

    const result = await runSetReleaseAnnouncer();

    expect(result.threadsCreated).toBe(0);
    expect(await ForumThread.countDocuments()).toBe(0);
  });

  it('handles Scryfall fetch failures without throwing', async () => {
    await seedAdminAndCategory();
    axios.get.mockRejectedValue(new Error('network down'));

    const result = await runSetReleaseAnnouncer();

    expect(result.errors).toBe(1);
    expect(result.threadsCreated).toBe(0);
  });
});

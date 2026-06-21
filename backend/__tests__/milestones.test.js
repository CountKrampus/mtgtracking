const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');
const { checkCollectionMilestones, checkPostMilestones } = require('../utils/milestoneAwards');

// Minimal in-memory Card model for collection milestone tests
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  quantity: { type: Number, default: 1 },
});
// Use a unique model name so it doesn't collide if Card is already registered
const TestCard = mongoose.models.TestCard || mongoose.model('TestCard', cardSchema);

async function createUser(overrides = {}) {
  return User.create({
    email: `user_${Date.now()}@test.com`,
    username: `user_${Date.now()}`,
    passwordHash: 'hash',
    ...overrides,
  });
}

// ─── Collection Milestones ────────────────────────────────────────────────────

describe('checkCollectionMilestones', () => {
  it('grants Century Collector badge when card total >= 100', async () => {
    const user = await createUser();

    // Insert cards that sum to exactly 100
    await TestCard.create({ userId: user._id, name: 'Lightning Bolt', quantity: 100 });

    await checkCollectionMilestones(user._id, TestCard);

    const updated = await User.findById(user._id).lean();
    const badge = updated.badges.find(b => b.name === 'Century Collector');
    expect(badge).toBeDefined();
    expect(badge.description).toBe('Added 100 cards to your collection');
  });

  it('does NOT grant Century Collector when total < 100', async () => {
    const user = await createUser();
    await TestCard.create({ userId: user._id, name: 'Forest', quantity: 99 });

    await checkCollectionMilestones(user._id, TestCard);

    const updated = await User.findById(user._id).lean();
    const badge = updated.badges.find(b => b.name === 'Century Collector');
    expect(badge).toBeUndefined();
  });

  it('does NOT double-grant an already-owned badge', async () => {
    const user = await createUser({
      badges: [{ name: 'Century Collector', description: 'Already owned', earnedAt: new Date() }],
    });
    await TestCard.create({ userId: user._id, name: 'Lightning Bolt', quantity: 200 });

    await checkCollectionMilestones(user._id, TestCard);

    const updated = await User.findById(user._id).lean();
    const centuryBadges = updated.badges.filter(b => b.name === 'Century Collector');
    expect(centuryBadges).toHaveLength(1); // still only one
  });

  it('grants multiple collection badges when total crosses multiple thresholds', async () => {
    const user = await createUser();
    await TestCard.create({ userId: user._id, name: 'Plains', quantity: 500 });

    await checkCollectionMilestones(user._id, TestCard);

    const updated = await User.findById(user._id).lean();
    const names = updated.badges.map(b => b.name);
    expect(names).toContain('Century Collector');
    expect(names).toContain('Seasoned Collector');
    expect(names).not.toContain('Master Collector'); // 500 < 1000
  });

  it('adds matching ForumLevel achievement', async () => {
    const user = await createUser();
    await ForumLevel.create({ userId: user._id });
    await TestCard.create({ userId: user._id, name: 'Island', quantity: 100 });

    await checkCollectionMilestones(user._id, TestCard);

    const level = await ForumLevel.findOne({ userId: user._id }).lean();
    const ach = level.achievements.find(a => a.name === 'Century Collector');
    expect(ach).toBeDefined();
  });
});

// ─── Post Milestones ──────────────────────────────────────────────────────────

describe('checkPostMilestones', () => {
  it('grants First Steps badge when postCount >= 10', async () => {
    const user = await createUser();

    await checkPostMilestones(user._id, 10);

    const updated = await User.findById(user._id).lean();
    const badge = updated.badges.find(b => b.name === 'First Steps');
    expect(badge).toBeDefined();
    expect(badge.description).toBe('Made 10 forum posts');
  });

  it('does NOT grant First Steps when postCount < 10', async () => {
    const user = await createUser();

    await checkPostMilestones(user._id, 9);

    const updated = await User.findById(user._id).lean();
    const badge = updated.badges.find(b => b.name === 'First Steps');
    expect(badge).toBeUndefined();
  });

  it('does NOT double-grant an already-owned badge', async () => {
    const user = await createUser({
      badges: [{ name: 'First Steps', description: 'Made 10 forum posts', earnedAt: new Date() }],
    });

    await checkPostMilestones(user._id, 25);

    const updated = await User.findById(user._id).lean();
    const badges = updated.badges.filter(b => b.name === 'First Steps');
    expect(badges).toHaveLength(1);
  });

  it('grants multiple post badges when postCount crosses multiple thresholds', async () => {
    const user = await createUser();

    await checkPostMilestones(user._id, 100);

    const updated = await User.findById(user._id).lean();
    const names = updated.badges.map(b => b.name);
    expect(names).toContain('First Steps');    // >= 10
    expect(names).toContain('Regular');        // >= 50
    expect(names).toContain('Veteran Poster'); // >= 100
    expect(names).not.toContain('Forum Legend'); // 100 < 500
  });

  it('grants Forum Legend at 500 posts', async () => {
    const user = await createUser();

    await checkPostMilestones(user._id, 500);

    const updated = await User.findById(user._id).lean();
    const badge = updated.badges.find(b => b.name === 'Forum Legend');
    expect(badge).toBeDefined();
  });

  it('adds ForumLevel achievement for post milestone', async () => {
    const user = await createUser();
    await ForumLevel.create({ userId: user._id });

    await checkPostMilestones(user._id, 10);

    const level = await ForumLevel.findOne({ userId: user._id }).lean();
    const ach = level.achievements.find(a => a.name === 'First Steps');
    expect(ach).toBeDefined();
  });
});

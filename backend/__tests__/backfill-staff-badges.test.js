process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { backfillStaffBadges, ensureStaffBadgesExist } = require('../scripts/backfillStaffBadges');

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

describe('ensureStaffBadgesExist', () => {
  test('creates Community Manager and Support Badge docs if missing', async () => {
    await ensureStaffBadgesExist();
    const communityManager = await Badge.findOne({ name: 'Community Manager' });
    const support = await Badge.findOne({ name: 'Support' });
    expect(communityManager).not.toBeNull();
    expect(support).not.toBeNull();
  });

  test('is idempotent — running twice does not create duplicates', async () => {
    await ensureStaffBadgesExist();
    await ensureStaffBadgesExist();
    const count = await Badge.countDocuments({ name: 'Support' });
    expect(count).toBe(1);
  });
});

describe('backfillStaffBadges', () => {
  test('grants the matching badge to every staff user missing it, and skips non-staff users', async () => {
    const mod = await User.create({
      email: 'mod@test.com', username: 'moduser', passwordHash: 'x', role: 'moderator'
    });
    const nonStaff = await User.create({
      email: 'plain@test.com', username: 'plainuser', passwordHash: 'x', role: 'user'
    });

    const summary = await backfillStaffBadges();

    expect(summary).toEqual({ usersChecked: 1, badgesGranted: 1, namesFixed: 0 });

    const updatedMod = await User.findById(mod._id);
    expect(updatedMod.badges.map(b => b.name)).toEqual(['Moderator']);

    const updatedNonStaff = await User.findById(nonStaff._id);
    expect(updatedNonStaff.badges).toHaveLength(0);
  });

  test('renames the legacy "Owner" badge to "Site Owner" without creating a duplicate', async () => {
    const admin = await User.create({
      email: 'admin@test.com', username: 'adminuser', passwordHash: 'x', role: 'admin',
      badges: [{ name: 'Owner', description: 'Old label', icon: 'lucide:Crown', earnedAt: new Date() }]
    });

    const summary = await backfillStaffBadges();

    expect(summary).toEqual({ usersChecked: 1, badgesGranted: 0, namesFixed: 1 });

    const updated = await User.findById(admin._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('drops the legacy "Owner" entry instead of duplicating when "Site Owner" is already present', async () => {
    const admin = await User.create({
      email: 'admin2@test.com', username: 'adminuser2', passwordHash: 'x', role: 'admin',
      badges: [
        { name: 'Owner', description: 'Old label', icon: 'lucide:Crown', earnedAt: new Date() },
        { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown', earnedAt: new Date() }
      ]
    });

    await backfillStaffBadges();

    const updated = await User.findById(admin._id);
    expect(updated.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('running twice does not grant duplicate badges', async () => {
    await User.create({
      email: 'mod2@test.com', username: 'moduser2', passwordHash: 'x', role: 'moderator'
    });

    await backfillStaffBadges();
    const summary2 = await backfillStaffBadges();

    expect(summary2).toEqual({ usersChecked: 1, badgesGranted: 0, namesFixed: 0 });
  });
});

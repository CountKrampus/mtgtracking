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
const Referral = require('../models/Referral');
const ReferralCode = require('../models/ReferralCode');
const Card = require('../models/Card');
const SystemSettings = require('../models/SystemSettings');
const {
  awardSignup,
  awardQualification,
  checkQualification,
} = require('../utils/referralRewards');

const {
  claimReferral,
  getOrCreateCode,
} = require('../routes/referrals');

async function makeUser(overrides = {}) {
  return User.create({
    email: `u${Math.random().toString(36).slice(2)}@test.com`,
    username: `user${Math.random().toString(36).slice(2)}`,
    passwordHash: 'hash',
    role: 'user',
    isActive: true,
    ...overrides,
  });
}

async function makeReferral(referrer, referred, overrides = {}) {
  return Referral.create({
    code: 'TESTCODE',
    referrerUserId: referrer._id,
    referredUserId: referred._id,
    ...overrides,
  });
}

test('referral defaults to pending with unpaid stages', async () => {
  const referrer = await makeUser();
  const referred = await makeUser();
  const ref = await makeReferral(referrer, referred);

  expect(ref.status).toBe('pending');
  expect(ref.signupRepAwarded).toBe(false);
  expect(ref.qualificationRepAwarded).toBe(false);
  expect(ref.ipSimilarityFlag).toBe(false);
});

test('signup award pays referrer the configured rep exactly once', async () => {
  const referrer = await makeUser({ reputation: 0 });
  const referred = await makeUser();
  const ref = await makeReferral(referrer, referred);

  const first = await awardSignup(ref._id);
  const second = await awardSignup(ref._id); // retry / re-fire

  expect(first).toBe(true);
  expect(second).toBe(false); // idempotent — not paid twice

  const updated = await User.findById(referrer._id);
  expect(updated.reputation).toBe(10); // default signupRep
});

test('qualification award pays both sides and bumps referralCount exactly once', async () => {
  const referrer = await makeUser({ reputation: 0, referralCount: 0 });
  const referred = await makeUser({ reputation: 0 });
  const ref = await makeReferral(referrer, referred);

  const first = await awardQualification(ref._id);
  const second = await awardQualification(ref._id);

  expect(first).toBe(true);
  expect(second).toBe(false);

  const updatedReferrer = await User.findById(referrer._id);
  const updatedReferred = await User.findById(referred._id);
  expect(updatedReferrer.reputation).toBe(50); // default qualificationRep
  expect(updatedReferred.reputation).toBe(10); // default referredRep
  expect(updatedReferrer.referralCount).toBe(1);

  const updatedRef = await Referral.findById(ref._id);
  expect(updatedRef.status).toBe('qualified');
  expect(updatedRef.qualifiedAt).toBeTruthy();
});

test('referrer earns Connector badge on first qualification', async () => {
  const referrer = await makeUser({ referralCount: 0 });
  const referred = await makeUser();
  const ref = await makeReferral(referrer, referred);

  await awardQualification(ref._id);

  const updated = await User.findById(referrer._id);
  expect(updated.badges.some((b) => b.name === 'Connector')).toBe(true);
});

test('self-referral via claimReferral is blocked', async () => {
  const user = await makeUser();
  const code = await getOrCreateCode(user._id);

  const result = await claimReferral(code.code, user, '1.2.3.4');

  expect(result).toBeNull();
  expect(await Referral.countDocuments({})).toBe(0);
});

test('claimReferral sets ipSimilarityFlag when signup IP matches referrer lastSeenIp', async () => {
  const referrer = await makeUser({ lastSeenIp: '9.9.9.9' });
  const code = await getOrCreateCode(referrer._id);
  const referred = await makeUser();

  await claimReferral(code.code, referred, '9.9.9.9');

  const ref = await Referral.findOne({ referredUserId: referred._id });
  expect(ref).toBeTruthy();
  expect(ref.ipSimilarityFlag).toBe(true);

  // The referred user is stamped with who invited them
  const updatedReferred = await User.findById(referred._id);
  expect(String(updatedReferred.referredBy)).toBe(String(referrer._id));
});

test('claimReferral does not set flag on a different IP', async () => {
  const referrer = await makeUser({ lastSeenIp: '9.9.9.9' });
  const code = await getOrCreateCode(referrer._id);
  const referred = await makeUser();

  await claimReferral(code.code, referred, '5.5.5.5');

  const ref = await Referral.findOne({ referredUserId: referred._id });
  expect(ref.ipSimilarityFlag).toBe(false);
});

test('claimReferral ignores an unknown code', async () => {
  const referred = await makeUser();
  const result = await claimReferral('NOSUCHCODE', referred, '1.1.1.1');

  expect(result).toBeNull();
  expect(await Referral.countDocuments({})).toBe(0);
});

test('claimReferral is a no-op when the referrer is inactive', async () => {
  const referrer = await makeUser({ isActive: false });
  const code = await getOrCreateCode(referrer._id);
  const referred = await makeUser();

  const result = await claimReferral(code.code, referred, '1.1.1.1');

  expect(result).toBeNull();
  expect(await Referral.countDocuments({})).toBe(0);
  expect((await User.findById(referred._id)).referredBy).toBeNull();
});

test('referrer earns Evangelist badge at 5 referrals, without duplicates', async () => {
  const referrer = await makeUser({ referralCount: 0, reputation: 0 });

  for (let i = 0; i < 5; i++) {
    const referred = await makeUser();
    const ref = await makeReferral(referrer, referred);
    await awardQualification(ref._id);
  }

  const updated = await User.findById(referrer._id);
  expect(updated.referralCount).toBe(5);
  expect(updated.badges.filter((b) => b.name === 'Connector')).toHaveLength(1);
  expect(updated.badges.filter((b) => b.name === 'Evangelist')).toHaveLength(1);
});

test('getOrCreateCode is stable — repeated calls return the same code', async () => {
  const user = await makeUser();
  const first = await getOrCreateCode(user._id);
  const second = await getOrCreateCode(user._id);

  expect(String(first._id)).toBe(String(second._id));
  expect(first.code).toBe(second.code);
  expect(await ReferralCode.countDocuments({ userId: user._id })).toBe(1);
});

test('DB rejects a second code for the same user, and rejects duplicate codes', async () => {
  await ReferralCode.syncIndexes();

  const userA = await makeUser();
  const userB = await makeUser();
  const codeA = await getOrCreateCode(userA._id);

  // Same user cannot mint a second code
  let userDup = null;
  try { await ReferralCode.create({ code: 'ZZZZZZ', userId: userA._id }); }
  catch (err) { userDup = err; }
  expect(userDup && userDup.code).toBe(11000);

  // Another user cannot reuse an existing code
  let codeDup = null;
  try { await ReferralCode.create({ code: codeA.code, userId: userB._id }); }
  catch (err) { codeDup = err; }
  expect(codeDup && codeDup.code).toBe(11000);

  expect(await ReferralCode.countDocuments({})).toBe(1);
});

test('checkQualification fires once when card total crosses the threshold', async () => {
  const referrer = await makeUser({ reputation: 0, referralCount: 0 });
  const referred = await makeUser({ reputation: 0 });
  const ref = await makeReferral(referrer, referred);

  // Below threshold (default 20): no award
  await Card.create({ userId: referred._id, name: 'Sol Ring', quantity: 5, condition: 'NM' });
  const below = await checkQualification(referred._id, Card);
  expect(below).toBe(false);
  expect((await User.findById(referrer._id)).reputation).toBe(0);

  // Cross threshold (5 + 20 = 25 >= 20)
  await Card.create({ userId: referred._id, name: 'Counterspell', quantity: 20, condition: 'NM' });
  const at = await checkQualification(referred._id, Card);
  expect(at).toBe(true);
  expect((await User.findById(referrer._id)).reputation).toBe(50);

  // Re-fire: no second payout
  const again = await checkQualification(referred._id, Card);
  expect(again).toBe(false);
  expect((await User.findById(referrer._id)).reputation).toBe(50);
});

test('checkQualification skips when referrals are disabled', async () => {
  await SystemSettings.create({ key: 'referralsEnabled', value: false });

  const referrer = await makeUser({ reputation: 0 });
  const referred = await makeUser();
  const ref = await makeReferral(referrer, referred);

  await Card.create({ userId: referred._id, name: 'Lightning Bolt', quantity: 40, condition: 'NM' });
  const result = await checkQualification(referred._id, Card);

  expect(result).toBe(false);
  expect((await User.findById(referrer._id)).reputation).toBe(0);
});

test('rejected referrals never pay out', async () => {
  const referrer = await makeUser({ reputation: 0 });
  const referred = await makeUser({ reputation: 0 });
  const ref = await makeReferral(referrer, referred, { status: 'rejected' });

  const signup = await awardSignup(ref._id);
  const qual = await awardQualification(ref._id);

  expect(signup).toBe(false);
  expect(qual).toBe(false);
  expect((await User.findById(referrer._id)).reputation).toBe(0);
});

test('DB rejects a second referral for the same referred user', async () => {
  // Build the unique index explicitly first — otherwise Mongo may still be
  // creating it in the background and would accept the duplicate insert.
  await Referral.syncIndexes();

  const referrerA = await makeUser();
  const referrerB = await makeUser();
  const referred = await makeUser();

  await makeReferral(referrerA, referred);

  let duplicateError = null;
  try {
    await makeReferral(referrerB, referred);
  } catch (err) {
    duplicateError = err;
  }

  expect(duplicateError).toBeTruthy();
  expect(duplicateError.code).toBe(11000); // Mongo duplicate key
  expect(await Referral.countDocuments({ referredUserId: referred._id })).toBe(1);
});

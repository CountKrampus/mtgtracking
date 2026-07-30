const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('axios');
const axios = require('axios');

// computeProgress() takes Card as a parameter rather than requiring it directly
// (Card is registered dynamically by server.js, not a requirable file) — see
// health-report-job.test.js for the established pattern this mirrors.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  set: String,
  setCode: String,
  colors: [String],
  rarity: String,
  isFoil: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

const ActivityLog = require('../models/ActivityLog');
const TradeOffer = require('../models/TradeOffer');
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const User = require('../models/User');
const { computeProgress, getScryfallSetSize, validateMetricParams } = require('../utils/challengeProgress');

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
  await ActivityLog.deleteMany({});
  await TradeOffer.deleteMany({});
  await ForumPost.deleteMany({});
  await ForumThread.deleteMany({});
  await ForumCategory.deleteMany({});
  await ChallengeParticipation.deleteMany({});
  await User.deleteMany({});
  jest.clearAllMocks();
});

const userId = new mongoose.Types.ObjectId();
const monthStart = new Date('2026-06-01T00:00:00Z');
const monthEnd = new Date('2026-06-30T23:59:59Z');
const outsideMonth = new Date('2026-05-15T00:00:00Z');

describe('computeProgress', () => {
  it('foils_added counts only foil cards added this month', async () => {
    await Card.create({ userId, name: 'Foil A', isFoil: true, createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'Non-foil', isFoil: false, createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'Foil old', isFoil: true, createdAt: outsideMonth });

    const progress = await computeProgress({ metric: 'foils_added', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('cards_added counts all cards added this month regardless of foil', async () => {
    await Card.create({ userId, name: 'A', createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'B', createdAt: new Date('2026-06-10') });
    await Card.create({ userId, name: 'C', createdAt: outsideMonth });

    const progress = await computeProgress({ metric: 'cards_added', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(2);
  });

  it('value_added sums price of cards added this month', async () => {
    await Card.create({ userId, name: 'A', price: 5.5, createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'B', price: 2.25, createdAt: new Date('2026-06-10') });

    const progress = await computeProgress({ metric: 'value_added', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(7.75);
  });

  it('color_added matches uppercase Scryfall color letters regardless of input casing', async () => {
    await Card.create({ userId, name: 'Blue card', colors: ['U'], createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'Red card', colors: ['R'], createdAt: new Date('2026-06-05') });

    const progress = await computeProgress({ metric: 'color_added', params: { color: 'u' } }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('rarity_added matches uppercase rarity letters', async () => {
    await Card.create({ userId, name: 'Mythic card', rarity: 'M', createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'Common card', rarity: 'C', createdAt: new Date('2026-06-05') });

    const progress = await computeProgress({ metric: 'rarity_added', params: { rarity: 'mythic'.charAt(0).toUpperCase() } }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('unique_sets counts distinct set names among cards added this month', async () => {
    await Card.create({ userId, name: 'A', set: 'Alpha', createdAt: new Date('2026-06-05') });
    await Card.create({ userId, name: 'B', set: 'Alpha', createdAt: new Date('2026-06-06') });
    await Card.create({ userId, name: 'C', set: 'Beta', createdAt: new Date('2026-06-07') });

    const progress = await computeProgress({ metric: 'unique_sets', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(2);
  });

  it('set_completion computes owned/total percentage using the Scryfall set size cache', async () => {
    axios.get.mockResolvedValue({ data: { card_count: 200 } });
    await Card.create({ userId, name: 'A', setCode: 'mom' });
    await Card.create({ userId, name: 'B', setCode: 'mom' });

    const progress = await computeProgress({ metric: 'set_completion', params: { setCode: 'mom' } }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1); // round(2/200*100) = 1
    expect(axios.get).toHaveBeenCalledWith('https://api.scryfall.com/sets/mom');
  });

  it('getScryfallSetSize caches results across calls', async () => {
    axios.get.mockResolvedValue({ data: { card_count: 350 } });
    const first = await getScryfallSetSize('neo');
    const second = await getScryfallSetSize('neo');
    expect(first).toBe(350);
    expect(second).toBe(350);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('high_value_card returns the target value if any card meets the minimum, else 0', async () => {
    await Card.create({ userId, name: 'Cheap', price: 1 });
    let progress = await computeProgress({ metric: 'high_value_card', params: { minValue: 50 } }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(0);

    await Card.create({ userId, name: 'Expensive', price: 75 });
    progress = await computeProgress({ metric: 'high_value_card', params: { minValue: 50 } }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(50);
  });

  it('trades_completed counts accepted trades this month where user is either party', async () => {
    const otherUser = new mongoose.Types.ObjectId();
    const accepted = await TradeOffer.create({
      fromUserId: userId, toUserId: otherUser, fromUsername: 'me', toUsername: 'other', status: 'accepted',
      listingId: new mongoose.Types.ObjectId(), offeredCards: [{ cardName: 'X', quantity: 1 }],
    });
    const pending = await TradeOffer.create({
      fromUserId: otherUser, toUserId: userId, fromUsername: 'other', toUsername: 'me', status: 'pending',
      listingId: new mongoose.Types.ObjectId(), offeredCards: [{ cardName: 'Y', quantity: 1 }],
    });
    // TradeOffer's pre('save') hook stamps updatedAt on every .save()/create(), so
    // backdate via a query-level update (bypasses document middleware) instead.
    await TradeOffer.updateOne({ _id: accepted._id }, { $set: { updatedAt: new Date('2026-06-10') } });
    await TradeOffer.updateOne({ _id: pending._id }, { $set: { updatedAt: new Date('2026-06-11') } });

    const progress = await computeProgress({ metric: 'trades_completed', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('wishlist_acquired counts ActivityLog wishlist_acquire entries this month', async () => {
    await ActivityLog.create({ userId, action: 'wishlist_acquire', category: 'wishlist', createdAt: new Date('2026-06-15') });
    await ActivityLog.create({ userId, action: 'wishlist_acquire', category: 'wishlist', createdAt: outsideMonth });
    await ActivityLog.create({ userId, action: 'wishlist_add', category: 'wishlist', createdAt: new Date('2026-06-15') });

    const progress = await computeProgress({ metric: 'wishlist_acquired', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('forum_posts counts non-hidden posts by the user this month', async () => {
    const category = await ForumCategory.create({ name: 'General', slug: 'general' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: userId, content: 'x' });
    await ForumPost.create({ threadId: thread._id, authorId: userId, body: 'hi', createdAt: new Date('2026-06-15') });
    await ForumPost.create({ threadId: thread._id, authorId: userId, body: 'hidden', isHidden: true, createdAt: new Date('2026-06-15') });

    const progress = await computeProgress({ metric: 'forum_posts', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('forum_threads counts non-hidden threads created by the user this month', async () => {
    const category = await ForumCategory.create({ name: 'General', slug: 'general' });
    await ForumThread.create({ title: 'T1', categoryId: category._id, authorId: userId, content: 'x', createdAt: new Date('2026-06-15') });
    await ForumThread.create({ title: 'T2', categoryId: category._id, authorId: userId, content: 'x', createdAt: outsideMonth });

    const progress = await computeProgress({ metric: 'forum_threads', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('forum_upvotes sums the length of the upvotes array on the user\'s posts this month', async () => {
    const category = await ForumCategory.create({ name: 'General', slug: 'general' });
    const thread = await ForumThread.create({ title: 'T', categoryId: category._id, authorId: userId, content: 'x' });
    const voter1 = new mongoose.Types.ObjectId();
    const voter2 = new mongoose.Types.ObjectId();
    await ForumPost.create({ threadId: thread._id, authorId: userId, body: 'a', upvotes: [voter1, voter2], createdAt: new Date('2026-06-15') });
    await ForumPost.create({ threadId: thread._id, authorId: userId, body: 'b', upvotes: [voter1], createdAt: new Date('2026-06-16') });

    const progress = await computeProgress({ metric: 'forum_upvotes', params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(3);
  });

  it('custom metric reads stored ChallengeParticipation progress', async () => {
    const challengeId = new mongoose.Types.ObjectId();
    await ChallengeParticipation.create({ userId, challengeId, progress: 1, proofNote: 'done' });

    const progress = await computeProgress({ metric: 'custom', _id: challengeId, params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(1);
  });

  it('custom metric returns 0 when no participation exists yet', async () => {
    const challengeId = new mongoose.Types.ObjectId();
    const progress = await computeProgress({ metric: 'custom', _id: challengeId, params: {} }, userId, monthStart, monthEnd, Card);
    expect(progress).toBe(0);
  });
});

describe('validateMetricParams', () => {
  it('requires color for color_added', () => {
    expect(validateMetricParams('color_added', {})).toMatch(/color/);
    expect(validateMetricParams('color_added', { color: 'U' })).toBeNull();
  });

  it('requires setCode and targetPercent for set_completion', () => {
    expect(validateMetricParams('set_completion', { setCode: 'mom' })).toMatch(/targetPercent/);
    expect(validateMetricParams('set_completion', { setCode: 'mom', targetPercent: 50 })).toBeNull();
  });

  it('has no required params for metrics without params', () => {
    expect(validateMetricParams('cards_added', {})).toBeNull();
  });
});

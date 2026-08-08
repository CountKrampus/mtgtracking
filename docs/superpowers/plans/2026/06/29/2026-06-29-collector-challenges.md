# Collector Challenges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monthly community challenges covering collection, trading, and social activity. Admins create challenges; users propose challenges admins approve; progress auto-tracked for measurable metrics, manual proof for custom challenges.

**Architecture:** Two new Mongoose models (Challenge, ChallengeParticipation); challengeProgress utility with metric-specific computation; new challenges router; admin routes; ChallengesView frontend with sidebar entry.

**Tech Stack:** Node.js/Express/Mongoose, React, Tailwind CSS, Lucide icons (Trophy), useAuthContext authFetch.

---

## Task 1 — Challenge + ChallengeParticipation Models

### Step 1.1 — Write failing test for Challenge model
- [ ] Create `backend/tests/models/challenge.test.js`:
```js
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
  await mongoose.connection.db.dropDatabase();
});

const Challenge = require('../../models/Challenge');

describe('Challenge model', () => {
  test('creates with required fields', async () => {
    const c = await Challenge.create({
      title: 'Foil Hunter',
      description: 'Add 5 foil cards this month',
      metric: 'foils_added',
      target: 5,
      month: '2026-06'
    });
    expect(c._id).toBeDefined();
    expect(c.status).toBe('draft');
    expect(c.isProposal).toBe(false);
    expect(c.params).toEqual({});
  });

  test('rejects invalid metric', async () => {
    await expect(Challenge.create({
      title: 'Bad',
      description: 'Bad metric',
      metric: 'not_a_metric',
      target: 1,
      month: '2026-06'
    })).rejects.toThrow();
  });

  test('rejects title over 100 chars', async () => {
    await expect(Challenge.create({
      title: 'x'.repeat(101),
      description: 'desc',
      metric: 'cards_added',
      target: 1,
      month: '2026-06'
    })).rejects.toThrow();
  });

  test('rejects description over 500 chars', async () => {
    await expect(Challenge.create({
      title: 'Title',
      description: 'x'.repeat(501),
      metric: 'cards_added',
      target: 1,
      month: '2026-06'
    })).rejects.toThrow();
  });

  test('stores params for color_added', async () => {
    const c = await Challenge.create({
      title: 'Blue Collector',
      description: 'Add 10 blue cards',
      metric: 'color_added',
      params: { color: 'U' },
      target: 10,
      month: '2026-06'
    });
    expect(c.params.color).toBe('U');
  });

  test('stores all valid metric types', async () => {
    const metrics = [
      'foils_added','cards_added','value_added','color_added','rarity_added',
      'unique_sets','set_completion','high_value_card',
      'trades_completed','wishlist_acquired',
      'forum_posts','forum_threads','forum_upvotes','custom'
    ];
    for (const metric of metrics) {
      const c = await Challenge.create({
        title: `Test ${metric}`,
        description: 'desc',
        metric,
        target: 1,
        month: '2026-06'
      });
      expect(c.metric).toBe(metric);
      await Challenge.deleteOne({ _id: c._id });
    }
  });

  test('index exists on month+status', async () => {
    const indexes = await Challenge.collection.getIndexes();
    const keys = Object.values(indexes).map(i => Object.keys(i.key).join(','));
    expect(keys).toContain('month,status');
  });
});
```

- [ ] Run test — expect failure (model file does not exist):
```bash
cd backend && npx jest tests/models/challenge.test.js --no-coverage 2>&1 | tail -20
```
Expected output: `Cannot find module '../../models/Challenge'`

### Step 1.2 — Create `backend/models/Challenge.js`
- [ ] Create the file:
```js
const mongoose = require('mongoose');
const ChallengeSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 500 },
  metric: { type: String, enum: [
    'foils_added','cards_added','value_added','color_added','rarity_added',
    'unique_sets','set_completion','high_value_card',
    'trades_completed','wishlist_acquired',
    'forum_posts','forum_threads','forum_upvotes','custom'
  ], required: true },
  params:      { type: mongoose.Schema.Types.Mixed, default: {} },
  target:      { type: Number, required: true },
  month:       { type: String, required: true },
  status:      { type: String, enum: ['draft','active','closed'], default: 'draft' },
  isProposal:  { type: Boolean, default: false },
  proposedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt:   { type: Date, default: Date.now }
});
ChallengeSchema.index({ month: 1, status: 1 });
module.exports = mongoose.model('Challenge', ChallengeSchema);
```

- [ ] Run test — expect all pass:
```bash
cd backend && npx jest tests/models/challenge.test.js --no-coverage 2>&1 | tail -10
```
Expected output: `Tests: 6 passed, 6 total`

### Step 1.3 — Write failing test for ChallengeParticipation model
- [ ] Create `backend/tests/models/challengeParticipation.test.js`:
```js
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
  await mongoose.connection.db.dropDatabase();
});

const ChallengeParticipation = require('../../models/ChallengeParticipation');

describe('ChallengeParticipation model', () => {
  const userId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();

  test('creates with required fields and defaults', async () => {
    const p = await ChallengeParticipation.create({ userId, challengeId });
    expect(p._id).toBeDefined();
    expect(p.progress).toBe(0);
    expect(p.completed).toBe(false);
    expect(p.completedAt).toBeNull();
    expect(p.proofNote).toBe('');
    expect(p.verifiedBy).toBeNull();
  });

  test('enforces unique userId+challengeId', async () => {
    await ChallengeParticipation.create({ userId, challengeId });
    await expect(
      ChallengeParticipation.create({ userId, challengeId })
    ).rejects.toThrow();
  });

  test('rejects proofNote over 1000 chars', async () => {
    await expect(
      ChallengeParticipation.create({
        userId,
        challengeId: new mongoose.Types.ObjectId(),
        proofNote: 'x'.repeat(1001)
      })
    ).rejects.toThrow();
  });

  test('stores progress and completion state', async () => {
    const p = await ChallengeParticipation.create({
      userId,
      challengeId: new mongoose.Types.ObjectId(),
      progress: 5,
      completed: true,
      completedAt: new Date('2026-06-15'),
      proofNote: 'Submitted proof image'
    });
    expect(p.progress).toBe(5);
    expect(p.completed).toBe(true);
    expect(p.proofNote).toBe('Submitted proof image');
  });

  test('unique index exists on userId+challengeId', async () => {
    const indexes = await ChallengeParticipation.collection.getIndexes();
    const uniqueIndexes = Object.values(indexes).filter(i => i.unique);
    const keys = uniqueIndexes.map(i => Object.keys(i.key).join(','));
    expect(keys).toContain('userId,challengeId');
  });
});
```

- [ ] Run test — expect failure (model does not exist):
```bash
cd backend && npx jest tests/models/challengeParticipation.test.js --no-coverage 2>&1 | tail -10
```
Expected output: `Cannot find module '../../models/ChallengeParticipation'`

### Step 1.4 — Create `backend/models/ChallengeParticipation.js`
- [ ] Create the file:
```js
const mongoose = require('mongoose');
const ChallengeParticipationSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  progress:    { type: Number, default: 0 },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  proofNote:   { type: String, default: '', maxlength: 1000 },
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt:   { type: Date, default: Date.now }
});
ChallengeParticipationSchema.index({ userId: 1, challengeId: 1 }, { unique: true });
module.exports = mongoose.model('ChallengeParticipation', ChallengeParticipationSchema);
```

- [ ] Run test — expect all pass:
```bash
cd backend && npx jest tests/models/challengeParticipation.test.js --no-coverage 2>&1 | tail -10
```
Expected output: `Tests: 5 passed, 5 total`

### Step 1.5 — Commit
```bash
cd backend && git add models/Challenge.js models/ChallengeParticipation.js tests/models/challenge.test.js tests/models/challengeParticipation.test.js && git commit -m "feat: Challenge and ChallengeParticipation Mongoose models with indexes"
```

---

## Task 2 — challengeProgress Utility

### Step 2.1 — Write failing tests for challengeProgress
- [ ] Create `backend/tests/utils/challengeProgress.test.js`:
```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Register schemas needed by computeProgress
  require('../../models/ChallengeParticipation');
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

// Minimal Card schema for testing
let Card;
beforeAll(() => {
  if (mongoose.models.Card) {
    Card = mongoose.model('Card');
  } else {
    const CardSchema = new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      isFoil: { type: Boolean, default: false },
      colors: [String],
      rarity: String,
      set: String,
      setCode: String,
      price: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now }
    });
    Card = mongoose.model('Card', CardSchema);
  }
});

const { computeProgress } = require('../../utils/challengeProgress');

describe('computeProgress — foils_added', () => {
  test('counts foil cards added in month', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await Card.insertMany([
      { userId, isFoil: true,  createdAt: new Date('2026-06-10') },
      { userId, isFoil: true,  createdAt: new Date('2026-06-20') },
      { userId, isFoil: false, createdAt: new Date('2026-06-15') },
      { userId, isFoil: true,  createdAt: new Date('2026-05-01') }, // before month
    ]);

    const challenge = { metric: 'foils_added', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(2);
  });

  test('returns 0 when no foils added', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');
    const challenge = { metric: 'foils_added', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(0);
  });
});

describe('computeProgress — color_added', () => {
  test('counts cards of specified color added in month', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await Card.insertMany([
      { userId, colors: ['U'],     createdAt: new Date('2026-06-05') },
      { userId, colors: ['U','W'], createdAt: new Date('2026-06-10') },
      { userId, colors: ['R'],     createdAt: new Date('2026-06-15') },
      { userId, colors: ['U'],     createdAt: new Date('2026-05-20') }, // before month
    ]);

    const challenge = { metric: 'color_added', params: { color: 'U' }, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(2);
  });

  test('returns 0 for color not present', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');
    await Card.create({ userId, colors: ['R'], createdAt: new Date('2026-06-10') });
    const challenge = { metric: 'color_added', params: { color: 'B' }, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(0);
  });
});

describe('computeProgress — custom', () => {
  test('returns stored progress from ChallengeParticipation', async () => {
    const ChallengeParticipation = mongoose.model('ChallengeParticipation');
    const userId = new mongoose.Types.ObjectId();
    const challengeId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await ChallengeParticipation.create({
      userId,
      challengeId,
      progress: 1,
      proofNote: 'Proof submitted'
    });

    const challenge = { metric: 'custom', params: {}, _id: challengeId };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(1);
  });

  test('returns 0 when no participation record exists', async () => {
    const userId = new mongoose.Types.ObjectId();
    const challengeId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');
    const challenge = { metric: 'custom', params: {}, _id: challengeId };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(0);
  });
});

describe('computeProgress — cards_added', () => {
  test('counts all cards added in month regardless of type', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await Card.insertMany([
      { userId, createdAt: new Date('2026-06-01') },
      { userId, createdAt: new Date('2026-06-15') },
      { userId, createdAt: new Date('2026-06-30') },
      { userId, createdAt: new Date('2026-07-01') }, // boundary — excluded
    ]);

    const challenge = { metric: 'cards_added', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(3);
  });
});

describe('computeProgress — value_added', () => {
  test('sums price of cards added in month', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await Card.insertMany([
      { userId, price: 10.50, createdAt: new Date('2026-06-05') },
      { userId, price: 5.25, createdAt: new Date('2026-06-20') },
      { userId, price: 100, createdAt: new Date('2026-05-01') }, // excluded
    ]);

    const challenge = { metric: 'value_added', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBeCloseTo(15.75);
  });
});

describe('computeProgress — unique_sets', () => {
  test('counts distinct sets from cards added in month', async () => {
    const userId = new mongoose.Types.ObjectId();
    const monthStart = new Date('2026-06-01');
    const monthEnd = new Date('2026-07-01');

    await Card.insertMany([
      { userId, set: 'Dominaria', createdAt: new Date('2026-06-01') },
      { userId, set: 'Dominaria', createdAt: new Date('2026-06-10') }, // duplicate set
      { userId, set: 'Theros',    createdAt: new Date('2026-06-15') },
      { userId, set: 'Ixalan',    createdAt: new Date('2026-06-20') },
    ]);

    const challenge = { metric: 'unique_sets', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, monthStart, monthEnd);
    expect(result).toBe(3);
  });
});

describe('computeProgress — unknown metric', () => {
  test('returns 0 for unknown metric', async () => {
    const userId = new mongoose.Types.ObjectId();
    const challenge = { metric: 'unknown_metric', params: {}, _id: new mongoose.Types.ObjectId() };
    const result = await computeProgress(challenge, userId, new Date(), new Date());
    expect(result).toBe(0);
  });
});
```

- [ ] Run test — expect failure (utility does not exist):
```bash
cd backend && npx jest tests/utils/challengeProgress.test.js --no-coverage 2>&1 | tail -10
```
Expected output: `Cannot find module '../../utils/challengeProgress'`

### Step 2.2 — Create `backend/utils/challengeProgress.js`
- [ ] Create `backend/utils/` directory if it does not exist, then create the file:
```js
const mongoose = require('mongoose');

const scryfallSetCache = new Map(); // { setCode: { size, timestamp } }

async function getScryfallSetSize(setCode) {
  const cached = scryfallSetCache.get(setCode);
  if (cached && Date.now() - cached.timestamp < 24 * 3600 * 1000) return cached.size;
  const axios = require('axios');
  const { data } = await axios.get(`https://api.scryfall.com/sets/${setCode}`);
  const size = data.card_count || 0;
  scryfallSetCache.set(setCode, { size, timestamp: Date.now() });
  return size;
}

async function computeProgress(challenge, userId, monthStart, monthEnd) {
  const Card = mongoose.model('Card');
  const { metric, params } = challenge;
  switch (metric) {
    case 'foils_added':
      return Card.countDocuments({ userId, isFoil: true, createdAt: { $gte: monthStart, $lte: monthEnd } });
    case 'cards_added':
      return Card.countDocuments({ userId, createdAt: { $gte: monthStart, $lte: monthEnd } });
    case 'value_added': {
      const cards = await Card.find({ userId, createdAt: { $gte: monthStart, $lte: monthEnd } }, 'price');
      return cards.reduce((s, c) => s + (c.price || 0), 0);
    }
    case 'color_added':
      return Card.countDocuments({ userId, colors: params.color, createdAt: { $gte: monthStart, $lte: monthEnd } });
    case 'rarity_added':
      return Card.countDocuments({ userId, rarity: params.rarity, createdAt: { $gte: monthStart, $lte: monthEnd } });
    case 'unique_sets': {
      const sets = await Card.distinct('set', { userId, createdAt: { $gte: monthStart, $lte: monthEnd } });
      return sets.length;
    }
    case 'set_completion': {
      const owned = await Card.countDocuments({ userId, setCode: params.setCode });
      const total = await getScryfallSetSize(params.setCode);
      return total > 0 ? Math.round((owned / total) * 100) : 0;
    }
    case 'high_value_card': {
      const card = await Card.findOne({ userId, price: { $gte: params.minValue } });
      return card ? params.minValue : 0;
    }
    case 'trades_completed': {
      const TradeOffer = mongoose.model('TradeOffer');
      return TradeOffer.countDocuments({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        status: 'accepted',
        updatedAt: { $gte: monthStart, $lte: monthEnd }
      });
    }
    case 'wishlist_acquired': {
      const WishlistItem = mongoose.model('WishlistItem');
      return WishlistItem.countDocuments({ userId, acquiredAt: { $gte: monthStart, $lte: monthEnd } });
    }
    case 'forum_posts': {
      const ForumPost = mongoose.model('ForumPost');
      return ForumPost.countDocuments({ authorId: userId, createdAt: { $gte: monthStart, $lte: monthEnd }, isHidden: { $ne: true } });
    }
    case 'forum_threads': {
      const ForumThread = mongoose.model('ForumThread');
      return ForumThread.countDocuments({ authorId: userId, createdAt: { $gte: monthStart, $lte: monthEnd }, isHidden: { $ne: true } });
    }
    case 'forum_upvotes': {
      const ForumPost = mongoose.model('ForumPost');
      const posts = await ForumPost.find({ authorId: userId, createdAt: { $gte: monthStart, $lte: monthEnd } }, 'likes');
      return posts.reduce((s, p) => s + (p.likes || 0), 0);
    }
    case 'custom': {
      const ChallengeParticipation = mongoose.model('ChallengeParticipation');
      const p = await ChallengeParticipation.findOne({ userId, challengeId: challenge._id });
      return p?.progress || 0;
    }
    default:
      return 0;
  }
}

module.exports = { computeProgress };
```

- [ ] Run tests — expect all pass:
```bash
cd backend && npx jest tests/utils/challengeProgress.test.js --no-coverage 2>&1 | tail -15
```
Expected output: `Tests: 10 passed, 10 total`

### Step 2.3 — Commit
```bash
cd backend && git add utils/challengeProgress.js tests/utils/challengeProgress.test.js && git commit -m "feat: challengeProgress utility with metric computation for all 14 metrics"
```

---

## Task 3 — Challenges Router + Register in server.js

### Step 3.1 — Write failing tests for challenges router
- [ ] Create `backend/tests/routes/challenges.test.js`:
```js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-key';
  app = require('../../server');
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const Challenge = require('../../models/Challenge');
const jwt = require('jsonwebtoken');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId: userId.toString(), role }, process.env.JWT_SECRET);
}

describe('GET /api/challenges', () => {
  test('returns active challenges for current month without auth', async () => {
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    await Challenge.create([
      { title: 'Active', description: 'desc', metric: 'cards_added', target: 5, month, status: 'active' },
      { title: 'Draft',  description: 'desc', metric: 'foils_added', target: 3, month, status: 'draft' }
    ]);

    const res = await request(app).get('/api/challenges');
    expect(res.status).toBe(200);
    expect(res.body.challenges).toHaveLength(1);
    expect(res.body.challenges[0].title).toBe('Active');
    expect(res.body.month).toBe(month);
  });

  test('returns empty array when no active challenges', async () => {
    const res = await request(app).get('/api/challenges');
    expect(res.status).toBe(200);
    expect(res.body.challenges).toHaveLength(0);
  });

  test('returns progress fields when authenticated', async () => {
    const User = mongoose.model('User');
    const userId = new mongoose.Types.ObjectId();
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    await Challenge.create({ title: 'Test', description: 'desc', metric: 'cards_added', target: 5, month, status: 'active' });

    const token = makeToken(userId);
    const res = await request(app).get('/api/challenges').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.challenges[0]).toHaveProperty('progress');
    expect(res.body.challenges[0]).toHaveProperty('completed');
  });
});

describe('POST /api/challenges/propose', () => {
  test('requires authentication', async () => {
    const res = await request(app).post('/api/challenges/propose').send({
      title: 'My Challenge', description: 'desc', metric: 'cards_added', target: 5
    });
    expect(res.status).toBe(401);
  });

  test('creates proposal for authenticated user', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Foil Hunter', description: 'Collect 5 foils this month', metric: 'foils_added', target: 5 });

    expect(res.status).toBe(201);
    expect(res.body.isProposal).toBe(true);
    expect(res.body.status).toBe('draft');
    expect(res.body.title).toBe('Foil Hunter');
    expect(res.body.month).toBe(month);
  });

  test('rejects invalid metric', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);

    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad', description: 'desc', metric: 'not_valid', target: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid metric');
  });

  test('rejects color_added without params.color', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);

    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Color', description: 'desc', metric: 'color_added', target: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('color_added requires params.color');
  });

  test('accepts color_added with params.color', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);

    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Blue Cards', description: 'desc', metric: 'color_added', params: { color: 'U' }, target: 10 });

    expect(res.status).toBe(201);
    expect(res.body.params.color).toBe('U');
  });

  test('uses suggestedMonth when provided', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);

    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Future', description: 'desc', metric: 'cards_added', target: 5, suggestedMonth: '2026-07' });

    expect(res.status).toBe(201);
    expect(res.body.month).toBe('2026-07');
  });
});

describe('POST /api/challenges/:id/progress', () => {
  test('requires authentication', async () => {
    const challengeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/challenges/${challengeId}/progress`).send({ proofNote: 'proof' });
    expect(res.status).toBe(401);
  });

  test('rejects progress submission for non-custom metric', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const challenge = await Challenge.create({ title: 'Auto', description: 'desc', metric: 'cards_added', target: 5, month, status: 'active' });

    const res = await request(app)
      .post(`/api/challenges/${challenge._id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proofNote: 'proof' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only custom challenges accept manual progress');
  });

  test('submits proof for custom challenge', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const challenge = await Challenge.create({ title: 'Custom', description: 'desc', metric: 'custom', target: 1, month, status: 'active' });

    const res = await request(app)
      .post(`/api/challenges/${challenge._id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proofNote: 'I completed it!' });

    expect(res.status).toBe(200);
    expect(res.body.progress).toBe(1);
    expect(res.body.proofNote).toBe('I completed it!');
  });

  test('returns 404 for non-existent challenge', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/challenges/${fakeId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ proofNote: 'proof' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/challenges/:id/leaderboard', () => {
  test('returns leaderboard entries sorted by progress descending', async () => {
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const challenge = await Challenge.create({ title: 'Race', description: 'desc', metric: 'cards_added', target: 10, month, status: 'active' });

    const ChallengeParticipation = require('../../models/ChallengeParticipation');
    const users = [
      { _id: new mongoose.Types.ObjectId(), progress: 7 },
      { _id: new mongoose.Types.ObjectId(), progress: 10 },
      { _id: new mongoose.Types.ObjectId(), progress: 3 },
    ];
    await ChallengeParticipation.insertMany(users.map(u => ({
      userId: u._id, challengeId: challenge._id, progress: u.progress
    })));

    const res = await request(app).get(`/api/challenges/${challenge._id}/leaderboard`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].rank).toBe(1);
    expect(res.body[0].progress).toBe(10);
    expect(res.body[1].progress).toBe(7);
    expect(res.body[2].progress).toBe(3);
  });

  test('returns empty array when no participations', async () => {
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const challenge = await Challenge.create({ title: 'Empty', description: 'desc', metric: 'cards_added', target: 5, month, status: 'active' });

    const res = await request(app).get(`/api/challenges/${challenge._id}/leaderboard`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] Run test — expect failure (route not registered):
```bash
cd backend && npx jest tests/routes/challenges.test.js --no-coverage 2>&1 | tail -15
```
Expected output: `404` or route not found errors

### Step 3.2 — Create `backend/routes/challenges.js`
- [ ] Create the file:
```js
const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { computeProgress } = require('../utils/challengeProgress');
const { verifyToken, requireAuth } = require('../middleware/auth');

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

router.use(verifyToken);

// GET /api/challenges
router.get('/', async (req, res) => {
  try {
    const month = getCurrentMonth();
    const challenges = await Challenge.find({ month, status: 'active' });
    if (!req.user) return res.json({ challenges, month });
    const { start, end } = getMonthBounds(month);
    const withProgress = await Promise.all(challenges.map(async c => {
      const progress = await computeProgress(c, req.user._id, start, end);
      const completed = progress >= c.target;
      return { ...c.toObject(), progress, completed };
    }));
    res.json({ challenges: withProgress, month });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/challenges/propose
router.post('/propose', requireAuth, async (req, res) => {
  try {
    const { title, description, metric, params = {}, target, suggestedMonth } = req.body;
    const validMetrics = [
      'foils_added', 'cards_added', 'value_added', 'color_added', 'rarity_added',
      'unique_sets', 'set_completion', 'high_value_card',
      'trades_completed', 'wishlist_acquired',
      'forum_posts', 'forum_threads', 'forum_upvotes', 'custom'
    ];
    if (!validMetrics.includes(metric)) return res.status(400).json({ message: 'Invalid metric' });
    if (metric === 'color_added' && !params.color) return res.status(400).json({ message: 'color_added requires params.color' });
    if (metric === 'rarity_added' && !params.rarity) return res.status(400).json({ message: 'rarity_added requires params.rarity' });
    if (metric === 'set_completion' && (!params.setCode || !params.targetPercent)) return res.status(400).json({ message: 'set_completion requires params.setCode and params.targetPercent' });
    if (metric === 'high_value_card' && !params.minValue) return res.status(400).json({ message: 'high_value_card requires params.minValue' });

    const challenge = await Challenge.create({
      title, description, metric, params, target,
      month: suggestedMonth || getCurrentMonth(),
      isProposal: true,
      status: 'draft',
      proposedBy: req.user._id
    });
    res.status(201).json(challenge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/challenges/:id/progress (custom metric only)
router.post('/:id/progress', requireAuth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ message: 'Not found' });
    if (challenge.metric !== 'custom') return res.status(400).json({ message: 'Only custom challenges accept manual progress' });
    const { proofNote } = req.body;
    const participation = await ChallengeParticipation.findOneAndUpdate(
      { userId: req.user._id, challengeId: challenge._id },
      { progress: 1, proofNote: proofNote || '', updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(participation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/challenges/:id/leaderboard
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const entries = await ChallengeParticipation.find({ challengeId: req.params.id })
      .sort({ progress: -1 }).limit(20).populate('userId', 'username avatarUrl');
    res.json(entries.map((e, i) => ({
      rank: i + 1,
      username: e.userId?.username,
      avatarUrl: e.userId?.avatarUrl,
      progress: e.progress,
      completed: e.completed,
      completedAt: e.completedAt
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

### Step 3.3 — Register route in `backend/server.js`
- [ ] Find the block where routes are registered in `backend/server.js` (look for lines like `app.use('/api/cards', ...)`) and add after the last route registration:
```js
app.use('/api/challenges', require('./routes/challenges'));
```

- [ ] Run tests — expect all pass:
```bash
cd backend && npx jest tests/routes/challenges.test.js --no-coverage 2>&1 | tail -15
```
Expected output: `Tests: 12 passed, 12 total`

### Step 3.4 — Commit
```bash
cd backend && git add routes/challenges.js tests/routes/challenges.test.js server.js && git commit -m "feat: challenges router with GET /, propose, progress, leaderboard endpoints"
```

---

## Task 4 — Admin Challenge Routes

### Step 4.1 — Write failing tests for admin challenge routes
- [ ] Create `backend/tests/routes/adminChallenges.test.js`:
```js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-key';
  app = require('../../server');
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const Challenge = require('../../models/Challenge');
const ChallengeParticipation = require('../../models/ChallengeParticipation');
const jwt = require('jsonwebtoken');

function makeToken(userId, role = 'user') {
  return jwt.sign({ userId: userId.toString(), role }, process.env.JWT_SECRET);
}

describe('POST /api/admin/challenges', () => {
  test('requires admin role', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId, 'user');
    const res = await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test', description: 'desc', metric: 'cards_added', target: 5, month: '2026-06' });
    expect(res.status).toBe(403);
  });

  test('admin creates challenge with active status', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const res = await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Admin Challenge', description: 'Monthly foil hunt', metric: 'foils_added', target: 10, month: '2026-06' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.title).toBe('Admin Challenge');
  });

  test('admin creates challenge with params for color metric', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const res = await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Blue Invasion', description: 'desc', metric: 'color_added', params: { color: 'U' }, target: 15, month: '2026-06' });
    expect(res.status).toBe(201);
    expect(res.body.params.color).toBe('U');
  });
});

describe('GET /api/admin/challenges/proposals', () => {
  test('requires moderator role or higher', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId, 'user');
    const res = await request(app)
      .get('/api/admin/challenges/proposals')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('moderator can view proposals', async () => {
    const modId = new mongoose.Types.ObjectId();
    const token = makeToken(modId, 'moderator');
    const proposerId = new mongoose.Types.ObjectId();
    await Challenge.create({
      title: 'Community Idea', description: 'desc', metric: 'cards_added', target: 5, month: '2026-06',
      isProposal: true, status: 'draft', proposedBy: proposerId
    });

    const res = await request(app)
      .get('/api/admin/challenges/proposals')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isProposal).toBe(true);
  });

  test('returns empty array when no proposals', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const res = await request(app)
      .get('/api/admin/challenges/proposals')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PUT /api/admin/challenges/proposals/:id/approve', () => {
  test('requires admin role', async () => {
    const modId = new mongoose.Types.ObjectId();
    const token = makeToken(modId, 'moderator');
    const proposalId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/admin/challenges/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin approves proposal — sets status active, isProposal false', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const challenge = await Challenge.create({
      title: 'Proposed', description: 'desc', metric: 'foils_added', target: 3, month: '2026-06',
      isProposal: true, status: 'draft'
    });

    const res = await request(app)
      .put(`/api/admin/challenges/proposals/${challenge._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.isProposal).toBe(false);
  });

  test('returns 404 for non-existent proposal', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put(`/api/admin/challenges/proposals/${fakeId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/challenges/proposals/:id', () => {
  test('requires admin role', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId, 'user');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/admin/challenges/proposals/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin deletes proposal', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const token = makeToken(adminId, 'admin');
    const challenge = await Challenge.create({
      title: 'To Delete', description: 'desc', metric: 'cards_added', target: 1, month: '2026-06',
      isProposal: true, status: 'draft'
    });

    const res = await request(app)
      .delete(`/api/admin/challenges/proposals/${challenge._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const deleted = await Challenge.findById(challenge._id);
    expect(deleted).toBeNull();
  });
});

describe('PUT /api/admin/challenges/:id/verify-manual', () => {
  test('requires moderator role or higher', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId, 'user');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/admin/challenges/${fakeId}/verify-manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(403);
  });

  test('moderator verifies manual challenge completion', async () => {
    const modId = new mongoose.Types.ObjectId();
    const token = makeToken(modId, 'moderator');
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const challenge = await Challenge.create({ title: 'Custom', description: 'desc', metric: 'custom', target: 1, month, status: 'active' });
    const participantId = new mongoose.Types.ObjectId();
    await ChallengeParticipation.create({ userId: participantId, challengeId: challenge._id, progress: 1, proofNote: 'evidence' });

    const res = await request(app)
      .put(`/api/admin/challenges/${challenge._id}/verify-manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: participantId.toString() });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.completedAt).toBeTruthy();
  });
});
```

- [ ] Run test — expect failures (routes not yet in admin.js):
```bash
cd backend && npx jest tests/routes/adminChallenges.test.js --no-coverage 2>&1 | tail -15
```
Expected output: failing tests with 404 or 403 on admin challenge routes

### Step 4.2 — Add admin challenge routes to `backend/routes/admin.js`
- [ ] Open `backend/routes/admin.js` and add at the top (after existing requires):
```js
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
```

- [ ] Add these routes before `module.exports = router;`:
```js
// POST /api/admin/challenges
router.post('/challenges', requireAdmin, async (req, res) => {
  try {
    const { title, description, metric, params = {}, target, month } = req.body;
    const challenge = await Challenge.create({
      title, description, metric, params, target, month,
      status: 'active',
      createdBy: req.user._id
    });
    res.status(201).json(challenge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/challenges/proposals
router.get('/challenges/proposals', requireModerator, async (req, res) => {
  try {
    const proposals = await Challenge.find({ isProposal: true }).populate('proposedBy', 'username');
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/challenges/proposals/:id/approve
router.put('/challenges/proposals/:id/approve', requireAdmin, async (req, res) => {
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { status: 'active', isProposal: false, approvedBy: req.user._id },
      { new: true }
    );
    if (!challenge) return res.status(404).json({ message: 'Not found' });
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/challenges/proposals/:id
router.delete('/challenges/proposals/:id', requireAdmin, async (req, res) => {
  try {
    await Challenge.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/challenges/:id/verify-manual
router.put('/challenges/:id/verify-manual', requireModerator, async (req, res) => {
  try {
    const { userId } = req.body;
    const participation = await ChallengeParticipation.findOneAndUpdate(
      { challengeId: req.params.id, userId },
      { verifiedBy: req.user._id, completed: true, completedAt: new Date() },
      { new: true }
    );
    res.json(participation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] Run tests — expect all pass:
```bash
cd backend && npx jest tests/routes/adminChallenges.test.js --no-coverage 2>&1 | tail -15
```
Expected output: `Tests: 11 passed, 11 total`

### Step 4.3 — Commit
```bash
cd backend && git add routes/admin.js tests/routes/adminChallenges.test.js && git commit -m "feat: admin challenge routes — create, proposals, approve/reject, verify-manual"
```

---

## Task 5 — ChallengesView + Sub-components

### Step 5.1 — Write frontend component test
- [ ] Create `frontend/src/components/__tests__/ChallengesView.test.js`:
```js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock authContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    authFetch: jest.fn(),
    user: { _id: 'user1', username: 'tester' }
  })
}));

// Mock config
jest.mock('../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

const mockChallenges = [
  {
    _id: 'c1',
    title: 'Foil Hunter',
    description: 'Add 5 foils this month',
    metric: 'foils_added',
    target: 5,
    progress: 2,
    completed: false,
    month: '2026-06',
    status: 'active'
  },
  {
    _id: 'c2',
    title: 'Set Explorer',
    description: 'Add cards from 3 unique sets',
    metric: 'unique_sets',
    target: 3,
    progress: 3,
    completed: true,
    month: '2026-06',
    status: 'active'
  }
];

// Mock fetch
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ challenges: mockChallenges, month: '2026-06' })
  });
});
afterEach(() => jest.clearAllMocks());

import ChallengesView from '../ChallengesView';

describe('ChallengesView', () => {
  test('renders loading state then challenges', async () => {
    render(<ChallengesView />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Foil Hunter')).toBeInTheDocument();
      expect(screen.getByText('Set Explorer')).toBeInTheDocument();
    });
  });

  test('renders month in header', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      expect(screen.getByText(/monthly challenges/i)).toBeInTheDocument();
      expect(screen.getByText(/2026-06/)).toBeInTheDocument();
    });
  });

  test('shows completed badge on completed challenge', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      expect(screen.getByText(/completed/i)).toBeInTheDocument();
    });
  });

  test('shows progress bar for each challenge', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);
    });
  });

  test('shows propose challenge button', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      expect(screen.getByText(/propose a challenge/i)).toBeInTheDocument();
    });
  });

  test('opens ProposeModal when propose button clicked', async () => {
    render(<ChallengesView />);
    await waitFor(() => screen.getByText(/propose a challenge/i));
    fireEvent.click(screen.getByText(/propose a challenge/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('shows metric badge on each challenge card', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      expect(screen.getByText('foils_added')).toBeInTheDocument();
      expect(screen.getByText('unique_sets')).toBeInTheDocument();
    });
  });

  test('shows leaderboard button on each challenge card', async () => {
    render(<ChallengesView />);
    await waitFor(() => {
      const leaderboardBtns = screen.getAllByText(/leaderboard/i);
      expect(leaderboardBtns.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('shows submit proof button on custom metric challenges', async () => {
    const customChallenge = [{
      _id: 'c3', title: 'Custom Task', description: 'Do something', metric: 'custom',
      target: 1, progress: 0, completed: false, month: '2026-06', status: 'active'
    }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ challenges: customChallenge, month: '2026-06' })
    });
    render(<ChallengesView />);
    await waitFor(() => {
      expect(screen.getByText(/submit proof/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] Run test — expect failure (component does not exist):
```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="ChallengesView" 2>&1 | tail -20
```
Expected output: `Cannot find module '../ChallengesView'`

### Step 5.2 — Create `frontend/src/components/ChallengesView.js`

All sub-components are defined at **module scope** (never inside ChallengesView's body):

- [ ] Create the file:
```js
import React, { useState, useEffect } from 'react';
import { Trophy, X, ChevronUp, ChevronDown, Send, BarChart2 } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { API_URL } from '../config';

// ─── ChallengeCard ───────────────────────────────────────────────────────────
function ChallengeCard({ challenge, onLeaderboard, onSubmitProof }) {
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  return (
    <div
      role="article"
      className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white text-base">{challenge.title}</h3>
          <p className="text-white/70 text-sm mt-1">{challenge.description}</p>
        </div>
        {challenge.completed && (
          <span className="shrink-0 bg-green-500/20 text-green-300 text-xs font-medium px-2 py-1 rounded-full border border-green-500/30">
            Completed
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded border border-purple-500/30">
          {challenge.metric}
        </span>
        <span className="text-white/50 text-xs">
          {challenge.progress} / {challenge.target}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-white/10 rounded-full h-2"
      >
        <div
          className={`h-2 rounded-full transition-all ${challenge.completed ? 'bg-green-400' : 'bg-purple-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onLeaderboard(challenge._id)}
          className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white/80 px-3 py-1 rounded-lg transition-colors"
        >
          <BarChart2 size={12} /> Leaderboard
        </button>
        {challenge.metric === 'custom' && !challenge.completed && (
          <button
            onClick={() => onSubmitProof(challenge)}
            className="flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/30 transition-colors"
          >
            <Send size={12} /> Submit Proof
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ProposeModal ─────────────────────────────────────────────────────────────
function ProposeModal({ onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [form, setForm] = useState({
    title: '', description: '', metric: 'cards_added', params: {}, target: 1, suggestedMonth: ''
  });
  const [paramField, setParamField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const metricsRequiringParam = {
    color_added: 'color (e.g. U, W, R, G, B)',
    rarity_added: 'rarity (C, U, R, M)',
    set_completion: 'setCode (e.g. DOM)',
    high_value_card: 'minValue (number)'
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const params = {};
      if (metricsRequiringParam[form.metric]) {
        const key = Object.keys(metricsRequiringParam[form.metric] ? { [form.metric.split('_')[0]]: true } : {})[0];
        if (form.metric === 'color_added') params.color = paramField;
        else if (form.metric === 'rarity_added') params.rarity = paramField;
        else if (form.metric === 'set_completion') { params.setCode = paramField; params.targetPercent = form.target; }
        else if (form.metric === 'high_value_card') params.minValue = parseFloat(paramField);
      }
      const res = await authFetch(`${API_URL}/challenges/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, params, target: Number(form.target) })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit proposal');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Propose a Challenge"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" /> Propose a Challenge
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-white/70 text-sm block mb-1">Title</label>
            <input
              required
              maxLength={100}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
              placeholder="Challenge title"
            />
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-1">Description</label>
            <textarea
              required
              maxLength={500}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400 resize-none h-20"
              placeholder="Describe the challenge..."
            />
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-1">Metric</label>
            <select
              value={form.metric}
              onChange={e => { setForm(f => ({ ...f, metric: e.target.value })); setParamField(''); }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
            >
              {['foils_added','cards_added','value_added','color_added','rarity_added','unique_sets','set_completion','high_value_card','trades_completed','wishlist_acquired','forum_posts','forum_threads','forum_upvotes','custom'].map(m => (
                <option key={m} value={m} className="bg-gray-900">{m}</option>
              ))}
            </select>
          </div>
          {metricsRequiringParam[form.metric] && (
            <div>
              <label className="text-white/70 text-sm block mb-1">
                Parameter: <span className="text-white/50">{metricsRequiringParam[form.metric]}</span>
              </label>
              <input
                required
                value={paramField}
                onChange={e => setParamField(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
          )}
          <div>
            <label className="text-white/70 text-sm block mb-1">Target</label>
            <input
              type="number"
              required
              min={1}
              value={form.target}
              onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-1">Suggested Month (optional, YYYY-MM)</label>
            <input
              value={form.suggestedMonth}
              onChange={e => setForm(f => ({ ...f, suggestedMonth: e.target.value }))}
              pattern="\d{4}-\d{2}"
              placeholder="e.g. 2026-07"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="px-4 py-1 text-white/70 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ProofModal ───────────────────────────────────────────────────────────────
function ProofModal({ challenge, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/challenges/${challenge._id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofNote })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit proof');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Submit Proof"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-gray-900 border border-white/20 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Send size={16} className="text-amber-400" /> Submit Proof
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-white/70 text-sm mb-4">Challenge: <span className="text-white font-medium">{challenge.title}</span></p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-white/70 text-sm block mb-1">Proof / Notes</label>
            <textarea
              required
              maxLength={1000}
              value={proofNote}
              onChange={e => setProofNote(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400 resize-none h-28"
              placeholder="Describe how you completed the challenge, add links, etc."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1 text-white/70 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── LeaderboardDrawer ────────────────────────────────────────────────────────
function LeaderboardDrawer({ challengeId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/challenges/${challengeId}/leaderboard`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [challengeId]);

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900/95 border-l border-white/20 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <BarChart2 size={16} className="text-purple-400" /> Leaderboard
        </h3>
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-white/50 text-sm text-center mt-8">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-white/50 text-sm text-center mt-8">No participants yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map(entry => (
              <li key={entry.username || entry.rank} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                <span className={`text-sm font-bold w-6 text-center ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : 'text-white/40'}`}>
                  {entry.rank}
                </span>
                <span className="flex-1 text-white text-sm truncate">{entry.username || 'Anonymous'}</span>
                <span className={`text-sm font-mono ${entry.completed ? 'text-green-400' : 'text-white/70'}`}>
                  {entry.progress}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─── ChallengesView ───────────────────────────────────────────────────────────
export default function ChallengesView() {
  const [challenges, setChallenges] = useState([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [proofChallenge, setProofChallenge] = useState(null);
  const [leaderboardId, setLeaderboardId] = useState(null);

  async function loadChallenges() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/challenges`);
      const data = await res.json();
      setChallenges(data.challenges || []);
      setMonth(data.month || '');
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadChallenges(); }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy size={24} className="text-amber-400" />
              Monthly Challenges
              {month && <span className="text-white/50 font-normal text-lg ml-2">— {month}</span>}
            </h1>
            <p className="text-white/50 text-sm mt-1">Track your progress and compete with the community</p>
          </div>
          <button
            onClick={() => setProposing(true)}
            className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 px-4 py-1 rounded-lg text-sm font-medium transition-colors"
          >
            <Trophy size={14} /> Propose a Challenge
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-white/50">Loading challenges…</div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-16">
            <Trophy size={40} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/50">No active challenges this month.</p>
            <p className="text-white/30 text-sm mt-1">Check back soon or propose one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map(c => (
              <ChallengeCard
                key={c._id}
                challenge={c}
                onLeaderboard={id => setLeaderboardId(id)}
                onSubmitProof={challenge => setProofChallenge(challenge)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {proposing && (
        <ProposeModal
          onClose={() => setProposing(false)}
          onSuccess={loadChallenges}
        />
      )}
      {proofChallenge && (
        <ProofModal
          challenge={proofChallenge}
          onClose={() => setProofChallenge(null)}
          onSuccess={loadChallenges}
        />
      )}
      {leaderboardId && (
        <LeaderboardDrawer
          challengeId={leaderboardId}
          onClose={() => setLeaderboardId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] Run tests — expect all pass:
```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="ChallengesView" 2>&1 | tail -20
```
Expected output: `Tests: 9 passed, 9 total`

### Step 5.3 — Commit
```bash
cd frontend && git add src/components/ChallengesView.js src/components/__tests__/ChallengesView.test.js && git commit -m "feat: ChallengesView with ChallengeCard, ProposeModal, ProofModal, LeaderboardDrawer"
```

---

## Task 6 — ChallengesTab Admin Component + Wire into AdminPanel + Sidebar

### Step 6.1 — Write failing test for ChallengesTab
- [ ] Create `frontend/src/components/admin/community/__tests__/ChallengesTab.test.js`:
```js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    authFetch: jest.fn(),
    user: { _id: 'admin1', username: 'admin', role: 'admin' }
  })
}));
jest.mock('../../../config', () => ({ API_URL: 'http://localhost:5000/api' }));

const mockChallenges = [
  { _id: 'c1', title: 'Foil Hunt', description: 'desc', metric: 'foils_added', target: 5, month: '2026-06', status: 'active' }
];
const mockProposals = [
  { _id: 'p1', title: 'Community Idea', description: 'desc', metric: 'cards_added', target: 3, month: '2026-06', isProposal: true, status: 'draft', proposedBy: { username: 'user1' } }
];

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url.includes('/proposals')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProposals) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockChallenges) });
  });
});
afterEach(() => jest.clearAllMocks());

import ChallengesTab from '../ChallengesTab';

describe('ChallengesTab', () => {
  test('renders Active Challenges and Proposals sub-tabs', async () => {
    render(<ChallengesTab />);
    await waitFor(() => {
      expect(screen.getByText('Active Challenges')).toBeInTheDocument();
      expect(screen.getByText('Proposals')).toBeInTheDocument();
    });
  });

  test('shows active challenges list', async () => {
    render(<ChallengesTab />);
    await waitFor(() => {
      expect(screen.getByText('Foil Hunt')).toBeInTheDocument();
    });
  });

  test('switches to proposals tab and shows proposals', async () => {
    render(<ChallengesTab />);
    await waitFor(() => screen.getByText('Proposals'));
    fireEvent.click(screen.getByText('Proposals'));
    await waitFor(() => {
      expect(screen.getByText('Community Idea')).toBeInTheDocument();
      expect(screen.getByText(/proposed by/i)).toBeInTheDocument();
    });
  });

  test('shows Approve and Reject buttons on proposals', async () => {
    render(<ChallengesTab />);
    await waitFor(() => screen.getByText('Proposals'));
    fireEvent.click(screen.getByText('Proposals'));
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  test('shows Create Challenge form', async () => {
    render(<ChallengesTab />);
    await waitFor(() => {
      expect(screen.getByText(/create challenge/i)).toBeInTheDocument();
    });
  });

  test('shows close button on active challenges', async () => {
    render(<ChallengesTab />);
    await waitFor(() => {
      expect(screen.getByText('Foil Hunt')).toBeInTheDocument();
    });
    // Close button should be present in active challenges list
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
```

- [ ] Run test — expect failure (component does not exist):
```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="ChallengesTab" 2>&1 | tail -15
```
Expected output: `Cannot find module '../ChallengesTab'`

### Step 6.2 — Create `frontend/src/components/admin/community/ChallengesTab.js`
- [ ] Ensure the directory `frontend/src/components/admin/community/` exists (it may already exist from prior features — if not, create it)
- [ ] Create the file:
```js
import React, { useState, useEffect } from 'react';
import { Trophy, X, Check, Plus, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

const METRICS = [
  'foils_added','cards_added','value_added','color_added','rarity_added',
  'unique_sets','set_completion','high_value_card','trades_completed',
  'wishlist_acquired','forum_posts','forum_threads','forum_upvotes','custom'
];

export default function ChallengesTab() {
  const { authFetch } = useAuthContext();
  const [subTab, setSubTab] = useState('active');
  const [challenges, setChallenges] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', metric: 'cards_added', params: {}, target: 1, month: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  async function loadChallenges() {
    setLoading(true);
    try {
      const month = getCurrentMonth();
      const res = await fetch(`${API_URL}/challenges?month=${month}`);
      const data = await res.json();
      setChallenges(data.challenges || []);
    } catch { setChallenges([]); }
    finally { setLoading(false); }
  }

  async function loadProposals() {
    try {
      const res = await authFetch(`${API_URL}/admin/challenges/proposals`);
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch { setProposals([]); }
  }

  useEffect(() => {
    loadChallenges();
    loadProposals();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const res = await authFetch(`${API_URL}/admin/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, target: Number(form.target), month: form.month || getCurrentMonth() })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to create');
      }
      setForm({ title: '', description: '', metric: 'cards_added', params: {}, target: 1, month: '' });
      await loadChallenges();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove(id) {
    await authFetch(`${API_URL}/admin/challenges/proposals/${id}/approve`, { method: 'PUT' });
    await loadProposals();
    await loadChallenges();
  }

  async function handleReject(id) {
    await authFetch(`${API_URL}/admin/challenges/proposals/${id}`, { method: 'DELETE' });
    await loadProposals();
  }

  async function handleClose(id) {
    await authFetch(`${API_URL}/admin/challenges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' })
    });
    await loadChallenges();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 border-b border-white/10 pb-1">
        {['active', 'proposals'].map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1 rounded-t-lg text-sm font-medium transition-colors ${subTab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
          >
            {t === 'active' ? 'Active Challenges' : 'Proposals'}
          </button>
        ))}
      </div>

      {/* Active Challenges */}
      {subTab === 'active' && (
        <div className="flex flex-col gap-4">
          {/* Create form */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Plus size={14} /> Create Challenge
            </h3>
            {createError && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-lg p-2 mb-3">{createError}</div>
            )}
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required maxLength={100} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
              />
              <input
                required maxLength={500} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
              />
              <select
                value={form.metric}
                onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
              >
                {METRICS.map(m => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
              </select>
              <input
                type="number" required min={1} value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder="Target"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
              />
              <input
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                placeholder="Month (YYYY-MM, blank = current)"
                pattern="\d{4}-\d{2}"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit" disabled={creating}
                className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-1 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </form>
          </div>

          {/* Active list */}
          {loading ? (
            <p className="text-white/50 text-sm text-center py-6">Loading…</p>
          ) : challenges.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-6">No active challenges this month.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {challenges.map(c => (
                <li key={c._id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                  <div>
                    <span className="text-white text-sm font-medium">{c.title}</span>
                    <span className="ml-3 text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">{c.metric}</span>
                    <span className="ml-2 text-xs text-white/40">target: {c.target} • {c.month}</span>
                  </div>
                  <button
                    aria-label="Close challenge"
                    onClick={() => handleClose(c._id)}
                    className="text-white/40 hover:text-red-400 transition-colors ml-4 flex items-center gap-1 text-xs"
                  >
                    <X size={14} /> Close
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Proposals */}
      {subTab === 'proposals' && (
        <div className="flex flex-col gap-2">
          {proposals.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-6">No pending proposals.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proposals.map(p => (
                <li key={p._id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{p.title}</p>
                      <p className="text-white/60 text-xs mt-0.5">{p.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">{p.metric}</span>
                        <span className="text-xs text-white/40">target: {p.target}</span>
                        {p.proposedBy && (
                          <span className="text-xs text-white/40">Proposed by: <span className="text-white/60">{p.proposedBy.username}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(p._id)}
                        className="flex items-center gap-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-xs px-3 py-1 rounded-lg transition-colors"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(p._id)}
                        className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs px-3 py-1 rounded-lg transition-colors"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] Run tests — expect all pass:
```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="ChallengesTab" 2>&1 | tail -15
```
Expected output: `Tests: 6 passed, 6 total`

### Step 6.3 — Wire ChallengesTab into AdminPanel
- [ ] Open `frontend/src/components/admin/AdminPanel.js`
- [ ] Add the import near the other community tab imports:
```js
import ChallengesTab from './community/ChallengesTab';
```
- [ ] Find the Community section tab array (look for an array containing `'Forum'`, `'Users'`, or similar community tab entries) and add `'Challenges'` to the tab list
- [ ] Find the conditional render block for community sub-tabs and add:
```js
{activeCommunityTab === 'Challenges' && <ChallengesTab />}
```

### Step 6.4 — Wire Challenges nav item into sidebar
- [ ] Identify the sidebar nav component file (look for `frontend/src/components/Sidebar.js` or similar navigation component that lists Trophy, crown, or other nav icons)
- [ ] Add the Trophy import if not already present:
```js
import { Trophy } from 'lucide-react';
```
- [ ] Add Challenges nav entry in the appropriate nav group (Community or standalone), following the existing nav item pattern:
```js
{
  label: 'Challenges',
  icon: <Trophy size={18} className="text-amber-400" />,
  onClick: () => navigate('/challenges'), // adjust to match routing pattern in this app
  active: location.pathname === '/challenges'
}
```
  Note: If the app uses view-state switching rather than React Router, follow the app's existing pattern (e.g., `setView('challenges')`) instead.

### Step 6.5 — Final verification run
- [ ] Run all backend tests to confirm no regressions:
```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```
Expected output: All test suites pass, no failures

- [ ] Run all frontend tests to confirm no regressions:
```bash
cd frontend && npx react-scripts test --watchAll=false 2>&1 | tail -20
```
Expected output: All test suites pass, no failures

### Step 6.6 — Commit
```bash
git add frontend/src/components/admin/community/ChallengesTab.js frontend/src/components/admin/community/__tests__/ChallengesTab.test.js frontend/src/components/admin/AdminPanel.js && git commit -m "feat: ChallengesTab admin component, wired into AdminPanel Community section and sidebar nav"
```

---

## Summary of Files Created/Modified

| File | Action |
|------|--------|
| `backend/models/Challenge.js` | New — Challenge Mongoose model |
| `backend/models/ChallengeParticipation.js` | New — ChallengeParticipation Mongoose model |
| `backend/utils/challengeProgress.js` | New — metric computation utility |
| `backend/routes/challenges.js` | New — public/user challenge routes |
| `backend/routes/admin.js` | Modified — admin challenge management routes added |
| `backend/server.js` | Modified — register challenges router |
| `frontend/src/components/ChallengesView.js` | New — main user-facing challenges view |
| `frontend/src/components/admin/community/ChallengesTab.js` | New — admin challenges management tab |
| `frontend/src/components/admin/AdminPanel.js` | Modified — Challenges tab added to Community section |
| Sidebar nav component | Modified — Challenges nav item added |
| `backend/tests/models/challenge.test.js` | New — Challenge model tests |
| `backend/tests/models/challengeParticipation.test.js` | New — ChallengeParticipation model tests |
| `backend/tests/utils/challengeProgress.test.js` | New — challengeProgress utility tests |
| `backend/tests/routes/challenges.test.js` | New — challenges router integration tests |
| `backend/tests/routes/adminChallenges.test.js` | New — admin challenge routes integration tests |
| `frontend/src/components/__tests__/ChallengesView.test.js` | New — ChallengesView component tests |
| `frontend/src/components/admin/community/__tests__/ChallengesTab.test.js` | New — ChallengesTab component tests |

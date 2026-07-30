process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Card is registered dynamically by server.js; register a minimal version here
// so routes/challenges.js's mongoose.model('Card') lookup succeeds in tests.
const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  isFoil: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

const User = require('../models/User');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');

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
  await User.deleteMany({});
  await Challenge.deleteMany({});
  await ChallengeParticipation.deleteMany({});
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/challenges', require('../routes/challenges'));
  return app;
}

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'editor' }, 'test-secret');
}

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`, username: `user_${suffix}`,
    passwordHash: 'x', role: 'editor', isActive: true, ...overrides,
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

describe('GET /api/challenges', () => {
  it('returns active challenges for the current month without progress when unauthenticated', async () => {
    await Challenge.create({ title: 'T', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(), status: 'active' });
    await Challenge.create({ title: 'Draft', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(), status: 'draft' });
    await Challenge.create({ title: 'OldMonth', description: 'D', metric: 'cards_added', target: 5, month: '2020-01', status: 'active' });

    const app = buildApp();
    const res = await request(app).get('/api/challenges').expect(200);

    expect(res.body.challenges.length).toBe(1);
    expect(res.body.challenges[0].title).toBe('T');
    expect(res.body.challenges[0].progress).toBeUndefined();
  });

  it('includes computed progress and records participation when authenticated', async () => {
    const user = await createUser();
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'cards_added', target: 2, month: currentMonth(), status: 'active' });
    await Card.create({ userId: user._id, name: 'A' });
    await Card.create({ userId: user._id, name: 'B' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/challenges')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.challenges[0].progress).toBe(2);
    expect(res.body.challenges[0].completed).toBe(true);

    const participation = await ChallengeParticipation.findOne({ userId: user._id, challengeId: challenge._id });
    expect(participation).not.toBeNull();
    expect(participation.progress).toBe(2);
    expect(participation.completedAt).not.toBeNull();
  });
});

describe('POST /api/challenges/propose', () => {
  it('creates a draft proposal for a valid metric', async () => {
    const user = await createUser();
    const app = buildApp();
    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ title: 'Add 10 foils', description: 'D', metric: 'foils_added', target: 10 })
      .expect(201);

    expect(res.body.status).toBe('draft');
    expect(res.body.isProposal).toBe(true);
    expect(res.body.proposedBy).toBe(user._id.toString());
  });

  it('rejects an invalid metric', async () => {
    const user = await createUser();
    const app = buildApp();
    await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ title: 'T', description: 'D', metric: 'not_a_real_metric', target: 10 })
      .expect(400);
  });

  it('rejects color_added missing params.color', async () => {
    const user = await createUser();
    const app = buildApp();
    const res = await request(app)
      .post('/api/challenges/propose')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ title: 'T', description: 'D', metric: 'color_added', target: 10, params: {} })
      .expect(400);

    expect(res.body.message).toMatch(/color/);
  });

  it('returns 401 without a token', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/challenges/propose')
      .send({ title: 'T', description: 'D', metric: 'cards_added', target: 10 })
      .expect(401);
  });
});

describe('POST /api/challenges/:id/progress', () => {
  it('upserts participation with proof note for a custom-metric challenge', async () => {
    const user = await createUser();
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'custom', target: 1, month: currentMonth(), status: 'active' });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/challenges/${challenge._id}/progress`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ proofNote: 'Here is my proof' })
      .expect(200);

    expect(res.body.proofNote).toBe('Here is my proof');
    expect(res.body.progress).toBe(1);
  });

  it('rejects progress submission on a non-custom metric challenge', async () => {
    const user = await createUser();
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(), status: 'active' });

    const app = buildApp();
    await request(app)
      .post(`/api/challenges/${challenge._id}/progress`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ proofNote: 'nope' })
      .expect(400);
  });
});

describe('GET /api/challenges/:id/leaderboard', () => {
  it('returns custom-metric participants ranked by progress, capped at 20', async () => {
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'custom', target: 1, month: currentMonth(), status: 'active' });
    const users = await Promise.all(Array.from({ length: 25 }, () => createUser()));
    for (let i = 0; i < users.length; i++) {
      await ChallengeParticipation.create({ userId: users[i]._id, challengeId: challenge._id, progress: i });
    }

    const app = buildApp();
    const res = await request(app).get(`/api/challenges/${challenge._id}/leaderboard`).expect(200);

    expect(res.body.length).toBe(20);
    expect(res.body[0].progress).toBe(24);
    expect(res.body[0].rank).toBe(1);
    expect(res.body[19].progress).toBe(5);
  });

  it('recomputes live progress for auto-metric participants', async () => {
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(), status: 'active' });
    const user = await createUser();
    // Stale stored progress — leaderboard should recompute from actual Card data, not trust this.
    await ChallengeParticipation.create({ userId: user._id, challengeId: challenge._id, progress: 0 });
    await Card.create({ userId: user._id, name: 'A' });
    await Card.create({ userId: user._id, name: 'B' });
    await Card.create({ userId: user._id, name: 'C' });

    const app = buildApp();
    const res = await request(app).get(`/api/challenges/${challenge._id}/leaderboard`).expect(200);

    expect(res.body[0].progress).toBe(3);
  });

  it('returns 404 for an unknown challenge id', async () => {
    const app = buildApp();
    await request(app).get(`/api/challenges/${new mongoose.Types.ObjectId()}/leaderboard`).expect(404);
  });
});

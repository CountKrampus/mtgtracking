process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

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
  await mongoose.connection.dropDatabase();
});

function makeToken(userId, role = 'editor') {
  return jwt.sign({ userId: userId.toString(), role }, 'test-secret');
}

// admin.js applies verifyToken/requireAuth internally — no need to mount them again here.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

async function createAdmin(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `admin_${suffix}@test.com`, username: `admin_${suffix}`,
    passwordHash: 'x', role: 'admin', isActive: true, ...overrides,
  });
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

describe('POST /api/admin/challenges', () => {
  it('creates an active challenge directly as admin', async () => {
    const admin = await createAdmin();
    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ title: 'Add 20 cards', description: 'D', metric: 'cards_added', target: 20, month: currentMonth() })
      .expect(201);

    expect(res.body.status).toBe('active');
    expect(res.body.isProposal).toBe(false);
    expect(res.body.createdBy).toBe(admin._id.toString());
  });

  it('rejects a non-admin', async () => {
    const editor = await createUser();
    const app = buildApp();
    await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${makeToken(editor._id, 'editor')}`)
      .send({ title: 'T', description: 'D', metric: 'cards_added', target: 20, month: currentMonth() })
      .expect(403);
  });

  it('rejects an invalid metric', async () => {
    const admin = await createAdmin();
    const app = buildApp();
    await request(app)
      .post('/api/admin/challenges')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ title: 'T', description: 'D', metric: 'bogus', target: 20, month: currentMonth() })
      .expect(400);
  });
});

describe('GET /api/admin/challenges/proposals', () => {
  it('lists pending proposals with the proposer populated', async () => {
    const admin = await createAdmin();
    const proposer = await createUser({ username: 'proposer1' });
    await Challenge.create({
      title: 'Proposed', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(),
      status: 'draft', isProposal: true, proposedBy: proposer._id
    });
    await Challenge.create({
      title: 'Already active', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(),
      status: 'active', isProposal: false
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/admin/challenges/proposals')
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Proposed');
    expect(res.body[0].proposedBy.username).toBe('proposer1');
  });
});

describe('PUT /api/admin/challenges/proposals/:id/approve', () => {
  it('activates a proposal and records approvedBy', async () => {
    const admin = await createAdmin();
    const proposer = await createUser();
    const proposal = await Challenge.create({
      title: 'Proposed', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(),
      status: 'draft', isProposal: true, proposedBy: proposer._id
    });

    const app = buildApp();
    const res = await request(app)
      .put(`/api/admin/challenges/proposals/${proposal._id}/approve`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .expect(200);

    expect(res.body.status).toBe('active');
    expect(res.body.isProposal).toBe(false);
    expect(res.body.approvedBy).toBe(admin._id.toString());
  });
});

describe('DELETE /api/admin/challenges/proposals/:id', () => {
  it('rejects (deletes) a proposal', async () => {
    const admin = await createAdmin();
    const proposal = await Challenge.create({
      title: 'Proposed', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(),
      status: 'draft', isProposal: true
    });

    const app = buildApp();
    await request(app)
      .delete(`/api/admin/challenges/proposals/${proposal._id}`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .expect(200);

    expect(await Challenge.findById(proposal._id)).toBeNull();
  });
});

describe('PUT /api/admin/challenges/:id/verify-manual', () => {
  it('marks a custom-metric participation completed and records the verifier', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'custom', target: 1, month: currentMonth(), status: 'active' });
    await ChallengeParticipation.create({ userId: user._id, challengeId: challenge._id, proofNote: 'proof', progress: 1 });

    const app = buildApp();
    const res = await request(app)
      .put(`/api/admin/challenges/${challenge._id}/verify-manual`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ userId: user._id.toString() })
      .expect(200);

    expect(res.body.completed).toBe(true);
    expect(res.body.verifiedBy).toBe(admin._id.toString());
  });

  it('rejects verification on a non-custom-metric challenge', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const challenge = await Challenge.create({ title: 'T', description: 'D', metric: 'cards_added', target: 5, month: currentMonth(), status: 'active' });

    const app = buildApp();
    await request(app)
      .put(`/api/admin/challenges/${challenge._id}/verify-manual`)
      .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
      .send({ userId: user._id.toString() })
      .expect(400);
  });
});

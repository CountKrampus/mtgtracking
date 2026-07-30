process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
const Webhook = require('../models/Webhook');

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', require('../routes/webhooks'));
  return app;
}

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'editor' }, 'test-secret');
}

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`,
    username: `user_${suffix}`,
    passwordHash: 'x',
    role: 'editor',
    isActive: true,
    ...overrides,
  });
}

describe('POST /api/webhooks', () => {
  it('creates a webhook with a valid public https URL', async () => {
    const user = await createUser();
    const app = buildApp();
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ url: 'https://example.com/hook' })
      .expect(201);

    expect(res.body.url).toBe('https://example.com/hook');
    expect(res.body.secret).toBeDefined();
    expect(res.body.events).toEqual(['price_alert']);
    expect(res.body.isActive).toBe(true);
  });

  it('rejects a non-http(s) protocol', async () => {
    const user = await createUser();
    const app = buildApp();
    await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ url: 'ftp://example.com/hook' })
      .expect(400);
  });

  it('rejects internal/private hostnames (SSRF guard)', async () => {
    const user = await createUser();
    const app = buildApp();
    for (const url of ['http://localhost:5000/hook', 'http://127.0.0.1/hook', 'http://192.168.1.5/hook', 'http://10.0.0.1/hook']) {
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${makeToken(user._id)}`)
        .send({ url })
        .expect(400);
    }
  });

  it('rejects missing url', async () => {
    const user = await createUser();
    const app = buildApp();
    await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({})
      .expect(400);
  });

  it('enforces a maximum of 10 webhooks per user', async () => {
    const user = await createUser();
    const app = buildApp();
    for (let i = 0; i < 10; i++) {
      await Webhook.create({ userId: user._id, url: `https://example.com/${i}`, secret: 'x' });
    }
    await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ url: 'https://example.com/one-too-many' })
      .expect(400);
  });

  it('returns 401 without a token', async () => {
    const app = buildApp();
    await request(app).post('/api/webhooks').send({ url: 'https://example.com/hook' }).expect(401);
  });
});

describe('GET /api/webhooks', () => {
  it('only returns the requesting user\'s webhooks', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    await Webhook.create({ userId: user1._id, url: 'https://example.com/mine', secret: 'x' });
    await Webhook.create({ userId: user2._id, url: 'https://example.com/theirs', secret: 'y' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${makeToken(user1._id)}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].url).toBe('https://example.com/mine');
  });
});

describe('PUT /api/webhooks/:id', () => {
  it('updates isActive and resets failureCount when reactivated', async () => {
    const user = await createUser();
    const webhook = await Webhook.create({
      userId: user._id, url: 'https://example.com/hook', secret: 'x', isActive: false, failureCount: 7
    });
    const app = buildApp();
    const res = await request(app)
      .put(`/api/webhooks/${webhook._id}`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .send({ isActive: true })
      .expect(200);

    expect(res.body.isActive).toBe(true);
    expect(res.body.failureCount).toBe(0);
  });

  it('returns 404 for another user\'s webhook', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const webhook = await Webhook.create({ userId: owner._id, url: 'https://example.com/hook', secret: 'x' });

    const app = buildApp();
    await request(app)
      .put(`/api/webhooks/${webhook._id}`)
      .set('Authorization', `Bearer ${makeToken(intruder._id)}`)
      .send({ isActive: false })
      .expect(404);
  });
});

describe('DELETE /api/webhooks/:id', () => {
  it('deletes own webhook', async () => {
    const user = await createUser();
    const webhook = await Webhook.create({ userId: user._id, url: 'https://example.com/hook', secret: 'x' });
    const app = buildApp();
    await request(app)
      .delete(`/api/webhooks/${webhook._id}`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(await Webhook.findById(webhook._id)).toBeNull();
  });
});

describe('POST /api/webhooks/:id/test', () => {
  it('delivers a test event only to the specified webhook and records success', async () => {
    const user = await createUser();
    const targetHook = await Webhook.create({ userId: user._id, url: 'https://example.com/target', secret: 'x' });
    const otherHook = await Webhook.create({ userId: user._id, url: 'https://example.com/other', secret: 'y' });
    axios.post.mockResolvedValue({ status: 200 });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/webhooks/${targetHook._id}/test`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.lastStatus).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('https://example.com/target', expect.anything(), expect.anything());

    const untouchedOther = await Webhook.findById(otherHook._id);
    expect(untouchedOther.lastTriggeredAt).toBeNull();
  });

  it('records a failed delivery without throwing', async () => {
    const user = await createUser();
    const webhook = await Webhook.create({ userId: user._id, url: 'https://example.com/hook', secret: 'x' });
    axios.post.mockRejectedValue({ response: { status: 500 } });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/webhooks/${webhook._id}/test`)
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.lastStatus).toBe(500);
    const updated = await Webhook.findById(webhook._id);
    expect(updated.failureCount).toBe(1);
  });
});

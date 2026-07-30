process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-bot-token';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');
const LinkCode = require('../models/LinkCode');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');

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
  await User.deleteMany({});
  await DiscordLink.deleteMany({});
  await LinkCode.deleteMany({});
  await Notification.deleteMany({});
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/discord', require('../routes/discord'));
  return app;
}

describe('POST /api/discord/link-code', () => {
  test('issues a code for the logged-in user', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/discord/link-code')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(201);

    expect(res.body.code).toMatch(/^[0-9A-F]{6}$/);
    const stored = await LinkCode.findOne({ userId: user._id });
    expect(stored.code).toBe(res.body.code);
  });

  test('401s without a session', async () => {
    const app = buildApp();
    await request(app).post('/api/discord/link-code').expect(401);
  });
});

describe('POST /api/discord/exchange', () => {
  test('links a valid, unexpired code and consumes it', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'user2', passwordHash: 'x', role: 'editor' });
    const linkCode = await LinkCode.generateForUser(user._id);

    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .set('Authorization', 'Bearer test-bot-token')
      .send({ code: linkCode.code, discordUserId: 'discord-999' })
      .expect(201);

    const link = await DiscordLink.findOne({ discordUserId: 'discord-999' });
    expect(link.userId.toString()).toBe(user._id.toString());
    expect(await LinkCode.findById(linkCode._id)).toBeNull();
  });

  test('rejects an expired code', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    const linkCode = await LinkCode.create({ code: 'STALE1', userId: user._id, expiresAt: new Date(Date.now() - 1000) });

    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .set('Authorization', 'Bearer test-bot-token')
      .send({ code: linkCode.code, discordUserId: 'discord-888' })
      .expect(400);
  });

  test('rejects a missing/invalid service token', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/discord/exchange')
      .send({ code: 'ABCDEF', discordUserId: 'discord-777' })
      .expect(401);
  });
});

describe('DELETE /api/discord/link', () => {
  test('unlinks via a normal web session', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'user4', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-111' });

    const app = buildApp();
    await request(app)
      .delete('/api/discord/link')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .expect(200);

    expect(await DiscordLink.findOne({ userId: user._id })).toBeNull();
  });

  test('unlinks via the bot (X-Discord-User-Id)', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'user5', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-222' });

    const app = buildApp();
    await request(app)
      .delete('/api/discord/link')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-222')
      .expect(200);

    expect(await DiscordLink.findOne({ discordUserId: 'discord-222' })).toBeNull();
  });
});

describe('GET /api/discord/notifications/pending', () => {
  test('returns price_alert notifications for linked users created after since', async () => {
    const user = await User.create({ email: 'f@test.com', username: 'user6', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-333' });

    await Notification.create({
      userId: user._id, type: 'price_alert', content: 'old alert',
      createdAt: new Date(Date.now() - 60000)
    });
    await Notification.create({ userId: user._id, type: 'price_alert', content: 'new alert' });

    const app = buildApp();
    const res = await request(app)
      .get(`/api/discord/notifications/pending?since=${new Date(Date.now() - 30000).toISOString()}`)
      .set('Authorization', 'Bearer test-bot-token')
      .expect(200);

    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].discordUserId).toBe('discord-333');
    expect(res.body.notifications[0].content).toBe('new alert');
  });

  test('rejects without the service token', async () => {
    const app = buildApp();
    await request(app).get('/api/discord/notifications/pending').expect(401);
  });
});

process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.DISCORD_BOT_SERVICE_TOKEN = 'test-bot-token';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const DiscordLink = require('../models/DiscordLink');
const { verifyToken, requireAuth } = require('../middleware/auth');

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
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.get('/whoami', requireAuth, (req, res) => res.json({ userId: req.user._id.toString() }));
  return app;
}

describe('verifyToken bot auth path', () => {
  test('resolves a linked Discord user to the real account', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    await DiscordLink.create({ userId: user._id, discordUserId: 'discord-123' });

    const app = buildApp();
    const res = await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-123')
      .expect(200);

    expect(res.body.userId).toBe(user._id.toString());
  });

  test('401s for an unlinked Discord user', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .set('X-Discord-User-Id', 'discord-unknown')
      .expect(401);
  });

  test('401s when the bearer token matches the service token but no X-Discord-User-Id header is sent', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer test-bot-token')
      .expect(401);
  });

  test('does not treat a random invalid token as a normal JWT failure differently from bot auth failure (still 401)', async () => {
    const app = buildApp();
    await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer not-the-service-token-and-not-a-jwt')
      .expect(401);
  });
});

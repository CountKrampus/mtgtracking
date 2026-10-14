process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Deck = require('../models/Deck');
const { refreshRoleCache } = require('../utils/permissions');

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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  const decksRouter = require('../routes/decks');
  // Card/GameSession models are registered in server.js; the routes exercised
  // here don't need them (POST / creates stats only, /import parses only).
  decksRouter.injectDependencies(null, null, null);
  app.use('/api/decks', decksRouter);
  return app;
}

describe('Deck write route permissions (deck:create instead of admin/editor role names)', () => {
  let app, admin, moderator, contentManager, viewer, editor, user;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@t.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    moderator = await User.create({ email: 'mod@t.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    contentManager = await User.create({ email: 'cm@t.com', username: 'cm1', passwordHash: 'x', role: 'content_manager' });
    viewer = await User.create({ email: 'viewer@t.com', username: 'viewer1', passwordHash: 'x', role: 'viewer' });
    editor = await User.create({ email: 'editor@t.com', username: 'editor1', passwordHash: 'x', role: 'editor' });
    user = await User.create({ email: 'user@t.com', username: 'user1', passwordHash: 'x', role: 'user' });
    app = buildApp();
  });

  const newDeck = { name: 'Permission Probe', format: 'commander', mainDeck: [] };

  test('admin can create a deck', async () => {
    await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send(newDeck)
      .expect(201);
  });

  test('editor (legacy role) can still create a deck', async () => {
    await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(editor)}`)
      .send(newDeck)
      .expect(201);
  });

  test('standard user role can create a deck (has deck:create)', async () => {
    await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send(newDeck)
      .expect(201);
  });

  // Regression: moderator/content_manager previously got 403 because the route
  // required the literal role names 'admin'/'editor', even though their roles
  // carry deck:create (this was the reported "can't import by Moxfield link").
  test('moderator can create a deck (base perms granted via grantMigrationPermissions)', async () => {
    await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send(newDeck)
      .expect(201);
  });

  test('content_manager can create a deck', async () => {
    await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .send(newDeck)
      .expect(201);
  });

  test('viewer (read-only role) cannot create a deck', async () => {
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .send(newDeck);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.requiredPermissions).toContain('deck:create');
  });

  test('anonymous request is rejected with 401', async () => {
    await request(app)
      .post('/api/decks')
      .send(newDeck)
      .expect(401);
  });

  test('moderator passes the /import permission gate (fails later on source, not on 403)', async () => {
    const res = await request(app)
      .post('/api/decks/import')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ source: 'not-a-real-source', data: 'whatever' });
    // Reaches the handler: the gate no longer blocks staff. The bogus source
    // then fails validation with 400, before any Scryfall/network call.
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid source type');
  });

  test('viewer cannot reach /import at all', async () => {
    const res = await request(app)
      .post('/api/decks/import')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .send({ source: 'not-a-real-source', data: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.requiredPermissions).toContain('deck:create');
  });

  test('text import without a commander still returns the documented 400 (no network)', async () => {
    const res = await request(app)
      .post('/api/decks/import')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ source: 'text', data: 'Deck:\n1 Sol Ring' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No commander found in deck list');
  });

  test('deck update (PUT) is permission-gated the same way', async () => {
    const deck = await Deck.create({ userId: moderator._id, name: 'Owned Deck' });

    await request(app)
      .put(`/api/decks/${deck._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ name: 'Renamed By Moderator' })
      .expect(200);

    await request(app)
      .put(`/api/decks/${deck._id}`)
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .send({ name: 'Renamed By Viewer' })
      .expect(403);
  });
});

process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Card = require('../models/Card');
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
  // cards.js applies verifyToken internally via router.use
  app.use('/api/cards', require('../routes/cards'));
  return app;
}

// Regression tests: the card write routes were gated by the literal role
// names 'admin'/'editor' (requireEditor) even though the permission catalog
// grants collection:manage to every non-read-only role. That 403'd the deck
// builder's "add card(s) to collection" for staff roles (reported for a
// moderator after importing a deck).
describe('Card write route permissions (collection:manage instead of admin/editor role names)', () => {
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

  const newCard = { name: 'Permission Probe', set: 'Test Set', quantity: 1, condition: 'NM', price: 0 };

  test('admin can create a card', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send(newCard)
      .expect(201);
  });

  test('editor (legacy role) can still create a card', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(editor)}`)
      .send(newCard)
      .expect(201);
  });

  test('standard user role can create a card (has collection:manage)', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send(newCard)
      .expect(201);
  });

  test('moderator can create a card (deck builder add-to-collection regression)', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send(newCard)
      .expect(201);
  });

  test('content_manager can create a card', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(contentManager)}`)
      .send(newCard)
      .expect(201);
  });

  test('viewer (read-only role) cannot create a card', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${makeToken(viewer)}`)
      .send(newCard);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.requiredPermissions).toContain('collection:manage');
  });

  test('moderator can update and delete their own card', async () => {
    const card = await Card.create({ userId: moderator._id, ...newCard });

    await request(app)
      .put(`/api/cards/${card._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ quantity: 3, condition: 'LP' })
      .expect(200);

    const updated = await Card.findById(card._id);
    expect(updated.quantity).toBe(3);

    await request(app)
      .delete(`/api/cards/${card._id}`)
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(200);

    expect(await Card.findById(card._id)).toBeNull();
  });

  test('moderator can bulk-import offline (deck-side mass add path)', async () => {
    const res = await request(app)
      .post('/api/cards/bulk-import-offline')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .send({ cardList: ['1 Bolt', '2 Counterspell'] });
    expect(res.status).toBe(200);
    expect(await Card.countDocuments({ userId: moderator._id })).toBe(2);
  });

  test('anonymous request is rejected with 401', async () => {
    await request(app)
      .post('/api/cards')
      .send(newCard)
      .expect(401);
  });
});

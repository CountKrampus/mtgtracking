process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Card = require('../models/Card');

let mongoServer;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/cards', require('../routes/cards'));
  return a;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

async function makeUser(n = 1) {
  return User.create({ email: `u${n}@test.com`, username: `user${n}`, passwordHash: 'x', role: 'editor' });
}

describe('GET /api/cards/duplicates', () => {
  test('groups exact duplicates by name+set+condition+isFoil+collectorNumber', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 2 });
    await Card.create({ userId: user._id, name: 'Lightning Bolt', set: 'Magic 2010', condition: 'NM', isFoil: false, quantity: 3 });
    await Card.create({ userId: user._id, name: 'Counterspell', set: 'Ice Age', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(1);
    expect(res.body.exactGroups[0].cards).toHaveLength(2);
    expect(res.body.exactGroups[0].cards[0].name).toBe('Lightning Bolt');
  });

  test('does NOT flag same name+set with different collector numbers (alt arts)', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '1', quantity: 1 });
    await Card.create({ userId: user._id, name: 'Brainstorm', set: 'Secret Lair', condition: 'NM', isFoil: false, collectorNumber: '2', quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(0);
  });

  test('suggests Unknown-set rows against real-set rows of same name+condition+foil', async () => {
    const user = await makeUser();
    const unknown = await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1, price: 0 });
    const real = await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Commander 2021', condition: 'NM', isFoil: false, quantity: 2, price: 1.5 });
    // Different condition — not a candidate
    await Card.create({ userId: user._id, name: 'Sol Ring', set: 'Commander Legends', condition: 'LP', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.suggestedGroups).toHaveLength(1);
    expect(res.body.suggestedGroups[0].unknownCard._id).toBe(unknown._id.toString());
    expect(res.body.suggestedGroups[0].candidates).toHaveLength(1);
    expect(res.body.suggestedGroups[0].candidates[0]._id).toBe(real._id.toString());
  });

  test('omits Unknown rows with no real-set candidates and scopes to the requesting user', async () => {
    const user1 = await makeUser(1);
    const user2 = await makeUser(2);
    await Card.create({ userId: user1._id, name: 'Ponder', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });
    // Real-set Ponder belongs to a DIFFERENT user — must not become a candidate
    await Card.create({ userId: user2._id, name: 'Ponder', set: 'Lorwyn', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user1)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(0);
    expect(res.body.suggestedGroups).toHaveLength(0);
  });

  test('a second Unknown row of the same card appears as an exact group, not a suggestion pair', async () => {
    const user = await makeUser();
    await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });
    await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });

    const res = await request(app)
      .get('/api/cards/duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    expect(res.body.exactGroups).toHaveLength(1);
    expect(res.body.suggestedGroups).toHaveLength(0);
  });

  test('rejects unauthenticated requests', async () => {
    await request(app).get('/api/cards/duplicates').expect(401);
  });
});

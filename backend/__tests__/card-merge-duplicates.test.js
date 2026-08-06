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

describe('POST /api/cards/merge-duplicates', () => {
  test('merges quantities, unions tags, backfills empty fields, deletes sources', async () => {
    const user = await makeUser();
    const target = await Card.create({
      userId: user._id, name: 'Sol Ring', set: 'Commander 2021', condition: 'NM', isFoil: false,
      quantity: 2, price: 1.5, tags: ['staple'], location: ''
    });
    const source = await Card.create({
      userId: user._id, name: 'Sol Ring', set: 'Unknown', condition: 'NM', isFoil: false,
      quantity: 3, price: 0, tags: ['staple', 'commander'], location: 'Binder A', oracleText: 'Add {C}{C}.'
    });

    const res = await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ targetId: target._id.toString(), sourceIds: [source._id.toString()] })
      .expect(200);

    expect(res.body.merged).toBe(true);
    expect(res.body.removedCount).toBe(1);
    expect(res.body.target.quantity).toBe(5);
    expect(res.body.target.tags.sort()).toEqual(['commander', 'staple']);
    expect(res.body.target.location).toBe('Binder A');   // backfilled (target was empty)
    expect(res.body.target.oracleText).toBe('Add {C}{C}.');
    expect(res.body.target.set).toBe('Commander 2021');  // target's set always wins
    expect(res.body.target.price).toBe(1.5);             // target's price always wins

    expect(await Card.findById(source._id)).toBeNull();
    expect((await Card.find({ userId: user._id })).length).toBe(1);
  });

  test("rejects merging another user's cards", async () => {
    const user1 = await makeUser(1);
    const user2 = await makeUser(2);
    const target = await Card.create({ userId: user1._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const foreign = await Card.create({ userId: user2._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, quantity: 1 });

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user1)}`)
      .send({ targetId: target._id.toString(), sourceIds: [foreign._id.toString()] })
      .expect(404);

    expect(await Card.findById(foreign._id)).not.toBeNull();
  });

  test('rejects sources with mismatched name/condition/foil', async () => {
    const user = await makeUser();
    const target = await Card.create({ userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const wrongCondition = await Card.create({ userId: user._id, name: 'Opt', set: 'Unknown', condition: 'LP', isFoil: false, quantity: 1 });

    const res = await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ targetId: target._id.toString(), sourceIds: [wrongCondition._id.toString()] })
      .expect(400);

    expect(res.body.message).toMatch(/match/i);
    expect(await Card.findById(wrongCondition._id)).not.toBeNull();
  });

  test('rejects target included in sourceIds and empty sourceIds', async () => {
    const user = await makeUser();
    const card = await Card.create({ userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1 });
    const token = tokenFor(user);

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: card._id.toString(), sourceIds: [card._id.toString()] })
      .expect(400);

    await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: card._id.toString(), sourceIds: [] })
      .expect(400);
  });

  test('returns a clean 400 (not 500) if backfilling a field would collide with another card under the unique index', async () => {
    await Card.syncIndexes();
    const user = await makeUser();
    const token = tokenFor(user);

    // Target has no collectorNumber yet; a source will backfill '5', but a
    // third, unrelated card already occupies that exact resulting key.
    const collision = await Card.create({
      userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, collectorNumber: '5', quantity: 1
    });
    const target = await Card.create({
      userId: user._id, name: 'Opt', set: 'Ixalan', condition: 'NM', isFoil: false, quantity: 1
    });
    const source = await Card.create({
      userId: user._id, name: 'Opt', set: 'Unknown', condition: 'NM', isFoil: false, collectorNumber: '5', quantity: 1
    });

    const res = await request(app)
      .post('/api/cards/merge-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: target._id.toString(), sourceIds: [source._id.toString()] })
      .expect(400);

    expect(res.body.message).toMatch(/duplicate/i);
    // Nothing was deleted - the failure happens on target.save(), before deleteMany.
    expect(await Card.findById(source._id)).not.toBeNull();
    expect(await Card.findById(collision._id)).not.toBeNull();
  });
});

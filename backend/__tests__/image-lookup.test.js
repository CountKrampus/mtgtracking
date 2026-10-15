process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const os = require('os');
const path = require('path');
const fs = require('fs');

// Point the image cache at a temp dir BEFORE ../routes/images loads it —
// imageCache resolves CACHE_DIR at module load time.
const TEST_CACHE = path.join(os.tmpdir(), `image-lookup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS = TEST_CACHE;

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
const Card = require('../models/Card');
const Deck = require('../models/Deck');

// server.js registers WishlistItem inline and is never loaded under jest, so
// register a stand-in here to exercise the wishlist source in the router.
if (!mongoose.models.WishlistItem) {
  mongoose.model('WishlistItem', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    scryfallId: { type: String, default: '' },
  }));
}
const WishlistItem = mongoose.model('WishlistItem');

const imagesRouter = require('../routes/images');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(TEST_CACHE, { recursive: true, force: true });
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
  jest.clearAllMocks();
});

function makeToken(userId, role = 'editor') {
  return jwt.sign({ userId: userId.toString(), role }, 'test-secret');
}

async function createUser(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2);
  return User.create({
    email: `user_${suffix}@test.com`, username: `user_${suffix}`,
    passwordHash: 'x', role: 'editor', isActive: true, ...overrides,
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/images', imagesRouter);
  return app;
}

// Write a fake image into the sharded cache layout:
// <TEST_CACHE>/<first 2 chars of id>/<id>.jpg
function cacheImage(scryfallId) {
  const dir = path.join(TEST_CACHE, scryfallId.slice(0, 2));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${scryfallId}.jpg`), Buffer.from([0xff, 0xd8, 0xff]));
}

const CACHED_ID = 'aa11bb22-cc33-dd44-ee55-ff6677889900';
const UNCACHED_ID = 'bb22cc33-dd44-ee55-ff66-778899001122';
const DECK_ID = 'cc33dd44-ee55-ff66-7788-990011223344';
const WISH_ID = 'dd44ee55-ff66-7788-9900-112233445566';

describe('GET /api/images/lookup', () => {
  it('resolves a name from the requester\'s own collection when the image is on disk', async () => {
    const user = await createUser();
    await Card.create({ userId: user._id, name: 'Sol Ring', scryfallId: CACHED_ID, condition: 'NM' });
    cacheImage(CACHED_ID);

    const res = await request(buildApp())
      .get('/api/images/lookup?name=Sol%20Ring')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.scryfallId).toBe(CACHED_ID);
    expect(res.body.imageUrl).toBe(`/api/images/${CACHED_ID}`);
    expect(res.body.source).toBe('collection');
    // Local-only guarantee: the endpoint never calls Scryfall
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('404s when the card is known but its image is not on disk (client falls back)', async () => {
    const user = await createUser();
    await Card.create({ userId: user._id, name: 'Path to Exile', scryfallId: UNCACHED_ID, condition: 'NM' });

    const res = await request(buildApp())
      .get('/api/images/lookup?name=Path%20to%20Exile')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(404);

    expect(res.body.message).toMatch(/not cached locally/i);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('falls back to the requester\'s decks when the card is not in the collection', async () => {
    const user = await createUser();
    await Deck.create({
      userId: user._id, name: 'Ramp Deck',
      mainDeck: [{ scryfallId: DECK_ID, name: 'Cultivate' }]
    });
    cacheImage(DECK_ID);

    const res = await request(buildApp())
      .get('/api/images/lookup?name=Cultivate')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.scryfallId).toBe(DECK_ID);
    expect(res.body.source).toBe('deck');
  });

  it('falls back to the requester\'s wishlist', async () => {
    const user = await createUser();
    await WishlistItem.create({ userId: user._id, name: 'Rhystic Study', scryfallId: WISH_ID });
    cacheImage(WISH_ID);

    const res = await request(buildApp())
      .get('/api/images/lookup?name=Rhystic%20Study')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(200);

    expect(res.body.scryfallId).toBe(WISH_ID);
    expect(res.body.source).toBe('wishlist');
  });

  it('404s for a name that is not locally known at all', async () => {
    const user = await createUser();

    const res = await request(buildApp())
      .get('/api/images/lookup?name=Completely%20Fake%20Card')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(404);

    expect(res.body.message).toMatch(/not found/i);
  });

  it('400s when the name param is missing', async () => {
    const user = await createUser();
    await request(buildApp())
      .get('/api/images/lookup')
      .set('Authorization', `Bearer ${makeToken(user._id)}`)
      .expect(400);
  });

  it('401s without a token', async () => {
    await request(buildApp())
      .get('/api/images/lookup?name=Sol%20Ring')
      .expect(401);
  });

  it('does not leak another user\'s card mapping', async () => {
    const owner = await createUser();
    const other = await createUser();
    await Card.create({ userId: owner._id, name: 'Sol Ring', scryfallId: CACHED_ID, condition: 'NM' });
    cacheImage(CACHED_ID);

    await request(buildApp())
      .get('/api/images/lookup?name=Sol%20Ring')
      .set('Authorization', `Bearer ${makeToken(other._id)}`)
      .expect(404);
  });
});

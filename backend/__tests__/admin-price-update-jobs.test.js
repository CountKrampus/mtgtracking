process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

jest.mock('../utils/pricing', () => ({
  getPriceWithFallback: jest.fn(async (name) => ({
    usd: name === 'Priced Card' ? 2.5 : 0,
    cad: 0,
    source: name === 'Priced Card' ? 'Scryfall' : 'None (not found)',
  })),
  fetchFaceToFacePrice: jest.fn(async () => ({ cad: 0, source: 'Face to Face' })),
  isPlausibleUsdPrice: jest.fn(() => true),
  isPlausibleCadPrice: jest.fn(() => true),
}));

jest.mock('../utils/scryfallLookup', () => ({
  fetchCardFromScryfall: jest.fn(),
}));

jest.mock('../utils/imageCache', () => ({
  cacheCardImage: jest.fn(async () => '/api/images/cached'),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Card = require('../models/Card');
const PriceUpdateJob = require('../models/PriceUpdateJob');
const Role = require('../models/Role');
const { verifyToken } = require('../middleware/auth');
const { refreshRoleCache } = require('../utils/permissions');
const { getPriceWithFallback, fetchFaceToFacePrice, isPlausibleUsdPrice } = require('../utils/pricing');
const { fetchCardFromScryfall } = require('../utils/scryfallLookup');

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

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

// Jobs run in the background after the POST responds — poll until terminal.
async function waitForJob(app, token, jobId, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const res = await request(app)
      .get(`/api/admin/force-price-update/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    last = res.body;
    if (res.body.status === 'complete' || res.body.status === 'failed') return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Job ${jobId} did not finish in ${timeoutMs}ms (last: ${JSON.stringify(last)})`);
}

describe('Admin force-price-update job tracking', () => {
  let app, admin, token;

  beforeEach(async () => {
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();
    admin = await User.create({ email: 'admin@test.com', username: 'admin', passwordHash: 'x', role: 'admin' });
    token = makeToken(admin);
    app = buildApp();
  });

  test('runs a job to completion, persists counters, and lists it as done', async () => {
    await Card.create([
      { userId: admin._id, name: 'Priced Card', condition: 'NM', price: 1 },
      { userId: admin._id, name: 'No Price Card', condition: 'NM', price: 0 },
    ]);

    const start = await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(start.body.jobId).toBeDefined();

    const job = await waitForJob(app, token, start.body.jobId);
    expect(job.status).toBe('complete');
    expect(job.total).toBe(2);
    expect(job.updated).toBe(1);
    expect(job.skipped).toBe(1);
    expect(job.failed).toBe(0);
    expect(job.completedAt).toBeTruthy();
    expect(getPriceWithFallback).toHaveBeenCalledTimes(2);

    // Durable copy in Mongo — this is what Recent Price Jobs reads
    const saved = await PriceUpdateJob.findOne({ jobId: job.jobId }).lean();
    expect(saved).toBeTruthy();
    expect(saved.status).toBe('complete');
    expect(saved.total).toBe(2);
    expect(saved.updated).toBe(1);
    expect(saved.completedAt).toBeTruthy();

    // List endpoint reports it as finished
    const list = await request(app)
      .get('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.jobs).toHaveLength(1);
    expect(list.body.jobs[0].jobId).toBe(job.jobId);
    expect(list.body.jobs[0].status).toBe('complete');
    expect(list.body.jobs[0].completedAt).toBeTruthy();
  });

  test('fullData runs refresh complete card metadata and record the option', async () => {
    // Stale card: wrong price and placeholder metadata — exactly what the
    // admin "Update full card data" toggle is for.
    const card = await Card.create({
      userId: admin._id, name: 'Swords to Plowshares', set: 'Unknown', setCode: '',
      collectorNumber: '', condition: 'NM', price: 1000, rarity: 'U',
    });

    fetchCardFromScryfall.mockResolvedValueOnce({
      cardData: {
        id: 'msc-143-id',
        set_name: 'Marvel Super Heroes Commander',
        set: 'msc',
        collector_number: '143',
        rarity: 'uncommon',
        colors: ['W'],
        type_line: 'Instant',
        mana_cost: '{W}',
        image_uris: { normal: 'https://example.com/img.jpg' },
        oracle_text: 'Exile target creature. Its controller gains life equal to its power.',
        reserved: false,
        prices: { usd: '1.50', usd_foil: null },
      },
    });
    fetchFaceToFacePrice.mockResolvedValueOnce({ cad: 3.99, source: 'Face to Face' });

    const start = await request(app)
      .post('/api/admin/force-price-update')
      .send({ fullData: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const job = await waitForJob(app, token, start.body.jobId);
    expect(job.status).toBe('complete');
    expect(job.updated).toBe(1);

    // Sanity check ran against the FRESH rarity and accepted the Scryfall price
    expect(isPlausibleUsdPrice).toHaveBeenCalledWith(1.5, 'U');
    // Scryfall's price was reused from the full-data fetch — no second
    // pricing round-trip for this card
    expect(getPriceWithFallback).not.toHaveBeenCalled();

    const updated = await Card.findById(card._id).lean();
    expect(updated.set).toBe('Marvel Super Heroes Commander');
    expect(updated.setCode).toBe('MSC');
    expect(updated.collectorNumber).toBe('143');
    expect(updated.rarity).toBe('U');
    expect(updated.colors).toEqual(['W']);
    expect(updated.types).toEqual(['Instant']);
    expect(updated.manaCost).toBe('{W}');
    expect(updated.scryfallId).toBe('msc-143-id');
    expect(updated.imageUrl).toBe('/api/images/cached');
    expect(updated.oracleText).toContain('Exile target creature');
    expect(updated.price).toBe(1.5);
    expect(updated.priceCad).toBe(3.99);

    // The option is persisted so Recent Price Jobs can label the run
    const saved = await PriceUpdateJob.findOne({ jobId: job.jobId }).lean();
    expect(saved.options.fullData).toBe(true);
  });

  test('poll endpoint falls back to the persisted record after an in-memory miss', async () => {
    // Simulate a job that finished before a server restart: only the DB copy exists
    await PriceUpdateJob.create({
      jobId: 'price_update_legacy',
      status: 'complete',
      total: 10,
      updated: 7,
      skipped: 3,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 30000),
    });

    const res = await request(app)
      .get('/api/admin/force-price-update/price_update_legacy')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.status).toBe('complete');
    expect(res.body.updated).toBe(7);
    expect(res.body.completedAt).toBeTruthy();
  });

  test('a persisted running job with no live process is healed to failed (server restarted mid-run)', async () => {
    // Simulates exactly what a restart during an update leaves behind: DB says
    // running, but no in-memory entry exists, so nothing will ever progress it.
    await PriceUpdateJob.create({
      jobId: 'price_update_orphan',
      status: 'running',
      total: 100,
      updated: 40,
      startedAt: new Date(Date.now() - 120000),
    });

    const poll = await request(app)
      .get('/api/admin/force-price-update/price_update_orphan')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(poll.body.status).toBe('failed');
    expect(poll.body.error).toMatch(/restart/i);
    expect(poll.body.completedAt).toBeTruthy();

    // Healing is persisted, not just cosmetic
    const saved = await PriceUpdateJob.findOne({ jobId: 'price_update_orphan' }).lean();
    expect(saved.status).toBe('failed');

    // The list view heals its rows too (live in-memory jobs from other tests
    // may share the list, so find ours rather than indexing)
    const list = await request(app)
      .get('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const row = list.body.jobs.find(j => j.jobId === 'price_update_orphan');
    expect(row).toBeTruthy();
    expect(row.status).toBe('failed');
  });

  test('poll endpoint 404s for an unknown job id', async () => {
    await request(app)
      .get('/api/admin/force-price-update/nope_not_real')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  test('records per-card failures without failing the whole job', async () => {
    // Deterministic per-card outcome: with 5 workers the cards race, so a
    // mockRejectedValueOnce would hit whichever card started first.
    getPriceWithFallback.mockImplementation(async (name) => {
      if (name === 'Failing Card') throw new Error('source down');
      return { usd: 2.5, cad: 0, source: 'Scryfall' };
    });

    await Card.create([
      { userId: admin._id, name: 'Priced Card', condition: 'NM', price: 1 },
      { userId: admin._id, name: 'Failing Card', condition: 'NM', price: 1 },
    ]);

    const start = await request(app)
      .post('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const job = await waitForJob(app, token, start.body.jobId);
    expect(job.status).toBe('complete');
    expect(job.failed).toBe(1);
    expect(job.updated).toBe(1);
    expect(job.errors).toHaveLength(1);
    // Error entries are { card, error } objects, rendered by the admin panel
    expect(job.errors[0]).toEqual({ card: 'Failing Card', error: 'source down' });
  });

  test('403 for users without prices:force-update', async () => {
    const moderator = await User.create({ email: 'mod@test.com', username: 'mod1', passwordHash: 'x', role: 'moderator' });
    await request(app)
      .get('/api/admin/force-price-update')
      .set('Authorization', `Bearer ${makeToken(moderator)}`)
      .expect(403);
  });
});

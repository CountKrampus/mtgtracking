const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('axios');
const axios = require('axios');

const Webhook = require('../models/Webhook');
const { deliverWebhookEvent, isValidWebhookUrl } = require('../utils/webhookDelivery');

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

describe('isValidWebhookUrl', () => {
  it('accepts public https/http URLs', () => {
    expect(isValidWebhookUrl('https://example.com/hook')).toBe(true);
    expect(isValidWebhookUrl('http://example.com/hook')).toBe(true);
  });

  it('rejects non-http(s) protocols and internal hosts', () => {
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    expect(isValidWebhookUrl('http://localhost/hook')).toBe(false);
    expect(isValidWebhookUrl('http://127.0.0.1/hook')).toBe(false);
    expect(isValidWebhookUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isValidWebhookUrl('not a url')).toBe(false);
  });
});

describe('deliverWebhookEvent', () => {
  const userId = new mongoose.Types.ObjectId();

  it('only delivers to active webhooks subscribed to the given event', async () => {
    await Webhook.create({ userId, url: 'https://example.com/a', secret: 'x', isActive: true, events: ['price_alert'] });
    await Webhook.create({ userId, url: 'https://example.com/b', secret: 'y', isActive: false, events: ['price_alert'] });
    axios.post.mockResolvedValue({ status: 200 });

    await deliverWebhookEvent(userId, 'price_alert', { cardName: 'Test' });

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('https://example.com/a', expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Webhook-Signature': expect.any(String) })
    }));
  });

  it('auto-disables a webhook after repeated consecutive failures', async () => {
    const webhook = await Webhook.create({
      userId, url: 'https://example.com/flaky', secret: 'x', isActive: true, failureCount: 9
    });
    axios.post.mockRejectedValue({ response: { status: 503 } });

    await deliverWebhookEvent(userId, 'price_alert', { cardName: 'Test' });

    const updated = await Webhook.findById(webhook._id);
    expect(updated.failureCount).toBe(10);
    expect(updated.isActive).toBe(false);
  });

  it('resets failureCount to 0 after a successful delivery', async () => {
    const webhook = await Webhook.create({
      userId, url: 'https://example.com/recovering', secret: 'x', isActive: true, failureCount: 5
    });
    axios.post.mockResolvedValue({ status: 200 });

    await deliverWebhookEvent(userId, 'price_alert', { cardName: 'Test' });

    const updated = await Webhook.findById(webhook._id);
    expect(updated.failureCount).toBe(0);
    expect(updated.lastStatus).toBe(200);
  });
});

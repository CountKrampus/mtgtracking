const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createPriceAlertNotification } = require('../utils/notifications');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('price_alert notifications', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      email: 'test@test.com',
      username: 'testuser',
      displayName: 'Test User',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  test('createPriceAlertNotification creates a price_alert notification', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const notif = await createPriceAlertNotification(
      user._id,
      cardId,
      'Lightning Bolt',
      0.50,
      0.45
    );
    expect(notif).not.toBeNull();
    expect(notif.type).toBe('price_alert');
    expect(notif.userId.toString()).toBe(user._id.toString());
    expect(notif.cardId.toString()).toBe(cardId.toString());
    expect(notif.content).toContain('Lightning Bolt');
    expect(notif.content).toContain('0.45');
  });

  test('price_alert notification can be created without fromUserId', async () => {
    const cardId = new mongoose.Types.ObjectId();
    const notif = await Notification.create({
      userId: user._id,
      type: 'price_alert',
      cardId,
      content: 'Lightning Bolt dropped to $0.45 (target: $0.50)'
    });
    expect(notif._id).toBeDefined();
    expect(notif.fromUserId).toBeUndefined();
  });

  test('existing notification types still require fromUserId', async () => {
    await expect(
      Notification.create({
        userId: user._id,
        type: 'mention',
        content: 'You were mentioned'
      })
    ).rejects.toThrow();
  });
});

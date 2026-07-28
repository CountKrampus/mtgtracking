const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const CollectionHealthReport = require('../models/CollectionHealthReport');
const Notification = require('../models/Notification');
const { createHealthReportNotification } = require('../utils/notifications');

afterEach(async () => {
  await CollectionHealthReport.deleteMany({});
});

describe('CollectionHealthReport model', () => {
  test('stores condition breakdown, value change, and upgrade suggestions', async () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();

    const report = await CollectionHealthReport.create({
      userId,
      weekOf: new Date('2026-07-06'),
      conditionBreakdown: { NM: 10, LP: 2, MP: 1, HP: 1, DMG: 0 },
      valueChange: { from: 100, to: 120, delta: 20, deltaPercent: 20 },
      upgradeSuggestions: [
        { cardId, name: 'Sol Ring', reason: 'poor_condition', detail: 'Condition: HP' }
      ]
    });

    expect(report._id).toBeDefined();
    expect(report.conditionBreakdown.NM).toBe(10);
    expect(report.valueChange.delta).toBe(20);
    expect(report.upgradeSuggestions).toHaveLength(1);
    expect(report.upgradeSuggestions[0].reason).toBe('poor_condition');
    expect(report.createdAt).toBeDefined();
  });

  test('rejects an upgradeSuggestions reason outside the enum', async () => {
    const userId = new mongoose.Types.ObjectId();
    await expect(
      CollectionHealthReport.create({
        userId,
        weekOf: new Date(),
        conditionBreakdown: { NM: 1, LP: 0, MP: 0, HP: 0, DMG: 0 },
        valueChange: { from: 0, to: 0, delta: 0, deltaPercent: 0 },
        upgradeSuggestions: [{ name: 'Bad', reason: 'not_a_real_reason', detail: 'x' }]
      })
    ).rejects.toThrow();
  });

  test('requires userId and weekOf', async () => {
    await expect(
      CollectionHealthReport.create({
        conditionBreakdown: { NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 },
        valueChange: { from: 0, to: 0, delta: 0, deltaPercent: 0 },
        upgradeSuggestions: []
      })
    ).rejects.toThrow();
  });
});

describe('Notification: collection_health_report type', () => {
  afterEach(async () => {
    await Notification.deleteMany({});
  });

  test('can be created without fromUserId (system-generated)', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await Notification.create({
      userId,
      type: 'collection_health_report',
      healthReportId: reportId,
      content: 'Your weekly collection health report is ready'
    });

    expect(notif._id).toBeDefined();
    expect(notif.fromUserId).toBeUndefined();
    expect(notif.healthReportId.toString()).toBe(reportId.toString());
  });
});

describe('createHealthReportNotification', () => {
  afterEach(async () => {
    await Notification.deleteMany({});
  });

  test('creates a collection_health_report notification referencing the report and summarizing the value delta', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await createHealthReportNotification(userId, reportId, { delta: 12.5, deltaPercent: 8.2 });

    expect(notif).not.toBeNull();
    expect(notif.type).toBe('collection_health_report');
    expect(notif.userId.toString()).toBe(userId.toString());
    expect(notif.healthReportId.toString()).toBe(reportId.toString());
    expect(notif.content).toContain('+$12.50');
  });

  test('formats a negative value delta with a minus sign', async () => {
    const userId = new mongoose.Types.ObjectId();
    const reportId = new mongoose.Types.ObjectId();

    const notif = await createHealthReportNotification(userId, reportId, { delta: -7, deltaPercent: -3.1 });

    expect(notif.content).toContain('-$7.00');
  });
});

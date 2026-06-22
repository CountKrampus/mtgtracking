const cron = require('node-cron');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');
const { getPriceWithFallback } = require('../utils/pricing');
const { createPriceAlertNotification } = require('../utils/notifications');

const RATE_LIMIT_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDailySnapshot() {
  const mongoose = require('mongoose');
  // Card model is registered by server.js before this job runs
  const Card = mongoose.model('Card');

  const started = Date.now();
  let snapshotted = 0;
  let skipped = 0;
  let alertsFired = 0;
  let errors = 0;

  console.log('[dailySnapshot] Starting nightly price snapshot...');

  // --- Phase 1: Card price snapshots ---
  let cards;
  try {
    cards = await Card.find({}).lean();
  } catch (err) {
    console.error('[dailySnapshot] Failed to load cards:', err.message);
    return;
  }

  const updatedPrices = {}; // cardId -> newPrice

  for (const card of cards) {
    if (!card.name) { skipped++; continue; }
    try {
      const priceData = await getPriceWithFallback(card.name, card.isFoil || false);
      const newPrice = priceData.usd || 0;
      if (newPrice > 0) {
        await CardPriceSnapshot.create({
          cardId: card._id,
          userId: card.userId,
          price: newPrice
        });
        updatedPrices[card._id.toString()] = newPrice;
        snapshotted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[dailySnapshot] Error for card "${card.name}":`, err.message);
      errors++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  // --- Phase 2: Collection value snapshot (per user) ---
  try {
    const userIds = [...new Set(cards.filter(c => c.userId).map(c => c.userId.toString()))];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const userIdStr of userIds) {
      const userCards = cards.filter(c => c.userId && c.userId.toString() === userIdStr);
      const totalValue = userCards.reduce((sum, c) => {
        const price = updatedPrices[c._id.toString()] ?? (c.price || 0);
        return sum + price * (c.quantity || 1);
      }, 0);

      // Only one snapshot per user per day
      const existing = await ValueSnapshot.findOne({
        userId: userIdStr,
        createdAt: { $gte: todayStart }
      });
      if (!existing) {
        await ValueSnapshot.create({
          userId: userIdStr,
          value: totalValue,
          cardCount: userCards.length
        });
      }
    }
  } catch (err) {
    console.error('[dailySnapshot] Error writing value snapshots:', err.message);
    errors++;
  }

  // --- Phase 3: Price alert check ---
  try {
    const alertCards = cards.filter(c => c.priceAlert && c.priceAlert.targetPrice > 0 && c.userId);
    for (const card of alertCards) {
      const newPrice = updatedPrices[card._id.toString()];
      if (newPrice === undefined) continue;

      const targetPrice = card.priceAlert.targetPrice;
      if (newPrice > targetPrice) continue;

      // Check if this is a new crossing (price was above target yesterday)
      const lastFired = card.priceAlert.lastAlertFiredAt;
      if (lastFired) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const prevSnap = await CardPriceSnapshot.findOne({
          cardId: card._id,
          createdAt: { $lt: todayStart }
        }).sort({ createdAt: -1 }).lean();

        if (!prevSnap || prevSnap.price <= targetPrice) {
          // No prior snapshot to confirm recovery, or price was already at or below target — not a new crossing
          continue;
        }
      }

      const notif = await createPriceAlertNotification(
        card.userId,
        card._id,
        card.name,
        targetPrice,
        newPrice
      );
      if (notif) {
        await Card.updateOne(
          { _id: card._id },
          { $set: { 'priceAlert.lastAlertFiredAt': new Date() } }
        );
        alertsFired++;
      }
    }
  } catch (err) {
    console.error('[dailySnapshot] Error checking price alerts:', err.message);
    errors++;
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[dailySnapshot] Done. Snapshotted: ${snapshotted} | Skipped: ${skipped} | Alerts fired: ${alertsFired} | Errors: ${errors} | Duration: ${duration}s`
  );
}

function registerDailySnapshotJob() {
  // Run at 00:05 daily (5 min past midnight server time)
  cron.schedule('5 0 * * *', () => {
    runDailySnapshot().catch(err =>
      console.error('[dailySnapshot] Unhandled error:', err.message)
    );
  });
  console.log('[dailySnapshot] Nightly price snapshot job registered (00:05 daily)');
}

module.exports = { registerDailySnapshotJob, runDailySnapshot };

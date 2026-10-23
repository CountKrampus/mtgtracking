const cron = require('node-cron');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const ValueSnapshot = require('../models/ValueSnapshot');
const SetValueSnapshot = require('../models/SetValueSnapshot');
const { getPriceWithFallback } = require('../utils/pricing');
const { mapWithConcurrency, createStartRateLimiter } = require('../utils/concurrency');
const { createPriceAlertNotification } = require('../utils/notifications');
const { deliverWebhookEvent } = require('../utils/webhookDelivery');

// Card snapshots run with this many lookups in flight, with request starts
// spaced SNAPSHOT_MIN_INTERVAL_MS apart (see utils/concurrency.js). Replaces
// the old one-card-per-500ms serial loop.
const SNAPSHOT_CONCURRENCY = 5;
const SNAPSHOT_MIN_INTERVAL_MS = 200;

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

  const limitStart = createStartRateLimiter(SNAPSHOT_MIN_INTERVAL_MS);

  await mapWithConcurrency(cards, SNAPSHOT_CONCURRENCY, async (card) => {
    if (!card.name) { skipped++; return; }
    try {
      await limitStart();
      const priceData = await getPriceWithFallback(card.name, card.isFoil || false, {
        userId: card.userId,
        rarity: card.rarity
      });
      // Nightly refresh writes the fetched prices back onto the card itself,
      // not just into snapshot history — so a stale/wrong stored price (e.g.
      // the old $1000 Swords to Plowshares) self-heals on the next run.
      const newPrice = priceData.usd || 0;
      const cardPriceUpdate = {};
      if (newPrice > 0) cardPriceUpdate.price = newPrice;
      if (priceData.cad > 0) cardPriceUpdate.priceCad = priceData.cad;
      if (Object.keys(cardPriceUpdate).length > 0) {
        await Card.updateOne({ _id: card._id }, { $set: cardPriceUpdate });
      }
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
  });

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

      const dailySets = new Map();
      for (const card of userCards) {
        const setCode = (card.setCode || '').toLowerCase();
        const setName = card.set || 'Unknown';
        const setKey = setCode || setName.trim().toLowerCase();
        const current = dailySets.get(setKey) || { setCode, setName, value: 0, cardCount: 0, quantityCount: 0 };
        const price = updatedPrices[card._id.toString()] ?? (card.price || 0);
        current.value += price * (card.quantity || 1);
        current.cardCount++;
        current.quantityCount += card.quantity || 1;
        dailySets.set(setKey, current);
      }
      for (const [setKey, set] of dailySets) {
        await SetValueSnapshot.updateOne(
          { userId: userIdStr, setKey, snapshotDate: todayStart },
          { $setOnInsert: { userId: userIdStr, setKey, ...set, snapshotDate: todayStart } },
          { upsert: true }
        );
      }
    }
  } catch (err) {
    console.error('[dailySnapshot] Error writing value snapshots:', err.message);
    errors++;
  }

  // --- Phase 3: Price alert check ---
  // Checks one direction of a card's price alert (low target crossed downward,
  // or high target crossed upward), firing a notification only on a fresh
  // crossing — i.e. yesterday's snapshot was still on the "safe" side — so a
  // price that's been sitting past the target for days doesn't re-notify daily.
  async function checkAlertDirection(card, newPrice, direction) {
    const target = direction === 'high' ? card.priceAlert.targetHigh : card.priceAlert.targetPrice;
    if (!(target > 0)) return false;

    const crossed = direction === 'high' ? newPrice >= target : newPrice <= target;
    if (!crossed) return false;

    const firedField = direction === 'high' ? 'lastHighAlertFiredAt' : 'lastAlertFiredAt';
    const lastFired = card.priceAlert[firedField];
    if (lastFired) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const prevSnap = await CardPriceSnapshot.findOne({
        cardId: card._id,
        createdAt: { $lt: todayStart }
      }).sort({ createdAt: -1 }).lean();

      const wasSafe = direction === 'high' ? prevSnap && prevSnap.price < target : prevSnap && prevSnap.price > target;
      if (!wasSafe) return false; // no prior snapshot to confirm a fresh crossing, or already past target
    }

    const notif = await createPriceAlertNotification(card.userId, card._id, card.name, target, newPrice, direction);
    if (!notif) return false;

    await Card.updateOne({ _id: card._id }, { $set: { [`priceAlert.${firedField}`]: new Date() } });

    deliverWebhookEvent(card.userId, 'price_alert', {
      cardId: card._id,
      cardName: card.name,
      direction,
      targetPrice: target,
      actualPrice: newPrice,
    }).catch(err => console.error('[dailySnapshot] Webhook delivery error:', err.message));

    return true;
  }

  try {
    const alertCards = cards.filter(c =>
      c.priceAlert && c.userId && (c.priceAlert.targetPrice > 0 || c.priceAlert.targetHigh > 0)
    );
    for (const card of alertCards) {
      const newPrice = updatedPrices[card._id.toString()];
      if (newPrice === undefined) continue;

      if (await checkAlertDirection(card, newPrice, 'low')) alertsFired++;
      if (await checkAlertDirection(card, newPrice, 'high')) alertsFired++;
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

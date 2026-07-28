const PRICE_DROP_THRESHOLD_PCT = 0.20; // 20% drop triggers a "worth a look" suggestion
const PRICE_DROP_MIN_PRICE = 1; // floor: ignore drops on cards currently under $1 (noise)

const EMPTY_BREAKDOWN = { NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 };

function computeConditionBreakdown(cards) {
  const breakdown = { ...EMPTY_BREAKDOWN };
  for (const card of cards) {
    if (Object.prototype.hasOwnProperty.call(breakdown, card.condition)) {
      breakdown[card.condition] += card.quantity || 1;
    }
  }
  return breakdown;
}

function computeValueChange(fromValue, toValue) {
  const from = fromValue || 0;
  const to = toValue || 0;
  const delta = to - from;
  const deltaPercent = from > 0 ? (delta / from) * 100 : 0;
  return { from, to, delta, deltaPercent };
}

function computeUpgradeSuggestions(cards, priceWeekAgoByCardId) {
  const suggestions = [];
  for (const card of cards) {
    if (card.condition === 'HP' || card.condition === 'DMG') {
      suggestions.push({
        cardId: card._id,
        name: card.name,
        reason: 'poor_condition',
        detail: `Condition: ${card.condition}`
      });
    }

    const oldPrice = priceWeekAgoByCardId.get(card._id.toString());
    if (oldPrice && oldPrice > 0 && card.price >= PRICE_DROP_MIN_PRICE) {
      const dropPct = (oldPrice - card.price) / oldPrice;
      if (dropPct >= PRICE_DROP_THRESHOLD_PCT) {
        suggestions.push({
          cardId: card._id,
          name: card.name,
          reason: 'price_drop',
          detail: `Price dropped ${(dropPct * 100).toFixed(0)}% to $${card.price.toFixed(2)}`
        });
      }
    }
  }
  return suggestions;
}

// Start of the ISO week (Monday, 00:00 local time) containing the given date.
function startOfISOWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Orchestrates one report for one user. Models are passed in explicitly (Card, ValueSnapshot,
// CardPriceSnapshot, CollectionHealthReport) rather than required at the top of this module,
// because Card is registered dynamically by server.js at runtime (see backend/server.js:398)
// and isn't a requirable file — callers (the weekly job, the admin run-now route, and tests)
// each resolve/construct the Card model themselves and pass it in.
async function generateHealthReportForUser(userId, models) {
  const { Card, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport } = models;

  const cards = await Card.find({ userId }).lean();
  const conditionBreakdown = computeConditionBreakdown(cards);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const latestSnapshot = await ValueSnapshot.findOne({ userId }).sort({ createdAt: -1 }).lean();
  const weekAgoSnapshot = await ValueSnapshot.findOne({
    userId,
    createdAt: { $lte: weekAgo }
  }).sort({ createdAt: -1 }).lean();

  const valueChange = computeValueChange(weekAgoSnapshot?.value, latestSnapshot?.value);

  const priceWeekAgoByCardId = new Map();
  for (const card of cards) {
    const snap = await CardPriceSnapshot.findOne({
      cardId: card._id,
      createdAt: { $lte: weekAgo }
    }).sort({ createdAt: -1 }).lean();
    if (snap) {
      priceWeekAgoByCardId.set(card._id.toString(), snap.price);
    }
  }

  const upgradeSuggestions = computeUpgradeSuggestions(cards, priceWeekAgoByCardId);

  return CollectionHealthReport.create({
    userId,
    weekOf: startOfISOWeek(now),
    conditionBreakdown,
    valueChange,
    upgradeSuggestions
  });
}

module.exports = {
  PRICE_DROP_THRESHOLD_PCT,
  PRICE_DROP_MIN_PRICE,
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek,
  generateHealthReportForUser
};

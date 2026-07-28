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

module.exports = {
  PRICE_DROP_THRESHOLD_PCT,
  PRICE_DROP_MIN_PRICE,
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek
};

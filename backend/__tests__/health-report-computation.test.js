const {
  computeConditionBreakdown,
  computeValueChange,
  computeUpgradeSuggestions,
  startOfISOWeek
} = require('../utils/healthReport');

describe('computeConditionBreakdown', () => {
  test('counts cards by condition, weighted by quantity', () => {
    const cards = [
      { condition: 'NM', quantity: 3 },
      { condition: 'NM', quantity: 1 },
      { condition: 'HP', quantity: 2 },
      { condition: 'DMG', quantity: 1 }
    ];
    expect(computeConditionBreakdown(cards)).toEqual({ NM: 4, LP: 0, MP: 0, HP: 2, DMG: 1 });
  });

  test('returns all-zero breakdown for an empty collection', () => {
    expect(computeConditionBreakdown([])).toEqual({ NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 });
  });

  test('defaults missing quantity to 1', () => {
    expect(computeConditionBreakdown([{ condition: 'LP' }])).toEqual({ NM: 0, LP: 1, MP: 0, HP: 0, DMG: 0 });
  });
});

describe('computeValueChange', () => {
  test('computes delta and percent for an increase', () => {
    expect(computeValueChange(100, 120)).toEqual({ from: 100, to: 120, delta: 20, deltaPercent: 20 });
  });

  test('computes delta and percent for a decrease', () => {
    expect(computeValueChange(200, 150)).toEqual({ from: 200, to: 150, delta: -50, deltaPercent: -25 });
  });

  test('treats a missing "from" value as zero without dividing by zero', () => {
    expect(computeValueChange(undefined, 50)).toEqual({ from: 0, to: 50, delta: 50, deltaPercent: 0 });
  });

  test('treats a missing "to" value as zero', () => {
    expect(computeValueChange(80, undefined)).toEqual({ from: 80, to: 0, delta: -80, deltaPercent: -100 });
  });
});

describe('computeUpgradeSuggestions', () => {
  test('flags HP and DMG cards as poor_condition', () => {
    const cards = [
      { _id: 'card-hp', name: 'Underground Sea', condition: 'HP', price: 300 },
      { _id: 'card-dmg', name: 'Bayou', condition: 'DMG', price: 150 },
      { _id: 'card-nm', name: 'Sol Ring', condition: 'NM', price: 2 }
    ];
    const suggestions = computeUpgradeSuggestions(cards, new Map());

    expect(suggestions).toEqual([
      { cardId: 'card-hp', name: 'Underground Sea', reason: 'poor_condition', detail: 'Condition: HP' },
      { cardId: 'card-dmg', name: 'Bayou', reason: 'poor_condition', detail: 'Condition: DMG' }
    ]);
  });

  test('flags a card whose price dropped 20% or more since last week', () => {
    const cards = [{ _id: 'card-1', name: 'Mana Crypt', condition: 'NM', price: 40 }];
    const priceWeekAgo = new Map([['card-1', 50]]); // 40 is exactly a 20% drop from 50

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([
      { cardId: 'card-1', name: 'Mana Crypt', reason: 'price_drop', detail: 'Price dropped 20% to $40.00' }
    ]);
  });

  test('does not flag a price drop below the 20% threshold', () => {
    const cards = [{ _id: 'card-2', name: 'Command Tower', condition: 'NM', price: 2 }];
    const priceWeekAgo = new Map([['card-2', 2.2]]); // ~9% drop

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([]);
  });

  test('ignores price drops on cards under the $1 current-price floor to avoid noise', () => {
    const cards = [{ _id: 'card-3', name: 'Swamp', condition: 'NM', price: 0.1 }];
    const priceWeekAgo = new Map([['card-3', 1]]); // 90% drop, but current price is under $1

    expect(computeUpgradeSuggestions(cards, priceWeekAgo)).toEqual([]);
  });

  test('a card in poor condition with a price drop produces two separate suggestions', () => {
    const cards = [{ _id: 'card-4', name: 'Time Walk', condition: 'HP', price: 800 }];
    const priceWeekAgo = new Map([['card-4', 1000]]); // 20% drop

    const suggestions = computeUpgradeSuggestions(cards, priceWeekAgo);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map(s => s.reason).sort()).toEqual(['poor_condition', 'price_drop']);
  });
});

describe('startOfISOWeek', () => {
  test('returns the Monday of the same week for a mid-week date', () => {
    const thursday = new Date(2026, 6, 9); // July 9, 2026 is a Thursday
    const result = startOfISOWeek(thursday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(6);
    expect(result.getDay()).toBe(1); // Monday
  });

  test('a Sunday belongs to the Monday that started its own week', () => {
    const sunday = new Date(2026, 6, 12); // July 12, 2026 is a Sunday
    const result = startOfISOWeek(sunday);
    expect(result.getDate()).toBe(6);
    expect(result.getDay()).toBe(1);
  });

  test('a Monday maps to itself with the time zeroed', () => {
    const monday = new Date(2026, 6, 6, 15, 30);
    const result = startOfISOWeek(monday);
    expect(result.getDate()).toBe(6);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

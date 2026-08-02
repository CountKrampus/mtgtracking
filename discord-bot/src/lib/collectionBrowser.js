const PAGE_SIZE = 25;
const COLORS = ['W', 'U', 'B', 'R', 'G'];

function filterCards(cards, { set, type, colors }) {
  return cards.filter(c => {
    if (set && c.set !== set) return false;
    if (type && !(c.types || []).includes(type)) return false;
    if (colors && colors.size > 0) {
      const cardColors = c.colors || [];
      const matchesColor = cardColors.some(col => colors.has(col));
      const matchesColorless = colors.has('C') && cardColors.length === 0;
      if (!matchesColor && !matchesColorless) return false;
    }
    return true;
  });
}

function paginate(filtered, page) {
  const start = page * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

function buildSetOptions(cards, selectedSet) {
  const uniqueSets = [...new Set(cards.map(c => c.set).filter(Boolean))].sort();
  const options = [{ label: 'All Sets', value: '', default: !selectedSet }];
  for (const set of uniqueSets.slice(0, 24)) {
    options.push({ label: set.slice(0, 100), value: set, default: set === selectedSet });
  }
  return options;
}

function buildTypeOptions(cards, selectedType) {
  const uniqueTypes = [...new Set(cards.flatMap(c => c.types || []))].sort();
  const options = [{ label: 'All Types', value: '', default: !selectedType }];
  for (const type of uniqueTypes.slice(0, 24)) {
    options.push({ label: type.slice(0, 100), value: type, default: type === selectedType });
  }
  return options;
}

function buildCardOptions(pageCards) {
  if (pageCards.length === 0) {
    return [{ label: 'No matching cards', value: '__none__' }];
  }
  return pageCards.map(c => ({
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
    value: c._id
  }));
}

module.exports = {
  PAGE_SIZE,
  COLORS,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions
};

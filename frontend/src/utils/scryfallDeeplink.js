// Translates the CollectionView filter state into a Scryfall search URL.
// filterTag, filterLocation, and filterCondition have no Scryfall equivalent
// (they're collection-specific) and are intentionally not represented in the query.
export function buildScryfallQuery({
  searchTerm,
  filterColor,
  filterType,
  filterRarity,
  filterSet,
  filterSpecial,
  cards,
}) {
  const parts = [];

  if (searchTerm && searchTerm.trim()) {
    parts.push(searchTerm.trim());
  }

  if (filterColor && filterColor !== 'all') {
    parts.push(`c:${filterColor.toLowerCase()}`);
  }

  if (filterType && filterType !== 'all') {
    parts.push(`t:"${filterType}"`);
  }

  if (filterRarity && filterRarity !== 'all') {
    parts.push(`r:${filterRarity.toLowerCase()}`);
  }

  if (filterSet && filterSet !== 'all') {
    const setCode = (cards || []).find(c => c.set === filterSet)?.setCode;
    parts.push(setCode ? `s:${setCode.toLowerCase()}` : `set:"${filterSet}"`);
  }

  if (filterSpecial === 'tokens') parts.push('t:token');
  else if (filterSpecial === 'non-tokens') parts.push('-t:token');
  else if (filterSpecial === 'foil') parts.push('is:foil');
  else if (filterSpecial === 'non-foil') parts.push('-is:foil');

  return parts.join(' ');
}

export function buildScryfallSearchUrl(filters) {
  const query = buildScryfallQuery(filters);
  if (!query) return null;
  return `https://scryfall.com/search?q=${encodeURIComponent(query)}`;
}

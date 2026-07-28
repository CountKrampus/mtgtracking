const axios = require('axios');

// Sets whose release announcements aren't useful in a forum feed —
// tokens, memorabilia, art series, etc. rather than actual card sets.
const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'art_series']);

/**
 * Fetches non-digital MTG sets from Scryfall that released within the
 * last `windowDays` days (inclusive of today), oldest first.
 */
async function fetchRecentlyReleasedSets(windowDays = 7) {
  const response = await axios.get('https://api.scryfall.com/sets');
  const sets = response.data?.data || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - windowDays);

  return sets
    .filter(set => {
      if (set.digital) return false;
      if (EXCLUDED_SET_TYPES.has(set.set_type)) return false;
      if (!set.released_at) return false;
      const releaseDate = new Date(set.released_at);
      return releaseDate >= cutoff && releaseDate <= today;
    })
    .sort((a, b) => new Date(a.released_at) - new Date(b.released_at));
}

module.exports = { fetchRecentlyReleasedSets };

const axios = require('axios');

// Fetch card data from Scryfall with exact collector number lookup and fallback to fuzzy search
// Priority: exact (set+collector) > fuzzy with set > fuzzy name-only
async function fetchCardFromScryfall(cardName, setCode, collectorNumber) {
  let cardData = null;
  let lookupMethod = 'fuzzy';

  // Method 1: Exact lookup by set + collector number (most precise)
  if (setCode && collectorNumber) {
    try {
      const response = await axios.get(
        `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${collectorNumber}`
      );
      cardData = response.data;
      lookupMethod = 'exact';
      console.log(`âœ“ Exact match: ${cardName} (${setCode} ${collectorNumber})`);
    } catch (error) {
      console.log(`Exact lookup failed for ${setCode}/${collectorNumber}, trying fuzzy...`);
    }
  }

  // Method 2: Fuzzy search by name + set code
  if (!cardData && setCode) {
    try {
      const response = await axios.get(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}&set=${setCode.toLowerCase()}`
      );
      cardData = response.data;
      lookupMethod = 'fuzzy-with-set';
      console.log(`âœ“ Fuzzy match with set: ${cardName} (${setCode})`);
    } catch (error) {
      console.log(`Fuzzy with set failed, trying name-only fuzzy...`);
    }
  }

  // Method 3: Fuzzy search by name only (fallback). Retried once with backoff
  // on 429, since this is the last method and has nothing further to fall
  // back to - an uncaught throw here used to silently abort the whole
  // full-data update for that card (see git history around 2026-07-30).
  if (!cardData) {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
    try {
      const response = await axios.get(url);
      cardData = response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`Rate limited fetching ${cardName}, retrying after backoff...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const response = await axios.get(url);
        cardData = response.data;
      } else {
        throw error;
      }
    }
    lookupMethod = 'fuzzy-name-only';
    console.log(`âœ“ Fuzzy match (name only): ${cardName}`);
  }

  return {
    cardData,
    lookupMethod
  };
}

module.exports = { fetchCardFromScryfall };

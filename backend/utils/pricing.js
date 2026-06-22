const axios = require('axios');

/**
 * Fetch a card's price from Exor Games (primary) with Scryfall as fallback.
 * @param {string} cardName - Card name to look up
 * @param {boolean} isFoil - If true, uses Scryfall usd_foil price as backup
 * @returns {{ cad: number, usd: number, source: string }}
 */
async function getPriceWithFallback(cardName, isFoil = false) {
  // Try Exor Games first
  try {
    const searchUrl = `https://exorgames.com/a/search?type=product&q=${encodeURIComponent(cardName)}`;
    const response = await axios.get(searchUrl);
    const html = response.data;
    const priceMatch = html.match(/"price":\s*(\d+)/);
    if (priceMatch) {
      const priceInCents = parseInt(priceMatch[1]);
      const priceCAD = priceInCents / 100;
      const priceUSD = Math.round(priceCAD * 0.73 * 100) / 100;
      if (priceUSD > 0) {
        return { cad: priceCAD, usd: priceUSD, source: 'Exor Games' };
      }
    }
  } catch (error) {
    console.error('Exor Games price fetch failed:', error.message);
  }

  // Fallback to Scryfall if Exor Games returns 0 or fails
  try {
    console.log('Falling back to Scryfall pricing for:', cardName);
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const scryfallPrice = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);
    if (scryfallPrice > 0) {
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall (backup)' };
    }
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
  }

  // If both fail, return 0
  return { cad: 0, usd: 0, source: 'None (not found)' };
}

module.exports = { getPriceWithFallback };

const axios = require('axios');

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch a card's USD price from MTGGoldfish.
 * @param {string} cardName - Card name to look up
 * @returns {{ usd: number, source: string }}
 */
async function fetchMTGGoldfishPrice(cardName) {
  const encodedName = cardName.replace(/\s+/g, '+');
  const url = `https://www.mtggoldfish.com/price/${encodedName}#paper`;
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeout: 10000,
    });
    const html = response.data;

    // MTGGoldfish embeds price in a <div class="price-box-price"> element
    const priceMatch = html.match(/class="price-box-price"[^>]*>\s*\$?([\d,]+\.?\d*)/);
    if (priceMatch) {
      const usd = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (usd > 0) {
        return { usd, source: 'MTGGoldfish' };
      }
    }

    // Secondary pattern: look for paper price in JSON/script blocks
    const jsonPriceMatch = html.match(/"paper"[^}]*"price"\s*:\s*([\d.]+)/);
    if (jsonPriceMatch) {
      const usd = parseFloat(jsonPriceMatch[1]);
      if (usd > 0) {
        return { usd, source: 'MTGGoldfish' };
      }
    }
  } catch (error) {
    console.error('MTGGoldfish price fetch failed:', error.message);
  }
  return { usd: 0, source: 'MTGGoldfish' };
}

/**
 * Fetch a card's price from Exor Games (primary) with MTGGoldfish then Scryfall as fallbacks.
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

  // Fallback #1: MTGGoldfish if Exor Games returns 0 or fails
  console.log('MTGGoldfish fallback used for:', cardName);
  const goldfish = await fetchMTGGoldfishPrice(cardName);
  if (goldfish.usd > 0) {
    return { cad: 0, usd: goldfish.usd, source: 'MTGGoldfish (backup)' };
  }

  // Fallback #2: Scryfall if MTGGoldfish also returns 0 or fails
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

  // If all three fail, return 0
  return { cad: 0, usd: 0, source: 'None (not found)' };
}

module.exports = { getPriceWithFallback };

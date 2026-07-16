const axios = require('axios');

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch a card's USD price from MTGGoldfish.
 * @param {string} cardName - Card name to look up
 * @returns {{ usd: number, source: string }}
 */
async function fetchMTGGoldfishPrice(cardName) {
  try {
    // MTGGoldfish price pages are keyed by set slug + collector number
    // (e.g. /price/tenth-edition/296/seedborn-muse), which can't be built
    // from a card name alone. Search first to resolve the actual URL.
    const searchUrl = `https://www.mtggoldfish.com/q?query_string=${encodeURIComponent(cardName)}`;
    const searchResponse = await axios.get(searchUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeout: 10000,
    });
    const searchHtml = searchResponse.data;

    const normalizedName = cardName.trim().toLowerCase();
    const linkPattern = /href="(\/price\/[^"]+)"[^>]*>([^<]+)</g;
    let firstMatch = null;
    let firstNonFoilMatch = null;
    let linkResult;
    while ((linkResult = linkPattern.exec(searchHtml)) !== null) {
      const [, href, text] = linkResult;
      if (text.trim().toLowerCase() !== normalizedName) continue;
      if (!firstMatch) firstMatch = href;
      if (!href.endsWith('-foil')) {
        firstNonFoilMatch = href;
        break;
      }
    }
    const priceHref = firstNonFoilMatch || firstMatch;
    if (!priceHref) {
      return { usd: 0, source: 'MTGGoldfish' };
    }

    const priceResponse = await axios.get(`https://www.mtggoldfish.com${priceHref}#paper`, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeout: 10000,
    });
    const html = priceResponse.data;

    // MTGGoldfish embeds price in a <div class='price-box-price'> element
    const priceMatch = html.match(/class=['"]price-box-price['"][^>]*>\s*\$?\s*([\d,]+\.?\d*)/);
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
 * Fetch a card's price from Scryfall (primary) with MTGGoldfish as a fallback.
 *
 * Exor Games was previously tried first, but its search endpoint no longer returns usable
 * product data (it now returns unrelated site navigation JSON with one incidental price on
 * the page), which silently poisoned every price lookup with the same wrong value. Removed
 * rather than patched, since a working replacement scraper wasn't wanted here.
 *
 * @param {string} cardName - Card name to look up
 * @param {boolean} isFoil - If true, uses Scryfall usd_foil price
 * @returns {{ cad: number, usd: number, source: string }}
 */
async function getPriceWithFallback(cardName, isFoil = false) {
  try {
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const scryfallPrice = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);
    if (scryfallPrice > 0) {
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall' };
    }
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
  }

  // Fallback: MTGGoldfish if Scryfall has no price
  const goldfish = await fetchMTGGoldfishPrice(cardName);
  if (goldfish.usd > 0) {
    return { cad: 0, usd: goldfish.usd, source: 'MTGGoldfish (backup)' };
  }

  return { cad: 0, usd: 0, source: 'None (not found)' };
}

module.exports = { getPriceWithFallback, fetchMTGGoldfishPrice };

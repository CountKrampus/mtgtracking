const axios = require('axios');
const NodeCache = require('node-cache');
const PriceSourceLog = require('../models/PriceSourceLog');

function logPriceSource(source) {
  PriceSourceLog.create({ source }).catch(() => {});
}

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const VALID_PRIMARY_SOURCES = ['scryfall', 'mtggoldfish', 'facetoface'];

// ── Price sanity guard ───────────────────────────────────────────────────
// A broken scraper can poison every lookup with one junk value (Exor Games
// returned a single fixed decoy price for every card, which is how a common
// Swords to Plowshares ended up stored at $1000). Fetched prices are
// therefore sanity-checked before being trusted: commons/uncommons never
// approach $250 in any real market, and even tier-one power printings stay
// under $10k on Scryfall/MTGGoldfish. An implausible value is rejected so
// the chain falls through to the next source instead of writing junk.
const MAX_PLAUSIBLE_USD = 10000;
const MAX_PLAUSIBLE_USD_CU = 250;
const MAX_PLAUSIBLE_CAD = 15000;
const COMMON_UNCOMMON_RARITIES = new Set(['c', 'u', 'common', 'uncommon']);

function isPlausibleUsdPrice(usd, rarity) {
  if (!(usd > 0)) return true; // nothing fetched — nothing to reject
  if (!Number.isFinite(usd) || usd > MAX_PLAUSIBLE_USD) return false;
  if (rarity && COMMON_UNCOMMON_RARITIES.has(String(rarity).toLowerCase()) &&
      usd > MAX_PLAUSIBLE_USD_CU) {
    return false;
  }
  return true;
}

function isPlausibleCadPrice(cad) {
  return !(cad > 0) || (Number.isFinite(cad) && cad <= MAX_PLAUSIBLE_CAD);
}

// Short-TTL cache of each account's primary price source so batch paths
// (admin bulk update, nightly snapshot) don't re-query the same user per card.
const primarySourceCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

/**
 * Resolve which price source an account treats as primary.
 * @param {string} [primarySource] - Known value (e.g. from req.user) — used as-is when valid
 * @param {string|object} [userId] - Card owner to look up when no explicit source given
 * @returns {Promise<'scryfall'|'mtggoldfish'|'facetoface'>}
 */
async function resolvePrimarySource(primarySource, userId) {
  if (primarySource && VALID_PRIMARY_SOURCES.includes(primarySource)) {
    return primarySource;
  }
  if (!userId) return 'scryfall';

  const key = String(userId);
  const cached = primarySourceCache.get(key);
  if (cached) return cached;

  try {
    // Lazy require: models/User pulls in permissions, no cycle — but keep it
    // out of module load so unit tests that never hit this path stay light.
    const User = require('../models/User');
    const user = await User.findById(userId).select('pricePreferences.primarySource').lean();
    const resolved = user?.pricePreferences?.primarySource || 'scryfall';
    primarySourceCache.set(key, resolved);
    return resolved;
  } catch (error) {
    return 'scryfall';
  }
}

/**
 * Fetch a card's USD price from Scryfall.
 * @returns {Promise<number>} USD price, 0 when Scryfall has none
 */
async function fetchScryfallPrice(cardName, isFoil = false) {
  try {
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const price = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);
    return price > 0 ? price : 0;
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
    return 0;
  }
}

/**
 * Fetch a card's CAD retail price from Face to Face Games.
 *
 * F2F is a Shopify storefront, so /search/suggest.json returns structured
 * product data (no HTML scraping). Singles are listed per printing/finish as
 * "Name [collector] [Set] [Foil|Non-Foil]" with condition variants
 * (NM/PL/HP) — price_max is the NM tier (NM >= PL >= HP by condition).
 *
 * @param {string} cardName - Card name to look up
 * @param {boolean} isFoil - Prefer the foil listing when true
 * @returns {Promise<{cad: number, source: string}>}
 */
async function fetchFaceToFacePrice(cardName, isFoil = false) {
  try {
    const url = `https://facetofacegames.com/search/suggest.json?q=${encodeURIComponent(cardName)}&resources%5Btype%5D=product&resources%5Blimit%5D=10`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeout: 10000,
    });
    const products = response.data?.resources?.results?.products || [];
    const wanted = cardName.trim().toLowerCase();

    for (const product of products) {
      if (!product.title) continue;
      if (product.type && product.type !== 'Singles') continue;

      // "Lightning Bolt [162] [Revised Edition] [Non-Foil]" -> "lightning bolt"
      const bracketIdx = product.title.indexOf(' [');
      const name = (bracketIdx === -1 ? product.title : product.title.slice(0, bracketIdx)).trim().toLowerCase();
      if (name !== wanted) continue;

      const title = product.title.toLowerCase();
      const isFoilListing = title.includes('[foil]');
      // Skip a foil listing when we want non-foil; skip an unconfirmed
      // finish when we specifically want foil (no tag -> treat as non-foil).
      if (isFoil && !isFoilListing) continue;
      if (!isFoil && isFoilListing) continue;

      const price = parseFloat(product.price_max ?? product.price);
      if (price > 0) {
        return { cad: price, source: 'Face to Face' };
      }
    }
    return { cad: 0, source: 'Face to Face' };
  } catch (error) {
    console.error('Face to Face price fetch failed:', error.message);
    return { cad: 0, source: 'Face to Face' };
  }
}

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
 * Fetch a card's price, honoring the account's primary source preference.
 *
 * Chain (per account setting, see User.pricePreferences.primarySource):
 *   - 'scryfall'   (default): Scryfall -> MTGGoldfish
 *   - 'mtggoldfish':          MTGGoldfish -> Scryfall
 *   - 'facetoface':           Face to Face leads (its CAD price is credited
 *     as the source; the USD chain still fills `usd` so stats stay USD)
 *
 * F2F always runs in parallel with the USD chain on every real fetch (one
 * extra request that never blocks the USD lookup), so `cad` is populated
 * with F2F's retail CAD price whenever F2F lists the card.
 *
 * Exor Games was previously tried first, but its search endpoint no longer returns usable
 * product data (it now returns unrelated site navigation JSON with one incidental price on
 * the page), which silently poisoned every price lookup with the same wrong value. Removed
 * rather than patched, since a working replacement scraper wasn't wanted here.
 *
 * @param {string} cardName - Card name to look up
 * @param {boolean} isFoil - If true, uses Scryfall usd_foil price
 * @param {Object} [options]
 * @param {string} [options.primarySource] - Explicit primary source (from req.user)
 * @param {string} [options.userId] - Card owner to look the primary source up from
 * @param {string} [options.rarity] - Card rarity ('C'/'U'/'R'/'M' or full words);
 *   commons/uncommons get a much stricter plausibility cap (see sanity guard)
 * @returns {{ cad: number, usd: number, source: string }}
 */
async function getPriceWithFallback(cardName, isFoil = false, options = {}) {
  const primary = await resolvePrimarySource(options.primarySource, options.userId);
  const rarity = options.rarity;

  // F2F rides along with every fetch in parallel — CAD retail price (never
  // blocks or fails the USD lookup).
  const f2fPromise = fetchFaceToFacePrice(cardName, isFoil);

  const usdChain = primary === 'mtggoldfish'
    ? [
        { label: 'MTGGoldfish', fetch: () => fetchMTGGoldfishPrice(cardName).then(r => r.usd) },
        { label: 'Scryfall (backup)', fetch: () => fetchScryfallPrice(cardName, isFoil) },
      ]
    : [
        { label: 'Scryfall', fetch: () => fetchScryfallPrice(cardName, isFoil) },
        { label: 'MTGGoldfish (backup)', fetch: () => fetchMTGGoldfishPrice(cardName).then(r => r.usd) },
      ];

  let usd = 0;
  let usdSource = null;
  for (const step of usdChain) {
    const price = await step.fetch();
    if (price > 0 && !isPlausibleUsdPrice(price, rarity)) {
      // Junk value (scraper decoy / parse bug): don't trust it, try the next
      // source rather than writing an implausible price to the collection.
      console.warn(
        `[pricing] Rejected implausible USD ${price} from ${step.label} for "${cardName}"` +
        `${rarity ? ` (rarity ${rarity})` : ''} — trying next source`
      );
      continue;
    }
    if (price > 0) {
      usd = price;
      usdSource = step.label;
      break;
    }
  }

  const f2f = await f2fPromise;
  if (f2f.cad > 0 && !isPlausibleCadPrice(f2f.cad)) {
    console.warn(`[pricing] Rejected implausible CAD ${f2f.cad} from Face to Face for "${cardName}"`);
    f2f.cad = 0;
  }

  // Source label: the account's primary source when it delivered, otherwise
  // whichever source actually supplied the price.
  let source;
  if (primary === 'facetoface' && f2f.cad > 0) {
    source = 'Face to Face';
  } else if (usdSource) {
    source = usdSource;
  } else if (f2f.cad > 0) {
    source = 'Face to Face';
  } else {
    source = 'None (not found)';
  }

  if (source !== 'None (not found)') {
    logPriceSource(source);
  }

  return { cad: f2f.cad, usd, source };
}

module.exports = {
  getPriceWithFallback,
  fetchMTGGoldfishPrice,
  fetchScryfallPrice,
  fetchFaceToFacePrice,
  resolvePrimarySource,
  isPlausibleUsdPrice,
  isPlausibleCadPrice,
};

jest.mock('axios');
jest.mock('../models/PriceSourceLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const axios = require('axios');
const {
  getPriceWithFallback,
  fetchFaceToFacePrice,
} = require('../utils/pricing');

// F2F suggest.json fixture: same name across printings/finishes, plus a
// sealed product that must never match a card lookup.
const f2fSuggest = {
  resources: {
    results: {
      products: [
        {
          title: 'Lightning Bolt [401] [Rulebook Showcase] [Commander Legends: Battle for Baldur\'s Gate] [Non-Foil]',
          type: 'Singles',
          price: '2.79',
          price_max: '3.49',
        },
        {
          title: 'Lightning Bolt [162] [Revised Edition] [Non-Foil]',
          type: 'Singles',
          price: '2.00',
          price_max: '4.99',
        },
        {
          title: 'Lightning Bolt [162] [Revised Edition] [Foil]',
          type: 'Singles',
          price: '25.00',
          price_max: '39.99',
        },
        {
          title: 'Lightning Bolt Playmat',
          type: 'Sealed Products',
          price: '99.99',
          price_max: '99.99',
        },
      ],
    },
  },
};

const scryfallData = { prices: { usd: '1.50', usd_foil: '4.00' } };

const goldfishSearchHtml =
  '<a href="/price/revised-edition/162/lightning-bolt">Lightning Bolt</a>';
const goldfishPriceHtml =
  "<div class='price-box-price'> $12.34</div>";

// Route axios.get by URL so each source can be exercised independently.
function mockSources({ scryfall, f2f, goldfishSearch, goldfishPrice } = {}) {
  axios.get.mockImplementation((url) => {
    if (url.includes('api.scryfall.com')) {
      if (scryfall === 'error') return Promise.reject(new Error('404'));
      return Promise.resolve({ data: scryfall });
    }
    if (url.includes('facetofacegames.com')) {
      if (f2f === 'error') return Promise.reject(new Error('network'));
      return Promise.resolve({ data: f2f });
    }
    if (url.includes('mtggoldfish.com/q?')) {
      if (goldfishSearch === 'error') return Promise.reject(new Error('network'));
      return Promise.resolve({ data: goldfishSearch ?? '' });
    }
    if (url.includes('mtggoldfish.com')) {
      if (goldfishPrice === 'error') return Promise.reject(new Error('network'));
      return Promise.resolve({ data: goldfishPrice ?? '' });
    }
    return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
  });
}

describe('fetchFaceToFacePrice', () => {
  // Reset only axios: resetAllMocks would also wipe the PriceSourceLog
  // factory implementation (create() returning undefined -> .catch throws)
  beforeEach(() => axios.get.mockReset());

  test('returns the first matching non-foil listing price_max (NM tier) in CAD', async () => {
    mockSources({ f2f: f2fSuggest });
    const result = await fetchFaceToFacePrice('Lightning Bolt', false);
    expect(result).toEqual({ cad: 3.49, source: 'Face to Face' });
  });

  test('picks the foil listing when isFoil is true', async () => {
    mockSources({ f2f: f2fSuggest });
    const result = await fetchFaceToFacePrice('Lightning Bolt', true);
    expect(result.cad).toBe(39.99);
  });

  test('matches on exact card name only (sealed products excluded, no fuzzy prefix matches)', async () => {
    mockSources({ f2f: f2fSuggest });
    const result = await fetchFaceToFacePrice('Sol Ring', false);
    expect(result.cad).toBe(0);
  });

  test('returns 0 when the store is unreachable', async () => {
    mockSources({ f2f: 'error' });
    const result = await fetchFaceToFacePrice('Lightning Bolt', false);
    expect(result.cad).toBe(0);
    expect(result.source).toBe('Face to Face');
  });
});

describe('getPriceWithFallback — default chain (scryfall primary)', () => {
  // Reset only axios: resetAllMocks would also wipe the PriceSourceLog
  // factory implementation (create() returning undefined -> .catch throws)
  beforeEach(() => axios.get.mockReset());

  test('Scryfall wins the USD price and F2F CAD rides along in parallel', async () => {
    mockSources({ scryfall: scryfallData, f2f: f2fSuggest, goldfishSearch: 'error' });
    const result = await getPriceWithFallback('Lightning Bolt', false);
    expect(result.usd).toBe(1.5);
    expect(result.source).toBe('Scryfall');
    expect(result.cad).toBe(3.49);
    // Chain stopped at Scryfall — no MTGGoldfish request was made
    const goldfishCalls = axios.get.mock.calls.filter(([url]) => url.includes('mtggoldfish.com'));
    expect(goldfishCalls).toHaveLength(0);
  });

  test('falls back to MTGGoldfish with the legacy backup label', async () => {
    mockSources({
      scryfall: 'error',
      f2f: f2fSuggest,
      goldfishSearch: goldfishSearchHtml,
      goldfishPrice: goldfishPriceHtml,
    });
    const result = await getPriceWithFallback('Lightning Bolt', false);
    expect(result.usd).toBe(12.34);
    expect(result.source).toBe('MTGGoldfish (backup)');
    expect(result.cad).toBe(3.49);
  });

  test("returns 'None (not found)' when every source misses", async () => {
    mockSources({
      scryfall: 'error',
      f2f: { resources: { results: { products: [] } } },
      goldfishSearch: 'no links here',
    });
    const result = await getPriceWithFallback('Lightning Bolt', false);
    expect(result).toEqual({ cad: 0, usd: 0, source: 'None (not found)' });
  });
});

describe('getPriceWithFallback — primarySource: mtggoldfish', () => {
  // Reset only axios: resetAllMocks would also wipe the PriceSourceLog
  // factory implementation (create() returning undefined -> .catch throws)
  beforeEach(() => axios.get.mockReset());

  test('MTGGoldfish is queried first and credited when it has a price', async () => {
    mockSources({
      scryfall: scryfallData,
      f2f: f2fSuggest,
      goldfishSearch: goldfishSearchHtml,
      goldfishPrice: goldfishPriceHtml,
    });
    const result = await getPriceWithFallback('Lightning Bolt', false, {
      primarySource: 'mtggoldfish',
    });
    expect(result.usd).toBe(12.34);
    expect(result.source).toBe('MTGGoldfish');
    // Chain stopped at MTGGoldfish — Scryfall was never queried
    const scryfallCalls = axios.get.mock.calls.filter(([url]) => url.includes('api.scryfall.com'));
    expect(scryfallCalls).toHaveLength(0);
  });

  test('Scryfall fills in as backup when MTGGoldfish misses', async () => {
    mockSources({
      scryfall: scryfallData,
      f2f: f2fSuggest,
      goldfishSearch: 'no links here',
    });
    const result = await getPriceWithFallback('Lightning Bolt', false, {
      primarySource: 'mtggoldfish',
    });
    expect(result.usd).toBe(1.5);
    expect(result.source).toBe('Scryfall (backup)');
  });
});

describe('getPriceWithFallback — price sanity guard', () => {
  // A broken scraper once returned one fixed junk price for every card (the
  // Exor Games decoy) — a common Swords to Plowshares was stored at $1000.
  // Implausible values must be rejected, not written to the collection.
  beforeEach(() => axios.get.mockReset());

  test('rejects an implausible C/U price and falls through to the next source', async () => {
    mockSources({
      scryfall: { prices: { usd: '1000.00' } },
      f2f: f2fSuggest,
      goldfishSearch: goldfishSearchHtml,
      goldfishPrice: goldfishPriceHtml,
    });
    const result = await getPriceWithFallback('Lightning Bolt', false, { rarity: 'C' });
    expect(result.usd).toBe(12.34);
    expect(result.source).toBe('MTGGoldfish (backup)');
  });

  test('rejects an implausible price from every USD source (no rarity given)', async () => {
    mockSources({
      scryfall: { prices: { usd: '50000.00' } },
      f2f: { resources: { results: { products: [] } } },
      goldfishSearch: goldfishSearchHtml,
      goldfishPrice: "<div class='price-box-price'> $99999</div>",
    });
    const result = await getPriceWithFallback('Lightning Bolt', false);
    expect(result.usd).toBe(0);
    expect(result.source).toBe('None (not found)');
  });

  test('accepts a plausible high price for a rare/mythic', async () => {
    mockSources({
      scryfall: { prices: { usd: '6000.00' } },
      f2f: { resources: { results: { products: [] } } },
    });
    const result = await getPriceWithFallback('Alpha Rare', false, { rarity: 'mythic' });
    expect(result.usd).toBe(6000);
    expect(result.source).toBe('Scryfall');
  });

  test('rejects an implausible F2F CAD price but keeps the USD price', async () => {
    const greedyF2f = {
      resources: {
        results: {
          products: [{
            title: 'Lightning Bolt [162] [Revised Edition] [Non-Foil]',
            type: 'Singles',
            price: '99999',
            price_max: '99999',
          }],
        },
      },
    };
    mockSources({ scryfall: scryfallData, f2f: greedyF2f, goldfishSearch: 'error' });
    const result = await getPriceWithFallback('Lightning Bolt', false);
    expect(result.usd).toBe(1.5);
    expect(result.cad).toBe(0);
  });
});

describe('getPriceWithFallback — primarySource: facetoface', () => {
  // Reset only axios: resetAllMocks would also wipe the PriceSourceLog
  // factory implementation (create() returning undefined -> .catch throws)
  beforeEach(() => axios.get.mockReset());

  test('F2F is credited as the source and CAD + USD are both returned', async () => {
    mockSources({ scryfall: scryfallData, f2f: f2fSuggest, goldfishSearch: 'error' });
    const result = await getPriceWithFallback('Lightning Bolt', false, {
      primarySource: 'facetoface',
    });
    expect(result.source).toBe('Face to Face');
    expect(result.cad).toBe(3.49);
    expect(result.usd).toBe(1.5); // USD stats stay filled by the fallback chain
  });

  test('USD chain saves the lookup when F2F does not list the card', async () => {
    mockSources({
      scryfall: scryfallData,
      f2f: { resources: { results: { products: [] } } },
      goldfishSearch: 'error',
    });
    const result = await getPriceWithFallback('Lightning Bolt', false, {
      primarySource: 'facetoface',
    });
    expect(result.source).toBe('Scryfall');
    expect(result.usd).toBe(1.5);
    expect(result.cad).toBe(0);
  });
});

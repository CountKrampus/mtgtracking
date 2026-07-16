const axios = require('axios');

jest.mock('axios');

const { fetchMTGGoldfishPrice, getPriceWithFallback } = require('../utils/pricing');

describe('fetchMTGGoldfishPrice', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('resolves the card price page from search results and extracts the price', async () => {
    const searchHtml = `
      <a href="/price/unlimited-edition/lightning-bolt">Lightning Bolt</a>
      <a href="/price/double-masters-2022/117/lightning-bolt-foil">Lightning Bolt</a>
    `;
    // MTGGoldfish renders the price box with single-quoted class attributes
    const pricePageHtml = `<div class='price-box-price'>$ 28.61</div>`;

    axios.get.mockImplementation((url) => {
      if (url.includes('/q?query_string=')) {
        return Promise.resolve({ data: searchHtml });
      }
      if (url.includes('/price/unlimited-edition/lightning-bolt')) {
        return Promise.resolve({ data: pricePageHtml });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await fetchMTGGoldfishPrice('Lightning Bolt');

    expect(result).toEqual({ usd: 28.61, source: 'MTGGoldfish' });
  });

  test('returns zero when the search page has no matching card link', async () => {
    axios.get.mockResolvedValue({ data: '<div>Search Results</div>' });

    const result = await fetchMTGGoldfishPrice('Some Nonexistent Card');

    expect(result).toEqual({ usd: 0, source: 'MTGGoldfish' });
  });
});

describe('getPriceWithFallback', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('uses Scryfall as the primary price source and never calls MTGGoldfish when it succeeds', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('api.scryfall.com')) {
        return Promise.resolve({ data: { prices: { usd: '1.81', usd_foil: null } } });
      }
      if (url.includes('mtggoldfish.com')) {
        // Should never be reached: Scryfall succeeding must short-circuit the fallback.
        return Promise.resolve({
          data: '<a href="/price/unlimited-edition/sol-ring">Sol Ring</a>',
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await getPriceWithFallback('Sol Ring');

    expect(result).toEqual({ cad: 0, usd: 1.81, source: 'Scryfall' });
    expect(axios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('mtggoldfish.com'),
      expect.anything()
    );
  });

  test('falls back to MTGGoldfish when Scryfall has no price', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('api.scryfall.com')) {
        return Promise.resolve({ data: { prices: { usd: null, usd_foil: null } } });
      }
      if (url.includes('/q?query_string=')) {
        return Promise.resolve({
          data: '<a href="/price/unlimited-edition/sol-ring">Sol Ring</a>',
        });
      }
      if (url.includes('/price/unlimited-edition/sol-ring')) {
        return Promise.resolve({ data: `<div class='price-box-price'>$ 131.42</div>` });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await getPriceWithFallback('Sol Ring');

    expect(result).toEqual({ cad: 0, usd: 131.42, source: 'MTGGoldfish (backup)' });
  });

  test('returns zero when both sources have no price', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('api.scryfall.com')) {
        return Promise.resolve({ data: { prices: { usd: null, usd_foil: null } } });
      }
      return Promise.resolve({ data: '<div>no results</div>' });
    });

    const result = await getPriceWithFallback('Some Obscure Card');

    expect(result).toEqual({ cad: 0, usd: 0, source: 'None (not found)' });
  });
});

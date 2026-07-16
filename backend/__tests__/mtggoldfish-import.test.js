const axios = require('axios');

jest.mock('axios');

const { parseMTGGoldfishURL } = require('../utils/deckHelpers');

describe('parseMTGGoldfishURL', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('detects the commander and excludes it from the main deck', async () => {
    // MTGGoldfish's plain-text /deck/download export has no commander marker at all —
    // the commander is just another line in the list. The commander name only appears
    // in a hidden form field on the deck page itself.
    const deckPageHtml = `
      <input type="hidden" name="deck_input[commander]" id="deck_input_commander" value="Slicer, Hired Muscle" autocomplete="off" />
    `;
    const downloadText = '1 Sol Ring\n1 Slicer, Hired Muscle\n1 Lightning Greaves\n';

    axios.get.mockImplementation((url) => {
      if (url.includes('/deck/download/')) {
        return Promise.resolve({ data: downloadText });
      }
      if (url.match(/mtggoldfish\.com\/deck\/\d+$/)) {
        return Promise.resolve({ data: deckPageHtml });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await parseMTGGoldfishURL('https://www.mtggoldfish.com/deck/6383166');

    expect(result.commander).toBe('Slicer, Hired Muscle');
    expect(result.mainDeck).toEqual([
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Lightning Greaves', quantity: 1 },
    ]);
  });
});

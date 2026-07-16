const axios = require('axios');

jest.mock('axios');

const { parseArchidektURL } = require('../utils/deckHelpers');

describe('parseArchidektURL', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('excludes cards from categories marked includedInDeck: false (e.g. Tokens & Extras)', async () => {
    const deckData = {
      name: 'Never Mind, it’s Dinos',
      description: '',
      categories: [
        { name: 'Commander', includedInDeck: true },
        { name: 'Creature', includedInDeck: true },
        { name: 'Tokens & Extras', includedInDeck: false },
        { name: 'Maybeboard', includedInDeck: false },
      ],
      cards: [
        {
          quantity: 1,
          categories: ['Commander'],
          card: { oracleCard: { name: 'Gishath, Sun’s Avatar' } },
        },
        {
          quantity: 1,
          categories: ['Creature'],
          card: { oracleCard: { name: 'Ripjaw Raptor' } },
        },
        {
          quantity: 1,
          categories: ['Tokens & Extras'],
          card: { oracleCard: { name: 'Dinosaur' } },
        },
        {
          quantity: 1,
          categories: ['Maybeboard'],
          card: { oracleCard: { name: 'Some Card Under Consideration' } },
        },
      ],
    };

    axios.get.mockResolvedValue({ data: deckData });

    const result = await parseArchidektURL('https://archidekt.com/decks/13613745/never_mind_its_dinos');

    expect(result.commander).toBe('Gishath, Sun’s Avatar');
    expect(result.mainDeck).toEqual([{ name: 'Ripjaw Raptor', quantity: 1 }]);
  });
});

jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const showoffCommand = require('../src/commands/showoff');

function mockInteraction({ subcommand, name, count }) {
  const followUp = jest.fn().mockResolvedValue(undefined);
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(name),
      getInteger: jest.fn().mockReturnValue(count ?? null),
    },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp,
  };
}

describe('/showoff', () => {
  afterEach(() => jest.clearAllMocks());

  describe('cards subcommand', () => {
    test('shows the top valuable cards and does not mark the reply ephemeral', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { cards: [
            { name: 'Black Lotus', set: 'Vintage Masters', price: 500 },
            { name: 'Sol Ring', set: 'Commander Masters', price: 2 },
          ], total: 2, page: 1, limit: 5 },
        }),
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards', count: 5 });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/cards?sortBy=price&sortOrder=desc&limit=5');
      const call = interaction.followUp.mock.calls[0][0];
      expect(call.embeds[0].description).toContain('Black Lotus');
      expect(call.embeds[0].description).toContain('Sol Ring');
      expect(call.ephemeral).toBeUndefined();
    });

    test('defaults count to 5 when not provided', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { cards: [] } }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards' });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/cards?sortBy=price&sortOrder=desc&limit=5');
    });

    test('replies not-linked on 401', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards', count: 5 });
      await showoffCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('link'),
        ephemeral: true,
      }));
    });
  });

  describe('deck subcommand', () => {
    test('resolves the deck by name and shows a public spotlight embed', async () => {
      const api = {
        get: jest.fn()
          .mockResolvedValueOnce({ status: 200, data: [{ _id: 'deck-1', name: 'Edgar Markov' }] })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              name: 'Edgar Markov', format: 'commander', totalValue: 245.5,
              commander: { name: 'Edgar Markov', imageUrl: 'http://example.com/edgar.jpg' },
              mainDeck: new Array(99).fill({ name: 'Sol Ring' }),
              statistics: { totalCards: 100 },
            },
          }),
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'deck', name: 'edgar markov' });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
      expect(api.get).toHaveBeenNthCalledWith(2, '/decks/deck-1');
      const call = interaction.followUp.mock.calls[0][0];
      expect(call.embeds[0].title).toContain('Edgar Markov');
      expect(call.embeds[0].thumbnail.url).toBe('http://example.com/edgar.jpg');
      expect(call.ephemeral).toBeUndefined();
    });

    test('reports no match for an unknown deck name (private error)', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'deck', name: 'Nonexistent Deck' });
      await showoffCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('No deck named'),
        ephemeral: true,
      }));
    });
  });
});

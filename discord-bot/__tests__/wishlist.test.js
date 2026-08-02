jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const wishlistCommand = require('../src/commands/wishlist');

function mockInteraction(subcommand, options = {}) {
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(options.name)
    },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/wishlist', () => {
  afterEach(() => jest.clearAllMocks());

  describe('list', () => {
    test('renders wishlist items in an embed', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ name: 'Sol Ring', priority: 'high' }]
        })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('list');
      await wishlistCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/wishlist');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [expect.objectContaining({ title: 'Wishlist' })]
        })
      );
    });

    test('replies with a plain message when the wishlist is empty', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('list');
      await wishlistCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('empty') })
      );
    });
  });

  describe('deals', () => {
    test('calls GET /wishlist', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/wishlist');
    });

    test('renders only items at or below target price in an embed', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [
            { name: 'Sol Ring', priority: 'high', currentPrice: 2, targetPrice: 5 },
            { name: 'Mana Crypt', priority: 'medium', currentPrice: 50, targetPrice: 10 },
            { name: 'Rhystic Study', priority: 'low', currentPrice: 0, targetPrice: 40 },
            { name: 'Cyclonic Rift', priority: 'medium', currentPrice: 15, targetPrice: 0 },
            { name: 'Smothering Tithe', priority: 'high', currentPrice: 20, targetPrice: 20 }
          ]
        })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [expect.objectContaining({
            description: expect.stringContaining('Sol Ring')
          })]
        })
      );
      const call = interaction.reply.mock.calls[0][0];
      const description = call.embeds[0].description;
      expect(description).toContain('Sol Ring (high): $2 (target $5)');
      expect(description).toContain('Smothering Tithe (high): $20 (target $20)');
      expect(description).not.toContain('Mana Crypt');
      expect(description).not.toContain('Rhystic Study');
      expect(description).not.toContain('Cyclonic Rift');
    });

    test('replies with a plain ephemeral "No deals" message when nothing qualifies', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ name: 'Mana Crypt', currentPrice: 50, targetPrice: 10 }]
        })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('No deals'),
          ephemeral: true
        })
      );
      const call = interaction.reply.mock.calls[0][0];
      expect(call.embeds).toBeUndefined();
    });

    test('replies with replyNotLinked on a 401', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 401, data: null }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("haven't linked") })
      );
    });

    test('replies with a generic error message on a non-200/401 status', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 500, data: null }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('500'), ephemeral: true })
      );
    });
  });
});

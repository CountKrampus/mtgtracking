jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const wishlistCommand = require('../src/commands/wishlist');

function mockInteraction(subcommand, options = {}) {
  const interaction = {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(options.name)
    },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
  // Mirror discord.js: deferReply marks the interaction deferred, which routes
  // replyNotLinked through editReply.
  interaction.deferReply = jest.fn().mockImplementation(async () => {
    interaction.deferred = true;
  });
  return interaction;
}

describe('/wishlist', () => {
  afterEach(() => jest.clearAllMocks());

  describe('list', () => {
    test('defers before calling the API, then renders wishlist items in an embed', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ name: 'Sol Ring', priority: 'high' }]
        })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('list');
      await wishlistCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith();
      // Defer must precede the backend round-trip.
      expect(interaction.deferReply.mock.invocationCallOrder[0])
        .toBeLessThan(api.get.mock.invocationCallOrder[0]);
      expect(api.get).toHaveBeenCalledWith('/wishlist');
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [expect.objectContaining({ title: 'Wishlist' })]
        })
      );
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('follows up with a plain message when the wishlist is empty', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('list');
      await wishlistCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(
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

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [expect.objectContaining({
            description: expect.stringContaining('Sol Ring')
          })]
        })
      );
      const call = interaction.followUp.mock.calls[0][0];
      const description = call.embeds[0].description;
      expect(description).toContain('Sol Ring (high): $2 (target $5)');
      expect(description).toContain('Smothering Tithe (high): $20 (target $20)');
      expect(description).not.toContain('Mana Crypt');
      expect(description).not.toContain('Rhystic Study');
      expect(description).not.toContain('Cyclonic Rift');
    });

    test('follows up with a plain "No deals" message when nothing qualifies', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ name: 'Mana Crypt', currentPrice: 50, targetPrice: 10 }]
        })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('No deals'),
        })
      );
      const call = interaction.followUp.mock.calls[0][0];
      expect(call.embeds).toBeUndefined();
    });

    test('reports not-linked via editReply on a 401 (already deferred)', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 401, data: null }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("haven't linked") })
      );
    });

    test('follows up with a generic error message on a non-200/401 status', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 500, data: null }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction('deals');
      await wishlistCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('500') })
      );
    });
  });

  describe('acquire', () => {
    test('moves the matched wishlist item into the collection and reports the merge', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ _id: 'w-1', name: 'Sol Ring' }, { _id: 'w-2', name: 'Mana Crypt' }]
        }),
        post: jest.fn().mockResolvedValue({ status: 200, data: { merged: true, message: 'New quantity: 3' } })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('acquire', { name: 'sol ring' });
      await wishlistCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/wishlist');
      expect(api.post).toHaveBeenCalledWith('/wishlist/w-1/acquire', {});
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('acquired and merged') })
      );
      expect(interaction.followUp.mock.calls[0][0].content).toContain('New quantity: 3');
    });

    test('reports a brand-new card (no merge) as added to the collection', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({ status: 200, data: [{ _id: 'w-1', name: 'Sol Ring' }] }),
        post: jest.fn().mockResolvedValue({ status: 200, data: { merged: false } })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('acquire', { name: 'Sol Ring' });
      await wishlistCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('added to your collection') })
      );
    });

    test('does not acquire anything when the card is not on the wishlist', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({ status: 200, data: [{ _id: 'w-1', name: 'Sol Ring' }] }),
        post: jest.fn()
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('acquire', { name: 'Mana Crypt' });
      await wishlistCommand.execute(interaction);

      expect(api.post).not.toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("isn't on your wishlist") })
      );
    });

    test('refuses to pick between duplicate wishlist entries', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: [{ _id: 'w-1', name: 'Sol Ring' }, { _id: 'w-2', name: 'Sol Ring' }]
        }),
        post: jest.fn()
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('acquire', { name: 'Sol Ring' });
      await wishlistCommand.execute(interaction);

      expect(api.post).not.toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Multiple wishlist entries') })
      );
    });
  });

  describe('remove', () => {
    test('still defers exactly once before its two backend round-trips', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({ status: 200, data: [{ _id: 'w-1', name: 'Sol Ring' }] }),
        delete: jest.fn().mockResolvedValue({ status: 200 })
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction('remove', { name: 'Sol Ring' });
      await wishlistCommand.execute(interaction);

      // A second deferReply would throw "Invalid interaction" at runtime.
      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      expect(api.delete).toHaveBeenCalledWith('/wishlist/w-1');
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Removed "Sol Ring"') })
      );
    });
  });
});
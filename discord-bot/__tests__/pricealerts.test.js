jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const pricealertsCommand = require('../src/commands/pricealerts');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/pricealerts', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows only cards with an active price alert, with thresholds', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { name: 'Sol Ring', price: 2.5, priceAlert: { targetPrice: 1, targetHigh: 0 } },
          { name: 'Mana Crypt', price: 45, priceAlert: { targetPrice: 0, targetHigh: 60 } },
          { name: 'Command Tower', price: 0.5, priceAlert: { targetPrice: 0.25, targetHigh: 5 } },
          { name: 'Island', price: 0.1, priceAlert: undefined }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/cards');

    const call = interaction.reply.mock.calls[0][0];
    expect(call.ephemeral).toBe(true);
    const embed = call.embeds[0];
    expect(embed.description).toContain('Sol Ring');
    expect(embed.description).toContain('$2.5');
    expect(embed.description).toContain('drop to $1');
    expect(embed.description).toContain('Mana Crypt');
    expect(embed.description).toContain('rise to $60');
    expect(embed.description).toContain('Command Tower');
    expect(embed.description).toContain('drop to $0.25');
    expect(embed.description).toContain('rise to $5');
    expect(embed.description).not.toContain('Island');
  });

  test('replies with a plain ephemeral message when no cards have an active alert', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { name: 'Island', price: 0.1, priceAlert: undefined },
          { name: 'Forest', price: 0.1, priceAlert: { targetPrice: 0, targetHigh: 0 } }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("don't have any"), ephemeral: true })
    );
    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds).toBeUndefined();
  });

  test('replies via replyNotLinked on a 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('link') })
    );
  });

  test('replies with a generic error message on a non-200/401 status', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 500, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('500'), ephemeral: true })
    );
  });
});

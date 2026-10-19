jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const pricealertsCommand = require('../src/commands/pricealerts');

function mockInteraction() {
  const interaction = {
    user: { id: 'discord-1' },
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


describe('/pricealerts', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before calling the API, then shows only cards with an active price alert, with thresholds', async () => {
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

    expect(interaction.deferReply).toHaveBeenCalledWith();
    // The defer must actually happen before the backend round-trip, not after.
    expect(interaction.deferReply.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0]);
    expect(api.get).toHaveBeenCalledWith('/cards');

    const call = interaction.followUp.mock.calls[0][0];
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
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('follows up with a plain message when no cards have an active alert', async () => {
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

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("don't have any") })
    );
    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds).toBeUndefined();
  });

  test('reports not-linked via editReply on a 401 (already deferred)', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('link') })
    );
  });

  test('follows up with a generic error message on a non-200/401 status', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 500, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('500') })
    );
  });
});
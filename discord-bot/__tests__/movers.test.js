jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const moversCommand = require('../src/commands/movers');

function mockInteraction() {
  const interaction = {
    user: { id: 'discord-1' },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
  interaction.deferReply = jest.fn().mockImplementation(async () => { interaction.deferred = true; });
  return interaction;
}

describe('/movers', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before the snapshot walk and shows gainers and losers with signs', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          gainers: [{ name: 'Ragavan', oldPrice: 20, newPrice: 40, changeAbs: 20, changePct: 100 }],
          losers: [{ name: 'Mana Crypt', oldPrice: 100, newPrice: 60, changeAbs: -40, changePct: -40 }]
        }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await moversCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.deferReply.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0]);
    expect(api.get).toHaveBeenCalledWith('/stats/price-changes');

    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Price Movers — Last 30 Days');
    expect(embed.description).toContain('📈 Top Gainers');
    expect(embed.description).toContain('**Ragavan** — $20.00 → $40.00 (+100.0%)');
    expect(embed.description).toContain('📉 Top Losers');
    expect(embed.description).toContain('**Mana Crypt** — $100.00 → $60.00 (-40.0%)');
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('shows only the section that has entries', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { gainers: [{ name: 'Sol Ring', oldPrice: 1, newPrice: 2, changeAbs: 1, changePct: 100 }], losers: [] }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await moversCommand.execute(interaction);

    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Top Gainers');
    expect(embed.description).not.toContain('Top Losers');
  });

  test('reports when there is no movement data at all', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { gainers: [], losers: [] } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await moversCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No price movements') })
    );
  });

  test('reports not-linked via editReply on 401 (already deferred)', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await moversCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't linked") })
    );
  });
});
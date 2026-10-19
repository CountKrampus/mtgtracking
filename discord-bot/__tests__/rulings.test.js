jest.mock('../src/apiClient', () => ({
  client: jest.fn(),
  resolveImageUrl: (url) => (url ? url : null)
}));
const { client } = require('../src/apiClient');
const rulingsCommand = require('../src/commands/rulings');

function mockInteraction(options = {}) {
  const interaction = {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue(options.card ?? null) },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    channel: { awaitMessageComponent: jest.fn() },
    deferred: false,
    replied: false
  };
  interaction.deferReply = jest.fn().mockImplementation(async () => { interaction.deferred = true; });
  return interaction;
}

describe('/rulings', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before the Scryfall call and lists rulings with their dates', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { published_at: '2017-09-20', comment: 'If a player casts a spell with a kicker cost, that cost is paid as the spell resolves.' },
          { published_at: '2004-10-04', comment: 'Kicker represents an optional additional cost.' }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Venser Shaper Savant' });
    await rulingsCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.deferReply.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0]);
    expect(api.get).toHaveBeenCalledWith('/scryfall/rulings', { params: { q: 'Venser Shaper Savant' } });

    const payload = interaction.followUp.mock.calls[0][0];
    expect(payload.embeds[0].title).toContain('Rulings: Venser Shaper Savant');
    expect(payload.embeds[0].description).toContain('**2017-09-20**');
    expect(payload.embeds[0].description).toContain('kicker cost');
    expect(payload.embeds[0].footer.text).toContain('2 rulings');
  });

  test('paginates when there are more rulings than one page holds', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      published_at: `2020-01-0${i + 1}`,
      comment: `Ruling number ${i + 1}.`
    }));
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: many }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Doom Blade' });
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('timeout'));
    await rulingsCommand.execute(interaction);

    const payload = interaction.followUp.mock.calls[0][0];
    expect(payload.components).toBeDefined();
    expect(payload.components[0].components).toHaveLength(2); // Prev + Next
    expect(payload.embeds[0].footer.text).toContain('Page 1/2');
  });

  test('reports an unknown card on 404', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 404 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Nonexistent Card' });
    await rulingsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Couldn't find a card") })
    );
  });

  test('reports when a card has no official rulings', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Air Elemental' });
    await rulingsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No official rulings') })
    );
  });
});
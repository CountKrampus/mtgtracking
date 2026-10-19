jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const comboCommand = require('../src/commands/combo');

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

describe('/combo', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before the Spellbook lookup and lists combos with produces and link', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          card: 'Basalt Monolith',
          found: 1,
          combos: [{
            cards: ['Basalt Monolith', 'Rings of Brighthearth'],
            produces: 'Infinite colorless mana',
            description: 'Rings copies Basalt Monolith untap trigger infinitely.',
            prerequisite: 'Basalt Monolith and Rings of Brighthearth both on the battlefield.',
            spellbookUrl: 'https://commanderspellbook.com/combo/123'
          }]
        }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'basalt monolith' });
    await comboCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.deferReply.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0]);
    expect(api.get).toHaveBeenCalledWith('/combos/for-card/basalt%20monolith');

    const payload = interaction.followUp.mock.calls[0][0];
    const embed = payload.embeds[0];
    expect(embed.title).toBe('⚡ Combos: Basalt Monolith');
    expect(embed.description).toContain('Basalt Monolith + Rings of Brighthearth');
    expect(embed.description).toContain('Infinite colorless mana');
    expect(embed.description).toContain('Rings copies Basalt Monolith');
    expect(embed.description).toContain('Prerequisites');
    expect(embed.description).toContain('https://commanderspellbook.com/combo/123');
    expect(embed.footer.text).toContain('1 combo');
  });

  test('reports when the card has no combos in the database', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { card: 'air elemental', found: 0, combos: [] } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Air Elemental' });
    await comboCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No infinite combos found for "air elemental"') })
    );
  });

  test('reports not-linked via editReply on 401 (already deferred)', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Sol Ring' });
    await comboCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't linked") })
    );
  });

  test('follows up with a generic error on a non-200/401 status', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 500 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ card: 'Sol Ring' });
    await comboCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('500') })
    );
  });
});
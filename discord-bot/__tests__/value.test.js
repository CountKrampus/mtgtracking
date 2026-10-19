jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const valueCommand = require('../src/commands/value');

function mockInteraction(days = null) {
  const interaction = {
    user: { id: 'discord-1' },
    options: { getInteger: jest.fn().mockReturnValue(days) },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
  interaction.deferReply = jest.fn().mockImplementation(async () => { interaction.deferred = true; });
  return interaction;
}

function snapshot(daysAgo, value) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { createdAt: d.toISOString(), value, cardCount: 10 };
}

describe('/value', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before fetching history and renders current value plus change', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { snapshots: [snapshot(30, 1000), snapshot(15, 1100), snapshot(0, 1250.5)], earliest: null }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction(30);
    await valueCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.deferReply.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0]);
    expect(api.get).toHaveBeenCalledWith('/stats/value-history', expect.objectContaining({
      params: expect.objectContaining({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    }));

    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('📈 Collection Value');
    const byName = (n) => embed.fields.find(f => f.name === n);
    expect(byName('Current Value').value).toBe('$1250.50');
    expect(byName('Change (30d)').value).toContain('📈');
    expect(byName('Change (30d)').value).toContain('+$250.50');
    expect(byName('Change (30d)').value).toContain('+25.1%');
    expect(embed.description).toContain('█'); // chart bars
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('renders a downward change with the down arrow', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { snapshots: [snapshot(30, 2000), snapshot(0, 1500)], earliest: null }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction(30);
    await valueCommand.execute(interaction);

    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    const change = embed.fields.find(f => f.name === 'Change (30d)');
    expect(change.value).toContain('📉');
    expect(change.value).toContain('-$500.00');
    expect(change.value).toContain('-25.0%');
  });

  test('does not crash when the value never moved (flat range)', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { snapshots: [snapshot(2, 500), snapshot(1, 500), snapshot(0, 500)], earliest: null }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction(null);
    await valueCommand.execute(interaction);

    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.fields.find(f => f.name === 'Change (30d)').value).toContain('+$0.00');
    expect(embed.description).not.toContain('NaN');
  });

  test('reports when no snapshots exist in the window', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { snapshots: [], earliest: null } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(30);
    await valueCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No value snapshots') })
    );
  });

  test('reports not-linked via editReply on 401 (already deferred)', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(30);
    await valueCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't linked") })
    );
  });
});
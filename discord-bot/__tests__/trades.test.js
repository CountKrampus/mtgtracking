jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const tradesCommand = require('../src/commands/trades');

function mockInteraction(subcommand, opts = {}) {
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn((name) => opts[name] ?? null)
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
}

describe('/trades browse', () => {
  afterEach(() => jest.clearAllMocks());

  test('lists active listings', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { listings: [{ type: 'have', cardName: 'Sol Ring', cardSet: 'Commander 2021', condition: 'NM', username: 'alice' }], total: 1 }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', { type: null, card: null });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades', { params: {} });
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
    expect(embed.description).toContain('alice');
  });

  test('passes type and card filters through as query params', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', { type: 'want', card: 'Sol Ring' });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades', { params: { type: 'want', card: 'Sol Ring' } });
  });

  test('reports no listings found', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No active listings') }));
  });
});

describe('/trades my-listings', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the caller\'s own listings', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ type: 'have', cardName: 'Sol Ring', cardSet: 'C21', condition: 'NM', status: 'active' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('my-listings', {});
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades/my-listings');
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('my-listings', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

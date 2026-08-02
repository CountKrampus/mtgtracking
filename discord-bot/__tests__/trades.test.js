jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const tradesCommand = require('../src/commands/trades');

function mockInteraction(subcommand, opts = {}) {
  const interaction = {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn((name) => opts[name] ?? null)
    },
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
  interaction.deferReply = jest.fn().mockImplementation(async () => {
    interaction.deferred = true;
  });
  return interaction;
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

describe('/trades create', () => {
  afterEach(() => jest.clearAllMocks());

  test('type=have resolves against the caller\'s own collection and posts a listing', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Sol Ring', set: 'Commander 2021', setCode: 'C21', scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', price: 2 } });
    const api = { post: jest.fn().mockResolvedValue({ status: 201, data: {} }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: 'looking to trade' });
    await tradesCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledWith('/trades', expect.objectContaining({
      type: 'have', cardName: 'Sol Ring', cardSet: 'Commander 2021', cardSetCode: 'C21',
      scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', estimatedValue: 2, quantity: 1, notes: 'looking to trade'
    }));
  });

  test('type=want looks up the card via Scryfall search, not the caller\'s collection', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { name: 'Mana Crypt', set: 'Eternal Masters', setCode: 'EMA', scryfallId: 'sf-2', imageUrl: '/img/sf-2', prices: { usd: '200.00' } } }),
      post: jest.fn().mockResolvedValue({ status: 201, data: {} })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'want', card: 'Mana Crypt', message: null });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/scryfall/search', { params: { name: 'Mana Crypt' } });
    expect(api.post).toHaveBeenCalledWith('/trades', expect.objectContaining({
      type: 'want', cardName: 'Mana Crypt', cardSet: 'Eternal Masters', cardSetCode: 'EMA',
      scryfallId: 'sf-2', imageUrl: '/img/sf-2', condition: 'NM', quantity: 1
    }));
  });

  test('type=have reports no match without posting anything', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'no_match' });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Nonexistent Card', message: null });
    await tradesCommand.execute(interaction);

    expect(api.post).not.toHaveBeenCalled();
  });

  test('type=want replies not-linked when POST /trades returns 401', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { name: 'Mana Crypt', set: 'Eternal Masters', setCode: 'EMA', scryfallId: 'sf-2', imageUrl: '/img/sf-2', prices: { usd: '200.00' } } }),
      post: jest.fn().mockResolvedValue({ status: 401 })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'want', card: 'Mana Crypt', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });

  test('type=have reports timeout without posting anything', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'timed_out' });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('timed out') }));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('type=have reports an error with the http status without posting anything', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'error', httpStatus: 500 });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('500') }));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('type=want reports an error when the Scryfall search fails without posting anything', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 404 }),
      post: jest.fn()
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'want', card: 'Nonexistent Card', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Couldn\'t find') }));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('type=have reports a generic error when POST /trades returns an unexpected status', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Sol Ring', set: 'Commander 2021', setCode: 'C21', scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', price: 2 } });
    const api = { post: jest.fn().mockResolvedValue({ status: 500 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Couldn't create listing") }));
  });
});

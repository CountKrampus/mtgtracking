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

describe('/trades offer', () => {
  afterEach(() => jest.clearAllMocks());

  test('resolves the listing, lets the caller multi-select their own cards, and posts the offer', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Mana Crypt', set: 'Eternal Masters', condition: 'NM', price: 200, scryfallId: 'sf-2', imageUrl: '/img/sf-2' },
          { name: 'Command Tower', set: 'Commander 2020', condition: 'NM', price: 0.5, scryfallId: 'sf-3', imageUrl: '/img/sf-3' }
        ] }), // /cards
      post: jest.fn().mockResolvedValue({ status: 201, data: {} })
    };
    client.mockReturnValue(api);

    const selectInteraction = {
      values: ['0'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: 'trade?' });
    interaction.channel = { awaitMessageComponent: jest.fn().mockResolvedValue(selectInteraction) };

    await tradesCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledWith('/trades/listing-1/offers', expect.objectContaining({
      message: 'trade?',
      offeredCards: [expect.objectContaining({ cardName: 'Mana Crypt', scryfallId: 'sf-2' })]
    }));
  });

  test('asks for a more specific name when multiple listings match', async () => {
    const api = {
      get: jest.fn().mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'a', cardName: 'Sol Ring' }, { _id: 'b', cardName: 'Sol Ring Foil' }], total: 2 } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('more specific') }));
  });

  test('reports no match when no listing matches', async () => {
    const api = { get: jest.fn().mockResolvedValueOnce({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Nonexistent', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No listing') }));
  });

  test('reports a timeout when the card selection is not made in time', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Mana Crypt', set: 'Eternal Masters', condition: 'NM', price: 200, scryfallId: 'sf-2', imageUrl: '/img/sf-2' }
        ] }) // /cards
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    interaction.channel = { awaitMessageComponent: jest.fn().mockRejectedValue(new Error('time')) };

    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('timed out') }));
  });

  test('surfaces the backend error message when the offer POST fails (e.g. own listing)', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Mana Crypt', set: 'Eternal Masters', condition: 'NM', price: 200, scryfallId: 'sf-2', imageUrl: '/img/sf-2' }
        ] }), // /cards
      post: jest.fn().mockResolvedValue({ status: 403, data: { message: 'Cannot offer on your own listing' } })
    };
    client.mockReturnValue(api);

    const selectInteraction = {
      values: ['0'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    interaction.channel = { awaitMessageComponent: jest.fn().mockResolvedValue(selectInteraction) };

    await tradesCommand.execute(interaction);

    expect(selectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Cannot offer on your own listing')
    }));
  });

  test('replies not-linked when the offer POST returns 401', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Mana Crypt', set: 'Eternal Masters', condition: 'NM', price: 200, scryfallId: 'sf-2', imageUrl: '/img/sf-2' }
        ] }), // /cards
      post: jest.fn().mockResolvedValue({ status: 401 })
    };
    client.mockReturnValue(api);

    const selectInteraction = {
      values: ['0'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    interaction.channel = { awaitMessageComponent: jest.fn().mockResolvedValue(selectInteraction) };

    await tradesCommand.execute(interaction);

    expect(selectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });

  test('replies not-linked when GET /cards returns 401', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 401 }) // /cards
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });

  test("reports the caller doesn't have any cards to offer", async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [] }) // /cards
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("don't have any cards") }));
  });

  test('reports a generic error when the initial listing search returns an unexpected status', async () => {
    const api = { get: jest.fn().mockResolvedValueOnce({ status: 500 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('500') }));
  });
});

describe('/trades received', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows pending received offers with Accept/Reject buttons', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{
          _id: 'offer-1', status: 'pending', fromUsername: 'bob', message: 'trade?',
          listingId: { cardName: 'Sol Ring' },
          offeredCards: [{ cardName: 'Mana Crypt', quantity: 1 }]
        }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('received', {});
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades/offers/received');
    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds[0].description).toContain('bob');
    expect(call.embeds[0].description).toContain('Mana Crypt');
    const button = call.components[0].components[0].data;
    expect(button.custom_id).toBe('trade-accept:offer-1');
  });

  test('reports no pending offers', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('received', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No pending') }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('received', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

describe('/trades sent', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows sent offers, with a Cancel button on pending ones', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'offer-2', status: 'pending', toUsername: 'carol', listingId: { cardName: 'Rhystic Study' } }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('sent', {});
    await tradesCommand.execute(interaction);

    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds[0].description).toContain('carol');
    const button = call.components[0].components[0].data;
    expect(button.custom_id).toBe('trade-cancel:offer-2');
  });

  test('does not show a Cancel button on a non-pending offer', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'offer-3', status: 'accepted', toUsername: 'carol', listingId: { cardName: 'Rhystic Study' } }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('sent', {});
    await tradesCommand.execute(interaction);

    const call = interaction.reply.mock.calls[0][0];
    expect(call.components).toEqual([]);
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('sent', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

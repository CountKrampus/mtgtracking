// Phase-1 reliability tests: these commands used to call reply() only AFTER a
// backend round-trip, which can exceed Discord's 3-second initial-response
// window and fail the whole command. They must now defer first and answer via
// followUp (or editReply for the not-linked path).
// The bare automock would make resolveImageUrl return undefined and silently
// drop embed images (same trap as showoff.test.js), so implement it for
// absolute URLs the way the real apiClient does.
jest.mock('../src/apiClient', () => ({
  client: jest.fn(),
  resolveImageUrl: (url) => (url ? url : null),
}));
const { client } = require('../src/apiClient');

const cardCommand = require('../src/commands/card');
const decksCommand = require('../src/commands/decks');
const collectionCommand = require('../src/commands/collection');
const linkCommand = require('../src/commands/link');
const unlinkCommand = require('../src/commands/unlink');
const notificationsCommand = require('../src/commands/notifications');

function mockInteraction({ subcommand, options = {} } = {}) {
  const interaction = {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand ?? 'stats'),
      getString: jest.fn((name) => options[name] ?? null)
    },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
  // Mirror discord.js: deferReply marks the interaction deferred, which is
  // what routes replyNotLinked through editReply.
  interaction.deferReply = jest.fn().mockImplementation(async () => {
    interaction.deferred = true;
  });
  return interaction;
}

// The defer must happen before the first backend call, not merely somewhere
// in the function.
function expectDeferredBefore(interaction, apiCall) {
  expect(interaction.deferReply).toHaveBeenCalledWith();
  expect(interaction.deferReply.mock.invocationCallOrder[0])
    .toBeLessThan(apiCall.mock.invocationCallOrder[0]);
}

describe('/card', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before the Scryfall lookup and answers via followUp', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          name: 'Lightning Bolt', oracleText: 'Lightning Bolt deals 3 damage to any target.',
          set: 'Limited Edition Alpha', rarity: 'common', manaCost: '{R}', types: ['Instant'],
          prices: { usd: '1.50', source: 'Scryfall' }, imageUrl: 'https://example.com/bolt.jpg'
        }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ options: { name: 'lightning bolt' } });
    await cardCommand.execute(interaction);

    expectDeferredBefore(interaction, api.get);
    expect(api.get).toHaveBeenCalledWith('/scryfall/search', { params: { name: 'lightning bolt' } });
    expect(interaction.reply).not.toHaveBeenCalled();

    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds[0].title).toBe('Lightning Bolt');
    expect(call.embeds[0].image.url).toBe('https://example.com/bolt.jpg');
    expect(call.embeds[0].fields.some(f => f.name === 'Mana Cost' && f.value === '{R}')).toBe(true);
    expect(call.embeds[0].fields.some(f => f.name === 'Type' && f.value === 'Instant')).toBe(true);
  });

  test('credits the backup price source in the footer when Scryfall had no price', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { name: 'Sol Ring', set: 'Commander 2021', rarity: 'uncommon', prices: { usd: '1.20', source: 'MTGGoldfish (backup)' } }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ options: { name: 'sol ring' } });
    await cardCommand.execute(interaction);

    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds[0].footer.text).toContain('MTGGoldfish (backup)');
  });

  test('follows up with an error message when the card is not found', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 404 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ options: { name: 'Nonexistent Card' } });
    await cardCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Couldn't find a card") })
    );
  });
});

describe('/decks', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before listing decks and answers via followUp', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ name: 'Edgar Markov' }, { name: 'Atraxa' }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await decksCommand.execute(interaction);

    expectDeferredBefore(interaction, api.get);
    expect(api.get).toHaveBeenCalledWith('/decks');
    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds[0].title).toBe('Your Decks');
    expect(call.embeds[0].description).toContain('Edgar Markov');
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('reports not-linked via editReply on 401 (already deferred)', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await decksCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't linked") })
    );
  });

  test('follows up with an empty-collection message when there are no decks', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await decksCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('no decks yet') })
    );
  });
});

describe('/collection', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects an unknown subcommand instantly, without deferring', async () => {
    const interaction = mockInteraction({ subcommand: 'bogus' });
    await collectionCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Unknown subcommand.' })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(client).not.toHaveBeenCalled();
  });

  test('defers before GET /stats and answers via followUp', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { totalCards: 420, totalValue: 1337.5 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ subcommand: 'stats' });
    await collectionCommand.execute(interaction);

    expectDeferredBefore(interaction, api.get);
    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds[0].fields.some(f => f.name === 'Total Cards' && f.value === '420')).toBe(true);
    expect(call.embeds[0].fields.some(f => f.name === 'Total Value' && f.value === '$1337.50')).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('surfaces the deeper stats: colors, types, rarity values, top sets, P&L, ignored value', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          totalCards: 420, uniqueCards: 301, totalValue: 1337.5, ignoredValue: 12.25,
          colorDistribution: { R: 120, U: 90, C: 40 },
          typeDistribution: { Creature: 150, Instant: 60, Land: 38, Sorcery: 40 },
          valueByRarity: { mythic: 800, rare: 400, common: 20.5 },
          valueBySet: { 'Commander 2021': 500, 'Modern Horizons 2': 300 },
          portfolioCost: 1000, portfolioGain: -250
        }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ subcommand: 'stats' });
    await collectionCommand.execute(interaction);

    const fields = interaction.followUp.mock.calls[0][0].embeds[0].fields;
    const byName = (n) => fields.find(f => f.name === n);
    expect(byName('Unique Cards').value).toBe('301');
    expect(byName('Colors').value).toContain('🟥 Red: 120');
    expect(byName('Colors').value).toContain('◆ Colorless: 40');
    expect(byName('Top Types').value).toContain('Creature: 150');
    expect(byName('Value by Rarity').value).toContain('Mythic: $800.00');
    expect(byName('Top Sets by Value').value).toContain('Commander 2021: $500.00');
    expect(byName('Portfolio P&L').value).toContain('-$250.00');
    expect(byName('Portfolio P&L').value).toContain('📉');
    expect(byName('⚠️ Ignored Value').value).toContain('$12.25');
  });
});

describe('/link', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before exchanging the code and confirms via followUp on success', async () => {
    const api = { post: jest.fn().mockResolvedValue({ status: 201 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ options: { code: 'ABC123' } });
    await linkCommand.execute(interaction);

    expectDeferredBefore(interaction, api.post);
    expect(api.post).toHaveBeenCalledWith('/discord/exchange', { code: 'ABC123', discordUserId: 'discord-1' });
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('✅ Linked!') })
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('follows up with the invalid-code message on 400', async () => {
    const api = { post: jest.fn().mockResolvedValue({ status: 400 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ options: { code: 'BAD' } });
    await linkCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('invalid or expired') })
    );
  });
});

describe('/unlink', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers before the backend call and confirms via followUp on success', async () => {
    const api = { delete: jest.fn().mockResolvedValue({ status: 200 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await unlinkCommand.execute(interaction);

    expectDeferredBefore(interaction, api.delete);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('✅ Unlinked') })
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('reports not-linked via editReply on 401 (already deferred)', async () => {
    const api = { delete: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await unlinkCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't linked") })
    );
  });
});

describe('/notifications', () => {
  afterEach(() => jest.clearAllMocks());

  test('list: defers before reading preferences and answers via followUp', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { price_alert: true, trade_offer: false } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ subcommand: 'list' });
    await notificationsCommand.execute(interaction);

    expectDeferredBefore(interaction, api.get);
    const call = interaction.followUp.mock.calls[0][0];
    expect(call.embeds[0].title).toContain('Notification Preferences');
    const pricing = call.embeds[0].fields.find(f => f.name === 'Pricing');
    expect(pricing.value).toContain('✅ Price Alert');
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('toggle: defers before the read-then-write round-trips and confirms the new state', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { price_alert: false } }),
      patch: jest.fn().mockResolvedValue({ status: 200 })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ subcommand: 'toggle', options: { type: 'price_alert' } });
    await notificationsCommand.execute(interaction);

    expectDeferredBefore(interaction, api.get);
    expect(api.patch).toHaveBeenCalledWith('/discord/link/prefs', { price_alert: true });
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('**Price Alert** notifications enabled') })
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test('list: reports not-linked via followUp when the account is not linked', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction({ subcommand: 'list' });
    await notificationsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('/link') })
    );
  });
});
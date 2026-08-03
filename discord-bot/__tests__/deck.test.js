jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const deckCommand = require('../src/commands/deck');

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
    channel: { awaitMessageComponent: jest.fn() },
    deferred: false,
    replied: false
  };
  interaction.deferReply = jest.fn().mockImplementation(async () => { interaction.deferred = true; });
  return interaction;
}

describe('/deck view', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the matched deck\'s format and card count', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ _id: 'd1', name: 'My Commander Deck' }] })
        .mockResolvedValueOnce({ status: 200, data: { name: 'My Commander Deck', format: 'commander', statistics: { totalCards: 100 } } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'My Commander Deck' });
    await deckCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
    expect(api.get).toHaveBeenNthCalledWith(2, '/decks/d1');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('My Commander Deck');
    expect(embed.fields).toEqual([
      { name: 'Format', value: 'commander', inline: true },
      { name: 'Cards', value: '100', inline: true }
    ]);
  });

  test('reports no matching deck', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'Nonexistent' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No deck named') }));
  });

  test('replies via replyNotLinked (editReply, since already deferred) on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'Anything' });
    await deckCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

jest.mock('../src/lib/deckImportSource');
const { detectDeckImportSource } = require('../src/lib/deckImportSource');

describe('/deck import', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects an unrecognized URL without deferring or calling the backend', async () => {
    detectDeckImportSource.mockReturnValue(null);
    const api = { get: jest.fn(), post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://example.com/decks/1' });
    await deckCommand.execute(interaction);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Moxfield') }));
  });

  test('normalizes a bare URL with no scheme before detecting the source and calling the backend', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = {
      post: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: parsedDeck })
        .mockResolvedValueOnce({ status: 201, data: { _id: 'new-deck-1', name: 'Krenko Goblins' } })
    };
    client.mockReturnValue(api);

    const confirmInteraction = { customId: 'deck-import-confirm', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(confirmInteraction);

    await deckCommand.execute(interaction);

    expect(detectDeckImportSource).toHaveBeenCalledWith('https://moxfield.com/decks/abc');
    expect(api.post).toHaveBeenNthCalledWith(1, '/decks/import', { source: 'moxfield', data: 'https://moxfield.com/decks/abc' });
  });

  test('replies via replyNotLinked (editReply, since already deferred) on a 401 from the import/parse call', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const api = { post: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    await deckCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });

  test('surfaces the backend\'s own error message on a non-200 parse response', async () => {
    detectDeckImportSource.mockReturnValue('tappedout');
    const api = { post: jest.fn().mockResolvedValue({ status: 400, data: { message: 'No commander found in deck list' } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://tappedout.net/mtg-decks/my-deck/' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No commander found in deck list') }));
  });

  test('shows a preview with Confirm/Cancel buttons, then Confirm persists the deck', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = {
      deckData: {
        name: 'Krenko Goblins',
        commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] },
        partnerCommander: null,
        mainDeck: []
      },
      statistics: { totalCards: 100 }
    };
    const api = {
      post: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: parsedDeck })
        .mockResolvedValueOnce({ status: 201, data: { _id: 'new-deck-1', name: 'Krenko Goblins' } })
    };
    client.mockReturnValue(api);

    const confirmInteraction = { customId: 'deck-import-confirm', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(confirmInteraction);

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenNthCalledWith(1, '/decks/import', { source: 'moxfield', data: 'https://moxfield.com/decks/abc' });
    const previewCall = interaction.followUp.mock.calls[0][0];
    expect(previewCall.embeds[0].title).toBe('Krenko Goblins');
    expect(previewCall.components[0].components).toHaveLength(2);

    expect(api.post).toHaveBeenNthCalledWith(2, '/decks', expect.objectContaining({ name: 'Krenko Goblins', statistics: { totalCards: 100 } }));
    expect(confirmInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Krenko Goblins'), components: [] }));
  });

  test('Cancel does not persist anything', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = { post: jest.fn().mockResolvedValue({ status: 200, data: parsedDeck }) };
    client.mockReturnValue(api);

    const cancelInteraction = { customId: 'deck-import-cancel', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(cancelInteraction);

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(cancelInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('cancelled'), components: [] }));
  });

  test('a timeout reports nothing was saved', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = { post: jest.fn().mockResolvedValue({ status: 200, data: parsedDeck }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('timed out') }));
  });

  test('a 401 on the confirm persist step clears the buttons and replies via replyNotLinked (editReply)', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = {
      post: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: parsedDeck })
        .mockResolvedValueOnce({ status: 401 })
    };
    client.mockReturnValue(api);

    const confirmInteraction = { customId: 'deck-import-confirm', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(confirmInteraction);

    await deckCommand.execute(interaction);

    expect(confirmInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

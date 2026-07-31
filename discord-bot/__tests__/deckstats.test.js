jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const deckstatsCommand = require('../src/commands/deckstats');

function mockInteraction(name) {
  // Mirrors real discord.js: once deferReply() resolves, interaction.deferred
  // is true, which replyNotLinked() (see src/lib/notLinked.js) relies on to
  // decide between reply() and editReply(). editReply is aliased to the same
  // jest.fn as followUp here since, from the test's perspective, both are
  // just "the user-visible response after deferral" - this lets assertions
  // on `followUp` catch either call without this test needing to know which
  // one a given code path happens to use.
  const followUp = jest.fn().mockResolvedValue(undefined);
  return {
    user: { id: 'discord-1' },
    options: { getString: jest.fn().mockReturnValue(name) },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp
  };
}

describe('/deckstats', () => {
  afterEach(() => jest.clearAllMocks());

  test('resolves the deck by name and shows power level and salt score', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ _id: 'deck-1', name: 'Edgar Markov' }] }) // /decks
        .mockResolvedValueOnce({
          status: 200,
          data: { powerLevel: { level: 7, breakdown: {} }, saltScore: { score: 8, cards: [{ name: 'Rhystic Study', salt: 2 }] } }
        }) // /decks/:id/stats
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('edgar markov');
    await deckstatsCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
    expect(api.get).toHaveBeenNthCalledWith(2, '/decks/deck-1/stats');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Edgar Markov — Power & Salt');
    expect(embed.fields.find(f => f.name === 'Power Level').value).toBe('7/10');
    expect(embed.fields.find(f => f.name === 'Salt Score').value).toBe('8');
    expect(embed.fields.find(f => f.name === 'Salty Cards').value).toContain('Rhystic Study');
  });

  test('reports no match for an unknown deck name', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('Nonexistent Deck');
    await deckstatsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('No deck named')
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('Edgar Markov');
    await deckstatsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});

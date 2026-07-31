jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const { resolveCard } = require('../src/lib/resolveCard');
const synergyCommand = require('../src/commands/synergy');

function mockInteraction() {
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
    options: { getString: jest.fn().mockReturnValue('Goblin Chieftain') },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp
  };
}

describe('/synergy', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers, resolves the card, and shows tribal/keywords/mechanics fields', async () => {
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Goblin Chieftain' } });
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { tribal: [{ name: 'Goblin Warchief' }], keywords: [], mechanics: [] }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await synergyCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/cards/card-1/synergies');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Synergies for Goblin Chieftain');
    const tribalField = embed.fields.find(f => f.name === 'Tribal');
    expect(tribalField.value).toContain('Goblin Warchief');
    const keywordsField = embed.fields.find(f => f.name === 'Keywords');
    expect(keywordsField.value).toBe('None found');
  });

  test('replies not-linked when resolveCard reports not_linked', async () => {
    resolveCard.mockResolvedValue({ status: 'not_linked' });
    const interaction = mockInteraction();
    await synergyCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});

jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const { resolveCard } = require('../src/lib/resolveCard');
const similarCommand = require('../src/commands/similar');

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
    options: { getString: jest.fn().mockReturnValue('Grizzly Bears') },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp
  };
}

describe('/similar', () => {
  afterEach(() => jest.clearAllMocks());

  test('defers, resolves the card, and shows similar cards in an embed', async () => {
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Grizzly Bears' } });
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Runeclaw Bear', prices: { usd: '0.10' } }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await similarCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(api.get).toHaveBeenCalledWith('/cards/card-1/similar');
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Similar to Grizzly Bears' })]
    }));
  });

  test('replies not-linked when resolveCard reports not_linked', async () => {
    resolveCard.mockResolvedValue({ status: 'not_linked' });
    const interaction = mockInteraction();
    await similarCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });

  test('shows a no-match message when resolveCard finds nothing', async () => {
    resolveCard.mockResolvedValue({ status: 'no_match' });
    const interaction = mockInteraction();
    await similarCommand.execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("Couldn't find")
    }));
  });
});

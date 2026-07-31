jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const setsCommand = require('../src/commands/sets');

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
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp
  };
}

describe('/sets', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the top 10 sets by completion percentage', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ setCode: 'LEB', setName: 'Limited Edition Beta', ownedUnique: 2, totalInSet: 10, totalOwned: 3 }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await setsCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/sets/completion');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Set Completion');
    expect(embed.fields[0].value).toContain('2/10');
    expect(embed.fields[0].value).toContain('20%');
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await setsCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});

jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const commanderCommand = require('../src/commands/commander');

function mockInteraction(colors = null) {
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
    options: { getString: jest.fn().mockReturnValue(colors) },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp
  };
}

describe('/commander', () => {
  afterEach(() => jest.clearAllMocks());

  test('calls /commanders/recommend with no colors param when none given', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'The Ur-Dragon', prices: { usd: '5.00' } }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(null);
    await commanderCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/commanders/recommend', { params: {} });
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Commander Recommendations' })]
    }));
  });

  test('passes the colors argument through as a query param when given', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('UB');
    await commanderCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/commanders/recommend', { params: { colors: 'UB' } });
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction(null);
    await commanderCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});

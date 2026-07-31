jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const locationCommand = require('../src/commands/location');

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

describe('/location', () => {
  afterEach(() => jest.clearAllMocks());

  test('lists cards at the single matching location', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Box 2' }] }) // /locations
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Sol Ring', quantity: 1, location: 'Binder 1' },
          { name: 'Forest', quantity: 4, location: 'Box 2' }
        ] }) // /cards
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder 1');
    await locationCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/locations');
    expect(api.get).toHaveBeenNthCalledWith(2, '/cards');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('Binder 1');
    expect(embed.description).toContain('Sol Ring x1');
    expect(embed.description).not.toContain('Forest');
  });

  test('lists available locations when no location matches', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Box 2' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('nonexistent');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Binder 1')
    }));
  });

  test('asks for a more specific name when multiple locations match', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Binder 1' }, { name: 'Binder 2' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Multiple locations match')
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('binder 1');
    await locationCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});

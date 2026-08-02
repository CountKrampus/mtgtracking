jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const achievementsCommand = require('../src/commands/achievements');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/achievements', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows only earned achievements with an X/Y earned count', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { id: 'a1', name: 'First Card', desc: 'Add your first card', icon: '🎴', earned: true, earnedAt: '2026-01-01' },
          { id: 'a2', name: 'Big Spender', desc: 'Spend $100', icon: '💰', earned: false, earnedAt: null },
          { id: 'a3', name: 'Set Master', desc: 'Complete a set', icon: '🏆', earned: true, earnedAt: '2026-02-01' }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/achievements');
    expect(interaction.deferReply).not.toHaveBeenCalled();

    const call = interaction.reply.mock.calls[0][0];
    expect(call.ephemeral).toBe(true);
    const embed = call.embeds[0];
    expect(embed.title).toBe('Achievements (2/3)');
    expect(embed.description).toContain('🎴 **First Card**');
    expect(embed.description).toContain('🏆 **Set Master**');
    expect(embed.description).not.toContain('Big Spender');
  });

  test('replies with a plain ephemeral message when none are earned', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { id: 'a1', name: 'First Card', desc: 'Add your first card', icon: '🎴', earned: false, earnedAt: null }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("haven't earned any achievements yet"), ephemeral: true })
    );
    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds).toBeUndefined();
  });

  test('replies via replyNotLinked on a 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('link') })
    );
  });

  test('replies with a generic error message on a non-200/401 status', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 500, data: null }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('500'), ephemeral: true })
    );
  });
});

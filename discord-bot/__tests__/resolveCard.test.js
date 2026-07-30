const { resolveCard } = require('../src/lib/resolveCard');

function mockApi(cards, status = 200) {
  return { get: jest.fn().mockResolvedValue({ status, data: cards }) };
}

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    followUp: jest.fn().mockResolvedValue(undefined),
    channel: { awaitMessageComponent: jest.fn() }
  };
}

describe('resolveCard', () => {
  test('returns not_linked on a 401', async () => {
    const api = mockApi([], 401);
    const result = await resolveCard(mockInteraction(), api, 'Sol Ring');
    expect(result.status).toBe('not_linked');
  });

  test('returns no_match when nothing matches', async () => {
    const api = mockApi([{ _id: '1', name: 'Lightning Bolt', set: 'M10', condition: 'NM' }]);
    const result = await resolveCard(mockInteraction(), api, 'Sol Ring');
    expect(result.status).toBe('no_match');
  });

  test('returns the single match directly without prompting', async () => {
    const api = mockApi([{ _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' }]);
    const interaction = mockInteraction();
    const result = await resolveCard(interaction, api, 'sol ring');
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('1');
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  test('is case-insensitive and matches substrings', async () => {
    const api = mockApi([{ _id: '1', name: "Urza's Saga", set: 'MH2', condition: 'NM' }]);
    const result = await resolveCard(mockInteraction(), api, 'urza');
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('1');
  });

  test('prompts for disambiguation with multiple matches and returns the picked card', async () => {
    const cards = [
      { _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' },
      { _id: '2', name: 'Sol Ring', set: 'CMR', condition: 'LP' }
    ];
    const api = mockApi(cards);
    const interaction = mockInteraction();
    interaction.channel.awaitMessageComponent.mockResolvedValue({
      values: ['2'],
      update: jest.fn().mockResolvedValue(undefined)
    });

    const result = await resolveCard(interaction, api, 'Sol Ring');
    expect(interaction.followUp).toHaveBeenCalled();
    expect(result.status).toBe('found');
    expect(result.card._id).toBe('2');
  });

  test('returns timed_out if the user never picks', async () => {
    const cards = [
      { _id: '1', name: 'Sol Ring', set: 'C21', condition: 'NM' },
      { _id: '2', name: 'Sol Ring', set: 'CMR', condition: 'LP' }
    ];
    const api = mockApi(cards);
    const interaction = mockInteraction();
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    const result = await resolveCard(interaction, api, 'Sol Ring');
    expect(result.status).toBe('timed_out');
  });
});

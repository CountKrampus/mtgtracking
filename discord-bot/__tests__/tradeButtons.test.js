jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const { handleTradeButton } = require('../src/tradeButtons');

function mockButtonInteraction(customId) {
  return {
    user: { id: 'discord-1' },
    customId,
    update: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false
  };
}

describe('handleTradeButton', () => {
  afterEach(() => jest.clearAllMocks());

  test('trade-accept: calls the accept endpoint and updates the message', async () => {
    const api = { put: jest.fn().mockResolvedValue({ status: 200, data: { message: 'Offer accepted' } }) };
    client.mockReturnValue(api);

    const interaction = mockButtonInteraction('trade-accept:offer-1');
    await handleTradeButton(interaction);

    expect(api.put).toHaveBeenCalledWith('/trades/offers/offer-1/accept');
    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Accepted'),
      embeds: [],
      components: []
    }));
  });

  test('trade-reject: calls the reject endpoint and updates the message', async () => {
    const api = { put: jest.fn().mockResolvedValue({ status: 200, data: { message: 'Offer rejected' } }) };
    client.mockReturnValue(api);

    const interaction = mockButtonInteraction('trade-reject:offer-2');
    await handleTradeButton(interaction);

    expect(api.put).toHaveBeenCalledWith('/trades/offers/offer-2/reject');
    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Rejected') }));
  });

  test('trade-cancel: calls the cancel endpoint and updates the message', async () => {
    const api = { put: jest.fn().mockResolvedValue({ status: 200, data: { message: 'cancelled' } }) };
    client.mockReturnValue(api);

    const interaction = mockButtonInteraction('trade-cancel:offer-3');
    await handleTradeButton(interaction);

    expect(api.put).toHaveBeenCalledWith('/trades/offers/offer-3/cancel');
    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Cancelled') }));
  });

  test('surfaces a backend error (e.g. already-actioned offer) without crashing', async () => {
    const api = { put: jest.fn().mockResolvedValue({ status: 400, data: { message: 'Offer is no longer pending' } }) };
    client.mockReturnValue(api);

    const interaction = mockButtonInteraction('trade-accept:offer-4');
    await handleTradeButton(interaction);

    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Offer is no longer pending'),
      embeds: []
    }));
  });

  test('surfaces a not-linked message on 401 without crashing', async () => {
    const api = { put: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockButtonInteraction('trade-accept:offer-5');
    await handleTradeButton(interaction);

    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});

jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const addCommand = require('../src/commands/add');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    options: {
      getInteger: jest.fn().mockReturnValue(1),
      getString: jest.fn().mockReturnValue('Ambush Viper')
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/add', () => {
  afterEach(() => jest.clearAllMocks());

  test('merges with an existing card by name, bumping its quantity, instead of creating a duplicate', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'card-1', name: 'Ambush Viper', quantity: 3 }]
      }),
      put: jest.fn().mockResolvedValue({ status: 200, data: { quantity: 4 } }),
      post: jest.fn()
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await addCommand.execute(interaction);

    expect(api.put).toHaveBeenCalledWith('/cards/card-1', { quantity: 4 });
    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('New quantity: 4') })
    );
  });

  test('creates a new card when no existing card matches the name', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: [] }),
      put: jest.fn(),
      post: jest.fn().mockResolvedValue({ status: 201, data: { name: 'Ambush Viper' } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await addCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledWith('/cards', { name: 'Ambush Viper', quantity: 1, condition: 'NM' });
    expect(api.put).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Added 1x') })
    );
  });

  test('matches an existing card case-insensitively', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'card-2', name: 'AMBUSH VIPER', quantity: 2 }]
      }),
      put: jest.fn().mockResolvedValue({ status: 200, data: { quantity: 3 } }),
      post: jest.fn()
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await addCommand.execute(interaction);

    expect(api.put).toHaveBeenCalledWith('/cards/card-2', { quantity: 3 });
  });

  test('defers before making any backend calls', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: [] }),
      put: jest.fn(),
      post: jest.fn().mockResolvedValue({ status: 201, data: { name: 'Ambush Viper' } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await addCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });
});

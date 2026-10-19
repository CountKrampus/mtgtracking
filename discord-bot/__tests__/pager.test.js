const { paginate, sendPaginated, PAGE_BUTTON_IDS } = require('../src/lib/pager');

function mockInteraction() {
  const message = { edit: jest.fn().mockResolvedValue(undefined) };
  return {
    message,
    interaction: {
      user: { id: 'discord-1' },
      followUp: jest.fn().mockResolvedValue(message),
      channel: { awaitMessageComponent: jest.fn() }
    }
  };
}

function button(customId) {
  return { customId, update: jest.fn().mockResolvedValue(undefined) };
}

describe('paginate', () => {
  test('splits items into full pages plus a remainder page', () => {
    const items = Array.from({ length: 25 }, (_, i) => `L${i}`);
    const pages = paginate(items, 10);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(10);
    expect(pages[1][0]).toBe('L10');
    expect(pages[2]).toHaveLength(5);
  });

  test('an empty list yields no pages', () => {
    expect(paginate([], 10)).toEqual([]);
  });
});

describe('sendPaginated', () => {
  afterEach(() => jest.clearAllMocks());

  test('a single page is posted with no components key at all', async () => {
    const { interaction } = mockInteraction();

    await sendPaginated(interaction, {
      title: 'T', color: 0x123456, lines: ['a', 'b'], footerExtra: '2 items'
    });

    expect(interaction.followUp).toHaveBeenCalledTimes(1);
    const payload = interaction.followUp.mock.calls[0][0];
    expect(payload.components).toBeUndefined();
    expect(payload.embeds[0].description).toBe('a\nb');
    expect(payload.embeds[0].color).toBe(0x123456);
    expect(payload.embeds[0].footer.text).toBe('Page 1/1 · 2 items');
    expect(interaction.channel.awaitMessageComponent).not.toHaveBeenCalled();
  });

  test('multiple pages post Prev/Next buttons; Next moves to page 2; timeout strips the buttons', async () => {
    const { interaction, message } = mockInteraction();
    const nextButton = button(PAGE_BUTTON_IDS.next);
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(nextButton)
      .mockRejectedValueOnce(new Error('timeout'));

    const lines = Array.from({ length: 25 }, (_, i) => `L${i}`);
    await sendPaginated(interaction, { title: 'T', color: 1, lines, footerExtra: '25 items' });

    // First page: Prev disabled, Next enabled.
    const first = interaction.followUp.mock.calls[0][0];
    expect(first.embeds[0].footer.text).toBe('Page 1/3 · 25 items');
    expect(first.components[0].components.map(b => b.data.disabled)).toEqual([true, false]);

    // Page 2 content was pushed into the same message via update().
    expect(nextButton.update).toHaveBeenCalledTimes(1);
    const updated = nextButton.update.mock.calls[0][0];
    expect(updated.embeds[0].description).toContain('L10');
    expect(updated.embeds[0].footer.text).toContain('Page 2/3');
    // Prev is now enabled, Next still enabled.
    expect(updated.components[0].components.map(b => b.data.disabled)).toEqual([false, false]);

    // The timeout on the second await stripped the dead buttons.
    expect(message.edit).toHaveBeenCalledWith({ components: [] });
  });

  test('clamps page movement: Prev on page 1 stays on page 1', async () => {
    const { interaction } = mockInteraction();
    const prevButton = button(PAGE_BUTTON_IDS.prev);
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(prevButton)
      .mockRejectedValueOnce(new Error('timeout'));

    const lines = Array.from({ length: 15 }, (_, i) => `L${i}`);
    await sendPaginated(interaction, { title: 'T', color: 1, lines });

    const updated = prevButton.update.mock.calls[0][0];
    expect(updated.embeds[0].footer.text).toContain('Page 1/2');
  });

  test('supports server-side paging via pageCount + loadLines, calling loadLines per rendered page', async () => {
    const { interaction } = mockInteraction();
    const nextButton = button(PAGE_BUTTON_IDS.next);
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(nextButton)
      .mockRejectedValueOnce(new Error('timeout'));

    const loadLines = jest.fn().mockImplementation(async (page) => [`server page ${page}`]);
    await sendPaginated(interaction, {
      title: 'T', color: 1, pageCount: 4, loadLines, footerExtra: '40 matches'
    });

    expect(loadLines).toHaveBeenCalledWith(0);
    expect(loadLines).toHaveBeenCalledWith(1);
    expect(interaction.followUp.mock.calls[0][0].embeds[0].description).toBe('server page 0');
    expect(nextButton.update.mock.calls[0][0].embeds[0].description).toBe('server page 1');
    // Next is still enabled on page 2 of 4.
    expect(nextButton.update.mock.calls[0][0].components[0].components.map(b => b.data.disabled))
      .toEqual([false, false]);
  });

  test('throws when neither lines nor pageCount + loadLines are given', async () => {
    const { interaction } = mockInteraction();
    await expect(sendPaginated(interaction, { title: 'T', color: 1 })).rejects.toThrow(/requires either lines/);
  });
});
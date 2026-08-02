const {
  PAGE_SIZE,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions
} = require('../src/lib/collectionBrowser');
const { buildBrowserRows } = require('../src/lib/collectionBrowser');
const { browseCollection } = require('../src/lib/collectionBrowser');

const CARDS = [
  { _id: '1', name: 'Sol Ring', set: 'Commander 2021', condition: 'NM', colors: [], types: ['Artifact'] },
  { _id: '2', name: 'Llanowar Elves', set: 'M19', condition: 'NM', colors: ['G'], types: ['Creature'] },
  { _id: '3', name: 'Counterspell', set: 'M19', condition: 'LP', colors: ['U'], types: ['Instant'] },
  { _id: '4', name: 'Boros Charm', set: 'M19', condition: 'NM', colors: ['R', 'W'], types: ['Instant'] }
];

describe('filterCards', () => {
  test('no filters returns everything', () => {
    expect(filterCards(CARDS, { set: null, type: null, colors: new Set() })).toHaveLength(4);
  });

  test('filters by set', () => {
    const result = filterCards(CARDS, { set: 'M19', type: null, colors: new Set() });
    expect(result.map(c => c.name)).toEqual(['Llanowar Elves', 'Counterspell', 'Boros Charm']);
  });

  test('filters by type', () => {
    const result = filterCards(CARDS, { set: null, type: 'Instant', colors: new Set() });
    expect(result.map(c => c.name)).toEqual(['Counterspell', 'Boros Charm']);
  });

  test('filters by a single color', () => {
    const result = filterCards(CARDS, { set: null, type: null, colors: new Set(['G']) });
    expect(result.map(c => c.name)).toEqual(['Llanowar Elves']);
  });

  test('ORs multiple active colors together', () => {
    const result = filterCards(CARDS, { set: null, type: null, colors: new Set(['G', 'U']) });
    expect(result.map(c => c.name)).toEqual(['Llanowar Elves', 'Counterspell']);
  });

  test('colorless matches only cards with an empty colors array', () => {
    const result = filterCards(CARDS, { set: null, type: null, colors: new Set(['C']) });
    expect(result.map(c => c.name)).toEqual(['Sol Ring']);
  });

  test('colorless OR a color combine correctly', () => {
    const result = filterCards(CARDS, { set: null, type: null, colors: new Set(['C', 'R']) });
    expect(result.map(c => c.name)).toEqual(['Sol Ring', 'Boros Charm']);
  });

  test('set AND type AND color all apply together', () => {
    const result = filterCards(CARDS, { set: 'M19', type: 'Instant', colors: new Set(['U']) });
    expect(result.map(c => c.name)).toEqual(['Counterspell']);
  });
});

describe('paginate', () => {
  test('returns the requested page slice', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ _id: String(i), name: `Card ${i}` }));
    expect(paginate(many, 0)).toHaveLength(PAGE_SIZE);
    expect(paginate(many, 0)[0].name).toBe('Card 0');
    expect(paginate(many, 1)[0].name).toBe(`Card ${PAGE_SIZE}`);
    expect(paginate(many, 2)).toHaveLength(60 - PAGE_SIZE * 2);
  });
});

describe('buildSetOptions', () => {
  test('pins "All Sets" first, then unique sets sorted, current selection marked default', () => {
    const options = buildSetOptions(CARDS, 'M19');
    expect(options[0]).toEqual({ label: 'All Sets', value: '', default: false });
    const m19 = options.find(o => o.value === 'M19');
    expect(m19.default).toBe(true);
    expect(options.map(o => o.value)).toEqual(['', 'Commander 2021', 'M19']);
  });

  test('marks "All Sets" as default when no set is selected', () => {
    const options = buildSetOptions(CARDS, null);
    expect(options[0].default).toBe(true);
  });
});

describe('buildTypeOptions', () => {
  test('pins "All Types" first, then unique types sorted', () => {
    const options = buildTypeOptions(CARDS, null);
    expect(options.map(o => o.value)).toEqual(['', 'Artifact', 'Creature', 'Instant']);
  });
});

describe('buildCardOptions', () => {
  test('builds one option per card', () => {
    const options = buildCardOptions([CARDS[0], CARDS[1]]);
    expect(options).toEqual([
      { label: 'Sol Ring (Commander 2021, NM)', value: '1' },
      { label: 'Llanowar Elves (M19, NM)', value: '2' }
    ]);
  });

  test('returns a single disabled placeholder option when the page is empty', () => {
    expect(buildCardOptions([])).toEqual([{ label: 'No matching cards', value: '__none__' }]);
  });
});

describe('buildBrowserRows', () => {
  test('builds exactly 5 rows: set, type, colors, controls, card select', () => {
    const state = { set: null, type: null, colors: new Set(), page: 0 };
    const { rows } = buildBrowserRows(CARDS, state);
    expect(rows).toHaveLength(5);
  });

  test('color buttons render Success when active, Secondary when inactive', () => {
    const state = { set: null, type: null, colors: new Set(['G']), page: 0 };
    const { rows } = buildBrowserRows(CARDS, state);
    const colorRow = rows[2].toJSON();
    const gButton = colorRow.components.find(b => b.custom_id === 'browse-color:G');
    const uButton = colorRow.components.find(b => b.custom_id === 'browse-color:U');
    expect(gButton.style).toBe(3); // ButtonStyle.Success
    expect(uButton.style).toBe(2); // ButtonStyle.Secondary
  });

  test('Prev is disabled on page 0, Next is disabled on the last page', () => {
    const state = { set: null, type: null, colors: new Set(), page: 0 };
    const { rows } = buildBrowserRows(CARDS, state);
    const controlsRow = rows[3].toJSON();
    const prev = controlsRow.components.find(b => b.custom_id === 'browse-prev');
    const next = controlsRow.components.find(b => b.custom_id === 'browse-next');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true); // only 4 cards, fits on page 0
  });

  test('card select is disabled with a placeholder when the filtered page is empty', () => {
    const state = { set: 'Nonexistent Set', type: null, colors: new Set(), page: 0 };
    const { rows, filtered } = buildBrowserRows(CARDS, state);
    expect(filtered).toHaveLength(0);
    const cardSelect = rows[4].toJSON().components[0];
    expect(cardSelect.disabled).toBe(true);
    expect(cardSelect.options).toEqual([{ label: 'No matching cards', value: '__none__' }]);
  });

  test('card select lists the current page of filtered results', () => {
    const state = { set: 'M19', type: null, colors: new Set(), page: 0 };
    const { rows, pageCards } = buildBrowserRows(CARDS, state);
    expect(pageCards.map(c => c.name)).toEqual(['Llanowar Elves', 'Counterspell', 'Boros Charm']);
    const cardSelect = rows[4].toJSON().components[0];
    expect(cardSelect.options.map(o => o.value)).toEqual(['2', '3', '4']);
  });
});

function mockBrowseInteraction() {
  return {
    user: { id: 'discord-1' },
    followUp: jest.fn().mockResolvedValue(undefined),
    channel: { awaitMessageComponent: jest.fn() }
  };
}

describe('browseCollection', () => {
  afterEach(() => jest.clearAllMocks());

  test('not_linked when GET /cards returns 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    const interaction = mockBrowseInteraction();

    const result = await browseCollection(interaction, api);
    expect(result).toEqual({ status: 'not_linked' });
  });

  test('error when GET /cards returns a non-200/401 status', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 500 }) };
    const interaction = mockBrowseInteraction();

    const result = await browseCollection(interaction, api);
    expect(result).toEqual({ status: 'error', httpStatus: 500 });
  });

  test('no_cards when the collection is empty', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    const interaction = mockBrowseInteraction();

    const result = await browseCollection(interaction, api);
    expect(result).toEqual({ status: 'no_cards' });
  });

  test('posts the initial browser UI, then a set filter narrows results, then a card is selected', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const setSelectInteraction = {
      customId: 'browse-set-select',
      values: ['M19'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['3'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(setSelectInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array), ephemeral: true }));
    expect(setSelectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(cardSelectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Counterspell'), components: [] }));
    expect(result).toEqual({ status: 'found', card: CARDS[2] });
  });

  test('a color button toggle also re-renders before a final selection', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const colorToggleInteraction = {
      customId: 'browse-color:G',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['2'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(colorToggleInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(colorToggleInteraction.update).toHaveBeenCalled();
    expect(result).toEqual({ status: 'found', card: CARDS[1] });
  });

  test('selecting "All Sets" (the __all__ sentinel) resets the set filter back to unfiltered', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const setSelectInteraction = {
      customId: 'browse-set-select',
      values: ['__all__'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['1'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(setSelectInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    // After resetting to "All Sets", all 4 cards should still be selectable - confirm the
    // update call after the reset shows an undisabled card select (i.e. results weren't
    // reduced to zero), by checking the eventually-selected card resolves correctly.
    expect(result).toEqual({ status: 'found', card: CARDS[0] });
  });

  test('a type-select interaction narrows to matching types before a final selection', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const typeSelectInteraction = {
      customId: 'browse-type-select',
      values: ['Instant'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['4'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(typeSelectInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(typeSelectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(result).toEqual({ status: 'found', card: CARDS[3] });
  });

  test('browse-color-reset clears an active color filter, widening results back out', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const colorToggleInteraction = {
      customId: 'browse-color:G',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const colorResetInteraction = {
      customId: 'browse-color-reset',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['1'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(colorToggleInteraction)
      .mockResolvedValueOnce(colorResetInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(colorResetInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    // Sol Ring doesn't match the G filter, so its selection only succeeds if the reset
    // actually widened the results back out.
    expect(result).toEqual({ status: 'found', card: CARDS[0] });
  });

  test('browse-next advances to the next page of a collection larger than one page', async () => {
    const manyCards = Array.from({ length: 30 }, (_, i) => ({
      _id: String(i),
      name: `Card ${i}`,
      set: 'TestSet',
      condition: 'NM',
      colors: [],
      types: ['Land']
    }));
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: manyCards }) };
    const interaction = mockBrowseInteraction();

    const nextInteraction = {
      customId: 'browse-next',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['25'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(nextInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(nextInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(result).toEqual({ status: 'found', card: manyCards[25] });
  });

  test('browse-prev moves back a page after a next', async () => {
    const manyCards = Array.from({ length: 30 }, (_, i) => ({
      _id: String(i),
      name: `Card ${i}`,
      set: 'TestSet',
      condition: 'NM',
      colors: [],
      types: ['Land']
    }));
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: manyCards }) };
    const interaction = mockBrowseInteraction();

    const nextInteraction = {
      customId: 'browse-next',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const prevInteraction = {
      customId: 'browse-prev',
      values: [],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['0'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(nextInteraction)
      .mockResolvedValueOnce(prevInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(prevInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(result).toEqual({ status: 'found', card: manyCards[0] });
  });

  test('selecting the disabled "__none__" placeholder takes the early-continue branch and the loop keeps going', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();

    const noneInteraction = {
      customId: 'browse-card-select',
      values: ['__none__'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const cardSelectInteraction = {
      customId: 'browse-card-select',
      values: ['1'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    interaction.channel.awaitMessageComponent
      .mockResolvedValueOnce(noneInteraction)
      .mockResolvedValueOnce(cardSelectInteraction);

    const result = await browseCollection(interaction, api);
    expect(noneInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(cardSelectInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Sol Ring'), components: [] }));
    expect(result).toEqual({ status: 'found', card: CARDS[0] });
  });

  test('times out if no selection is made within the window', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    const result = await browseCollection(interaction, api);
    expect(result).toEqual({ status: 'timed_out' });
  });
});

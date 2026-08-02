const {
  PAGE_SIZE,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions
} = require('../src/lib/collectionBrowser');
const { buildBrowserRows } = require('../src/lib/collectionBrowser');

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

# /trades create Collection Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/trades create type:have` open an interactive, paginated, filterable (set/color/type) browser of the caller's own collection when `card` is left blank, while the existing typed-name fast path (`resolveCard`) keeps working unchanged when a name is given.

**Architecture:** A new `discord-bot/src/lib/collectionBrowser.js` module holds (a) pure, easily-unit-tested filtering/option-building functions, and (b) `browseCollection(interaction, api)` — an interactive loop mirroring `resolveCard.js`'s return-shape convention (`{status: 'found'|'not_linked'|'error'|'timed_out'|'no_cards', ...}`). `discord-bot/src/commands/trades.js`'s `create()` calls it only when `type:have` and no `card` name was given; `registerCommands.js` makes `card` optional and validates it's still required for `type:want`.

**Tech Stack:** discord.js v14 (`StringSelectMenuBuilder`, `ButtonBuilder`, `ActionRowBuilder`), Jest.

---

## Task 1: Pure filtering and option-building helpers

**Files:**
- Create: `discord-bot/src/lib/collectionBrowser.js`
- Test: `discord-bot/__tests__/collectionBrowser.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/collectionBrowser.test.js
const {
  PAGE_SIZE,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions
} = require('../src/lib/collectionBrowser');

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: FAIL with "Cannot find module '../src/lib/collectionBrowser'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/lib/collectionBrowser.js
const PAGE_SIZE = 25;
const COLORS = ['W', 'U', 'B', 'R', 'G'];

function filterCards(cards, { set, type, colors }) {
  return cards.filter(c => {
    if (set && c.set !== set) return false;
    if (type && !(c.types || []).includes(type)) return false;
    if (colors && colors.size > 0) {
      const cardColors = c.colors || [];
      const matchesColor = cardColors.some(col => colors.has(col));
      const matchesColorless = colors.has('C') && cardColors.length === 0;
      if (!matchesColor && !matchesColorless) return false;
    }
    return true;
  });
}

function paginate(filtered, page) {
  const start = page * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

function buildSetOptions(cards, selectedSet) {
  const uniqueSets = [...new Set(cards.map(c => c.set).filter(Boolean))].sort();
  const options = [{ label: 'All Sets', value: '', default: !selectedSet }];
  for (const set of uniqueSets.slice(0, 24)) {
    options.push({ label: set.slice(0, 100), value: set, default: set === selectedSet });
  }
  return options;
}

function buildTypeOptions(cards, selectedType) {
  const uniqueTypes = [...new Set(cards.flatMap(c => c.types || []))].sort();
  const options = [{ label: 'All Types', value: '', default: !selectedType }];
  for (const type of uniqueTypes.slice(0, 24)) {
    options.push({ label: type.slice(0, 100), value: type, default: type === selectedType });
  }
  return options;
}

function buildCardOptions(pageCards) {
  if (pageCards.length === 0) {
    return [{ label: 'No matching cards', value: '__none__' }];
  }
  return pageCards.map(c => ({
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
    value: c._id
  }));
}

module.exports = {
  PAGE_SIZE,
  COLORS,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: PASS (13 tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/lib/collectionBrowser.js discord-bot/__tests__/collectionBrowser.test.js
git commit -m "feat: add pure filtering/option-building helpers for the collection browser"
```

---

## Task 2: Component-row assembly (`buildBrowserRows`)

**Files:**
- Modify: `discord-bot/src/lib/collectionBrowser.js`
- Modify: `discord-bot/__tests__/collectionBrowser.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `discord-bot/__tests__/collectionBrowser.test.js`:

```js
const { buildBrowserRows } = require('../src/lib/collectionBrowser');

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: FAIL — `buildBrowserRows` is not exported.

- [ ] **Step 3: Implement**

Add to `discord-bot/src/lib/collectionBrowser.js`:

```js
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
```
(add this require at the top of the file)

```js
function buildBrowserRows(cards, state) {
  const filtered = filterCards(cards, state);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageCards = paginate(filtered, state.page);

  const setRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-set-select')
      .setPlaceholder(state.set || 'All Sets')
      .addOptions(buildSetOptions(cards, state.set))
  );

  const typeRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-type-select')
      .setPlaceholder(state.type || 'All Types')
      .addOptions(buildTypeOptions(cards, state.type))
  );

  const colorRow = new ActionRowBuilder().addComponents(
    ...COLORS.map(color =>
      new ButtonBuilder()
        .setCustomId(`browse-color:${color}`)
        .setLabel(color)
        .setStyle(state.colors.has(color) ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );

  const controlsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('browse-color:C')
      .setLabel('Colorless')
      .setStyle(state.colors.has('C') ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('browse-color-reset')
      .setLabel('All Colors')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('browse-prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.page === 0),
    new ButtonBuilder()
      .setCustomId('browse-next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.page >= totalPages - 1)
  );

  const cardRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-card-select')
      .setPlaceholder(pageCards.length === 0 ? 'No matching cards' : 'Select a card to list')
      .setDisabled(pageCards.length === 0)
      .addOptions(buildCardOptions(pageCards))
  );

  return { rows: [setRow, typeRow, colorRow, controlsRow, cardRow], filtered, pageCards, totalPages };
}
```

Add `buildBrowserRows` to the `module.exports` object at the bottom of the file.

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: PASS (18 tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/lib/collectionBrowser.js discord-bot/__tests__/collectionBrowser.test.js
git commit -m "feat: assemble the 5-row collection browser component layout"
```

---

## Task 3: The interactive loop (`browseCollection`)

**Files:**
- Modify: `discord-bot/src/lib/collectionBrowser.js`
- Modify: `discord-bot/__tests__/collectionBrowser.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `discord-bot/__tests__/collectionBrowser.test.js`:

```js
const { browseCollection } = require('../src/lib/collectionBrowser');

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

  test('times out if no selection is made within the window', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: CARDS }) };
    const interaction = mockBrowseInteraction();
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    const result = await browseCollection(interaction, api);
    expect(result).toEqual({ status: 'timed_out' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: FAIL — `browseCollection` is not exported.

- [ ] **Step 3: Implement**

Add to the top imports of `discord-bot/src/lib/collectionBrowser.js`:

```js
const { ComponentType } = require('discord.js');
```
(only needed if referenced — this implementation below doesn't restrict `componentType` in the filter, since both buttons and a select fire on the same message; `ComponentType` isn't actually required — skip this import unless you use it elsewhere in the file.)

Add the function:

```js
async function browseCollection(interaction, api) {
  const res = await api.get('/cards');
  if (res.status === 401) return { status: 'not_linked' };
  if (res.status !== 200) return { status: 'error', httpStatus: res.status };
  if (res.data.length === 0) return { status: 'no_cards' };

  const cards = res.data;
  const state = { set: null, type: null, colors: new Set(), page: 0 };

  const initial = buildBrowserRows(cards, state);
  await interaction.followUp({
    content: 'Browse your collection — filter by set/color/type, then pick a card to list:',
    components: initial.rows,
    ephemeral: true
  });

  while (true) {
    let componentInteraction;
    try {
      componentInteraction = await interaction.channel.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('browse-'),
        time: 30000
      });
    } catch {
      return { status: 'timed_out' };
    }

    const { customId } = componentInteraction;

    if (customId === 'browse-card-select') {
      const cardId = componentInteraction.values[0];
      if (cardId === '__none__') {
        const { rows } = buildBrowserRows(cards, state);
        await componentInteraction.update({ components: rows });
        continue;
      }
      const chosen = cards.find(c => c._id === cardId);
      await componentInteraction.update({ content: `Selected: ${chosen.name}`, components: [] });
      return { status: 'found', card: chosen };
    }

    if (customId === 'browse-set-select') {
      state.set = componentInteraction.values[0] || null;
      state.page = 0;
    } else if (customId === 'browse-type-select') {
      state.type = componentInteraction.values[0] || null;
      state.page = 0;
    } else if (customId.startsWith('browse-color:')) {
      const color = customId.split(':')[1];
      if (state.colors.has(color)) state.colors.delete(color);
      else state.colors.add(color);
      state.page = 0;
    } else if (customId === 'browse-color-reset') {
      state.colors.clear();
      state.page = 0;
    } else if (customId === 'browse-prev') {
      state.page = Math.max(0, state.page - 1);
    } else if (customId === 'browse-next') {
      state.page += 1;
    }

    const filtered = filterCards(cards, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page >= totalPages) state.page = totalPages - 1;

    const { rows } = buildBrowserRows(cards, state);
    await componentInteraction.update({ components: rows });
  }
}
```

Add `browseCollection` to `module.exports`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest collectionBrowser --runInBand`
Expected: PASS (24 tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/lib/collectionBrowser.js discord-bot/__tests__/collectionBrowser.test.js
git commit -m "feat: add the browseCollection interactive loop"
```

---

## Task 4: Wire the browser into `/trades create`

**Files:**
- Modify: `discord-bot/src/commands/trades.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/__tests__/trades.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `discord-bot/__tests__/trades.test.js`. This requires mocking `../src/lib/collectionBrowser` the same way `../src/lib/resolveCard` is already mocked at the top of the file — add this mock alongside the existing one:

```js
jest.mock('../src/lib/collectionBrowser');
```
(add near the top of the file, next to the existing `jest.mock('../src/lib/resolveCard')`)

```js
describe('/trades create — collection browser (no card name given)', () => {
  afterEach(() => jest.clearAllMocks());

  test('type=have with no card name opens the browser and posts using the selected card', async () => {
    const { browseCollection } = require('../src/lib/collectionBrowser');
    browseCollection.mockResolvedValue({
      status: 'found',
      card: { _id: 'card-9', name: 'Ragavan', set: 'Modern Horizons 2', setCode: 'MH2', scryfallId: 'sf-9', imageUrl: '/img/sf-9', condition: 'NM', price: 50 }
    });
    const api = { post: jest.fn().mockResolvedValue({ status: 201, data: {} }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: null, message: null });
    await tradesCommand.execute(interaction);

    expect(browseCollection).toHaveBeenCalledWith(interaction, api);
    expect(api.post).toHaveBeenCalledWith('/trades', expect.objectContaining({ cardName: 'Ragavan', scryfallId: 'sf-9' }));
  });

  test('type=have with no cards in the collection reports it and posts nothing', async () => {
    const { browseCollection } = require('../src/lib/collectionBrowser');
    browseCollection.mockResolvedValue({ status: 'no_cards' });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: null, message: null });
    await tradesCommand.execute(interaction);

    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("don't have any cards") }));
  });

  test('type=have browser timeout is reported and nothing is posted', async () => {
    const { browseCollection } = require('../src/lib/collectionBrowser');
    browseCollection.mockResolvedValue({ status: 'timed_out' });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: null, message: null });
    await tradesCommand.execute(interaction);

    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('timed out') }));
  });

  test('type=want with no card name is rejected before deferring, without calling the browser', async () => {
    const { browseCollection } = require('../src/lib/collectionBrowser');
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'want', card: null, message: null });
    await tradesCommand.execute(interaction);

    expect(browseCollection).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('specify a card name') }));
  });

  test('type=have WITH a card name still uses resolveCard, not the browser', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    const { browseCollection } = require('../src/lib/collectionBrowser');
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Sol Ring', set: 'Commander 2021', setCode: 'C21', scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', price: 2 } });
    const api = { post: jest.fn().mockResolvedValue({ status: 201, data: {} }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(resolveCard).toHaveBeenCalled();
    expect(browseCollection).not.toHaveBeenCalled();
  });
});
```

Note: the existing `mockInteraction()` helper's `getString` mock (`jest.fn((name) => opts[name] ?? null)`) already returns `null` for any option key not explicitly passed in `opts`, so passing `{ type: 'have', card: null, message: null }` correctly simulates the `card` option being left blank.

Run the tests, confirm failure (the `create` function doesn't yet check for a missing `cardName` or call `browseCollection`).

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: FAIL — new tests fail since `create()` still requires `card` and never imports `browseCollection`.

- [ ] **Step 3: Implement**

In `discord-bot/src/commands/trades.js`, add the import near the other `lib` requires:

```js
const { browseCollection } = require('../lib/collectionBrowser');
```

Replace the `create` function's opening and `have`-branch resolution with:

```js
async function create(interaction, api) {
  const type = interaction.options.getString('type', true);
  const cardName = interaction.options.getString('card');
  const message = interaction.options.getString('message');

  if (type === 'want' && !cardName) {
    return interaction.reply({ content: '❌ Please specify a card name for a "want" listing.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  if (type === 'have') {
    const resolved = cardName
      ? await resolveCard(interaction, api, cardName)
      : await browseCollection(interaction, api);

    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${cardName}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'no_cards') {
      return interaction.followUp({ content: "You don't have any cards in your collection to list.", ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: '⌛ Selection timed out.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const postRes = await api.post('/trades', {
      type: 'have',
      cardName: card.name,
      cardSet: card.set,
      cardSetCode: card.setCode,
      scryfallId: card.scryfallId,
      imageUrl: card.imageUrl,
      condition: card.condition,
      quantity: 1,
      estimatedValue: card.price,
      notes: message || ''
    });
    if (postRes.status === 401) return replyNotLinked(interaction);
    if (postRes.status !== 201) {
      return interaction.followUp({ content: `❌ Couldn't create listing (${postRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ Listed "${card.name}" as available for trade.`, ephemeral: true });
  }

  const searchRes = await api.get('/scryfall/search', { params: { name: cardName } });
  if (searchRes.status !== 200) {
    return interaction.followUp({ content: `❌ Couldn't find "${cardName}" on Scryfall.`, ephemeral: true });
  }
  const cardData = searchRes.data;
  const postRes = await api.post('/trades', {
    type: 'want',
    cardName: cardData.name,
    cardSet: cardData.set,
    cardSetCode: cardData.setCode,
    scryfallId: cardData.scryfallId,
    imageUrl: cardData.imageUrl,
    condition: 'NM',
    quantity: 1,
    estimatedValue: cardData.prices?.usd ? parseFloat(cardData.prices.usd) : 0,
    notes: message || ''
  });
  if (postRes.status === 401) return replyNotLinked(interaction);
  if (postRes.status !== 201) {
    return interaction.followUp({ content: `❌ Couldn't create listing (${postRes.status}).`, ephemeral: true });
  }
  return interaction.followUp({ content: `✅ Listed "${cardData.name}" as wanted.`, ephemeral: true });
}
```

(Only the function signature's `interaction.options.getString('card', true)` → `interaction.options.getString('card')`, the new `want`-without-name early-return, and the `have`-branch's `cardName ? resolveCard(...) : browseCollection(...)` conditional, plus the two new `no_cards`/existing-status branches, actually changed — the `want` branch and the `have` branch's POST/response logic beyond resolution are unchanged from the current file.)

In `discord-bot/src/registerCommands.js`, update the `create` subcommand's `card` option (remove `.setRequired(true)` and clarify the description):

```js
    .addSubcommand(sub => sub.setName('create').setDescription('List a card you have or want to trade')
      .addStringOption(o => o.setName('type').setDescription('Listing type').setRequired(true)
        .addChoices({ name: 'have', value: 'have' }, { name: 'want', value: 'want' }))
      .addStringOption(o => o.setName('card').setDescription('Card name (required for "want"; leave blank with "have" to browse your collection)'))
      .addStringOption(o => o.setName('message').setDescription('Optional note')))
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: PASS (all tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/commands/trades.js discord-bot/src/registerCommands.js discord-bot/__tests__/trades.test.js
git commit -m "feat: open the collection browser for /trades create type:have with no card name"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run the full bot test suite one more time**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass.

- [ ] **Step 2: Register commands**

Run: `cd discord-bot && node src/registerCommands.js`
Expected: confirms the updated `card` option (no longer required) is pushed to Discord.

- [ ] **Step 3: Manual smoke test**

Restart the bot so it picks up the change. In Discord, against a real linked account with a real collection spanning multiple sets/colors/types:
- `/trades create type:have` (no `card` argument) — confirm the 5-row browser appears, the Set/Type dropdowns list your actual sets/types, clicking a color button turns it green and narrows results, clicking it again turns it back off, "All Colors" clears all active toggles, Prev/Next page through results and correctly disable at the boundaries, and selecting a card from the bottom dropdown creates the listing (verify via `/trades my-listings`).
- `/trades create type:have card:<a card you own>` — confirm the old typed-name fast path still works unchanged.
- `/trades create type:want` (no `card` argument) — confirm it's rejected immediately with a message asking for a card name, without opening any browser.
- Filter down to zero matches (e.g. pick a set/color combo you don't own) — confirm the card dropdown shows a disabled "No matching cards" placeholder rather than erroring.
- Let the browser sit idle 30+ seconds — confirm it reports a timeout rather than hanging or crashing.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 4) before considering this done.

# Discord Bot /deck import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Discord bot's `/deck` command into `/deck view <name>` (today's existing lookup, unchanged) and `/deck import <url>` (new — imports a deck from Moxfield, Archidekt, TappedOut, or MTGGoldfish via the backend's existing `POST /decks/import` + `POST /decks` two-step flow, with a Confirm/Cancel preview).

**Architecture:** A small pure helper (`discord-bot/src/lib/deckImportSource.js`) detects which of the 4 supported sites a pasted URL belongs to. `discord-bot/src/commands/deck.js` is restructured from a single required-option command into a subcommand dispatcher (`view`/`import`), matching the shape already established by `wishlist.js`/`trades.js` elsewhere in this bot. The `import` subcommand's interactive Confirm/Cancel step uses the same single-shot `awaitMessageComponent` pattern already used by `resolveCard.js`'s disambiguation menu (one wait, not a loop).

**Tech Stack:** discord.js v14 (`ButtonBuilder`, `ButtonStyle`, `ActionRowBuilder`), Jest.

---

## Task 1: Domain-detection helper

**Files:**
- Create: `discord-bot/src/lib/deckImportSource.js`
- Test: `discord-bot/__tests__/deckImportSource.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/deckImportSource.test.js
const { detectDeckImportSource, SUPPORTED_SITES } = require('../src/lib/deckImportSource');

describe('detectDeckImportSource', () => {
  test('detects Moxfield URLs', () => {
    expect(detectDeckImportSource('https://moxfield.com/decks/abc123')).toBe('moxfield');
    expect(detectDeckImportSource('https://www.moxfield.com/decks/abc123')).toBe('moxfield');
  });

  test('detects Archidekt URLs', () => {
    expect(detectDeckImportSource('https://archidekt.com/decks/123456')).toBe('archidekt');
  });

  test('detects TappedOut URLs', () => {
    expect(detectDeckImportSource('https://tappedout.net/mtg-decks/my-deck/')).toBe('tappedout');
  });

  test('detects MTGGoldfish URLs', () => {
    expect(detectDeckImportSource('https://www.mtggoldfish.com/deck/1234567')).toBe('mtggoldfish');
  });

  test('is case-insensitive', () => {
    expect(detectDeckImportSource('HTTPS://MOXFIELD.COM/decks/abc123')).toBe('moxfield');
  });

  test('returns null for an unsupported or unrecognized URL', () => {
    expect(detectDeckImportSource('https://example.com/decks/abc123')).toBeNull();
    expect(detectDeckImportSource('not a url at all')).toBeNull();
  });

  test('exports the list of supported site labels for error messages', () => {
    expect(SUPPORTED_SITES).toEqual(['Moxfield', 'Archidekt', 'TappedOut', 'MTGGoldfish']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest deckImportSource --runInBand`
Expected: FAIL with "Cannot find module '../src/lib/deckImportSource'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/lib/deckImportSource.js
const SUPPORTED_SITES = ['Moxfield', 'Archidekt', 'TappedOut', 'MTGGoldfish'];

const DOMAIN_TO_SOURCE = [
  { domain: 'moxfield.com', source: 'moxfield' },
  { domain: 'archidekt.com', source: 'archidekt' },
  { domain: 'tappedout.net', source: 'tappedout' },
  { domain: 'mtggoldfish.com', source: 'mtggoldfish' }
];

function detectDeckImportSource(url) {
  const lower = url.toLowerCase();
  const match = DOMAIN_TO_SOURCE.find(({ domain }) => lower.includes(domain));
  return match ? match.source : null;
}

module.exports = { detectDeckImportSource, SUPPORTED_SITES };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest deckImportSource --runInBand`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/lib/deckImportSource.js discord-bot/__tests__/deckImportSource.test.js
git commit -m "feat: add deck-import-source domain detection helper"
```

---

## Task 2: Restructure `/deck` into `view`/`import` subcommands

**Files:**
- Modify: `discord-bot/src/commands/deck.js`
- Modify: `discord-bot/src/registerCommands.js`
- Create: `discord-bot/__tests__/deck.test.js`

- [ ] **Step 1: Write a baseline test for the existing `view` behavior, against the UNMODIFIED command**

Create `discord-bot/__tests__/deck.test.js`:

```js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const deckCommand = require('../src/commands/deck');

function mockInteraction(subcommand, opts = {}) {
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn((name) => opts[name] ?? null)
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    channel: { awaitMessageComponent: jest.fn() },
    deferred: false,
    replied: false
  };
}

describe('/deck view', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the matched deck\'s format and card count', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: [{ _id: 'd1', name: 'My Commander Deck' }] })
        .mockResolvedValueOnce({ status: 200, data: { name: 'My Commander Deck', format: 'commander', statistics: { totalCards: 100 } } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'My Commander Deck' });
    await deckCommand.execute(interaction);

    expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
    expect(api.get).toHaveBeenNthCalledWith(2, '/decks/d1');
    const embed = interaction.followUp.mock.calls[0][0].embeds[0];
    expect(embed.title).toBe('My Commander Deck');
    expect(embed.fields).toEqual([
      { name: 'Format', value: 'commander', inline: true },
      { name: 'Cards', value: '100', inline: true }
    ]);
  });

  test('reports no matching deck', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'Nonexistent' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No deck named') }));
  });

  test('replies via replyNotLinked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('view', { name: 'Anything' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});
```

Run: `cd discord-bot && timeout 60 npx jest "__tests__/deck.test.js" --runInBand`
Expected: at this point `deck.js` still expects `interaction.options.getString('name', true)` directly (no subcommand dispatch) — since the mock's `getString` returns the same values either way and `getSubcommand` isn't called by the current code, these three tests should actually PASS against the unmodified command (this step is a baseline sanity check, not expected to fail — if any of these three fail, stop and re-read the current `deck.js` before proceeding, since that means an assumption above is wrong).

- [ ] **Step 2: Write the failing tests for `/deck import`**

Append to `discord-bot/__tests__/deck.test.js`:

```js
jest.mock('../src/lib/deckImportSource');
const { detectDeckImportSource } = require('../src/lib/deckImportSource');
const { ButtonBuilder } = require('discord.js');

describe('/deck import', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects an unrecognized URL without deferring or calling the backend', async () => {
    detectDeckImportSource.mockReturnValue(null);
    const api = { get: jest.fn(), post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://example.com/decks/1' });
    await deckCommand.execute(interaction);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Moxfield') }));
  });

  test('replies via replyNotLinked on a 401 from the import/parse call', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const api = { post: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });

  test('surfaces the backend\'s own error message on a non-200 parse response', async () => {
    detectDeckImportSource.mockReturnValue('tappedout');
    const api = { post: jest.fn().mockResolvedValue({ status: 400, data: { message: 'No commander found in deck list' } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://tappedout.net/mtg-decks/my-deck/' });
    await deckCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No commander found in deck list') }));
  });

  test('shows a preview with Confirm/Cancel buttons, then Confirm persists the deck', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = {
      deckData: {
        name: 'Krenko Goblins',
        commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] },
        partnerCommander: null,
        mainDeck: []
      },
      statistics: { totalCards: 100 }
    };
    const api = {
      post: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: parsedDeck })
        .mockResolvedValueOnce({ status: 201, data: { _id: 'new-deck-1', name: 'Krenko Goblins' } })
    };
    client.mockReturnValue(api);

    const confirmInteraction = { customId: 'deck-import-confirm', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(confirmInteraction);

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenNthCalledWith(1, '/decks/import', { source: 'moxfield', data: 'https://moxfield.com/decks/abc' });
    const previewCall = interaction.followUp.mock.calls[0][0];
    expect(previewCall.embeds[0].title).toBe('Krenko Goblins');
    expect(previewCall.components[0].components).toHaveLength(2);

    expect(api.post).toHaveBeenNthCalledWith(2, '/decks', expect.objectContaining({ name: 'Krenko Goblins', statistics: { totalCards: 100 } }));
    expect(confirmInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Krenko Goblins'), components: [] }));
  });

  test('Cancel does not persist anything', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = { post: jest.fn().mockResolvedValue({ status: 200, data: parsedDeck }) };
    client.mockReturnValue(api);

    const cancelInteraction = { customId: 'deck-import-cancel', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(cancelInteraction);

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledTimes(1); // only the parse call, never a second POST /decks
    expect(cancelInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('cancelled'), components: [] }));
  });

  test('a timeout reports nothing was saved', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = { post: jest.fn().mockResolvedValue({ status: 200, data: parsedDeck }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockRejectedValue(new Error('time'));

    await deckCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('timed out') }));
  });

  test('a 401 on the confirm persist step replies via replyNotLinked', async () => {
    detectDeckImportSource.mockReturnValue('moxfield');
    const parsedDeck = { deckData: { name: 'Krenko Goblins', commander: { name: 'Krenko, Mob Boss', colorIdentity: ['R'] }, mainDeck: [] }, statistics: { totalCards: 100 } };
    const api = {
      post: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: parsedDeck })
        .mockResolvedValueOnce({ status: 401 })
    };
    client.mockReturnValue(api);

    const confirmInteraction = { customId: 'deck-import-confirm', update: jest.fn().mockResolvedValue(undefined) };
    const interaction = mockInteraction('import', { url: 'https://moxfield.com/decks/abc' });
    interaction.channel.awaitMessageComponent.mockResolvedValue(confirmInteraction);

    await deckCommand.execute(interaction);

    expect(confirmInteraction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});
```

Run: `cd discord-bot && timeout 60 npx jest "__tests__/deck.test.js" --runInBand`
Expected: FAIL — the 8 new `/deck import` tests fail (no `import` handling exists yet), while the 3 baseline `/deck view` tests still pass.

- [ ] **Step 3: Implement**

Replace the full content of `discord-bot/src/commands/deck.js` with:

```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { detectDeckImportSource, SUPPORTED_SITES } = require('../lib/deckImportSource');

async function view(interaction, api) {
  const name = interaction.options.getString('name', true);

  // Deferred up front: this makes two sequential backend round-trips (list,
  // then the matched deck's detail) that can exceed Discord's 3-second
  // initial-response window, and followUp() requires the interaction to
  // already be deferred or replied.
  await interaction.deferReply({ ephemeral: true });

  const listRes = await api.get('/decks');
  if (listRes.status === 401) return replyNotLinked(interaction);
  if (listRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
  }
  const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    return interaction.followUp({ content: `❌ No deck named "${name}".`, ephemeral: true });
  }

  const deckRes = await api.get(`/decks/${match._id}`);
  if (deckRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${deckRes.status}).`, ephemeral: true });
  }
  const deck = deckRes.data;
  return interaction.followUp({
    embeds: [{
      title: deck.name,
      fields: [
        { name: 'Format', value: deck.format || 'N/A', inline: true },
        { name: 'Cards', value: String(deck.statistics?.totalCards ?? deck.mainDeck?.length ?? 0), inline: true }
      ]
    }],
    ephemeral: true
  });
}

function colorIdentityLine(deckData) {
  const colors = new Set([
    ...(deckData.commander?.colorIdentity || []),
    ...(deckData.partnerCommander?.colorIdentity || [])
  ]);
  return colors.size > 0 ? [...colors].join('') : 'Colorless';
}

async function importDeck(interaction, api) {
  const url = interaction.options.getString('url', true);
  const source = detectDeckImportSource(url);

  if (!source) {
    return interaction.reply({
      content: `❌ That doesn't look like a supported deck URL. Supported sites: ${SUPPORTED_SITES.join(', ')}.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const parseRes = await api.post('/decks/import', { source, data: url });
  if (parseRes.status === 401) return replyNotLinked(interaction);
  if (parseRes.status !== 200) {
    const message = parseRes.data?.message || `Something went wrong (${parseRes.status}).`;
    return interaction.followUp({ content: `❌ ${message}`, ephemeral: true });
  }

  const { deckData, statistics } = parseRes.data;
  const commanderLine = deckData.partnerCommander
    ? `${deckData.commander.name} + ${deckData.partnerCommander.name}`
    : deckData.commander.name;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('deck-import-confirm').setLabel('Confirm Import').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('deck-import-cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );

  await interaction.followUp({
    embeds: [{
      title: deckData.name,
      fields: [
        { name: 'Commander', value: commanderLine, inline: true },
        { name: 'Cards', value: String(statistics?.totalCards ?? deckData.mainDeck?.length ?? 0), inline: true },
        { name: 'Colors', value: colorIdentityLine(deckData), inline: true }
      ]
    }],
    components: [row],
    ephemeral: true
  });

  let buttonInteraction;
  try {
    buttonInteraction = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && (i.customId === 'deck-import-confirm' || i.customId === 'deck-import-cancel'),
      time: 30000
    });
  } catch {
    return interaction.followUp({ content: '⌛ Import timed out — nothing was saved.', ephemeral: true });
  }

  if (buttonInteraction.customId === 'deck-import-cancel') {
    return buttonInteraction.update({ content: 'Import cancelled — nothing was saved.', embeds: [], components: [] });
  }

  const saveRes = await api.post('/decks', { ...deckData, statistics });
  if (saveRes.status === 401) return replyNotLinked(interaction);
  if (saveRes.status !== 201) {
    const message = saveRes.data?.message || `Something went wrong (${saveRes.status}).`;
    return buttonInteraction.update({ content: `❌ ${message}`, embeds: [], components: [] });
  }

  return buttonInteraction.update({ content: `✅ Imported "${saveRes.data.name}".`, embeds: [], components: [] });
}

module.exports = {
  name: 'deck',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'view') return view(interaction, api);
    if (sub === 'import') return importDeck(interaction, api);

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};
```

In `discord-bot/src/registerCommands.js`, replace the current `deck` entry:

```js
  new SlashCommandBuilder().setName('deck').setDescription('View a deck')
    .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),
```

with:

```js
  new SlashCommandBuilder().setName('deck').setDescription('View or import a deck')
    .addSubcommand(sub => sub.setName('view').setDescription('View one of your existing decks')
      .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)))
    .addSubcommand(sub => sub.setName('import').setDescription('Import a deck from Moxfield, Archidekt, TappedOut, or MTGGoldfish')
      .addStringOption(o => o.setName('url').setDescription('Deck URL').setRequired(true))),
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/deck.test.js" --runInBand`
Expected: PASS (all 11 tests — 3 baseline `view` tests + 8 `import` tests)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/commands/deck.js discord-bot/src/registerCommands.js discord-bot/__tests__/deck.test.js
git commit -m "feat: restructure /deck into view/import subcommands, add deck import with Confirm/Cancel"
```

---

## Task 3: Final verification

- [ ] **Step 1: Run the full bot test suite one more time**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass.

- [ ] **Step 2: Register commands**

Run: `cd discord-bot && node src/registerCommands.js`
Expected: confirms the restructured `deck` command (now with `view`/`import` subcommands) is pushed to Discord. Command count stays at 20 (no new top-level command — `deck` gained subcommands).

- [ ] **Step 3: Manual smoke test**

Restart the bot so it picks up the change. In Discord, against a real linked account:
- `/deck view <a deck you have>` — confirm it works exactly as `/deck <name>` did before (same embed).
- `/deck import` with a real public Moxfield Commander deck URL — confirm the preview embed shows the right name/commander/card count/colors, Confirm actually creates the deck (verify via `/deck view <name>` afterward or `/decks`), Cancel doesn't create anything, and letting it sit idle 30+ seconds times out cleanly.
- `/deck import` with an unsupported URL (e.g. a random website) — confirm it's rejected immediately with the supported-sites message, no defer/backend call.
- `/deck import` with a real deck URL from one of the other 3 sources (Archidekt, TappedOut, or MTGGoldfish) if you have one handy — confirm domain detection routes to the right `source` value.
- `/deck import` with a real non-Commander deck URL (no commander section) — confirm the "No commander found in deck list" message surfaces clearly.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 2) before considering this done.

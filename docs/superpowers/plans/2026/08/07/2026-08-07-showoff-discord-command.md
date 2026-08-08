# `/showoff` Discord Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/showoff cards [count]` / `/showoff deck <name>` Discord command that posts publicly in the channel — no other command in this bot does that, every one replies privately.

**Architecture:** New command file following `deckstats.js`'s exact structure (API client call, error handling, embed reply), registered in the same two places every command already is. No backend changes — both subcommands are satisfied entirely by existing `GET /api/cards` (sort/limit query params) and `GET /api/decks`/`GET /api/decks/:id`.

**Tech Stack:** Node.js Discord bot (`discord-bot/`) with its own Jest suite (`discord-bot/__tests__/`, `jest.mock('../src/apiClient')` pattern — no live network/DB in these tests).

**Spec:** `docs/superpowers/specs/2026-08-07-showoff-discord-command-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `discord-bot/src/commands/deckstats.js` is the exact structural model: `client(interaction.user.id)` for an authenticated API client, `api.get('/decks')` + case-insensitive `.find(d => d.name.toLowerCase() === name.toLowerCase())` to resolve a deck by name, `replyNotLinked(interaction)` on a 401, a generic `❌ Something went wrong (${status}).` reply on other non-200s.
- `discord-bot/src/lib/notLinked.js`'s `replyNotLinked` always replies with `ephemeral: true` — this is fine as-is, error paths stay private even though this command's success path is public.
- Registration is two files: `discord-bot/src/registerCommands.js` (a `SlashCommandBuilder` array — `/collection`'s entry, lines ~14-15, is the subcommand pattern to copy) and `discord-bot/src/index.js` (a `new Map([...])` built from `require('./commands/X')` calls, keyed by each command module's exported `name` — add `require('./commands/showoff')` to the array, e.g. after the `trades` entry at line 27).
- `discord-bot/__tests__/deckstats.test.js` is the exact test-file model: `jest.mock('../src/apiClient')`, a `mockInteraction()` helper, assertions on `api.get` call order and the resulting embed shape.
- `GET /api/cards` accepts `sortBy` (allowed values include `'price'`), `sortOrder` (`'asc'|'desc'`), and `limit` query params (`backend/utils/cardUtils.js`'s `buildCardListQuery`) and returns a **paginated** `{ cards, total, page, limit }` shape whenever any of `page`/`limit` is present (confirmed earlier this session while fixing a related frontend crash) — NOT a raw array like the unparameterized call. The command must read `res.data.cards`, not `res.data` directly.
- `GET /api/decks/:id` returns the full `Deck` document: `commander.imageUrl`, `commander.name`, `name`, `format`, `mainDeck` (array), `statistics.totalCards`, `totalValue`.

---

## Task 1: `/showoff` command implementation, registration, and tests

**Files:**
- Create: `discord-bot/src/commands/showoff.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/src/index.js`
- Test: `discord-bot/__tests__/showoff.test.js` (new)

- [ ] **Step 1: Write the failing tests**

Create `discord-bot/__tests__/showoff.test.js`:

```js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const showoffCommand = require('../src/commands/showoff');

function mockInteraction({ subcommand, name, count }) {
  const followUp = jest.fn().mockResolvedValue(undefined);
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(name),
      getInteger: jest.fn().mockReturnValue(count ?? null),
    },
    deferred: true,
    replied: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp,
    editReply: followUp,
  };
}

describe('/showoff', () => {
  afterEach(() => jest.clearAllMocks());

  describe('cards subcommand', () => {
    test('shows the top valuable cards and does not mark the reply ephemeral', async () => {
      const api = {
        get: jest.fn().mockResolvedValue({
          status: 200,
          data: { cards: [
            { name: 'Black Lotus', set: 'Vintage Masters', price: 500 },
            { name: 'Sol Ring', set: 'Commander Masters', price: 2 },
          ], total: 2, page: 1, limit: 5 },
        }),
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards', count: 5 });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/cards?sortBy=price&sortOrder=desc&limit=5');
      const call = interaction.followUp.mock.calls[0][0];
      expect(call.embeds[0].description).toContain('Black Lotus');
      expect(call.embeds[0].description).toContain('Sol Ring');
      expect(call.ephemeral).toBeUndefined();
    });

    test('defaults count to 5 when not provided', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { cards: [] } }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards' });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenCalledWith('/cards?sortBy=price&sortOrder=desc&limit=5');
    });

    test('replies not-linked on 401', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'cards', count: 5 });
      await showoffCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('link'),
        ephemeral: true,
      }));
    });
  });

  describe('deck subcommand', () => {
    test('resolves the deck by name and shows a public spotlight embed', async () => {
      const api = {
        get: jest.fn()
          .mockResolvedValueOnce({ status: 200, data: [{ _id: 'deck-1', name: 'Edgar Markov' }] }) // /decks
          .mockResolvedValueOnce({
            status: 200,
            data: {
              name: 'Edgar Markov', format: 'commander', totalValue: 245.5,
              commander: { name: 'Edgar Markov', imageUrl: 'http://example.com/edgar.jpg' },
              mainDeck: new Array(99).fill({ name: 'Sol Ring' }),
              statistics: { totalCards: 100 },
            },
          }), // /decks/:id
      };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'deck', name: 'edgar markov' });
      await showoffCommand.execute(interaction);

      expect(api.get).toHaveBeenNthCalledWith(1, '/decks');
      expect(api.get).toHaveBeenNthCalledWith(2, '/decks/deck-1');
      const call = interaction.followUp.mock.calls[0][0];
      expect(call.embeds[0].title).toContain('Edgar Markov');
      expect(call.embeds[0].thumbnail.url).toBe('http://example.com/edgar.jpg');
      expect(call.ephemeral).toBeUndefined();
    });

    test('reports no match for an unknown deck name (private error)', async () => {
      const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
      client.mockReturnValue(api);

      const interaction = mockInteraction({ subcommand: 'deck', name: 'Nonexistent Deck' });
      await showoffCommand.execute(interaction);

      expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('No deck named'),
        ephemeral: true,
      }));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd discord-bot && npm test -- showoff`
Expected: FAIL — `discord-bot/src/commands/showoff.js` doesn't exist yet.

- [ ] **Step 3: Implement the command**

Create `discord-bot/src/commands/showoff.js`:

```js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'showoff',
  async execute(interaction) {
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'cards') {
      const count = interaction.options.getInteger('count') || 5;
      const res = await api.get(`/cards?sortBy=price&sortOrder=desc&limit=${count}`);
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }

      const cards = res.data.cards || [];
      if (cards.length === 0) {
        return interaction.followUp({ content: 'No cards in your collection yet.', ephemeral: true });
      }

      const description = cards
        .map((c, i) => `${i + 1}. **${c.name}** (${c.set}) — $${(c.price || 0).toFixed(2)}`)
        .join('\n');

      return interaction.followUp({
        embeds: [{ title: `💎 Top ${cards.length} Most Valuable Cards`, description }],
      });
    }

    if (sub === 'deck') {
      const name = interaction.options.getString('name', true);
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
      const cardCount = deck.statistics?.totalCards || deck.mainDeck?.length || 0;

      return interaction.followUp({
        embeds: [{
          title: `🃏 ${deck.name}`,
          thumbnail: deck.commander?.imageUrl ? { url: deck.commander.imageUrl } : undefined,
          fields: [
            { name: 'Commander', value: deck.commander?.name || 'None', inline: true },
            { name: 'Format', value: deck.format || 'commander', inline: true },
            { name: 'Cards', value: String(cardCount), inline: true },
            { name: 'Value', value: `$${(deck.totalValue || 0).toFixed(2)}`, inline: true },
          ],
        }],
      });
    }

    return interaction.followUp({ content: 'Unknown subcommand.', ephemeral: true });
  }
};
```

Note: `interaction.deferReply()` with no `{ ephemeral: true }` option defers publicly by default in discord.js — this is what makes the eventual `followUp` visible to the whole channel. Every error path still explicitly passes `ephemeral: true` on its own `followUp` call, so those stay private even though the deferral itself is public (discord.js allows a public-deferred interaction's individual `followUp` calls to still be ephemeral per-call).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd discord-bot && npm test -- showoff`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Register the command**

In `discord-bot/src/registerCommands.js`, add (matching the `/collection` subcommand pattern already in this file):
```js
  new SlashCommandBuilder().setName('showoff').setDescription('Post something to show off in the channel')
    .addSubcommand(sub => sub.setName('cards').setDescription('Show off your most valuable cards')
      .addIntegerOption(o => o.setName('count').setDescription('How many cards (default 5, max 10)').setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub => sub.setName('deck').setDescription('Show off a deck')
      .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true))),
```

In `discord-bot/src/index.js`, add `require('./commands/showoff'),` to the `commands` array (after the `trades` entry, line 27).

- [ ] **Step 6: Run the full discord-bot test suite**

Run: `cd discord-bot && npm test`
Expected: all suites pass, no regressions.

- [ ] **Step 7: Deploy the new command definition**

Check `discord-bot/package.json` or `README` for the existing command-deployment script (this repo's bot commands need to be registered with Discord's API separately from the bot process itself — likely a `node src/registerCommands.js` or an npm script). Run whatever this project's established deploy step is, in whatever environment (dev guild vs. global) matches how every other command in this bot was deployed. If you cannot determine the deployment mechanism with confidence, stop and flag it rather than guessing — deploying slash commands to the wrong scope (e.g. globally when only a dev-guild deploy was intended) is not easily reversible within a short timeframe (global command updates can take up to an hour to propagate/deregister).

- [ ] **Step 8: Manual smoke test**

In a real (or test) Discord server with the bot running and commands deployed:
- Run `/showoff cards` (no count) — confirm it posts publicly (visible to a second Discord account/observer, not just the invoker) showing 5 cards sorted by price descending.
- Run `/showoff cards count:3` — confirm exactly 3 cards.
- Run `/showoff deck name:<a real deck name>` — confirm a public embed with the commander thumbnail, correct card count, and value.
- Run `/showoff deck name:NotARealDeck` — confirm a private (only-you-see-it) error message.
- Test with an unlinked Discord account (or temporarily `/unlink`) — confirm the not-linked message is private.

- [ ] **Step 9: Commit**

```bash
git add discord-bot/src/commands/showoff.js discord-bot/src/registerCommands.js discord-bot/src/index.js discord-bot/__tests__/showoff.test.js
git commit -m "feat: add /showoff discord command for publicly spotlighting cards and decks"
```

---

## Task 2: Final verification

- [ ] **Step 1: Full discord-bot test suite**

Run: `cd discord-bot && npm test`
Expected: all pass, no regressions.

- [ ] **Step 2: Confirm no backend changes were needed**

Run: `cd backend && npm test`
Expected: all pass, unchanged from before this feature (sanity check that nothing in `discord-bot/` accidentally required a backend modification that got missed).

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

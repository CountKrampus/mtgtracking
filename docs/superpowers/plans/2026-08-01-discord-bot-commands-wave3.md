# Discord Bot Commands — Wave 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/wishlist deals`, `/achievements`, `/pricealerts`, and a full `/trades` command (browse/my-listings/create/offer/received/sent, with interactive Accept/Reject/Cancel buttons) to the Discord bot, using only existing backend endpoints.

**Architecture:** Small, independent read-mostly commands first (Tasks 1-4), then the two more involved `/trades` subcommands that build/submit data (Tasks 5-6), then the button-driven half — a new `discord-bot/src/tradeButtons.js` module handling Accept/Reject/Cancel clicks, wired into `index.js`'s interaction dispatcher (which currently only handles slash commands) — and finally registration/wiring and verification.

**Tech Stack:** discord.js v14, Jest + `jest.mock('../src/apiClient')` (existing bot test conventions).

---

## Task 1: `/wishlist deals` subcommand

**Files:**
- Modify: `discord-bot/src/commands/wishlist.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/__tests__/wishlist.test.js` (create if it doesn't already exist — check first; if it doesn't exist, this task creates it fresh with tests for the existing `list`/`add`/`remove` subcommands too, to establish a baseline, plus the new `deals` test)

- [ ] **Step 1: Check whether a test file already exists**

Run: `ls discord-bot/__tests__/wishlist.test.js` (or just try reading it). If it exists, read it in full and add the new test to it. If it doesn't exist, you'll create it fresh — see Step 1a below.

- [ ] **Step 1a (only if no existing test file): write baseline tests for list/add/remove first**

```js
// discord-bot/__tests__/wishlist.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const wishlistCommand = require('../src/commands/wishlist');

function mockInteraction(subcommand, name) {
  return {
    user: { id: 'discord-1' },
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(name)
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferred: true,
    replied: false
  };
}

describe('/wishlist', () => {
  afterEach(() => jest.clearAllMocks());

  test('list shows wishlist items', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Sol Ring', priority: 'high', targetPrice: 0, currentPrice: 0 }] }) };
    client.mockReturnValue(api);
    const interaction = mockInteraction('list');
    await wishlistCommand.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Wishlist' })]
    }));
  });
});
```

Write this, run it, confirm it passes against the EXISTING (unmodified) `wishlist.js` before proceeding to Step 2 — this confirms your test harness/mocks match the real command's behavior before you start changing it.

- [ ] **Step 2: Write the failing test for `deals`**

Add to `discord-bot/__tests__/wishlist.test.js`:

```js
  test('deals shows only items where current price has hit the target', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { name: 'Sol Ring', priority: 'high', targetPrice: 5, currentPrice: 3 },
          { name: 'Mana Crypt', priority: 'medium', targetPrice: 100, currentPrice: 150 },
          { name: 'Command Tower', priority: 'low', targetPrice: 0, currentPrice: 1 }
        ]
      })
    };
    client.mockReturnValue(api);
    const interaction = mockInteraction('deals');
    await wishlistCommand.execute(interaction);

    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
    expect(embed.description).not.toContain('Mana Crypt');
    expect(embed.description).not.toContain('Command Tower');
  });

  test('deals reports no deals when nothing qualifies', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Mana Crypt', priority: 'medium', targetPrice: 100, currentPrice: 150 }] }) };
    client.mockReturnValue(api);
    const interaction = mockInteraction('deals');
    await wishlistCommand.execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No deals') }));
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest wishlist --runInBand`
Expected: FAIL — `deals` subcommand isn't handled, falls through to "Unknown subcommand."

- [ ] **Step 4: Implement**

In `discord-bot/src/commands/wishlist.js`, add a new branch (after the existing `add` block, before `remove`):

```js
    if (sub === 'deals') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }
      const deals = res.data.filter(item => item.currentPrice > 0 && item.targetPrice > 0 && item.currentPrice <= item.targetPrice);
      if (deals.length === 0) {
        return interaction.reply({ content: 'No deals right now — nothing on your wishlist has hit its target price.', ephemeral: true });
      }
      const lines = deals.slice(0, 20).map(item => `• ${item.name} — $${item.currentPrice} (target $${item.targetPrice})`);
      return interaction.reply({
        embeds: [{ title: 'Wishlist Deals', description: lines.join('\n') }],
        ephemeral: true
      });
    }

```

In `discord-bot/src/registerCommands.js`, add a `deals` subcommand to the existing `wishlist` builder:

```js
  new SlashCommandBuilder().setName('wishlist').setDescription('Wishlist commands')
    .addSubcommand(sub => sub.setName('list').setDescription('Show your wishlist'))
    .addSubcommand(sub => sub.setName('deals').setDescription('Show wishlist items at or below your target price'))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a card to your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a card from your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true))),
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest wishlist --runInBand`
Expected: PASS (all tests)

- [ ] **Step 6: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add discord-bot/src/commands/wishlist.js discord-bot/src/registerCommands.js discord-bot/__tests__/wishlist.test.js
git commit -m "feat: add /wishlist deals subcommand"
```

---

## Task 2: `/achievements` command

**Files:**
- Create: `discord-bot/src/commands/achievements.js`
- Test: `discord-bot/__tests__/achievements.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/achievements.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const achievementsCommand = require('../src/commands/achievements');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    reply: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/achievements', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows earned achievements with a count summary', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { id: 'first_card', name: 'First Card', icon: '🃏', earned: true },
          { id: 'ten_cards', name: 'Getting Started', icon: '📦', earned: false },
          { id: '100_cards', name: 'Collector', icon: '📚', earned: true }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/achievements');
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.title).toContain('2/3');
    expect(embed.description).toContain('First Card');
    expect(embed.description).toContain('Collector');
    expect(embed.description).not.toContain('Getting Started');
  });

  test('reports no achievements earned yet', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ id: 'first_card', name: 'First Card', icon: '🃏', earned: false }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("haven't earned")
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await achievementsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest achievements --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/achievements'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/achievements.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'achievements',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/achievements');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const earned = res.data.filter(a => a.earned);
    if (earned.length === 0) {
      return interaction.reply({ content: "You haven't earned any achievements yet — keep building your collection!", ephemeral: true });
    }

    const lines = earned.map(a => `${a.icon} **${a.name}**`);
    return interaction.reply({
      embeds: [{ title: `Achievements (${earned.length}/${res.data.length})`, description: lines.join('\n') }],
      ephemeral: true
    });
  }
};
```

This command doesn't need `deferReply` — it makes exactly one backend call, well within Discord's 3-second window (matching the convention already used by single-round-trip commands like `/collection stats`).

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest achievements --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Register the command**

In `discord-bot/src/registerCommands.js`, add:

```js
  new SlashCommandBuilder().setName('achievements').setDescription('Show your earned collector achievements'),
```

- [ ] **Step 6: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add discord-bot/src/commands/achievements.js discord-bot/src/registerCommands.js discord-bot/__tests__/achievements.test.js
git commit -m "feat: add /achievements Discord bot command"
```

---

## Task 3: `/pricealerts` command

**Files:**
- Create: `discord-bot/src/commands/pricealerts.js`
- Test: `discord-bot/__tests__/pricealerts.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/pricealerts.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
const pricealertsCommand = require('../src/commands/pricealerts');

function mockInteraction() {
  return {
    user: { id: 'discord-1' },
    reply: jest.fn().mockResolvedValue(undefined)
  };
}

describe('/pricealerts', () => {
  afterEach(() => jest.clearAllMocks());

  test('lists cards with an active target price', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [
          { name: 'Sol Ring', price: 2, priceAlert: { targetPrice: 1.5 } },
          { name: 'Mana Crypt', price: 200, priceAlert: { targetHigh: 250 } },
          { name: 'Forest', price: 0, priceAlert: {} }
        ]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
    expect(embed.description).toContain('Mana Crypt');
    expect(embed.description).not.toContain('Forest');
  });

  test('reports no active alerts', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ name: 'Forest', price: 0, priceAlert: {} }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("don't have any")
    }));
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction();
    await pricealertsCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('link')
    }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest pricealerts --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/pricealerts'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/pricealerts.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'pricealerts',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/cards');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const withAlerts = res.data.filter(c => c.priceAlert?.targetPrice > 0 || c.priceAlert?.targetHigh > 0);
    if (withAlerts.length === 0) {
      return interaction.reply({ content: "You don't have any price alerts set.", ephemeral: true });
    }

    const lines = withAlerts.slice(0, 25).map(c => {
      const thresholds = [];
      if (c.priceAlert?.targetPrice > 0) thresholds.push(`drop to $${c.priceAlert.targetPrice}`);
      if (c.priceAlert?.targetHigh > 0) thresholds.push(`rise to $${c.priceAlert.targetHigh}`);
      return `• ${c.name} — $${c.price} now (alert: ${thresholds.join(', ')})`;
    });

    return interaction.reply({
      embeds: [{ title: 'Price Alerts', description: lines.join('\n') }],
      ephemeral: true
    });
  }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest pricealerts --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Register the command**

In `discord-bot/src/registerCommands.js`, add:

```js
  new SlashCommandBuilder().setName('pricealerts').setDescription('List your cards with an active price alert'),
```

- [ ] **Step 6: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add discord-bot/src/commands/pricealerts.js discord-bot/src/registerCommands.js discord-bot/__tests__/pricealerts.test.js
git commit -m "feat: add /pricealerts Discord bot command"
```

---

## Task 4: `/trades browse` and `/trades my-listings`

**Files:**
- Create: `discord-bot/src/commands/trades.js`
- Test: `discord-bot/__tests__/trades.test.js`

This task establishes the `trades.js` command file and its subcommand-dispatch shape (matching `wishlist.js`'s `getSubcommand()` pattern), starting with the two simplest, read-only subcommands. Later tasks (5, 6, 7) add more subcommands to this same file.

- [ ] **Step 1: Write the failing tests**

```js
// discord-bot/__tests__/trades.test.js
jest.mock('../src/apiClient');
const { client } = require('../src/apiClient');
jest.mock('../src/lib/resolveCard');
const tradesCommand = require('../src/commands/trades');

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
    deferred: false,
    replied: false
  };
}

describe('/trades browse', () => {
  afterEach(() => jest.clearAllMocks());

  test('lists active listings', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { listings: [{ type: 'have', cardName: 'Sol Ring', cardSet: 'Commander 2021', condition: 'NM', username: 'alice' }], total: 1 }
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', { type: null, card: null });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades', { params: {} });
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
    expect(embed.description).toContain('alice');
  });

  test('passes type and card filters through as query params', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', { type: 'want', card: 'Sol Ring' });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades', { params: { type: 'want', card: 'Sol Ring' } });
  });

  test('reports no listings found', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('browse', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No active listings') }));
  });
});

describe('/trades my-listings', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows the caller\'s own listings', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [{ type: 'have', cardName: 'Sol Ring', cardSet: 'C21', condition: 'NM', status: 'active' }] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('my-listings', {});
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades/my-listings');
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.description).toContain('Sol Ring');
  });

  test('replies not-linked on 401', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 401 }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('my-listings', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('link') }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: FAIL with "Cannot find module '../src/commands/trades'"

- [ ] **Step 3: Implement**

```js
// discord-bot/src/commands/trades.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

const TYPE_EMOJI = { have: '🟢', want: '🔵' };

async function browse(interaction, api) {
  const type = interaction.options.getString('type');
  const card = interaction.options.getString('card');
  const params = {};
  if (type) params.type = type;
  if (card) params.card = card;

  const res = await api.get('/trades', { params });
  if (res.status !== 200) {
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }
  if (res.data.listings.length === 0) {
    return interaction.reply({ content: 'No active listings match that search.', ephemeral: true });
  }

  const lines = res.data.listings.slice(0, 10).map(l =>
    `${TYPE_EMOJI[l.type] || ''} **${l.cardName}** (${l.cardSet || 'Unknown'}, ${l.condition}) — posted by ${l.username}`
  );
  return interaction.reply({
    embeds: [{ title: 'Trade Listings', description: lines.join('\n') }],
    ephemeral: true
  });
}

async function myListings(interaction, api) {
  const res = await api.get('/trades/my-listings');
  if (res.status === 401) return replyNotLinked(interaction);
  if (res.status !== 200) {
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }
  if (res.data.length === 0) {
    return interaction.reply({ content: "You don't have any active listings.", ephemeral: true });
  }

  const lines = res.data.slice(0, 20).map(l =>
    `${TYPE_EMOJI[l.type] || ''} **${l.cardName}** (${l.cardSet || 'Unknown'}, ${l.condition}) — ${l.status}`
  );
  return interaction.reply({
    embeds: [{ title: 'Your Trade Listings', description: lines.join('\n') }],
    ephemeral: true
  });
}

module.exports = {
  name: 'trades',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'browse') return browse(interaction, api);
    if (sub === 'my-listings') return myListings(interaction, api);

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};
```

(`resolveCard` is imported now even though unused by this task's two subcommands — Tasks 5 and 6 add subcommands to this same file that need it. If your linter/test setup flags an unused import as an error rather than a warning, it's fine to add it in Task 5 instead; check `card-insights.test.js`-style conventions in this repo, which don't appear to enforce that as a hard failure.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: PASS (5 tests)

- [ ] **Step 5: Register the `trades` command with its first two subcommands**

In `discord-bot/src/registerCommands.js`, add:

```js
  new SlashCommandBuilder().setName('trades').setDescription('Trading commands')
    .addSubcommand(sub => sub.setName('browse').setDescription('Browse active trade listings')
      .addStringOption(o => o.setName('type').setDescription('Filter by listing type')
        .addChoices({ name: 'have', value: 'have' }, { name: 'want', value: 'want' }))
      .addStringOption(o => o.setName('card').setDescription('Filter by card name')))
    .addSubcommand(sub => sub.setName('my-listings').setDescription('Show your own active listings')),
```

(Tasks 5-7 will add `create`, `offer`, `received`, `sent` subcommands to this same builder.)

- [ ] **Step 6: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add discord-bot/src/commands/trades.js discord-bot/src/registerCommands.js discord-bot/__tests__/trades.test.js
git commit -m "feat: add /trades browse and /trades my-listings"
```

---

## Task 5: `/trades create`

**Files:**
- Modify: `discord-bot/src/commands/trades.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/__tests__/trades.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `discord-bot/__tests__/trades.test.js`:

```js
describe('/trades create', () => {
  afterEach(() => jest.clearAllMocks());

  test('type=have resolves against the caller\'s own collection and posts a listing', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'found', card: { _id: 'card-1', name: 'Sol Ring', set: 'Commander 2021', setCode: 'C21', scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', price: 2 } });
    const api = { post: jest.fn().mockResolvedValue({ status: 201, data: {} }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Sol Ring', message: 'looking to trade' });
    await tradesCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledWith('/trades', expect.objectContaining({
      type: 'have', cardName: 'Sol Ring', cardSet: 'Commander 2021', cardSetCode: 'C21',
      scryfallId: 'sf-1', imageUrl: '/img/sf-1', condition: 'NM', estimatedValue: 2, quantity: 1, notes: 'looking to trade'
    }));
  });

  test('type=want looks up the card via Scryfall search, not the caller\'s collection', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({ status: 200, data: { name: 'Mana Crypt', set: 'Eternal Masters', setCode: 'EMA', scryfallId: 'sf-2', imageUrl: '/img/sf-2', prices: { usd: '200.00' } } }),
      post: jest.fn().mockResolvedValue({ status: 201, data: {} })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'want', card: 'Mana Crypt', message: null });
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/scryfall/search', { params: { name: 'Mana Crypt' } });
    expect(api.post).toHaveBeenCalledWith('/trades', expect.objectContaining({
      type: 'want', cardName: 'Mana Crypt', cardSet: 'Eternal Masters', cardSetCode: 'EMA',
      scryfallId: 'sf-2', imageUrl: '/img/sf-2', condition: 'NM', quantity: 1
    }));
  });

  test('type=have reports no match without posting anything', async () => {
    const { resolveCard } = require('../src/lib/resolveCard');
    resolveCard.mockResolvedValue({ status: 'no_match' });
    const api = { post: jest.fn() };
    client.mockReturnValue(api);

    const interaction = mockInteraction('create', { type: 'have', card: 'Nonexistent Card', message: null });
    await tradesCommand.execute(interaction);

    expect(api.post).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: FAIL — `create` subcommand isn't handled yet.

- [ ] **Step 3: Implement**

Add to `discord-bot/src/commands/trades.js` (before the `module.exports` block):

```js
async function create(interaction, api) {
  const type = interaction.options.getString('type', true);
  const cardName = interaction.options.getString('card', true);
  const message = interaction.options.getString('message');

  await interaction.deferReply({ ephemeral: true });

  if (type === 'have') {
    const resolved = await resolveCard(interaction, api, cardName);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${cardName}" in your collection.`, ephemeral: true });
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
    if (postRes.status !== 201) {
      return interaction.followUp({ content: `❌ Couldn't create listing (${postRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ Listed "${card.name}" as available for trade.`, ephemeral: true });
  }

  // type === 'want'
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
  if (postRes.status !== 201) {
    return interaction.followUp({ content: `❌ Couldn't create listing (${postRes.status}).`, ephemeral: true });
  }
  return interaction.followUp({ content: `✅ Listed "${cardData.name}" as wanted.`, ephemeral: true });
}
```

Add the dispatch line inside `execute`:

```js
    if (sub === 'create') return create(interaction, api);
```

In `discord-bot/src/registerCommands.js`, add a `create` subcommand to the `trades` builder:

```js
    .addSubcommand(sub => sub.setName('create').setDescription('List a card you have or want to trade')
      .addStringOption(o => o.setName('type').setDescription('Listing type').setRequired(true)
        .addChoices({ name: 'have', value: 'have' }, { name: 'want', value: 'want' }))
      .addStringOption(o => o.setName('card').setDescription('Card name').setRequired(true))
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
git commit -m "feat: add /trades create (have and want listings)"
```

---

## Task 6: `/trades offer`

**Files:**
- Modify: `discord-bot/src/commands/trades.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/__tests__/trades.test.js`

**Files:**
- Read first: `discord-bot/src/lib/resolveCard.js` (for the exact `StringSelectMenuBuilder`/`ActionRowBuilder`/`ComponentType` import and `awaitMessageComponent` usage pattern to mirror for a multi-select).

- [ ] **Step 1: Write the failing tests**

Add to `discord-bot/__tests__/trades.test.js`:

```js
describe('/trades offer', () => {
  afterEach(() => jest.clearAllMocks());

  test('resolves the listing, lets the caller multi-select their own cards, and posts the offer', async () => {
    const api = {
      get: jest.fn()
        .mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'listing-1', cardName: 'Sol Ring' }], total: 1 } }) // /trades?card=
        .mockResolvedValueOnce({ status: 200, data: [
          { name: 'Mana Crypt', set: 'Eternal Masters', condition: 'NM', price: 200, scryfallId: 'sf-2', imageUrl: '/img/sf-2' },
          { name: 'Command Tower', set: 'Commander 2020', condition: 'NM', price: 0.5, scryfallId: 'sf-3', imageUrl: '/img/sf-3' }
        ] }), // /cards
      post: jest.fn().mockResolvedValue({ status: 201, data: {} })
    };
    client.mockReturnValue(api);

    const selectInteraction = {
      values: ['0'],
      update: jest.fn().mockResolvedValue(undefined)
    };
    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: 'trade?' });
    interaction.channel = { awaitMessageComponent: jest.fn().mockResolvedValue(selectInteraction) };

    await tradesCommand.execute(interaction);

    expect(api.post).toHaveBeenCalledWith('/trades/listing-1/offers', expect.objectContaining({
      message: 'trade?',
      offeredCards: [expect.objectContaining({ cardName: 'Mana Crypt', scryfallId: 'sf-2' })]
    }));
  });

  test('asks for a more specific name when multiple listings match', async () => {
    const api = {
      get: jest.fn().mockResolvedValueOnce({ status: 200, data: { listings: [{ _id: 'a', cardName: 'Sol Ring' }, { _id: 'b', cardName: 'Sol Ring Foil' }], total: 2 } })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Sol Ring', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('more specific') }));
  });

  test('reports no match when no listing matches', async () => {
    const api = { get: jest.fn().mockResolvedValueOnce({ status: 200, data: { listings: [], total: 0 } }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('offer', { listing: 'Nonexistent', message: null });
    await tradesCommand.execute(interaction);

    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No listing') }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: FAIL — `offer` subcommand isn't handled yet.

- [ ] **Step 3: Implement**

Add to `discord-bot/src/commands/trades.js` (needs `StringSelectMenuBuilder`, `ActionRowBuilder`, `ComponentType` imported from `discord.js` at the top of the file):

```js
const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
```

```js
async function offer(interaction, api) {
  const listingSearch = interaction.options.getString('listing', true);
  const message = interaction.options.getString('message');

  await interaction.deferReply({ ephemeral: true });

  const listRes = await api.get('/trades', { params: { card: listingSearch } });
  if (listRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
  }
  const matches = listRes.data.listings;
  if (matches.length === 0) {
    return interaction.followUp({ content: `❌ No listing matches "${listingSearch}". Try /trades browse to see what's available.`, ephemeral: true });
  }
  if (matches.length > 1) {
    const names = matches.map(l => l.cardName).join(', ');
    return interaction.followUp({ content: `❌ Multiple listings match "${listingSearch}": ${names}. Be more specific.`, ephemeral: true });
  }
  const listing = matches[0];

  const cardsRes = await api.get('/cards');
  if (cardsRes.status === 401) return replyNotLinked(interaction);
  if (cardsRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${cardsRes.status}).`, ephemeral: true });
  }
  const ownedCards = cardsRes.data;
  if (ownedCards.length === 0) {
    return interaction.followUp({ content: "You don't have any cards to offer.", ephemeral: true });
  }

  const options = ownedCards.slice(0, 25).map((c, i) => ({
    label: `${c.name} (${c.condition})`.slice(0, 100),
    value: String(i)
  }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('trade-offer-select')
      .setPlaceholder('Select one or more cards to offer')
      .setMinValues(1)
      .setMaxValues(options.length)
      .addOptions(options)
  );

  await interaction.followUp({
    content: `Offering on "${listing.cardName}" — pick the card(s) you want to offer:`,
    components: [row],
    ephemeral: true
  });

  let selectInteraction;
  try {
    selectInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: i => i.customId === 'trade-offer-select' && i.user.id === interaction.user.id,
      time: 30000
    });
  } catch {
    return interaction.followUp({ content: '⌛ Selection timed out.', ephemeral: true });
  }

  const selectedCards = selectInteraction.values.map(v => ownedCards[Number(v)]);
  const offeredCards = selectedCards.map(c => ({
    cardName: c.name,
    cardSet: c.set,
    condition: c.condition,
    quantity: 1,
    estimatedValue: c.price,
    scryfallId: c.scryfallId,
    imageUrl: c.imageUrl
  }));

  const postRes = await api.post(`/trades/${listing._id}/offers`, { offeredCards, message: message || '' });
  if (postRes.status !== 201) {
    await selectInteraction.update({ content: `❌ Couldn't submit the offer (${postRes.status}).`, components: [] });
    return;
  }

  const cardList = selectedCards.map(c => c.name).join(', ');
  await selectInteraction.update({ content: `✅ Offered ${cardList} on "${listing.cardName}".`, components: [] });
}
```

Add the dispatch line inside `execute`:

```js
    if (sub === 'offer') return offer(interaction, api);
```

In `discord-bot/src/registerCommands.js`, add an `offer` subcommand:

```js
    .addSubcommand(sub => sub.setName('offer').setDescription('Offer one or more of your cards on a listing')
      .addStringOption(o => o.setName('listing').setDescription('Card name of the listing to offer on').setRequired(true))
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
git commit -m "feat: add /trades offer with multi-card select"
```

---

## Task 7: `/trades received`, `/trades sent`, and the trade-button handler module

**Files:**
- Modify: `discord-bot/src/commands/trades.js`
- Modify: `discord-bot/src/registerCommands.js`
- Modify: `discord-bot/__tests__/trades.test.js`
- Create: `discord-bot/src/tradeButtons.js`
- Create: `discord-bot/__tests__/tradeButtons.test.js`

This task adds the two remaining `/trades` subcommands (which render Accept/Reject/Cancel buttons) and the module that handles those buttons being clicked. The button-handling logic lives in its own module (not directly in `index.js`) so it's unit-testable without booting the live Discord client — `index.js` (Task 8) just imports and calls it.

- [ ] **Step 1: Write the failing tests for `/trades received` and `/trades sent`**

Add to `discord-bot/__tests__/trades.test.js` (needs `ButtonBuilder`, `ButtonStyle` available via `discord.js` — no new import needed in the test file itself, just asserting on the shape the command builds):

```js
describe('/trades received', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows pending received offers with Accept/Reject buttons', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{
          _id: 'offer-1', status: 'pending', fromUsername: 'bob', message: 'trade?',
          listingId: { cardName: 'Sol Ring' },
          offeredCards: [{ cardName: 'Mana Crypt', quantity: 1 }]
        }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('received', {});
    await tradesCommand.execute(interaction);

    expect(api.get).toHaveBeenCalledWith('/trades/offers/received');
    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds[0].description).toContain('bob');
    expect(call.embeds[0].description).toContain('Mana Crypt');
    const button = call.components[0].components[0].data;
    expect(button.custom_id).toBe('trade-accept:offer-1');
  });

  test('reports no pending offers', async () => {
    const api = { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) };
    client.mockReturnValue(api);

    const interaction = mockInteraction('received', {});
    await tradesCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No pending') }));
  });
});

describe('/trades sent', () => {
  afterEach(() => jest.clearAllMocks());

  test('shows sent offers, with a Cancel button on pending ones', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'offer-2', status: 'pending', toUsername: 'carol', listingId: { cardName: 'Rhystic Study' } }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('sent', {});
    await tradesCommand.execute(interaction);

    const call = interaction.reply.mock.calls[0][0];
    expect(call.embeds[0].description).toContain('carol');
    const button = call.components[0].components[0].data;
    expect(button.custom_id).toBe('trade-cancel:offer-2');
  });

  test('does not show a Cancel button on a non-pending offer', async () => {
    const api = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: [{ _id: 'offer-3', status: 'accepted', toUsername: 'carol', listingId: { cardName: 'Rhystic Study' } }]
      })
    };
    client.mockReturnValue(api);

    const interaction = mockInteraction('sent', {});
    await tradesCommand.execute(interaction);

    const call = interaction.reply.mock.calls[0][0];
    expect(call.components).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: FAIL — `received`/`sent` subcommands aren't handled yet.

- [ ] **Step 3: Implement the two subcommands**

Add to the top imports of `discord-bot/src/commands/trades.js`:

```js
const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
```

(replacing the narrower import added in Task 6 with this fuller one).

Add these two functions:

```js
async function received(interaction, api) {
  const res = await api.get('/trades/offers/received');
  if (res.status === 401) return replyNotLinked(interaction);
  if (res.status !== 200) {
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }

  const pending = res.data.filter(o => o.status === 'pending').slice(0, 5);
  if (pending.length === 0) {
    return interaction.reply({ content: 'No pending offers to review.', ephemeral: true });
  }

  const offer = pending[0];
  const cardsList = offer.offeredCards.map(c => `${c.cardName} x${c.quantity}`).join(', ');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trade-accept:${offer._id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`trade-reject:${offer._id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [{
      title: `Offer on "${offer.listingId?.cardName || 'your listing'}"`,
      description: `From **${offer.fromUsername}**: ${cardsList}${offer.message ? `\n"${offer.message}"` : ''}`
    }],
    components: [row],
    ephemeral: true
  });

  // Additional pending offers (beyond the first) are sent as follow-ups, each with its own buttons.
  for (const extra of pending.slice(1)) {
    const extraCardsList = extra.offeredCards.map(c => `${c.cardName} x${c.quantity}`).join(', ');
    const extraRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade-accept:${extra._id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade-reject:${extra._id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
    );
    await interaction.followUp({
      embeds: [{
        title: `Offer on "${extra.listingId?.cardName || 'your listing'}"`,
        description: `From **${extra.fromUsername}**: ${extraCardsList}${extra.message ? `\n"${extra.message}"` : ''}`
      }],
      components: [extraRow],
      ephemeral: true
    });
  }
}

async function sent(interaction, api) {
  const res = await api.get('/trades/offers/sent');
  if (res.status === 401) return replyNotLinked(interaction);
  if (res.status !== 200) {
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }
  if (res.data.length === 0) {
    return interaction.reply({ content: "You haven't sent any trade offers.", ephemeral: true });
  }

  const offer = res.data[0];
  const lines = res.data.slice(0, 10).map(o => `**${o.listingId?.cardName || 'Unknown listing'}** — to ${o.toUsername} (${o.status})`);
  const components = [];
  if (offer.status === 'pending') {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade-cancel:${offer._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    ));
  }

  return interaction.reply({
    embeds: [{ title: 'Your Sent Offers', description: lines.join('\n') }],
    components,
    ephemeral: true
  });
}
```

Add the dispatch lines inside `execute`:

```js
    if (sub === 'received') return received(interaction, api);
    if (sub === 'sent') return sent(interaction, api);
```

In `discord-bot/src/registerCommands.js`, add:

```js
    .addSubcommand(sub => sub.setName('received').setDescription('Review pending trade offers you\'ve received'))
    .addSubcommand(sub => sub.setName('sent').setDescription('View trade offers you\'ve sent')),
```

(Note the trailing comma replaces whatever previously closed the `trades` builder in Task 6 — this is now the last subcommand, so the `SlashCommandBuilder` chain ends here.)

- [ ] **Step 4: Run to verify the subcommand tests pass**

Run: `cd discord-bot && timeout 60 npx jest "__tests__/trades.test.js" --runInBand`
Expected: PASS (all tests)

- [ ] **Step 5: Write the failing test for the button-handler module**

```js
// discord-bot/__tests__/tradeButtons.test.js
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

    expect(interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Offer is no longer pending') }));
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd discord-bot && timeout 60 npx jest tradeButtons --runInBand`
Expected: FAIL with "Cannot find module '../src/tradeButtons'"

- [ ] **Step 7: Implement**

```js
// discord-bot/src/tradeButtons.js
const { client } = require('./apiClient');

const ACTIONS = {
  accept: { verb: 'accept', pastTense: 'Accepted' },
  reject: { verb: 'reject', pastTense: 'Rejected' },
  cancel: { verb: 'cancel', pastTense: 'Cancelled' }
};

// Handles clicks on the Accept/Reject/Cancel buttons rendered by
// /trades received and /trades sent. customId format: `trade-<action>:<offerId>`.
async function handleTradeButton(interaction) {
  const [, action, offerId] = interaction.customId.match(/^trade-(accept|reject|cancel):(.+)$/) || [];
  if (!action || !offerId) return;

  const api = client(interaction.user.id);
  const res = await api.put(`/trades/offers/${offerId}/${ACTIONS[action].verb}`);

  if (res.status !== 200) {
    const message = res.data?.message || `Something went wrong (${res.status}).`;
    return interaction.update({ content: `❌ ${message}`, components: [] });
  }

  return interaction.update({ content: `✅ ${ACTIONS[action].pastTense} the offer.`, components: [] });
}

module.exports = { handleTradeButton };
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd discord-bot && timeout 60 npx jest tradeButtons --runInBand`
Expected: PASS (4 tests)

- [ ] **Step 9: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 10: Commit**

```bash
git add discord-bot/src/commands/trades.js discord-bot/src/registerCommands.js discord-bot/__tests__/trades.test.js discord-bot/src/tradeButtons.js discord-bot/__tests__/tradeButtons.test.js
git commit -m "feat: add /trades received, /trades sent, and the trade-button handler"
```

---

## Task 8: Wire the button dispatcher into index.js

**Files:**
- Modify: `discord-bot/src/index.js`

`index.js` has no existing test file (it's the live-login entry point, not unit-testable directly) — this task is verified by re-running the full bot suite (which exercises `tradeButtons.js` directly, already covered) plus a manual smoke test in Task 9.

- [ ] **Step 1: Read `discord-bot/src/index.js` in full**

Confirm the exact current shape of the `Events.InteractionCreate` handler before editing.

- [ ] **Step 2: Add the button-interaction branch**

Add the import near the top:

```js
const { handleTradeButton } = require('./tradeButtons');
```

Change the `Events.InteractionCreate` handler from:

```js
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: '❌ Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});
```

to:

```js
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('trade-')) {
    try {
      await handleTradeButton(interaction);
    } catch (error) {
      console.error(`Error handling button ${interaction.customId}:`, error);
      const payload = { content: '❌ Something went wrong handling that action.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: '❌ Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});
```

- [ ] **Step 3: Add the 4 new commands to the dispatch map**

Change:

```js
const commands = new Map([
  require('./commands/link'),
  require('./commands/unlink'),
  require('./commands/card'),
  require('./commands/collection'),
  require('./commands/add'),
  require('./commands/remove'),
  require('./commands/update'),
  require('./commands/price'),
  require('./commands/wishlist'),
  require('./commands/decks'),
  require('./commands/deck'),
  require('./commands/similar'),
  require('./commands/synergy'),
  require('./commands/commander'),
  require('./commands/sets'),
  require('./commands/location'),
  require('./commands/deckstats'),
].map(cmd => [cmd.name, cmd]));
```

to:

```js
const commands = new Map([
  require('./commands/link'),
  require('./commands/unlink'),
  require('./commands/card'),
  require('./commands/collection'),
  require('./commands/add'),
  require('./commands/remove'),
  require('./commands/update'),
  require('./commands/price'),
  require('./commands/wishlist'),
  require('./commands/decks'),
  require('./commands/deck'),
  require('./commands/similar'),
  require('./commands/synergy'),
  require('./commands/commander'),
  require('./commands/sets'),
  require('./commands/location'),
  require('./commands/deckstats'),
  require('./commands/achievements'),
  require('./commands/pricealerts'),
  require('./commands/trades'),
].map(cmd => [cmd.name, cmd]));
```

- [ ] **Step 4: Run the full bot test suite**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass (index.js itself has no direct tests, but this confirms nothing else broke)

- [ ] **Step 5: Register commands to the guild**

Run: `cd discord-bot && node src/registerCommands.js`
Expected: `Registered 20 slash commands to guild <guild-id>.`

- [ ] **Step 6: Commit**

```bash
git add discord-bot/src/index.js
git commit -m "feat: wire trade-button dispatch and register the 3 new commands"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full bot test suite one more time**

Run: `cd discord-bot && timeout 60 npx jest --runInBand`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke test**

Restart the bot so it picks up all changes. In Discord, against a real linked account with real collection/wishlist data:
- `/wishlist deals`, `/achievements`, `/pricealerts` — confirm each renders sensibly (including the "nothing to show" case if applicable).
- `/trades create type:have card:<a card you own>` — confirm a listing appears via `/trades browse` afterward.
- `/trades create type:want card:<any real card>` — confirm it appears too.
- From a second linked account (or by having your own listing to test against), `/trades offer listing:<that card>` — confirm the multi-select appears, selecting a card submits successfully.
- `/trades received` on the listing owner's account — confirm the Accept/Reject buttons appear and clicking Accept updates the message and actually accepts the offer (verify via `/trades my-listings` showing the listing as `completed`).
- `/trades sent` — confirm the Cancel button appears on a still-pending offer and works.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 8) before considering this done.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { client, resolveImageUrl } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { detectDeckImportSource, SUPPORTED_SITES } = require('../lib/deckImportSource');
const { sendPaginated } = require('../lib/pager');

const SECTION_ORDER = ['Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Planeswalkers', 'Lands', 'Other'];

function sectionFor(card) {
  const types = card.types || [];
  if (types.includes('Land')) return 'Lands';
  if (types.includes('Creature')) return 'Creatures';
  if (types.includes('Planeswalker')) return 'Planeswalkers';
  if (types.includes('Instant')) return 'Instants';
  if (types.includes('Sorcery')) return 'Sorceries';
  if (types.includes('Enchantment')) return 'Enchantments';
  if (types.includes('Artifact')) return 'Artifacts';
  return 'Other';
}

function cardLine(c) {
  const qty = (c.quantity || 1) > 1 ? `${c.quantity}× ` : '';
  return `${qty}${c.name}`;
}

/**
 * Full decklist as embed lines: commander (and partner) first, then the main
 * deck grouped by card type, then the sideboard. Empty lines act as visual
 * spacing between sections.
 */
function decklistLines(deck) {
  const lines = [];
  if (deck.commander?.name) {
    lines.push(`**Commander:** ${deck.commander.name}`);
    if (deck.partnerCommander?.name) lines.push(`**Partner:** ${deck.partnerCommander.name}`);
    lines.push('');
  }

  const groups = {};
  for (const c of deck.mainDeck || []) {
    const section = sectionFor(c);
    (groups[section] = groups[section] || []).push(c);
  }
  for (const section of SECTION_ORDER) {
    const cards = groups[section];
    if (!cards || cards.length === 0) continue;
    lines.push(`**__${section}__**`);
    for (const c of cards) lines.push(cardLine(c));
    lines.push('');
  }

  if ((deck.sideboard || []).length > 0) {
    lines.push('**__Sideboard__**');
    for (const c of deck.sideboard) lines.push(cardLine(c));
    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

async function view(interaction, api) {
  const name = interaction.options.getString('name', true);

  await interaction.deferReply();

  const listRes = await api.get('/decks');
  if (listRes.status === 401) return replyNotLinked(interaction);
  if (listRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).` });
  }
  const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    return interaction.followUp({ content: `❌ No deck named "${name}".` });
  }

  const deckRes = await api.get(`/decks/${match._id}`);
  if (deckRes.status !== 200) {
    return interaction.followUp({ content: `❌ Something went wrong (${deckRes.status}).` });
  }
  const deck = deckRes.data;
  const thumbnailUrl = resolveImageUrl(deck.commander?.imageUrl);
  const fields = [
    { name: 'Format', value: deck.format || 'N/A', inline: true },
    { name: 'Cards', value: String(deck.statistics?.totalCards ?? deck.mainDeck?.length ?? 0), inline: true }
  ];
  if (deck.totalValue > 0) {
    fields.push({ name: 'Value', value: `$${deck.totalValue.toFixed(2)}`, inline: true });
  }
  await interaction.followUp({
    embeds: [{
      title: deck.name,
      color: 0x8b5cf6,
      fields,
      thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined
    }],
  });

  // Then the full decklist, paginated so even a 100-card deck stays readable.
  const lines = decklistLines(deck);
  if (lines.length > 0) {
    const totalCards = deck.statistics?.totalCards ?? deck.mainDeck?.length ?? 0;
    await sendPaginated(interaction, {
      title: `${deck.name} — Decklist`,
      color: 0x8b5cf6,
      lines,
      pageSize: 15,
      footerExtra: `${totalCards} card${totalCards === 1 ? '' : 's'}`
    });
  }
}

function colorIdentityLine(deckData) {
  const colors = new Set([
    ...(deckData.commander?.colorIdentity || []),
    ...(deckData.partnerCommander?.colorIdentity || [])
  ]);
  return colors.size > 0 ? [...colors].join('') : 'Colorless';
}

async function importDeck(interaction, api) {
  const rawUrl = interaction.options.getString('url', true);
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const source = detectDeckImportSource(url);

  if (!source) {
    return interaction.reply({
      content: `❌ That doesn't look like a supported deck URL. Supported sites: ${SUPPORTED_SITES.join(', ')}.`,
    });
  }

  await interaction.deferReply();

  const parseRes = await api.post('/decks/import', { source, data: url });
  if (parseRes.status === 401) return replyNotLinked(interaction);
  if (parseRes.status !== 200) {
    const message = parseRes.data?.message || `Something went wrong (${parseRes.status}).`;
    return interaction.followUp({ content: `❌ ${message}` });
  }

  const { deckData, statistics, validation } = parseRes.data;
  const commanderLine = deckData.partnerCommander
    ? `${deckData.commander.name} + ${deckData.partnerCommander.name}`
    : deckData.commander.name;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('deck-import-confirm').setLabel('Confirm Import').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('deck-import-cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );

  const fields = [
    { name: 'Commander', value: commanderLine, inline: true },
    { name: 'Cards', value: String(statistics?.totalCards ?? deckData.mainDeck?.length ?? 0), inline: true },
    { name: 'Colors', value: colorIdentityLine(deckData), inline: true }
  ];

  if (validation?.errors?.length) {
    fields.push({ name: '❌ Errors', value: validation.errors.join('\n') });
  }
  if (validation?.warnings?.length) {
    fields.push({ name: '⚠️ Warnings', value: validation.warnings.join('\n') });
  }

  await interaction.followUp({
    embeds: [{
      title: deckData.name,
      fields
    }],
    components: [row],
  });

  let buttonInteraction;
  try {
    buttonInteraction = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && (i.customId === 'deck-import-confirm' || i.customId === 'deck-import-cancel'),
      time: 30000
    });
  } catch {
    return interaction.followUp({ content: '⌛ Import timed out — nothing was saved.' });
  }

  if (buttonInteraction.customId === 'deck-import-cancel') {
    return buttonInteraction.update({ content: 'Import cancelled — nothing was saved.', embeds: [], components: [] });
  }

  const saveRes = await api.post('/decks', { ...deckData, statistics });
  if (saveRes.status === 401) {
    await buttonInteraction.update({ components: [] });
    return replyNotLinked(interaction);
  }
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

    return interaction.reply({ content: 'Unknown subcommand.' });
  }
};

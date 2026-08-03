const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { detectDeckImportSource, SUPPORTED_SITES } = require('../lib/deckImportSource');

async function view(interaction, api) {
  const name = interaction.options.getString('name', true);

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
  const rawUrl = interaction.options.getString('url', true);
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
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

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

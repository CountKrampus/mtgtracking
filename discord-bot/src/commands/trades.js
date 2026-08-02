const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

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

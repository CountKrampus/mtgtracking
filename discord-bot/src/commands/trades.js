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

module.exports = {
  name: 'trades',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'browse') return browse(interaction, api);
    if (sub === 'my-listings') return myListings(interaction, api);
    if (sub === 'create') return create(interaction, api);

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

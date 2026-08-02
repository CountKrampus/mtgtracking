const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
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
  if (postRes.status === 401) {
    await selectInteraction.update({ components: [] });
    return replyNotLinked(interaction);
  }
  if (postRes.status !== 201) {
    const errMsg = postRes.data?.message || `Couldn't submit the offer (${postRes.status}).`;
    await selectInteraction.update({ content: `❌ ${errMsg}`, components: [] });
    return;
  }

  const cardList = selectedCards.map(c => c.name).join(', ');
  await selectInteraction.update({ content: `✅ Offered ${cardList} on "${listing.cardName}".`, components: [] });
}

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
  const cardsList = offer.offeredCards.map(c => `• ${c.cardName} x${c.quantity}`).join('\n');
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

  for (const extra of pending.slice(1)) {
    const extraCardsList = extra.offeredCards.map(c => `• ${c.cardName} x${c.quantity}`).join('\n');
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

  const listed = res.data.slice(0, 10);
  const lines = listed.map(o => `**${o.listingId?.cardName || 'Unknown listing'}** — to ${o.toUsername} (${o.status})`);

  await interaction.reply({
    embeds: [{ title: 'Your Sent Offers', description: lines.join('\n') }],
    ephemeral: true
  });

  for (const o of listed) {
    if (o.status !== 'pending') continue;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade-cancel:${o._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );
    await interaction.followUp({
      content: `Cancel your offer on "${o.listingId?.cardName || 'this listing'}"?`,
      components: [row],
      ephemeral: true
    });
  }
}

module.exports = {
  name: 'trades',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'browse') return browse(interaction, api);
    if (sub === 'my-listings') return myListings(interaction, api);
    if (sub === 'create') return create(interaction, api);
    if (sub === 'offer') return offer(interaction, api);
    if (sub === 'received') return received(interaction, api);
    if (sub === 'sent') return sent(interaction, api);

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

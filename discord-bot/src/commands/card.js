const { client, resolveImageUrl } = require('../apiClient');

module.exports = {
  name: 'card',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);

    // Defer first: the Scryfall passthrough makes a backend round-trip that
    // can exceed Discord's 3-second initial-response window.
    await interaction.deferReply();

    const api = client(); // no linking required - pure Scryfall passthrough
    const res = await api.get('/scryfall/search', { params: { name } });

    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't find a card named "${name}".` });
    }

    const card = res.data;
    const imageUrl = resolveImageUrl(card.imageUrl);

    const fields = [];
    if (card.manaCost) fields.push({ name: 'Mana Cost', value: card.manaCost, inline: true });
    if (card.types?.length) fields.push({ name: 'Type', value: card.types.join(' '), inline: true });
    fields.push(
      { name: 'Set', value: card.set || 'Unknown', inline: true },
      { name: 'Price (USD)', value: card.prices?.usd ? `$${card.prices.usd}` : 'N/A', inline: true },
      { name: 'Rarity', value: card.rarity || 'N/A', inline: true }
    );
    // The backend price can come from the MTGGoldfish backup when Scryfall
    // has no listing - say so instead of always claiming Scryfall.
    const priceSource = card.prices?.source && card.prices.source !== 'Scryfall'
      ? `Price via ${card.prices.source} · Data via Scryfall`
      : 'Card data via Scryfall';

    return interaction.followUp({
      embeds: [{
        title: card.name,
        color: 0x3b82f6,
        description: card.oracleText || '',
        fields,
        image: imageUrl ? { url: imageUrl } : undefined,
        footer: { text: priceSource }
      }],
    });
  }
};

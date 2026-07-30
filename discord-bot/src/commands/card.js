const { client, resolveImageUrl } = require('../apiClient');

module.exports = {
  name: 'card',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(); // no linking required - pure Scryfall passthrough
    const res = await api.get('/scryfall/search', { params: { name } });

    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Couldn't find a card named "${name}".`, ephemeral: true });
    }

    const card = res.data;
    const imageUrl = resolveImageUrl(card.imageUrl);

    return interaction.reply({
      embeds: [{
        title: card.name,
        description: card.oracleText || '',
        fields: [
          { name: 'Set', value: card.set || 'Unknown', inline: true },
          { name: 'Price (USD)', value: card.prices?.usd ? `$${card.prices.usd}` : 'N/A', inline: true },
          { name: 'Rarity', value: card.rarity || 'N/A', inline: true }
        ],
        image: imageUrl ? { url: imageUrl } : undefined
      }],
      ephemeral: true
    });
  }
};

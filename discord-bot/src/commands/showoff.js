const { client, resolveImageUrl } = require('../apiClient');
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

      const base = process.env.PUBLIC_ASSET_BASE_URL ||
        (process.env.API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      const shareUrl = deck.shareCode ? `${base}/shared/deck/${deck.shareCode}` : null;
      const thumbnailUrl = resolveImageUrl(deck.commander?.imageUrl);

      const embed = {
        title: `🃏 ${deck.name}`,
        thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
        fields: [
          { name: 'Commander', value: deck.commander?.name || 'None', inline: true },
          { name: 'Format', value: deck.format || 'commander', inline: true },
          { name: 'Cards', value: String(cardCount), inline: true },
          { name: 'Value', value: `$${(deck.totalValue || 0).toFixed(2)}`, inline: true },
        ],
      };
      if (shareUrl) embed.description = `[View deck →](${shareUrl})`;

      return interaction.followUp({ embeds: [embed] });
    }

    return interaction.followUp({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

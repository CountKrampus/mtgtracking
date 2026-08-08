const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'search',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('query', true).trim();
    const api = client(interaction.user.id);

    const res = await api.get('/cards', { params: { search: query, limit: 15 } });
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const cards = Array.isArray(res.data) ? res.data : (res.data.cards || []);
    if (cards.length === 0) {
      return interaction.followUp({
        content: `No cards matching **"${query}"** in your collection.`,
        ephemeral: true,
      });
    }

    const lines = cards.map(c => {
      const foil = c.isFoil ? ' ✨' : '';
      const qty = c.quantity > 1 ? ` ×${c.quantity}` : '';
      const price = c.price > 0 ? ` — $${c.price.toFixed(2)}` : '';
      const cond = c.condition ? ` [${c.condition}]` : '';
      return `• **${c.name}**${foil}${qty}${cond}${price}`;
    });

    const total = res.data.total ?? cards.length;
    const footer = total > cards.length ? `Showing ${cards.length} of ${total} matches` : `${total} match${total !== 1 ? 'es' : ''}`;

    return interaction.followUp({
      embeds: [{
        title: `🔍 Search: "${query}"`,
        description: lines.join('\n'),
        color: 0x3b82f6,
        footer: { text: footer },
      }],
      ephemeral: true,
    });
  }
};

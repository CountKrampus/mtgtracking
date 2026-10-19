const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

module.exports = {
  name: 'decks',
  async execute(interaction) {
    // Defer before the backend call so a slow response can't trip Discord's
    // 3-second initial-response window.
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get('/decks');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }
    if (res.data.length === 0) {
      return interaction.followUp({ content: 'You have no decks yet.' });
    }
    const decks = res.data;
    const lines = decks.map(d => {
      const parts = [];
      if (d.statistics?.totalCards) parts.push(`${d.statistics.totalCards} cards`);
      if (d.totalValue > 0) parts.push(`$${d.totalValue.toFixed(2)}`);
      return `• ${d.name}${parts.length > 0 ? ` — ${parts.join(' · ')}` : ''}`;
    });
    return sendPaginated(interaction, {
      title: 'Your Decks',
      color: 0x8b5cf6,
      lines,
      footerExtra: `${decks.length} deck${decks.length === 1 ? '' : 's'}`
    });
  }
};

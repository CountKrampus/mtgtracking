// discord-bot/src/commands/movers.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

function fmtRow(r) {
  const sign = r.changePct >= 0 ? '+' : '';
  return `• **${r.name}** — $${(r.oldPrice || 0).toFixed(2)} → $${(r.newPrice || 0).toFixed(2)} (${sign}${r.changePct.toFixed(1)}%)`;
}

module.exports = {
  name: 'movers',
  async execute(interaction) {
    // Defer first: the backend walks a price snapshot per card, which is slow
    // on big collections.
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get('/stats/price-changes');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const gainers = res.data.gainers || [];
    const losers = res.data.losers || [];

    if (gainers.length === 0 && losers.length === 0) {
      return interaction.followUp({
        content: 'No price movements recorded yet — movers need at least two price snapshots per card (recorded over time while the app is in use).',
      });
    }

    const sections = [];
    if (gainers.length > 0) {
      sections.push(`**📈 Top Gainers**\n${gainers.map(fmtRow).join('\n')}`);
    }
    if (losers.length > 0) {
      sections.push(`**📉 Top Losers**\n${losers.map(fmtRow).join('\n')}`);
    }

    return interaction.followUp({
      embeds: [{
        title: 'Price Movers — Last 30 Days',
        description: sections.join('\n\n'),
        color: 0xf59e0b,
        footer: { text: 'Based on price snapshots of cards in your collection' }
      }],
    });
  }
};
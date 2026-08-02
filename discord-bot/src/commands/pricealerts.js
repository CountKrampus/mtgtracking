const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'pricealerts',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/cards');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const withAlerts = res.data.filter(c => c.priceAlert?.targetPrice > 0 || c.priceAlert?.targetHigh > 0);

    if (withAlerts.length === 0) {
      return interaction.reply({ content: "You don't have any price alerts set.", ephemeral: true });
    }

    const shown = withAlerts.slice(0, 25);
    const description = shown.map(c => {
      const thresholds = [];
      if (c.priceAlert?.targetPrice > 0) thresholds.push(`drop to $${c.priceAlert.targetPrice}`);
      if (c.priceAlert?.targetHigh > 0) thresholds.push(`rise to $${c.priceAlert.targetHigh}`);
      return `• ${c.name} — $${c.price} now (alert: ${thresholds.join(', ')})`;
    }).join('\n');

    return interaction.reply({
      embeds: [{ title: `Price Alerts (${withAlerts.length})`, description }],
      ephemeral: true
    });
  }
};

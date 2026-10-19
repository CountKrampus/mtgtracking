const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

module.exports = {
  name: 'pricealerts',
  async execute(interaction) {
    // Defer before the backend call: /cards must scan the whole collection
    // for alerts and can easily exceed 3 seconds.
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get('/cards');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const withAlerts = res.data.filter(c => c.priceAlert?.targetPrice > 0 || c.priceAlert?.targetHigh > 0);

    if (withAlerts.length === 0) {
      return interaction.followUp({ content: "You don't have any price alerts set." });
    }

    const lines = withAlerts.map(c => {
      const thresholds = [];
      if (c.priceAlert?.targetPrice > 0) thresholds.push(`drop to $${c.priceAlert.targetPrice}`);
      if (c.priceAlert?.targetHigh > 0) thresholds.push(`rise to $${c.priceAlert.targetHigh}`);
      return `• ${c.name} — $${c.price} now (alert: ${thresholds.join(', ')})`;
    });

    return sendPaginated(interaction, {
      title: `Price Alerts (${withAlerts.length})`,
      color: 0xf59e0b,
      lines,
      pageSize: 15,
      footerExtra: 'Alert thresholds are your saved targets'
    });
  }
};

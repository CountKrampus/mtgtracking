const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'inventory',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const api = client(interaction.user.id);
    const res = await api.get('/locations/stats');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const locations = res.data;
    if (!locations.length) {
      return interaction.followUp({ content: 'You have no storage locations set up yet.', ephemeral: true });
    }

    const lines = locations.map(loc => {
      const cap = loc.maxCapacity ? `/${loc.maxCapacity}` : '';
      const warn = loc.maxCapacity && loc.cardCount > loc.maxCapacity * 0.9
        ? (loc.cardCount > loc.maxCapacity ? ' ⚠️' : ' ⚡')
        : '';
      return `**${loc.name}**${warn} — ${loc.cardCount}${cap} cards · $${loc.totalValue.toFixed(2)}`;
    });

    const totalCards = locations.reduce((s, l) => s + l.cardCount, 0);
    const totalValue = locations.reduce((s, l) => s + l.totalValue, 0);

    return interaction.followUp({
      embeds: [{
        title: '📦 Storage Inventory',
        description: lines.join('\n'),
        fields: [
          { name: 'Locations', value: String(locations.length), inline: true },
          { name: 'Total Cards', value: String(totalCards), inline: true },
          { name: 'Total Value', value: `$${totalValue.toFixed(2)}`, inline: true },
        ],
        color: 0x14b8a6,
        footer: { text: '⚠️ = over capacity  ⚡ = nearly full' },
      }],
      ephemeral: true,
    });
  }
};

const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'collection',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'stats') {
      return interaction.reply({ content: 'Unknown subcommand.' });
    }

    // Defer only after validating the subcommand (an instant reply), and
    // before the backend round-trip below.
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get('/stats');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const stats = res.data;
    const fields = [
      { name: 'Total Cards', value: String(stats.totalCards ?? 0), inline: true },
      { name: 'Unique Cards', value: String(stats.uniqueCards ?? 0), inline: true },
      { name: 'Total Value', value: `$${(stats.totalValue ?? 0).toFixed(2)}`, inline: true }
    ];

    // Color breakdown (W/U/B/R/G + colorless), skipping empty buckets.
    const COLOR_LABEL = { W: '⬜ White', U: '🟦 Blue', B: '⬛ Black', R: '🟥 Red', G: '🟩 Green', C: '◆ Colorless' };
    const colorParts = Object.entries(stats.colorDistribution || {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => `${COLOR_LABEL[color] || color}: ${count}`);
    if (colorParts.length > 0) {
      fields.push({ name: 'Colors', value: colorParts.join(' · ') });
    }

    // Top card types by count.
    const topTypes = Object.entries(stats.typeDistribution || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    if (topTypes.length > 0) {
      fields.push({ name: 'Top Types', value: topTypes.map(([type, count]) => `${type}: ${count}`).join(' · ') });
    }

    // Value by rarity.
    const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythic: 'Mythic' };
    const rarityParts = Object.entries(stats.valueByRarity || {})
      .sort((a, b) => b[1] - a[1])
      .map(([rarity, value]) => `${RARITY_LABEL[rarity] || rarity}: $${value.toFixed(2)}`);
    if (rarityParts.length > 0) {
      fields.push({ name: 'Value by Rarity', value: rarityParts.join('\n') });
    }

    // Most valuable sets in the collection.
    const topSets = Object.entries(stats.valueBySet || {}).slice(0, 5);
    if (topSets.length > 0) {
      fields.push({ name: 'Top Sets by Value', value: topSets.map(([set, value]) => `${set}: $${value.toFixed(2)}`).join('\n') });
    }

    // Portfolio P&L, only when purchase prices exist for something.
    if (stats.portfolioCost > 0) {
      const gain = stats.portfolioGain || 0;
      const pct = ((gain / stats.portfolioCost) * 100).toFixed(1);
      const sign = gain >= 0 ? '📈 +' : '📉 -';
      fields.push({
        name: 'Portfolio P&L',
        value: `${sign}$${Math.abs(gain).toFixed(2)} on $${stats.portfolioCost.toFixed(2)} invested (${pct}%)`,
        inline: true
      });
    }

    // Value excluded by ignore-price locations/tags, when any.
    if (stats.ignoredValue > 0) {
      fields.push({
        name: '⚠️ Ignored Value',
        value: `$${stats.ignoredValue.toFixed(2)} excluded via ignore-price locations/tags`,
        inline: true
      });
    }

    return interaction.followUp({
      embeds: [{
        title: 'Collection Stats',
        color: 0x8b5cf6,
        fields
      }],
    });
  }
};

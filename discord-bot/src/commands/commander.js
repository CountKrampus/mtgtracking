const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'commander',
  async execute(interaction) {
    await interaction.deferReply();

    const colors = interaction.options.getString('colors');
    const api = client(interaction.user.id);
    const params = colors ? { colors } : {};
    const res = await api.get('/commanders/recommend', { params });

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const all = res.data;
    const fields = all.slice(0, 10).map(c => ({
      name: c.name,
      value: c.prices?.usd ? `$${c.prices.usd}` : 'N/A',
      inline: true
    }));

    return interaction.followUp({
      embeds: [{
        title: 'Commander Recommendations',
        color: 0xf59e0b,
        fields: fields.length > 0 ? fields : [{ name: 'No results', value: 'N/A' }],
        footer: all.length > 10 ? { text: `Top 10 of ${all.length} recommendations` } : undefined
      }],
    });
  }
};

const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'commander',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const colors = interaction.options.getString('colors');
    const api = client(interaction.user.id);
    const params = colors ? { colors } : {};
    const res = await api.get('/commanders/recommend', { params });

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const fields = res.data.slice(0, 10).map(c => ({
      name: c.name,
      value: c.prices?.usd ? `$${c.prices.usd}` : 'N/A',
      inline: true
    }));

    return interaction.followUp({
      embeds: [{ title: 'Commander Recommendations', fields: fields.length > 0 ? fields : [{ name: 'No results', value: 'N/A' }] }],
      ephemeral: true
    });
  }
};

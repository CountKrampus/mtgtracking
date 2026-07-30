const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'collection',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'stats') {
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }

    const api = client(interaction.user.id);
    const res = await api.get('/stats');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const stats = res.data;
    return interaction.reply({
      embeds: [{
        title: 'Collection Stats',
        fields: [
          { name: 'Total Cards', value: String(stats.totalCards ?? 0), inline: true },
          { name: 'Total Value', value: `$${(stats.totalValue ?? 0).toFixed(2)}`, inline: true }
        ]
      }],
      ephemeral: true
    });
  }
};

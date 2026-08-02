const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'achievements',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/achievements');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const all = res.data;
    const earned = all.filter(a => a.earned);

    if (earned.length === 0) {
      return interaction.reply({ content: "You haven't earned any achievements yet.", ephemeral: true });
    }

    const description = earned.map(a => `${a.icon} **${a.name}**`).join('\n');

    return interaction.reply({
      embeds: [{ title: `Achievements (${earned.length}/${all.length})`, description }],
      ephemeral: true
    });
  }
};

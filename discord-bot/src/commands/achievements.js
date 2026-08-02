const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'achievements',
  async execute(interaction) {
    const api = client(interaction.user.id);

    // Deferred because this endpoint also runs auto-grant checks server-side
    // (queries + a conditional insertMany), which can exceed Discord's 3s
    // interaction window under load.
    await interaction.deferReply({ ephemeral: true });

    const res = await api.get('/achievements');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const all = res.data;
    const earned = all.filter(a => a.earned);

    if (earned.length === 0) {
      return interaction.followUp({ content: "You haven't earned any achievements yet.", ephemeral: true });
    }

    const description = earned.map(a => `${a.icon} **${a.name}**`).join('\n');

    return interaction.followUp({
      embeds: [{ title: `Achievements (${earned.length}/${all.length})`, description }],
      ephemeral: true
    });
  }
};

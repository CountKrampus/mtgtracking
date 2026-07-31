const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'sets',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const api = client(interaction.user.id);
    const res = await api.get('/sets/completion');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    const fields = res.data.slice(0, 10).map(s => {
      const pct = s.totalInSet > 0 ? Math.round((s.ownedUnique / s.totalInSet) * 100) : 0;
      return {
        name: `${s.setCode} — ${s.setName}`,
        value: `${s.ownedUnique}/${s.totalInSet} (${pct}%)`
      };
    });

    return interaction.followUp({
      embeds: [{ title: 'Set Completion', fields: fields.length > 0 ? fields : [{ name: 'No data', value: 'No sets tracked yet' }] }],
      ephemeral: true
    });
  }
};

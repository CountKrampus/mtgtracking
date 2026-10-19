const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

module.exports = {
  name: 'sets',
  async execute(interaction) {
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get('/sets/completion');

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const sets = res.data;
    if (sets.length === 0) {
      return interaction.followUp({ content: 'No sets tracked yet.' });
    }

    // Description lines (not fields) so every tracked set is reachable through
    // the pager, with an ASCII progress bar for a quick visual scan.
    const lines = sets.map(s => {
      const pct = s.totalInSet > 0 ? Math.round((s.ownedUnique / s.totalInSet) * 100) : 0;
      const filled = Math.round(pct / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      return `\`${bar}\` **${s.setCode} — ${s.setName}** ${s.ownedUnique}/${s.totalInSet} (${pct}%)`;
    });

    return sendPaginated(interaction, {
      title: 'Set Completion',
      color: 0x14b8a6,
      lines,
      footerExtra: `${sets.length} set${sets.length === 1 ? '' : 's'} tracked`
    });
  }
};

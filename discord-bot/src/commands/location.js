const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

module.exports = {
  name: 'location',
  async execute(interaction) {
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const locRes = await api.get('/locations');
    if (locRes.status === 401) return replyNotLinked(interaction);
    if (locRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${locRes.status}).` });
    }

    const needle = name.trim().toLowerCase();
    const matches = locRes.data.filter(l => l.name.toLowerCase().includes(needle));

    if (matches.length === 0) {
      const available = locRes.data.map(l => l.name).join(', ') || 'none yet';
      return interaction.followUp({ content: `❌ No location matches "${name}". Available locations: ${available}` });
    }
    if (matches.length > 1) {
      const names = matches.map(l => l.name).join(', ');
      return interaction.followUp({ content: `❌ Multiple locations match "${name}": ${names}. Be more specific.` });
    }

    const location = matches[0];
    const cardsRes = await api.get('/cards');
    if (cardsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${cardsRes.status}).` });
    }

    const cardsHere = cardsRes.data.filter(c => c.location === location.name);
    if (cardsHere.length === 0) {
      return interaction.followUp({
        embeds: [{ title: location.name, color: 0x64748b, description: 'No cards stored here yet.' }],
      });
    }

    const lines = cardsHere.map(c => `${c.name} x${c.quantity}`);
    return sendPaginated(interaction, {
      title: location.name,
      color: 0x64748b,
      lines,
      pageSize: 15,
      footerExtra: `${cardsHere.length} card${cardsHere.length === 1 ? '' : 's'} here`
    });
  }
};

const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'location',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const locRes = await api.get('/locations');
    if (locRes.status === 401) return replyNotLinked(interaction);
    if (locRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${locRes.status}).`, ephemeral: true });
    }

    const needle = name.trim().toLowerCase();
    const matches = locRes.data.filter(l => l.name.toLowerCase().includes(needle));

    if (matches.length === 0) {
      const available = locRes.data.map(l => l.name).join(', ') || 'none yet';
      return interaction.followUp({ content: `❌ No location matches "${name}". Available locations: ${available}`, ephemeral: true });
    }
    if (matches.length > 1) {
      const names = matches.map(l => l.name).join(', ');
      return interaction.followUp({ content: `❌ Multiple locations match "${name}": ${names}. Be more specific.`, ephemeral: true });
    }

    const location = matches[0];
    const cardsRes = await api.get('/cards');
    if (cardsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${cardsRes.status}).`, ephemeral: true });
    }

    const cardsHere = cardsRes.data.filter(c => c.location === location.name);
    const lines = cardsHere.slice(0, 25).map(c => `${c.name} x${c.quantity}`);
    const truncated = cardsHere.length > 25 ? `\n...and ${cardsHere.length - 25} more` : '';

    return interaction.followUp({
      embeds: [{
        title: location.name,
        description: lines.length > 0 ? lines.join('\n') + truncated : 'No cards stored here yet.'
      }],
      ephemeral: true
    });
  }
};

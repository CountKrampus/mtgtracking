const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'decks',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.get('/decks');
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }
    if (res.data.length === 0) {
      return interaction.reply({ content: 'You have no decks yet.', ephemeral: true });
    }
    const lines = res.data.slice(0, 20).map(d => `• ${d.name}`);
    return interaction.reply({
      embeds: [{ title: 'Your Decks', description: lines.join('\n') }],
      ephemeral: true
    });
  }
};

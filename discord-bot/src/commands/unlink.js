// discord-bot/src/commands/unlink.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'unlink',
  async execute(interaction) {
    const api = client(interaction.user.id);
    const res = await api.delete('/discord/link');

    if (res.status === 200) {
      return interaction.reply({ content: '✅ Unlinked your MTG Tracker account.', ephemeral: true });
    }
    if (res.status === 401) {
      return replyNotLinked(interaction);
    }
    return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
  }
};

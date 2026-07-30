// discord-bot/src/commands/link.js
const { client } = require('../apiClient');

module.exports = {
  name: 'link',
  async execute(interaction) {
    const code = interaction.options.getString('code', true);
    const api = client();
    const res = await api.post('/discord/exchange', { code, discordUserId: interaction.user.id });

    if (res.status === 201) {
      return interaction.reply({
        content: '✅ Linked! Your Discord account is now connected to MTG Tracker.',
        ephemeral: true
      });
    }
    if (res.status === 400) {
      return interaction.reply({
        content: '❌ That code is invalid or expired. Generate a new one in Settings.',
        ephemeral: true
      });
    }
    return interaction.reply({ content: `❌ Something went wrong (${res.status}). Try again later.`, ephemeral: true });
  }
};

// discord-bot/src/commands/link.js
const { client } = require('../apiClient');

module.exports = {
  name: 'link',
  async execute(interaction) {
    const code = interaction.options.getString('code', true);

    // Defer before the exchange call - the backend has to look up and
    // consume the code, which can take longer than 3 seconds.
    await interaction.deferReply();

    const api = client();
    const res = await api.post('/discord/exchange', { code, discordUserId: interaction.user.id });

    if (res.status === 201) {
      return interaction.followUp({
        content: '✅ Linked! Your Discord account is now connected to MTG Tracker.',
      });
    }
    if (res.status === 400) {
      return interaction.followUp({
        content: '❌ That code is invalid or expired. Generate a new one in Settings.',
      });
    }
    return interaction.followUp({ content: `❌ Something went wrong (${res.status}). Try again later.` });
  }
};

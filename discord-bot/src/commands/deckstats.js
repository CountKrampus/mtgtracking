const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deckstats',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.followUp({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const statsRes = await api.get(`/decks/${match._id}/stats`);
    if (statsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${statsRes.status}).`, ephemeral: true });
    }

    const { powerLevel, saltScore } = statsRes.data;
    const fields = [
      { name: 'Power Level', value: `${powerLevel.level}/10`, inline: true },
      { name: 'Salt Score', value: String(saltScore.score), inline: true }
    ];
    if (saltScore.cards?.length > 0) {
      fields.push({
        name: 'Salty Cards',
        value: saltScore.cards.slice(0, 5).map(c => `${c.name} (${c.salt})`).join('\n')
      });
    }

    return interaction.followUp({
      embeds: [{ title: `${match.name} — Power & Salt`, fields }],
      ephemeral: true
    });
  }
};

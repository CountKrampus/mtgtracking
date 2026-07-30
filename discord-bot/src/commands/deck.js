const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deck',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.reply({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const deckRes = await api.get(`/decks/${match._id}`);
    if (deckRes.status !== 200) {
      return interaction.reply({ content: `❌ Something went wrong (${deckRes.status}).`, ephemeral: true });
    }
    const deck = deckRes.data;
    return interaction.reply({
      embeds: [{
        title: deck.name,
        fields: [
          { name: 'Format', value: deck.format || 'N/A', inline: true },
          { name: 'Cards', value: String(deck.statistics?.totalCards ?? deck.mainDeck?.length ?? 0), inline: true }
        ]
      }],
      ephemeral: true
    });
  }
};

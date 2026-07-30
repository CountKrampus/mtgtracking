const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deck',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    // Deferred up front: this command makes two sequential backend round-
    // trips (list, then the matched deck's detail) that can exceed
    // Discord's 3-second initial-response window, and followUp() (used
    // throughout below) requires the interaction to already be deferred
    // or replied.
    await interaction.deferReply({ ephemeral: true });

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.followUp({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const deckRes = await api.get(`/decks/${match._id}`);
    if (deckRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${deckRes.status}).`, ephemeral: true });
    }
    const deck = deckRes.data;
    return interaction.followUp({
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

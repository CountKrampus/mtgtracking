const { client } = require('../apiClient');
const { resolveCard } = require('../lib/resolveCard');
const { replyNotLinked } = require('../lib/notLinked');

function formatList(cards) {
  if (!cards || cards.length === 0) return 'None found';
  return cards.slice(0, 5).map(c => c.name).join('\n');
}

module.exports = {
  name: 'synergy',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('card', true);
    const api = client(interaction.user.id);
    const resolved = await resolveCard(interaction, api, name);

    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: '⌛ Selection timed out.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const res = await api.get(`/cards/${card._id}/synergies`);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
    }

    return interaction.followUp({
      embeds: [{
        title: `Synergies for ${card.name}`,
        fields: [
          { name: 'Tribal', value: formatList(res.data.tribal) },
          { name: 'Keywords', value: formatList(res.data.keywords) },
          { name: 'Mechanics', value: formatList(res.data.mechanics) }
        ]
      }],
      ephemeral: true
    });
  }
};

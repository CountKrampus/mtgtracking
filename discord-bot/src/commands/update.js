const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

module.exports = {
  name: 'update',
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const field = interaction.options.getString('field', true); // 'condition' | 'quantity' | 'location'
    const rawValue = interaction.options.getString('value', true);
    const api = client(interaction.user.id);

    // Deferred up front: resolveCard and the update below both make backend
    // round-trips that can exceed Discord's 3-second initial-response
    // window, and followUp()/editReply() (used throughout below) both
    // require the interaction to already be deferred or replied.
    await interaction.deferReply({ ephemeral: true });

    const resolved = await resolveCard(interaction, api, name);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ No card matching "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: 'No selection made in time.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const value = field === 'quantity' ? parseInt(rawValue, 10) : rawValue;
    const putRes = await api.put(`/cards/${card._id}`, { [field]: value });

    if (putRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't update "${card.name}" (${putRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ Updated "${card.name}" — ${field} is now ${value}.`, ephemeral: true });
  }
};

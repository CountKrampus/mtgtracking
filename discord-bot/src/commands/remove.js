const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { resolveCard } = require('../lib/resolveCard');

module.exports = {
  name: 'remove',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const resolved = await resolveCard(interaction, api, name);
    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.reply({ content: `❌ No card matching "${name}" in your collection.`, ephemeral: true });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: 'No selection made in time.', ephemeral: true });
    }
    if (resolved.status === 'error') {
      return interaction.reply({ content: `❌ Something went wrong (${resolved.httpStatus}).`, ephemeral: true });
    }

    const card = resolved.card;
    const remaining = card.quantity - quantity;

    if (remaining <= 0) {
      const delRes = await api.delete(`/cards/${card._id}`);
      if (delRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't remove "${card.name}" (${delRes.status}).`, ephemeral: true });
      }
      return interaction.followUp({ content: `✅ Removed "${card.name}" from your collection.`, ephemeral: true });
    }

    const putRes = await api.put(`/cards/${card._id}`, { quantity: remaining });
    if (putRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't update "${card.name}" (${putRes.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ "${card.name}" quantity is now ${remaining}.`, ephemeral: true });
  }
};

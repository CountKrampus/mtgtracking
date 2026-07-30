const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'add',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);

    const api = client(interaction.user.id);
    const res = await api.post('/cards', { name, quantity, condition: 'NM' });

    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200 && res.status !== 201) {
      return interaction.reply({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
    }

    const card = res.data;
    const message = card.merged
      ? `✅ Merged with your existing "${name}". New quantity: ${card.quantity}.`
      : `✅ Added ${quantity}x "${card.name}" to your collection.`;
    return interaction.reply({ content: message, ephemeral: true });
  }
};

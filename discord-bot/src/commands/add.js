const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'add',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);

    const api = client(interaction.user.id);

    // The backend's own auto-merge (POST /cards) only merges on an exact
    // name + set + condition match, but the bot never knows which printing
    // the user means - so without this lookup, every /add for a card the
    // user already owns (under any set) would silently create a second,
    // minimal (set: "Unknown", $0) duplicate instead of incrementing it.
    const listRes = await api.get('/cards');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.reply({ content: `❌ Couldn't add "${name}" (${listRes.status}).`, ephemeral: true });
    }
    const existing = listRes.data.find(c => c.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      const putRes = await api.put(`/cards/${existing._id}`, { quantity: existing.quantity + quantity });
      if (putRes.status !== 200) {
        return interaction.reply({ content: `❌ Couldn't add "${name}" (${putRes.status}).`, ephemeral: true });
      }
      return interaction.reply({
        content: `✅ Merged with your existing "${name}". New quantity: ${putRes.data.quantity}.`,
        ephemeral: true
      });
    }

    const res = await api.post('/cards', { name, quantity, condition: 'NM' });
    if (res.status !== 200 && res.status !== 201) {
      return interaction.reply({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
    }
    return interaction.reply({ content: `✅ Added ${quantity}x "${res.data.name}" to your collection.`, ephemeral: true });
  }
};

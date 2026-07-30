const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'add',
  async execute(interaction) {
    const quantity = interaction.options.getInteger('quantity', true);
    const name = interaction.options.getString('name', true);

    const api = client(interaction.user.id);

    // Deferred up front: this command makes two sequential backend round-
    // trips (list, then put/post) that can exceed Discord's 3-second
    // initial-response window, and followUp()/editReply() (used throughout
    // below) both require the interaction to already be deferred or replied.
    await interaction.deferReply({ ephemeral: true });

    // The backend's own auto-merge (POST /cards) only merges on an exact
    // name + set + condition match, but the bot never knows which printing
    // the user means - so without this lookup, every /add for a card the
    // user already owns (under any set) would silently create a second,
    // minimal (set: "Unknown", $0) duplicate instead of incrementing it.
    const listRes = await api.get('/cards');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't add "${name}" (${listRes.status}).`, ephemeral: true });
    }
    const existing = listRes.data.find(c => c.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      const putRes = await api.put(`/cards/${existing._id}`, { quantity: existing.quantity + quantity });
      if (putRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't add "${name}" (${putRes.status}).`, ephemeral: true });
      }
      return interaction.followUp({
        content: `✅ Merged with your existing "${name}". New quantity: ${putRes.data.quantity}.`,
        ephemeral: true
      });
    }

    const res = await api.post('/cards', { name, quantity, condition: 'NM' });
    if (res.status !== 200 && res.status !== 201) {
      return interaction.followUp({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
    }
    return interaction.followUp({ content: `✅ Added ${quantity}x "${res.data.name}" to your collection.`, ephemeral: true });
  }
};

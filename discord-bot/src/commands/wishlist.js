const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'wishlist',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'list') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }
      if (res.data.length === 0) {
        return interaction.reply({ content: 'Your wishlist is empty.', ephemeral: true });
      }
      const lines = res.data.slice(0, 20).map(item => `• ${item.name} (${item.priority})`);
      return interaction.reply({
        embeds: [{ title: 'Wishlist', description: lines.join('\n') }],
        ephemeral: true
      });
    }

    if (sub === 'add') {
      const name = interaction.options.getString('name', true);
      const res = await api.post('/wishlist', { name, priority: 'medium' });
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 201) {
        return interaction.reply({ content: `❌ Couldn't add "${name}" (${res.status}).`, ephemeral: true });
      }
      return interaction.reply({ content: `✅ Added "${name}" to your wishlist.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name', true);
      const listRes = await api.get('/wishlist');
      if (listRes.status === 401) return replyNotLinked(interaction);
      if (listRes.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
      }
      const match = listRes.data.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!match) {
        return interaction.reply({ content: `❌ "${name}" isn't on your wishlist.`, ephemeral: true });
      }
      const delRes = await api.delete(`/wishlist/${match._id}`);
      if (delRes.status !== 200) {
        return interaction.reply({ content: `❌ Couldn't remove "${name}" (${delRes.status}).`, ephemeral: true });
      }
      return interaction.reply({ content: `✅ Removed "${name}" from your wishlist.`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

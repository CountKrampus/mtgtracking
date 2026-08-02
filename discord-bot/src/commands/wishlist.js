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

    if (sub === 'deals') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }
      const deals = res.data.filter(item =>
        item.currentPrice > 0 && item.targetPrice > 0 && item.currentPrice <= item.targetPrice
      );
      if (deals.length === 0) {
        return interaction.reply({ content: 'No deals right now.', ephemeral: true });
      }
      const lines = deals.slice(0, 20).map(item => `• ${item.name}: $${item.currentPrice} (target $${item.targetPrice})`);
      return interaction.reply({
        embeds: [{ title: 'Wishlist Deals', description: lines.join('\n') }],
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

      // Deferred up front: unlike 'list'/'add' above, 'remove' makes two
      // sequential backend round-trips (list, then delete) that can exceed
      // Discord's 3-second initial-response window, and followUp() (used
      // throughout this branch) requires the interaction to already be
      // deferred or replied.
      await interaction.deferReply({ ephemeral: true });

      const listRes = await api.get('/wishlist');
      if (listRes.status === 401) return replyNotLinked(interaction);
      if (listRes.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
      }
      const match = listRes.data.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!match) {
        return interaction.followUp({ content: `❌ "${name}" isn't on your wishlist.`, ephemeral: true });
      }
      const delRes = await api.delete(`/wishlist/${match._id}`);
      if (delRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't remove "${name}" (${delRes.status}).`, ephemeral: true });
      }
      return interaction.followUp({ content: `✅ Removed "${name}" from your wishlist.`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

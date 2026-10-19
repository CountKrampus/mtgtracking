const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

const PRIORITY_ICON = { high: '🔴', medium: '🟡', low: '🟢' };

module.exports = {
  name: 'wishlist',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    // Defer up front for every subcommand: each branch makes one or two
    // backend round-trips (list, then delete for 'remove') that can exceed
    // Discord's 3-second initial-response window. followUp() (used
    // throughout below) requires the interaction to already be deferred.
    await interaction.deferReply();

    if (sub === 'list') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
      }
      if (res.data.length === 0) {
        return interaction.followUp({ content: 'Your wishlist is empty.' });
      }
      const items = res.data;
      const lines = items.map(item => `${PRIORITY_ICON[item.priority] || '⚪'} **${item.name}** (${item.priority})`);
      return sendPaginated(interaction, {
        title: 'Wishlist',
        color: 0xec4899,
        lines,
        footerExtra: `${items.length} card${items.length === 1 ? '' : 's'}`
      });
    }

    if (sub === 'deals') {
      const res = await api.get('/wishlist');
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
      }
      const deals = res.data.filter(item =>
        item.currentPrice > 0 && item.targetPrice > 0 && item.currentPrice <= item.targetPrice
      );
      if (deals.length === 0) {
        return interaction.followUp({ content: 'No deals right now.' });
      }
      const lines = deals.map(item => `• ${item.name} (${item.priority}): $${item.currentPrice} (target $${item.targetPrice})`);
      return sendPaginated(interaction, {
        title: 'Wishlist Deals',
        color: 0x22c55e,
        lines,
        footerExtra: `${deals.length} deal${deals.length === 1 ? '' : 's'}`
      });
    }

    if (sub === 'add') {
      const name = interaction.options.getString('name', true);
      const res = await api.post('/wishlist', { name, priority: 'medium' });
      if (res.status === 401) return replyNotLinked(interaction);
      if (res.status !== 201) {
        return interaction.followUp({ content: `❌ Couldn't add "${name}" (${res.status}).` });
      }
      return interaction.followUp({ content: `✅ Added "${name}" to your wishlist.` });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name', true);

      const listRes = await api.get('/wishlist');
      if (listRes.status === 401) return replyNotLinked(interaction);
      if (listRes.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).` });
      }
      const match = listRes.data.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!match) {
        return interaction.followUp({ content: `❌ "${name}" isn't on your wishlist.` });
      }
      const delRes = await api.delete(`/wishlist/${match._id}`);
      if (delRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't remove "${name}" (${delRes.status}).` });
      }
      return interaction.followUp({ content: `✅ Removed "${name}" from your wishlist.` });
    }

    if (sub === 'acquire') {
      const name = interaction.options.getString('name', true);

      const listRes = await api.get('/wishlist');
      if (listRes.status === 401) return replyNotLinked(interaction);
      if (listRes.status !== 200) {
        return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).` });
      }
      const matches = listRes.data.filter(item => item.name.toLowerCase() === name.toLowerCase());
      if (matches.length === 0) {
        return interaction.followUp({ content: `❌ "${name}" isn't on your wishlist.` });
      }
      if (matches.length > 1) {
        return interaction.followUp({
          content: `❌ Multiple wishlist entries match "${name}" — clean those up in the app first.`,
        });
      }

      const item = matches[0];
      const acqRes = await api.post(`/wishlist/${item._id}/acquire`, {});
      if (acqRes.status === 401) return replyNotLinked(interaction);
      if (acqRes.status !== 200) {
        return interaction.followUp({ content: `❌ Couldn't acquire "${name}" (${acqRes.status}).` });
      }
      const message = acqRes.data?.merged
        ? `✅ "${item.name}" acquired and merged with your existing copy — ${acqRes.data.message}`
        : `✅ "${item.name}" acquired and added to your collection.`;
      return interaction.followUp({ content: message });
    }

    return interaction.followUp({ content: 'Unknown subcommand.' });
  }
};

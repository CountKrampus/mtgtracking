const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

const PAGE_SIZE = 10;

function formatCards(cards) {
  return cards.map(c => {
    const foil = c.isFoil ? ' ✨' : '';
    const qty = c.quantity > 1 ? ` ×${c.quantity}` : '';
    const price = c.price > 0 ? ` — $${c.price.toFixed(2)}` : '';
    const cond = c.condition ? ` [${c.condition}]` : '';
    return `• **${c.name}**${foil}${qty}${cond}${price}`;
  });
}

module.exports = {
  name: 'search',
  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query', true).trim();
    const api = client(interaction.user.id);

    const res = await api.get('/cards', { params: { search: query, limit: PAGE_SIZE, page: 1 } });
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const cards = Array.isArray(res.data) ? res.data : (res.data.cards || []);
    if (cards.length === 0) {
      return interaction.followUp({
        content: `No cards matching **"${query}"** in your collection.`,
      });
    }

    // Server-side paging: the backend slices per page (limit/page params), so
    // paging deep into a big collection never loads the whole thing here.
    const total = (Array.isArray(res.data) ? cards.length : res.data.total) ?? cards.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return sendPaginated(interaction, {
      title: `🔍 Search: "${query}"`,
      color: 0x3b82f6,
      pageCount,
      loadLines: async (pageIdx) => {
        if (pageIdx === 0) return formatCards(cards);
        const pageRes = await api.get('/cards', { params: { search: query, limit: PAGE_SIZE, page: pageIdx + 1 } });
        return pageRes.status === 200
          ? formatCards(pageRes.data.cards || [])
          : ['❌ Could not load this page — try the search again.'];
      },
      footerExtra: `${total} match${total === 1 ? '' : 'es'}`,
    });
  }
};

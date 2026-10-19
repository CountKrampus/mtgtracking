const { client } = require('../apiClient');
const { resolveCard } = require('../lib/resolveCard');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'similar',
  async execute(interaction) {
    await interaction.deferReply();

    const name = interaction.options.getString('card', true);
    const api = client(interaction.user.id);
    const resolved = await resolveCard(interaction, api, name);

    if (resolved.status === 'not_linked') return replyNotLinked(interaction);
    if (resolved.status === 'no_match') {
      return interaction.followUp({ content: `❌ Couldn't find "${name}" in your collection.` });
    }
    if (resolved.status === 'timed_out') {
      return interaction.followUp({ content: '⌛ Selection timed out.' });
    }
    if (resolved.status === 'error') {
      return interaction.followUp({ content: `❌ Something went wrong (${resolved.httpStatus}).` });
    }

    const card = resolved.card;
    const res = await api.get(`/cards/${card._id}/similar`);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const all = res.data;
    const fields = all.slice(0, 10).map(c => ({
      name: c.name,
      value: c.prices?.usd ? `$${c.prices.usd}` : 'N/A',
      inline: true
    }));

    return interaction.followUp({
      embeds: [{
        title: `Similar to ${card.name}`,
        color: 0x8b5cf6,
        fields: fields.length > 0 ? fields : [{ name: 'No results', value: 'N/A' }],
        footer: all.length > 10 ? { text: `Top 10 of ${all.length} similar cards` } : undefined
      }],
    });
  }
};

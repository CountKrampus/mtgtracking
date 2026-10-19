const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

// Renders a simple ASCII bar for a day's count relative to the max in the set.
function bar(value, max) {
  if (max === 0) return '░░░░░░░░░░';
  const filled = Math.round((value / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

module.exports = {
  name: 'trend',
  async execute(interaction) {
    await interaction.deferReply();

    const days = interaction.options.getInteger('days') || 30;
    const api = client(interaction.user.id);

    const res = await api.get('/cards/acquisitions', { params: { days } });
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const data = res.data.data || [];
    if (data.length === 0) {
      return interaction.followUp({
        content: `No cards were added in the last ${days} days.`,
      });
    }

    const totalCards = data.reduce((s, d) => s + d.cardsAdded, 0);
    const totalValue = data.reduce((s, d) => s + d.valueAdded, 0);
    const maxCards = Math.max(...data.map(d => d.cardsAdded));

    // Show at most the 14 most recent entries to keep embed compact
    const rows = data.slice(-14).map(d => {
      const dateLabel = d.date.slice(5); // MM-DD
      return `\`${dateLabel}\` ${bar(d.cardsAdded, maxCards)} ${d.cardsAdded}`;
    });

    // Omit the footer entirely (undefined key) when nothing was cut off;
    // `footer: { text: undefined }` would serialize as an empty footer and
    // fail Discord's embed validation.
    const footer = data.length > 14 ? { text: `Bar chart shows the ${rows.length} most recent active days` } : undefined;

    return interaction.followUp({
      embeds: [{
        title: `📈 Acquisition Trend — Last ${days} Days`,
        description: rows.join('\n'),
        fields: [
          { name: 'Cards Added', value: String(totalCards), inline: true },
          { name: 'Value Added', value: `$${totalValue.toFixed(2)}`, inline: true },
          { name: 'Active Days', value: String(data.length), inline: true },
        ],
        footer,
        color: 0x8b5cf6,
      }],
    });
  }
};

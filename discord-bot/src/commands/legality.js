const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

const STATUS_LABELS = {
  banned: 'Banned',
  not_legal: 'Not Legal',
  suspended: 'Suspended',
  banned_as_commander: 'Banned as Commander',
};

module.exports = {
  name: 'legality',
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).`, ephemeral: true });
    }

    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.followUp({ content: `❌ No deck named "${name}".`, ephemeral: true });
    }

    const legalRes = await api.get(`/decks/${match._id}/legality`);
    if (legalRes.status !== 200) {
      return interaction.followUp({ content: `❌ Couldn't check legality (${legalRes.status}).`, ephemeral: true });
    }

    const { format, violations, checked } = legalRes.data;
    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1);

    if (violations.length === 0) {
      return interaction.followUp({
        embeds: [{
          title: `✅ ${match.name} — Legal`,
          description: `All ${checked} checked cards are legal in **${formatLabel}**.`,
          color: 0x22c55e,
        }],
        ephemeral: true,
      });
    }

    const lines = violations.slice(0, 20).map(v => {
      const label = STATUS_LABELS[v.status] || v.status;
      return `• **${v.name}** — ${label}`;
    });
    if (violations.length > 20) lines.push(`…and ${violations.length - 20} more`);

    return interaction.followUp({
      embeds: [{
        title: `❌ ${match.name} — ${violations.length} Violation${violations.length !== 1 ? 's' : ''}`,
        description: `Format: **${formatLabel}**\n\n${lines.join('\n')}`,
        color: 0xef4444,
        footer: { text: `${checked} cards checked` },
      }],
      ephemeral: true,
    });
  }
};

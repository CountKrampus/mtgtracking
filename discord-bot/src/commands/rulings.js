// discord-bot/src/commands/rulings.js
const { client } = require('../apiClient');
const { sendPaginated } = require('../lib/pager');

// Ruling comments can run long; cap so a 5-rulings page can never overflow
// Discord's 4096-char embed description limit.
const MAX_COMMENT = 750;

module.exports = {
  name: 'rulings',
  async execute(interaction) {
    const q = interaction.options.getString('card', true);

    // Defer first: this hits Scryfall twice (card lookup, then rulings).
    await interaction.deferReply();

    const api = client(); // no linking required - pure Scryfall passthrough
    const res = await api.get('/scryfall/rulings', { params: { q } });

    if (res.status === 404) {
      return interaction.followUp({ content: `❌ Couldn't find a card named "${q}".` });
    }
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const rulings = Array.isArray(res.data) ? res.data : [];
    if (rulings.length === 0) {
      return interaction.followUp({ content: `No official rulings for "${q}".` });
    }

    const lines = rulings.map(r => {
      const date = r.published_at ? r.published_at.slice(0, 10) : 'Undated';
      const comment = r.comment && r.comment.length > MAX_COMMENT
        ? `${r.comment.slice(0, MAX_COMMENT - 1)}…`
        : (r.comment || '');
      return `**${date}** — ${comment}`;
    });

    return sendPaginated(interaction, {
      title: `📜 Rulings: ${q}`,
      color: 0x3b82f6,
      lines,
      pageSize: 5,
      footerExtra: `${rulings.length} ruling${rulings.length === 1 ? '' : 's'} · via Scryfall`
    });
  }
};
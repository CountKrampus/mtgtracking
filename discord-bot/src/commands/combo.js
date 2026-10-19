// discord-bot/src/commands/combo.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');
const { sendPaginated } = require('../lib/pager');

const MAX_DESC = 280;

module.exports = {
  name: 'combo',
  async execute(interaction) {
    const name = interaction.options.getString('card', true);

    // Defer first: the backend fetches the whole Commander Spellbook combo
    // index when it isn't cached.
    await interaction.deferReply();

    const api = client(interaction.user.id);
    const res = await api.get(`/combos/for-card/${encodeURIComponent(name)}`);
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const combos = res.data.combos || [];
    if (combos.length === 0) {
      return interaction.followUp({
        content: `No infinite combos found for "${res.data.card || name}" in Commander Spellbook.`,
      });
    }

    const lines = [];
    combos.forEach((combo, i) => {
      const cards = (combo.cards || []).join(' + ');
      const produces = combo.produces ? ` → ${combo.produces}` : '';
      lines.push(`**${i + 1}. ${cards}**${produces}`);
      if (combo.prerequisite) {
        const prereq = String(combo.prerequisite).slice(0, MAX_DESC);
        lines.push(`*Prerequisites:* ${prereq}`);
      }
      if (combo.description) {
        const desc = String(combo.description);
        lines.push(desc.length > MAX_DESC ? `${desc.slice(0, MAX_DESC - 1)}…` : desc);
      }
      if (combo.spellbookUrl) {
        lines.push(`[Commander Spellbook →](${combo.spellbookUrl})`);
      }
      lines.push('');
    });
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    return sendPaginated(interaction, {
      title: `⚡ Combos: ${res.data.card || name}`,
      color: 0xeab308,
      lines,
      pageSize: 4,
      footerExtra: `${res.data.found ?? combos.length} combo${(res.data.found ?? combos.length) === 1 ? '' : 's'} · via Commander Spellbook`
    });
  }
};
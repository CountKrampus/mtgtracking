const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

module.exports = {
  name: 'deckstats',
  async execute(interaction) {
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);
    const api = client(interaction.user.id);

    const listRes = await api.get('/decks');
    if (listRes.status === 401) return replyNotLinked(interaction);
    if (listRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${listRes.status}).` });
    }
    const match = listRes.data.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return interaction.followUp({ content: `❌ No deck named "${name}".` });
    }

    const statsRes = await api.get(`/decks/${match._id}/stats`);
    if (statsRes.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${statsRes.status}).` });
    }

    const stats = statsRes.data;
    const { powerLevel, saltScore } = stats;
    const fields = [
      { name: 'Power Level', value: `${powerLevel.level}/10`, inline: true },
      { name: 'Salt Score', value: String(saltScore.score), inline: true }
    ];
    if (typeof stats.globalScore === 'number') {
      fields.push({ name: 'Global Score', value: `${stats.globalScore}/100`, inline: true });
    }
    if (stats.healthScore?.score != null) {
      fields.push({ name: 'Deck Health', value: `${stats.healthScore.score}/100`, inline: true });
    }
    if (stats.manabaseScore?.grade) {
      const [lo, hi] = stats.manabaseScore.recommendedLandRange || [];
      const range = lo ? ` — recommend ${lo}–${hi}` : '';
      fields.push({
        name: 'Manabase',
        value: `${stats.manabaseScore.grade} · ${stats.manabaseScore.landCount ?? 0} lands${range}`,
        inline: true
      });
    }
    if (stats.gamesPlayed > 0) {
      const losses = stats.gamesPlayed - (stats.wins || 0);
      const winRate = stats.winRate != null ? ` · ${Math.round(stats.winRate)}% win rate` : '';
      const placement = stats.avgPlacement ? ` · avg place #${Number(stats.avgPlacement).toFixed(1)}` : '';
      fields.push({
        name: 'Record',
        value: `${stats.wins || 0}W–${losses}L${winRate}${placement}`,
        inline: true
      });
    }
    if (saltScore.cards?.length > 0) {
      fields.push({
        name: 'Salty Cards',
        value: saltScore.cards.slice(0, 5).map(c => `${c.name} (${c.salt})`).join('\n')
      });
    }

    return interaction.followUp({
      embeds: [{ title: `${match.name} — Deck Stats`, color: 0xf59e0b, fields }],
    });
  }
};

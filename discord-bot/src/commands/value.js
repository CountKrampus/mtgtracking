// discord-bot/src/commands/value.js
const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

const MAX_BARS = 14;

// 10-char bar relative to the (value - min) range; a flat range renders as a
// full bar since the value is pinned at its max the whole time.
function bar(value, range) {
  if (range === 0) return '█'.repeat(10);
  const filled = Math.min(10, Math.max(0, Math.round((value / range) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

// Keep first and last points, sampling evenly in between.
function sample(points, max) {
  if (points.length <= max) return points;
  const picked = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    if (picked.length === 0 || picked[picked.length - 1] !== points[idx]) {
      picked.push(points[idx]);
    }
  }
  return picked;
}

const isoDate = (d) => d.toISOString().slice(0, 10);

module.exports = {
  name: 'value',
  async execute(interaction) {
    await interaction.deferReply();

    const days = interaction.options.getInteger('days') || 30;
    const api = client(interaction.user.id);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const res = await api.get('/stats/value-history', {
      params: { from: isoDate(from), to: isoDate(to) }
    });
    if (res.status === 401) return replyNotLinked(interaction);
    if (res.status !== 200) {
      return interaction.followUp({ content: `❌ Something went wrong (${res.status}).` });
    }

    const snapshots = res.data.snapshots || [];
    if (snapshots.length === 0) {
      return interaction.followUp({
        content: `No value snapshots in the last ${days} days — a snapshot is recorded once a day while the app is in use.`,
      });
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const change = last.value - first.value;
    const pct = first.value > 0 ? (change / first.value) * 100 : null;
    const arrow = change >= 0 ? '📈' : '📉';
    const changeText = `${change >= 0 ? '+' : '-'}$${Math.abs(change).toFixed(2)}`
      + (pct !== null ? ` (${change >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : '');

    const values = snapshots.map(s => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const rows = sample(snapshots, MAX_BARS).map(s => {
      const dateLabel = isoDate(new Date(s.createdAt)).slice(5); // MM-DD
      return `\`${dateLabel}\` ${bar(s.value - min, max - min)} $${Math.round(s.value).toLocaleString('en-US')}`;
    });

    const fields = [
      { name: 'Current Value', value: `$${last.value.toFixed(2)}`, inline: true },
      { name: `Change (${days}d)`, value: `${arrow} ${changeText}`, inline: true },
      { name: 'Snapshots', value: String(snapshots.length), inline: true }
    ];

    return interaction.followUp({
      embeds: [{
        title: '📈 Collection Value',
        color: 0x22c55e,
        description: rows.join('\n'),
        fields,
        footer: { text: 'Daily snapshots · bar scale is relative to the period low/high' }
      }],
    });
  }
};
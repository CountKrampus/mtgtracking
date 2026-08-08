const { client } = require('../apiClient');
const { replyNotLinked } = require('../lib/notLinked');

const GROUPS = [
  { label: 'Pricing',     types: ['price_alert'] },
  { label: 'Trading',     types: ['trade_offer', 'trade_accepted', 'trade_rejected', 'trade_countered'] },
  { label: 'Forum',       types: ['mention', 'reply', 'upvote'] },
  { label: 'Messages',    types: ['dm'] },
  { label: 'Collection',  types: ['collection_health_report', 'price_flag_resolved'] },
];

const DISPLAY_NAMES = {
  price_alert:              'Price Alert',
  trade_offer:              'Trade Offer',
  trade_accepted:           'Trade Accepted',
  trade_rejected:           'Trade Declined',
  trade_countered:          'Trade Countered',
  mention:                  'Mention',
  reply:                    'Reply',
  upvote:                   'Upvote',
  dm:                       'Direct Message',
  collection_health_report: 'Collection Report',
  price_flag_resolved:      'Price Flag Resolution',
};

const NOT_LINKED_MSG = 'Link your account first with /link <code>.';

module.exports = {
  name: 'notifications',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const api = client(interaction.user.id);

    if (sub === 'list') {
      const res = await api.get('/discord/link/prefs');
      if (res.status === 401 || res.status === 404) {
        return interaction.reply({ content: NOT_LINKED_MSG, ephemeral: true });
      }
      if (res.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${res.status}).`, ephemeral: true });
      }

      const prefs = res.data;
      const fields = GROUPS.map(group => ({
        name: group.label,
        value: group.types
          .map(t => `${prefs[t] ? '✅' : '❌'} ${DISPLAY_NAMES[t]}`)
          .join('\n'),
        inline: false,
      }));

      return interaction.reply({
        embeds: [{ title: '🔔 Discord Notification Preferences', fields }],
        ephemeral: true,
      });
    }

    if (sub === 'toggle') {
      const type = interaction.options.getString('type', true);

      const getRes = await api.get('/discord/link/prefs');
      if (getRes.status === 401 || getRes.status === 404) {
        return interaction.reply({ content: NOT_LINKED_MSG, ephemeral: true });
      }
      if (getRes.status !== 200) {
        return interaction.reply({ content: `❌ Something went wrong (${getRes.status}).`, ephemeral: true });
      }

      const currentVal = getRes.data[type] ?? false;
      const newVal = !currentVal;

      const patchRes = await api.patch('/discord/link/prefs', { [type]: newVal });
      if (patchRes.status !== 200) {
        return interaction.reply({ content: `❌ Failed to update preferences (${patchRes.status}).`, ephemeral: true });
      }

      const label = DISPLAY_NAMES[type] ?? type;
      const stateStr = newVal ? 'enabled' : 'disabled';
      const icon = newVal ? '✅' : '❌';
      return interaction.reply({
        content: `${icon} **${label}** notifications ${stateStr}.`,
        ephemeral: true,
      });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
};

const PREFIXES = {
  price_alert:              '📉 Price Alert',
  trade_offer:              '🔄 Trade Offer',
  trade_accepted:           '✅ Trade Accepted',
  trade_rejected:           '❌ Trade Declined',
  trade_countered:          '🔁 Trade Countered',
  mention:                  '🔔 Mention',
  reply:                    '💬 Reply',
  upvote:                   '⬆️ Upvote',
  dm:                       '📨 New Message',
  collection_health_report: '📊 Collection Report',
  price_flag_resolved:      '🏷️ Price Flag',
};

function formatDM(type, content) {
  const prefix = PREFIXES[type] ?? '🔔 Notification';
  return `${prefix}: ${content}`;
}

module.exports = { formatDM };

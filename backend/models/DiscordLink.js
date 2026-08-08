const mongoose = require('mongoose');

const discordLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  discordUserId: {
    type: String,
    required: true,
    unique: true
  },
  linkedAt: {
    type: Date,
    default: Date.now
  },
  notificationPrefs: {
    price_alert:              { type: Boolean, default: true },
    trade_offer:              { type: Boolean, default: false },
    trade_accepted:           { type: Boolean, default: false },
    trade_rejected:           { type: Boolean, default: false },
    trade_countered:          { type: Boolean, default: false },
    mention:                  { type: Boolean, default: false },
    reply:                    { type: Boolean, default: false },
    upvote:                   { type: Boolean, default: false },
    dm:                       { type: Boolean, default: false },
    collection_health_report: { type: Boolean, default: false },
    price_flag_resolved:      { type: Boolean, default: false },
  }
});

module.exports = mongoose.model('DiscordLink', discordLinkSchema);

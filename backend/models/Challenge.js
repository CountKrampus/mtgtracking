const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 500 },
  metric: {
    type: String,
    enum: [
      // Collection
      'foils_added', 'cards_added', 'value_added', 'color_added',
      'rarity_added', 'unique_sets', 'set_completion', 'high_value_card',
      // Trading
      'trades_completed', 'wishlist_acquired',
      // Social
      'forum_posts', 'forum_threads', 'forum_upvotes',
      // Manual
      'custom'
    ],
    required: true
  },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  target: { type: Number, required: true },
  month: { type: String, required: true }, // 'YYYY-MM'
  status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  isProposal: { type: Boolean, default: false },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

challengeSchema.index({ month: 1, status: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);

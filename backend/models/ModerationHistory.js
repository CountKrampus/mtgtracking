const mongoose = require('mongoose');

const moderationHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked', 'price_update'],
    required: true
  },
  actionDetails: mongoose.Schema.Types.Mixed,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // optional — null when action was system-generated
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Primary user history query index
moderationHistorySchema.index({ userId: 1, createdAt: -1 });

// Global feed index for recent-first queries
moderationHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ModerationHistory', moderationHistorySchema);

const mongoose = require('mongoose');

const moderationHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: ['ban', 'suspend', 'warn', 'appeal_approved', 'appeal_denied', 'override', 'ban_revoked'],
    required: true
  },
  actionDetails: mongoose.Schema.Types.Mixed,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Compound index on userId, actionType, and createdAt
moderationHistorySchema.index({ userId: 1, actionType: 1, createdAt: 1 });

// Single index on createdAt descending for recent-first queries
moderationHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ModerationHistory', moderationHistorySchema);

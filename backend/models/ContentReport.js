const mongoose = require('mongoose');

function computeSuggestedAction(source, reason, pendingCount) {
  if (source === 'automated') return 'hide_post';
  if (reason === 'harassment' || reason === 'spam') return 'hide_and_warn';
  if (pendingCount >= 3) return 'hide_post';
  return 'review';
}

const ContentReportSchema = new mongoose.Schema({
  contentId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  contentType:     { type: String, enum: ['post', 'thread'], required: true },
  reportedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:          { type: String, enum: ['spam', 'harassment', 'off-topic', 'other'], required: true },
  source:          { type: String, enum: ['user', 'automated'], required: true },
  triggeredRule:   { type: String, default: '' },
  status:          { type: String, enum: ['pending', 'actioned', 'dismissed'], default: 'pending' },
  suggestedAction: { type: String, enum: ['hide_post', 'hide_and_warn', 'review'], required: true },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:      { type: Date, default: null },
  createdAt:       { type: Date, default: Date.now }
});

ContentReportSchema.index({ contentId: 1, status: 1 });

module.exports = mongoose.model('ContentReport', ContentReportSchema);
module.exports.computeSuggestedAction = computeSuggestedAction;

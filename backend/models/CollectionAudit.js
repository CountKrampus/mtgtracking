const mongoose = require('mongoose');

const collectionAuditSchema = new mongoose.Schema({
  auditName: {
    type: String,
    required: true,
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['running', 'complete', 'failed'],
    default: 'running'
  },
  ranAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issues: [
    {
      cardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card'
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      cardName: String,
      setName: String,
      issueType: String,
      issueValue: String,
      flagged: {
        type: Boolean,
        default: false
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }
  ]
});

// Compound index on status and ranAt descending
collectionAuditSchema.index({ status: 1, ranAt: -1 });

// Single index on ranAt descending for recent-first queries
collectionAuditSchema.index({ ranAt: -1 });

module.exports = mongoose.model('CollectionAudit', collectionAuditSchema);

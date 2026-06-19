const mongoose = require('mongoose');

const banAppealSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  banId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserBan',
    required: true
  },
  appealText: {
    type: String,
    required: true,
    maxlength: 2000
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  decisionReason: {
    type: String,
    maxlength: 1000
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware
banAppealSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status !== 'pending') {
    if (!this.reviewedBy) return next(new Error('reviewedBy is required when status is not pending'));
    if (!this.decisionReason) return next(new Error('decisionReason is required when status is not pending'));
  }
  next();
});

// Unique index to prevent duplicate appeals for same ban
banAppealSchema.index({ userId: 1, banId: 1 }, { unique: true });

// Compound index on userId and status
banAppealSchema.index({ userId: 1, status: 1 });

// Compound index on status and submittedAt
banAppealSchema.index({ status: 1, submittedAt: 1 });

module.exports = mongoose.model('BanAppeal', banAppealSchema);

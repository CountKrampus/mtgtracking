const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['mute', 'ban'],
    default: 'mute',
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  level: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
    description: 'Escalation level (1-5) indicating severity of punishment'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  mutedUntil: {
    type: Date,
    description: 'When mute expires (null = permanent mute)'
  },
  bannedThreadIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    description: 'Threads where user is banned from posting'
  }],
  appealedAt: {
    type: Date,
    description: 'When user submitted an appeal'
  },
  appealedReason: {
    type: String,
    maxlength: 1000,
    description: 'User\'s explanation for why ban should be lifted'
  },
  appealStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    description: 'Status of the appeal'
  },
  appealReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Admin who reviewed the appeal'
  },
  appealReviewedAt: {
    type: Date,
    description: 'When appeal was reviewed'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for quick lookups by userId and active status
banSchema.index({ userId: 1, isActive: 1 });

// Pre-save middleware to auto-update updatedAt
banSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if mute has expired
banSchema.virtual('isExpired').get(function() {
  if (this.type !== 'mute' || !this.mutedUntil) {
    return false;
  }
  return new Date() > this.mutedUntil;
});

// Method to check if mute has expired
banSchema.methods.hasExpired = function() {
  if (this.type !== 'mute' || !this.mutedUntil) {
    return false;
  }
  return new Date() > this.mutedUntil;
};

module.exports = mongoose.model('Ban', banSchema);

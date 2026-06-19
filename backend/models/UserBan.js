const mongoose = require('mongoose');

const userBanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  banType: {
    type: String,
    enum: ['suspension', 'permanent'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Admin who issued the ban'
  },
  expiresAt: {
    type: Date,
    description: 'When suspension expires (null for permanent bans)'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bannedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for quick lookups by userId and active status
userBanSchema.index({ userId: 1, isActive: 1 });

// Index on expiresAt for finding expired suspensions
userBanSchema.index({ expiresAt: 1 });

// Pre-save middleware to auto-update updatedAt
userBanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if suspension has expired
userBanSchema.virtual('isExpired').get(function() {
  if (this.banType !== 'suspension' || !this.expiresAt) {
    return false;
  }
  return new Date() > this.expiresAt;
});

// Method to check if ban has expired
userBanSchema.methods.hasExpired = function() {
  if (this.banType !== 'suspension' || !this.expiresAt) {
    return false;
  }
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('UserBan', userBanSchema);

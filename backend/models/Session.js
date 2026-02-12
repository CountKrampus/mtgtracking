const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  isValid: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - document deleted when expiresAt is reached
  }
});

// Indexes (refreshToken already indexed via unique: true)
sessionSchema.index({ userId: 1, isValid: 1 });

// Static method to invalidate all sessions for a user
sessionSchema.statics.invalidateAllForUser = function(userId) {
  return this.updateMany(
    { userId, isValid: true },
    { isValid: false }
  );
};

// Static method to invalidate a specific session
sessionSchema.statics.invalidateSession = function(refreshToken) {
  return this.findOneAndUpdate(
    { refreshToken },
    { isValid: false },
    { new: true }
  );
};

// Static method to get active sessions for a user
sessionSchema.statics.getActiveSessions = function(userId) {
  return this.find({
    userId,
    isValid: true,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

// Static method to clean up expired sessions (optional manual cleanup)
sessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isValid: false }
    ]
  });
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;

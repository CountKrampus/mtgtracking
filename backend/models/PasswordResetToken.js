const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
passwordResetTokenSchema.index({ token: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 });
passwordResetTokenSchema.index({ used: 1 });

// Static method to create a new password reset token
passwordResetTokenSchema.statics.createToken = async function(userId) {
  // Remove any existing unused tokens for this user
  await this.deleteMany({ userId, used: false });

  // Generate a random token
  const token = require('crypto').randomBytes(32).toString('hex');
  
  // Set expiration (1 hour from now)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const resetToken = new this({
    userId,
    token,
    expiresAt
  });

  return await resetToken.save();
};

// Static method to find and validate a token
passwordResetTokenSchema.statics.findValidToken = async function(token) {
  const resetToken = await this.findOne({ 
    token,
    expiresAt: { $gt: new Date() }, // Not expired
    used: false // Not used yet
  }).populate('userId');

  return resetToken;
};

// Instance method to mark token as used
passwordResetTokenSchema.methods.markAsUsed = async function() {
  this.used = true;
  return await this.save();
};

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

module.exports = PasswordResetToken;
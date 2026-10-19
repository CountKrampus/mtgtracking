const mongoose = require('mongoose');

/**
 * A single, stable referral code per user. Generated lazily the first time a
 * user visits their Referrals page (see backend/routes/referrals.js) so we
 * don't mint codes for accounts that never look at the feature.
 *
 * `code` is unique across the site and `userId` is unique so a user can never
 * hold two live codes (the second lazy-generation call just returns the first).
 */
const referralCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'Referral code must be at least 6 characters'],
    maxlength: [12, 'Referral code cannot exceed 12 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Both unique indexes are declared here as the sole definition on their key.
// Do NOT also mark the schema fields `unique: true` — that creates a
// conflicting non-unique index on the same key and uniqueness stops being
// enforced (Mongoose logs a duplicate-index warning for the clash).
referralCodeSchema.index({ code: 1 }, { unique: true });
referralCodeSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('ReferralCode', referralCodeSchema);

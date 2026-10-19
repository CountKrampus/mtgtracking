const mongoose = require('mongoose');

/**
 * One row per referred signup. This is the anti-fraud backbone of the
 * referral system:
 *
 *  - `referredUserId` is UNIQUE, so a single referred account can never
 *    produce two payouts no matter how many times the claim/award code runs
 *    (concurrent requests, retries, re-logins). The DB enforces it, not just
 *    application logic.
 *  - `signupRepAwarded` / `qualificationRepAwarded` are flipped inside a
 *    conditional findOneAndUpdate, so a race cannot double-pay a stage.
 *  - `ipSimilarityFlag` records when the referred signup shares an IP with
 *    the referrer. It does NOT block the reward (families/roommates share a
 *    router) — it just marks the row for admin review.
 */
const referralSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  referrerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'qualified', 'rejected'],
    default: 'pending'
  },
  ipSimilarityFlag: {
    type: Boolean,
    default: false
  },
  signupRepAwarded: {
    type: Boolean,
    default: false
  },
  qualificationRepAwarded: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  qualifiedAt: {
    type: Date,
    default: null
  }
});

referralSchema.index({ code: 1 });
referralSchema.index({ referrerUserId: 1 });
referralSchema.index({ status: 1 });
// UNIQUE: one referral row per referred user, enforced by the database. This
// is the guarantee that a single referred account can never be double-counted
// (or paid out twice) no matter how many concurrent requests race. Declared
// here as the sole definition of this index — do NOT also mark the schema
// field `unique: true`, or Mongoose creates a conflicting non-unique index on
// the same key and uniqueness stops being enforced.
referralSchema.index({ referredUserId: 1 }, { unique: true });

module.exports = mongoose.model('Referral', referralSchema);

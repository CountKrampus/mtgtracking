const mongoose = require('mongoose');

const userWarningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 500
  },
  warnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  warnedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  escalationLevel: {
    type: Number,
    min: 1,
    max: 3,
    default: 1
  },
});

// Compound index on userId and warnedAt
userWarningSchema.index({ userId: 1, warnedAt: 1 });

module.exports = mongoose.model('UserWarning', userWarningSchema);

const mongoose = require('mongoose');

// One document per generation run (not unique per user/week — the admin
// run-now endpoint is meant to be triggered repeatedly for testing, and each
// run should produce a fresh report rather than fail on a duplicate-key error).
// GET /api/health-report always serves the most recent document by createdAt.
const collectionHealthReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  weekOf: {
    type: Date,
    required: true
  },
  conditionBreakdown: {
    NM: { type: Number, default: 0 },
    LP: { type: Number, default: 0 },
    MP: { type: Number, default: 0 },
    HP: { type: Number, default: 0 },
    DMG: { type: Number, default: 0 }
  },
  valueChange: {
    from: { type: Number, default: 0 },
    to: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    deltaPercent: { type: Number, default: 0 }
  },
  upgradeSuggestions: [
    {
      _id: false,
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
      name: String,
      reason: { type: String, enum: ['poor_condition', 'price_drop'], required: true },
      detail: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

collectionHealthReportSchema.index({ userId: 1, createdAt: -1 });
collectionHealthReportSchema.index({ userId: 1, weekOf: -1 });

module.exports = mongoose.model('CollectionHealthReport', collectionHealthReportSchema);

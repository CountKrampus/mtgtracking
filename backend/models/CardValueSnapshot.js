const mongoose = require('mongoose');

const cardValueSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  totalValue: {
    type: Number,
    required: true
  },
  cardCount: {
    type: Number,
    required: true
  }
});

cardValueSnapshotSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('CardValueSnapshot', cardValueSnapshotSchema);

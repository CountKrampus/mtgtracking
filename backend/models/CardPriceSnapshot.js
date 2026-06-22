const mongoose = require('mongoose');

const cardPriceSnapshotSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
cardPriceSnapshotSchema.index({ cardId: 1, createdAt: 1 });

module.exports = mongoose.model('CardPriceSnapshot', cardPriceSnapshotSchema);

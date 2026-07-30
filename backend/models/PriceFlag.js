const mongoose = require('mongoose');

const priceFlagSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, maxlength: 300, default: '' },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

priceFlagSchema.index({ cardId: 1, flaggedBy: 1 });

module.exports = mongoose.model('PriceFlag', priceFlagSchema);

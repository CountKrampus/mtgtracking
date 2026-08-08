const mongoose = require('mongoose');

const priceSourceLogSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['Scryfall', 'MTGGoldfish (backup)', 'None (not found)'],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

priceSourceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('PriceSourceLog', priceSourceLogSchema);

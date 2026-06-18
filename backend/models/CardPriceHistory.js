const mongoose = require('mongoose');

const cardPriceHistorySchema = new mongoose.Schema({
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

cardPriceHistorySchema.index({ cardId: 1, userId: 1, date: -1 });
cardPriceHistorySchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('CardPriceHistory', cardPriceHistorySchema);

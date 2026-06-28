const mongoose = require('mongoose');

const offeredCardSchema = new mongoose.Schema({
  cardName: { type: String, required: true },
  cardSet: { type: String, default: '' },
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  quantity: { type: Number, default: 1 },
  estimatedValue: { type: Number, default: 0 },
  scryfallId: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
}, { _id: false });

const tradeOfferSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeListing', required: true, index: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'From user ID is required'], index: true },
  fromUsername: { type: String, required: [true, 'From username is required'] },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'To user ID is required'], index: true },
  toUsername: { type: String, required: [true, 'To username is required'] },
  offeredCards: {
    type: [offeredCardSchema],
    validate: [arr => arr.length > 0, 'At least one card must be offered'],
  },
  message: { type: String, default: '', maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'countered'],
    default: 'pending',
    index: true,
  },
  counterOffer: {
    offeredCards: [offeredCardSchema],
    message: { type: String, default: '' },
    createdAt: { type: Date },
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

tradeOfferSchema.index({ toUserId: 1, status: 1 });
tradeOfferSchema.index({ fromUserId: 1, status: 1 });

tradeOfferSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TradeOffer', tradeOfferSchema);

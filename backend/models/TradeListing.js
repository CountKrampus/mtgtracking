const mongoose = require('mongoose');

const tradeListingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true },
  type: { type: String, enum: ['have', 'want'], required: true },
  cardName: { type: String, required: true },
  cardSet: { type: String, default: '' },
  cardSetCode: { type: String, default: '' },
  scryfallId: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  quantity: { type: Number, default: 1, min: 1 },
  estimatedValue: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

tradeListingSchema.index({ status: 1, type: 1, createdAt: -1 });
tradeListingSchema.index({ userId: 1, status: 1 });

tradeListingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TradeListing', tradeListingSchema);

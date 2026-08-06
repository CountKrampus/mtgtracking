const mongoose = require('mongoose');

const VALID_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true, trim: true },
  set: { type: String, required: false, default: 'Unknown', trim: true },
  setCode: { type: String, required: false, trim: true },
  collectorNumber: { type: String, required: false, trim: true },
  rarity: { type: String, required: false, trim: true },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  condition: { type: String, required: true, enum: VALID_CONDITIONS },
  price: { type: Number, required: true, default: 0, min: 0 },
  lastPrice: { type: Number, default: null, min: 0 },
  purchasePrice: { type: Number, default: null, min: 0 },
  colors: [{ type: String, trim: true }],
  types: [{ type: String, trim: true }],
  manaCost: { type: String, trim: true },
  scryfallId: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  isFoil: { type: Boolean, default: false },
  isToken: { type: Boolean, default: false },
  oracleText: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  location: { type: String, default: '', trim: true },
  buylistValue: { type: Number, default: 0, min: 0 },
  sellValue: { type: Number, default: 0, min: 0 },
  priceAlert: {
    targetPrice: { type: Number, default: 0, min: 0 },
    targetHigh: { type: Number, default: 0, min: 0 },
    emailNotification: { type: Boolean, default: false },
    lastAlertFiredAt: { type: Date, default: null },
    lastHighAlertFiredAt: { type: Date, default: null }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

cardSchema.index({ name: 1 });
cardSchema.index({ set: 1 });
cardSchema.index({ setCode: 1 });
cardSchema.index({ collectorNumber: 1 });
cardSchema.index({ rarity: 1 });
cardSchema.index({ condition: 1 });
cardSchema.index({ location: 1 });
cardSchema.index({ colors: 1 });
cardSchema.index({ types: 1 });
cardSchema.index({ tags: 1 });
cardSchema.index({ name: 1, set: 1, condition: 1, isFoil: 1 });
// Duplicate prevention at the database level. collectorNumber is part of the
// key so alt-art printings within one set coexist; rows without a collector
// number (null) conflict with each other, which is exactly the exact-dupe
// case the cleanup tool merges. If conflicting legacy rows still exist at
// startup, Mongoose logs a failed index build and continues; run the
// duplicate cleanup tool, then restart, and the build succeeds.
cardSchema.index(
  { userId: 1, name: 1, set: 1, condition: 1, isFoil: 1, collectorNumber: 1 },
  { unique: true }
);
cardSchema.index({ userId: 1, setCode: 1, collectorNumber: 1, condition: 1, isFoil: 1 });
cardSchema.index({ userId: 1, name: 1 });
cardSchema.index({ userId: 1, set: 1 });
cardSchema.index({ userId: 1, condition: 1 });
cardSchema.index({ userId: 1, updatedAt: -1 });

cardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;

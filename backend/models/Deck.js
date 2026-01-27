const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema({
  name: { type: String, required: true },
  commander: {
    scryfallId: { type: String, required: true },
    name: { type: String, required: true },
    manaCost: { type: String },
    colorIdentity: [{ type: String }],
    imageUrl: { type: String },
    oracleText: { type: String },
    flavorText: { type: String },
    typeLine: { type: String },
    power: { type: String },
    toughness: { type: String }
  },
  partnerCommander: {
    scryfallId: { type: String },
    name: { type: String },
    manaCost: { type: String },
    colorIdentity: [{ type: String }],
    imageUrl: { type: String },
    oracleText: { type: String },
    flavorText: { type: String },
    typeLine: { type: String },
    power: { type: String },
    toughness: { type: String }
  },
  mainDeck: [{
    scryfallId: { type: String, required: true },
    name: { type: String, required: true },
    manaCost: { type: String },
    types: [{ type: String }],
    colors: [{ type: String }],
    imageUrl: { type: String },
    quantity: { type: Number, default: 1 }
  }],
  statistics: {
    totalCards: { type: Number, default: 100 },
    manaCurve: { type: Map, of: Number },
    colorDistribution: { type: Map, of: Number },
    typeDistribution: { type: Map, of: Number },
    avgManaCost: { type: Number, default: 0 }
  },
  totalValue: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update timestamp
deckSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Deck = mongoose.model('Deck', deckSchema);

module.exports = Deck;

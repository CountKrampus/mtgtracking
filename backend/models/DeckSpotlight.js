const mongoose = require('mongoose');

const deckSpotlightSchema = new mongoose.Schema({
  deckId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  featuredAt: { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true },
  threadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread' },
  buildLabel: { type: String, default: 'Community Build' },
  budgetTier: { type: String, default: 'Unknown' },
  totalValue: { type: Number, default: 0 },
});

deckSpotlightSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('DeckSpotlight', deckSpotlightSchema);

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const Deck = require('../models/Deck');

/**
 * Get (or lazily register) the Card model.
 * In production, server.js registers it before any request arrives.
 * In tests that build a minimal app without server.js, we register a
 * minimal schema here so queries work against the in-memory database.
 */
function getCardModel() {
  if (mongoose.modelNames().includes('Card')) return mongoose.model('Card');
  const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    set: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    condition: String,
  });
  return mongoose.model('Card', schema);
}

/**
 * Get (or lazily register) the WishlistItem model.
 * Same reasoning as getCardModel above.
 */
function getWishlistItemModel() {
  if (mongoose.modelNames().includes('WishlistItem')) return mongoose.model('WishlistItem');
  const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    targetPrice: { type: Number, default: 0 },
    currentPrice: { type: Number, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  });
  return mongoose.model('WishlistItem', schema);
}

/**
 * GET /api/users/:username/public-profile
 * Public endpoint — no auth required.
 * This router is mounted in server.js BEFORE the auth-protected /api/users router.
 */
router.get('/:username/public-profile', async (req, res) => {
  try {
    // Get models — uses registry if server.js has already registered them,
    // otherwise falls back to minimal schema registration (for test environments).
    const Card = getCardModel();
    const WishlistItem = getWishlistItemModel();

    const { username } = req.params;
    const user = await User.findOne({ username, isActive: true })
      .select('username displayName avatarUrl reputation badges createdAt privacy pinnedCards')
      .lean();

    if (!user || !user.privacy?.isPublic) return res.status(404).json({ message: 'User not found' });

    // Fetch ForumLevel to check purchased unlocks and profile fields
    const level = await ForumLevel.findOne({ userId: user._id })
      .select('cosmetics aboutMeText personalLinks').lean();

    const purchased = (level?.cosmetics?.purchased || []).map(String);

    // Find all unlock-type cosmetics
    const unlockCosmetics = await Cosmetic.find({
      category: { $in: ['favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview'] },
      isActive: true,
    }).lean();

    const hasUnlock = (category) =>
      unlockCosmetics
        .filter(c => c.category === category)
        .some(c => purchased.includes(c._id.toString()));

    // Favorite cards showcase — gated by favoriteCardsShowcase unlock
    let pinnedCards = null;
    if (hasUnlock('favoriteCardsShowcase')) {
      pinnedCards = user.pinnedCards || [];
    }

    // Deck showcase — gated by deckShowcase unlock and privacy setting
    let publicDecks = null;
    if (hasUnlock('deckShowcase') && user.privacy?.showDecks !== false) {
      publicDecks = await Deck.find({ userId: user._id, isPublic: true })
        .select('name format commander description colors createdAt')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean();
    }

    // Collection stats — gated by collectionStatsWidget unlock and privacy setting
    let collectionStats = null;
    if (hasUnlock('collectionStatsWidget') && user.privacy?.showCollection) {
      const [aggResult, topCard] = await Promise.all([
        Card.aggregate([
          { $match: { userId: user._id } },
          { $group: {
            _id: null,
            totalCards: { $sum: '$quantity' },
            totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
            uniqueCards: { $sum: 1 },
          }},
        ]),
        Card.findOne({ userId: user._id, price: { $gt: 0 } })
          .sort({ price: -1 })
          .select('name price')
          .lean(),
      ]);
      collectionStats = {
        totalCards: aggResult[0]?.totalCards || 0,
        uniqueCards: aggResult[0]?.uniqueCards || 0,
        totalValue: Number((aggResult[0]?.totalValue || 0).toFixed(2)),
        mostValuableCard: topCard ? { name: topCard.name, price: topCard.price } : null,
      };
    }

    // Wishlist preview — gated by wishlistPreview unlock and privacy setting
    let wishlistPreview = null;
    if (hasUnlock('wishlistPreview') && user.privacy?.showWishlist) {
      wishlistPreview = await WishlistItem.find({ userId: user._id })
        .select('name targetPrice currentPrice priority')
        .sort({ priority: -1, targetPrice: 1 })
        .limit(3)
        .lean();
    }

    res.json({
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      reputation: user.reputation,
      badges: user.badges,
      createdAt: user.createdAt,
      pinnedCards,
      publicDecks,
      collectionStats,
      wishlistPreview,
      aboutMeText: level?.aboutMeText || '',
      personalLinks: level?.personalLinks || [],
    });
  } catch (e) {
    console.error('public-profile error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

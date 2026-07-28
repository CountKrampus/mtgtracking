const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const Deck = require('../models/Deck');
const { verifyToken, requireAuth } = require('../middleware/auth');

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
      // priority is a string enum ('low'/'medium'/'high'); sort by actual rank,
      // not alphabetically (a plain Mongo sort would put "medium" before "high").
      const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
      const items = await WishlistItem.find({ userId: user._id })
        .select('name targetPrice currentPrice priority')
        .lean();
      wishlistPreview = items
        .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.targetPrice - b.targetPrice)
        .slice(0, 3);
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

/**
 * GET /api/users/:username/compare — compare collections for trade targets.
 * Requires auth (unlike public-profile above, which is intentionally public).
 */
router.get('/:username/compare', verifyToken, requireAuth, async (req, res) => {
  try {
    const Card = getCardModel();

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!targetUser.privacy?.showCollection) {
      return res.status(403).json({ message: "This user's collection is private." });
    }

    const [myCards, theirCards] = await Promise.all([
      Card.find({ userId: req.user._id }, 'name set price imageUrl scryfallId condition quantity'),
      Card.find({ userId: targetUser._id }, 'name set price imageUrl scryfallId condition quantity'),
    ]);

    const myNames = new Set(myCards.map(c => c.name.toLowerCase()));
    const theirNames = new Set(theirCards.map(c => c.name.toLowerCase()));

    const theyHaveYouDont = theirCards
      .filter(c => !myNames.has(c.name.toLowerCase()))
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .slice(0, 200);

    const youHaveTheyDont = myCards
      .filter(c => !theirNames.has(c.name.toLowerCase()))
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .slice(0, 200);

    const theirTotal = theyHaveYouDont.reduce((s, c) => s + (c.price || 0), 0);
    const yourTotal = youHaveTheyDont.reduce((s, c) => s + (c.price || 0), 0);

    return res.json({
      targetUser: {
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl || '',
        reputation: targetUser.reputation || 0,
      },
      theyHaveYouDont,
      youHaveTheyDont,
      theirTotal,
      yourTotal,
      balance: theirTotal - yourTotal,
    });
  } catch (err) {
    console.error('Compare route error:', err);
    return res.status(500).json({ message: 'Server error during comparison.' });
  }
});

module.exports = router;

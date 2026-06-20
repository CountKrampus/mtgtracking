const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const Deck = require('../models/Deck');

/**
 * GET /api/users/:username/public-profile
 * Public endpoint — no auth required.
 * This router is mounted in server.js BEFORE the auth-protected /api/users router.
 */
router.get('/:username/public-profile', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username, isActive: true })
      .select('username displayName avatarUrl reputation badges createdAt privacy pinnedCards')
      .lean();

    if (!user || !user.privacy?.isPublic) return res.status(404).json({ message: 'User not found' });

    // Fetch ForumLevel to check purchased unlocks
    const level = await ForumLevel.findOne({ userId: user._id })
      .select('cosmetics').lean();

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
      try {
        publicDecks = await Deck.find({ userId: user._id, isPublic: true })
          .select('name format commander description')
          .limit(6)
          .lean();
      } catch {
        publicDecks = [];
      }
    }

    // Collection stats — no standalone Card model to query; return null
    const collectionStats = null;

    // Wishlist preview — no WishlistItem model to query; return null
    const wishlistPreview = null;

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
    });
  } catch (e) {
    console.error('public-profile error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

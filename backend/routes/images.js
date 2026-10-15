const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');
const Card = require('../models/Card');
const Deck = require('../models/Deck');
const { resolveCachedFilepath } = require('../utils/imageCache');

router.use(verifyToken);

// GET /api/images/lookup?name=<exact card name>
//
// Local-only fast path for hover previews (e.g. the deck builder's Missing
// Staples chips): resolve a card name to an image that is ALREADY in the disk
// cache (backend/cached-images/mtg-cards) without touching Scryfall. Sources,
// in order: the requester's own collection, their decks (mainDeck / sideboard
// / considering / commander), their wishlist. Never makes an external call —
// a 404 tells the client to fall back to the full /api/scryfall/search flow,
// which caches the image so a later lookup can succeed locally.
router.get('/lookup', requireAuth, async (req, res) => {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'name query param required' });
    }

    const userFilter = buildUserQuery({}, req);

    // 1) Own collection — indexed on { userId, name }; only rows that actually
    // carry a scryfallId count (offline-imported rows don't have one).
    const card = await Card.findOne({
      ...userFilter,
      name,
      scryfallId: { $exists: true, $ne: '' }
    }, 'scryfallId');
    let scryfallId = card?.scryfallId || null;
    let source = scryfallId ? 'collection' : null;

    // 2) Own decks — a staple missing from THIS deck may be in another deck
    if (!scryfallId) {
      const deck = await Deck.findOne({
        ...userFilter,
        $or: [
          { 'mainDeck.name': name },
          { 'sideboard.name': name },
          { 'considering.name': name },
          { 'commander.name': name },
          { 'partnerCommander.name': name },
        ],
      });
      if (deck) {
        const entry =
          [deck.mainDeck, deck.sideboard, deck.considering]
            .flatMap(arr => arr || [])
            .find(c => c.name === name && c.scryfallId) ||
          [deck.commander, deck.partnerCommander]
            .find(c => c && c.name === name && c.scryfallId);
        if (entry) {
          scryfallId = entry.scryfallId;
          source = 'deck';
        }
      }
    }

    // 3) Own wishlist — the schema is registered inline by server.js, so the
    // model may be absent in tests that never load it.
    const WishlistItem = mongoose.models.WishlistItem;
    if (!scryfallId && WishlistItem) {
      const item = await WishlistItem.findOne({
        ...userFilter,
        name,
        scryfallId: { $exists: true, $ne: '' }
      }, 'scryfallId');
      if (item?.scryfallId) {
        scryfallId = item.scryfallId;
        source = 'wishlist';
      }
    }

    if (!scryfallId) {
      return res.status(404).json({ message: 'Card not found in your collection, decks, or wishlist' });
    }
    if (!resolveCachedFilepath(scryfallId)) {
      // Known card, but no local image — the client should use the full
      // search endpoint, which downloads and caches the image for next time.
      return res.status(404).json({ message: 'Image not cached locally' });
    }

    res.json({
      name,
      scryfallId,
      imageUrl: `/api/images/${scryfallId}`,
      source
    });
  } catch (error) {
    console.error('Image lookup failed:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

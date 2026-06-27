const express = require('express');
const router = express.Router();
const TradeListing = require('../models/TradeListing');
const TradeOffer = require('../models/TradeOffer');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

// GET /api/trades — browse active listings
// Query: ?type=have|want&card=name&condition=NM&limit=20&offset=0
router.get('/', async (req, res) => {
  try {
    const { type, card, condition } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const filter = { status: 'active' };
    if (type === 'have' || type === 'want') filter.type = type;
    if (condition) filter.condition = condition;
    if (card) filter.cardName = { $regex: card, $options: 'i' };

    const [listings, total] = await Promise.all([
      TradeListing.find(filter).sort({ createdAt: -1 }).skip(Number(offset)).limit(Number(limit)).lean(),
      TradeListing.countDocuments(filter),
    ]);

    res.json({ listings, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/my-listings
router.get('/my-listings', requireAuth, async (req, res) => {
  try {
    const listings = await TradeListing.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/offers/received
router.get('/offers/received', requireAuth, async (req, res) => {
  try {
    const offers = await TradeOffer.find({ toUserId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('listingId', 'cardName type condition quantity imageUrl')
      .lean();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/offers/sent
router.get('/offers/sent', requireAuth, async (req, res) => {
  try {
    const offers = await TradeOffer.find({ fromUserId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('listingId', 'cardName type condition quantity imageUrl')
      .lean();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trades — create listing
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, cardName, cardSet, cardSetCode, scryfallId, imageUrl, condition, quantity, estimatedValue, notes } = req.body;
    if (!type || !cardName) return res.status(400).json({ message: 'type and cardName are required' });

    const listing = new TradeListing({
      userId: req.user._id,
      username: req.user.username,
      type, cardName,
      cardSet: cardSet || '',
      cardSetCode: cardSetCode || '',
      scryfallId: scryfallId || '',
      imageUrl: imageUrl || '',
      condition: condition || 'NM',
      quantity: quantity || 1,
      estimatedValue: estimatedValue || 0,
      notes: notes || '',
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/trades/:id — cancel listing (must be owner)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const listing = await TradeListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your listing' });

    listing.status = 'cancelled';
    await listing.save();
    await TradeOffer.updateMany({ listingId: listing._id, status: 'pending' }, { status: 'cancelled' });

    res.json({ message: 'Listing cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trades/:listingId/offers — make an offer
router.post('/:listingId/offers', requireAuth, async (req, res) => {
  try {
    const listing = await TradeListing.findById(req.params.listingId);
    if (!listing || listing.status !== 'active') return res.status(404).json({ message: 'Listing not found or no longer active' });
    if (listing.userId.toString() === req.user._id.toString()) return res.status(403).json({ message: 'Cannot offer on your own listing' });

    const { offeredCards, message } = req.body;
    if (!offeredCards || offeredCards.length === 0) return res.status(400).json({ message: 'Must offer at least one card' });

    const offer = new TradeOffer({
      listingId: listing._id,
      fromUserId: req.user._id,
      fromUsername: req.user.username,
      toUserId: listing.userId,
      toUsername: listing.username,
      offeredCards,
      message: message || '',
    });
    await offer.save();

    await Notification.create({
      userId: listing.userId,
      type: 'trade_offer',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} made a trade offer on your "${listing.cardName}" listing`,
    });

    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/accept
router.put('/offers/:offerId/accept', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to accept' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    offer.status = 'accepted';
    await offer.save();

    await TradeListing.findByIdAndUpdate(offer.listingId, { status: 'completed' });
    await TradeOffer.updateMany({ listingId: offer.listingId, _id: { $ne: offer._id }, status: 'pending' }, { status: 'cancelled' });

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_accepted',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} accepted your trade offer!`,
    });

    res.json({ message: 'Offer accepted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/reject
router.put('/offers/:offerId/reject', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to reject' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    offer.status = 'rejected';
    await offer.save();

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_rejected',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} declined your trade offer.`,
    });

    res.json({ message: 'Offer rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/counter
router.put('/offers/:offerId/counter', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to counter' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    const { offeredCards, message } = req.body;
    if (!offeredCards || offeredCards.length === 0) return res.status(400).json({ message: 'Must include cards in counter offer' });

    offer.status = 'countered';
    offer.counterOffer = { offeredCards, message: message || '', createdAt: new Date() };
    await offer.save();

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_countered',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} countered your trade offer.`,
    });

    res.json({ message: 'Counter offer sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/cancel — cancel own offer
router.put('/offers/:offerId/cancel', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.fromUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer' });
    if (!['pending', 'countered'].includes(offer.status)) return res.status(400).json({ message: 'Cannot cancel this offer' });

    offer.status = 'cancelled';
    await offer.save();
    res.json({ message: 'Offer cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

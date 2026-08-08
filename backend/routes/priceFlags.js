const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PriceFlag = require('../models/PriceFlag');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

// POST /api/cards/:id/flag-price - Flag a card's price as incorrect (requires reputation >= 50)
router.post('/:id/flag-price', requireAuth, async (req, res) => {
  try {
    if ((req.user.reputation || 0) < 50) {
      return res.status(403).json({ message: 'Requires at least 50 reputation to flag a price' });
    }

    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const existing = await PriceFlag.findOne({
      cardId: card._id,
      flaggedBy: req.user._id,
      status: 'pending'
    });
    if (existing) {
      return res.status(409).json({ message: 'You already have a pending flag for this card.' });
    }

    const { reason = '' } = req.body;
    const flag = await PriceFlag.create({
      cardId: card._id,
      flaggedBy: req.user._id,
      reason
    });

    res.status(201).json(flag);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/cards/my-flags - flags the current user submitted, with resolution info
router.get('/my-flags', requireAuth, async (req, res) => {
  try {
    const flags = await PriceFlag.find({ flaggedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('cardId', 'name set price')
      .lean();

    res.json(flags.map(f => ({
      _id: f._id,
      cardName: f.cardId?.name || 'Unknown card',
      cardSet: f.cardId?.set || '',
      currentPrice: f.cardId?.price || 0,
      reason: f.reason,
      status: f.status,
      createdAt: f.createdAt,
      resolvedAt: f.resolvedAt,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

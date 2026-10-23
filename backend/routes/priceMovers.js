const express = require('express');
const router = express.Router();
const Card = require('../models/Card');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const { requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.get('/', requireAuth, async (req, res) => {
  try {
    const allowedDays = [7, 30, 90];
    const days = Number(req.query.days || 7);
    if (!allowedDays.includes(days)) return res.status(400).json({ message: 'Days must be 7, 30, or 90' });

    const cards = await Card.find(buildUserQuery({}, req))
      .select('name set quantity price')
      .lean();
    const cardById = new Map(cards.map(card => [card._id.toString(), card]));
    if (!cards.length) return res.json({ days, generatedAt: new Date(), gainers: [], decliners: [] });

    const since = new Date(Date.now() - days * 86400000);
    const baselineStart = new Date(since.getTime() - 86400000);
    const snapshots = await CardPriceSnapshot.find({
      cardId: { $in: cards.map(card => card._id) },
      createdAt: { $gte: baselineStart }
    }).select('cardId price createdAt').sort({ cardId: 1, createdAt: 1 }).lean();

    const grouped = new Map();
    for (const snapshot of snapshots) {
      const key = snapshot.cardId.toString();
      const points = grouped.get(key) || [];
      points.push(snapshot);
      grouped.set(key, points);
    }

    const movers = [];
    for (const [cardId, points] of grouped) {
      const card = cardById.get(cardId);
      if (!card || points.length < 2) continue;
      const baseline = [...points].reverse().find(point => new Date(point.createdAt) <= since)
        || points.find(point => new Date(point.createdAt) > since);
      const latestSnapshot = points[points.length - 1];
      if (!baseline || new Date(latestSnapshot.createdAt) < since || baseline === latestSnapshot) continue;
      const startPrice = baseline.price;
      const currentPrice = card.price || points[points.length - 1].price;
      if (startPrice <= 0 || currentPrice <= 0 || currentPrice === startPrice) continue;
      const change = currentPrice - startPrice;
      movers.push({
        cardId,
        name: card.name,
        set: card.set,
        quantity: card.quantity || 0,
        startPrice,
        currentPrice,
        change,
        changePct: (change / startPrice) * 100,
        collectionChange: change * (card.quantity || 0)
      });
    }

    const byMovement = (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct);
    res.json({
      days,
      generatedAt: new Date(),
      gainers: movers.filter(card => card.change > 0).sort(byMovement).slice(0, 5),
      decliners: movers.filter(card => card.change < 0).sort(byMovement).slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

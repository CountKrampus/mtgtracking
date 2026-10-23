const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const InventoryAudit = require('../models/InventoryAudit');
const Card = require('../models/Card');
const Location = require('../models/Location');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (req.query.locationId) {
      if (!mongoose.isValidObjectId(req.query.locationId)) {
        return res.status(400).json({ message: 'Invalid location ID' });
      }
      query.locationId = req.query.locationId;
    }
    const audits = await InventoryAudit.find(buildUserQuery(query, req))
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(audits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('collection:manage'), async (req, res) => {
  try {
    const { locationId } = req.body;
    if (!mongoose.isValidObjectId(locationId)) {
      return res.status(400).json({ message: 'A valid location is required' });
    }
    const location = await Location.findOne(buildUserQuery({ _id: locationId }, req)).lean();
    if (!location) return res.status(404).json({ message: 'Location not found' });

    const auditQuery = buildUserQuery({ locationId: location._id, status: 'in_progress' }, req);
    const existing = await InventoryAudit.findOne(auditQuery).lean();
    if (existing) return res.status(409).json({ message: 'An audit is already in progress for this location', audit: existing });

    const cards = await Card.find(buildUserQuery({ location: location.name }, req))
      .select('name set condition isFoil quantity')
      .sort({ name: 1, set: 1 })
      .lean();
    const audit = await InventoryAudit.create({
      userId: getUserId(req),
      locationId: location._id,
      locationName: location.name,
      items: cards.map(card => ({
        cardId: card._id,
        name: card.name,
        set: card.set || '',
        condition: card.condition || '',
        isFoil: Boolean(card.isFoil),
        expectedQuantity: card.quantity || 0,
        countedQuantity: null
      }))
    });
    res.status(201).json(audit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/counts', requireAuth, requirePermission('collection:manage'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid audit ID' });
    if (!Array.isArray(req.body.items)) return res.status(400).json({ message: 'Audit counts must be an array' });
    const audit = await InventoryAudit.findOne(buildUserQuery({ _id: req.params.id, status: 'in_progress' }, req));
    if (!audit) return res.status(404).json({ message: 'Active audit not found' });

    const itemById = new Map(audit.items.map(item => [item.cardId.toString(), item]));
    for (const count of req.body.items) {
      if (!mongoose.isValidObjectId(count.cardId) || !itemById.has(count.cardId)) {
        return res.status(400).json({ message: 'Count references a card outside this audit' });
      }
      if (count.countedQuantity !== null && (!Number.isInteger(count.countedQuantity) || count.countedQuantity < 0)) {
        return res.status(400).json({ message: 'Counts must be non-negative whole numbers or null' });
      }
    }
    for (const count of req.body.items) {
      itemById.get(count.cardId).countedQuantity = count.countedQuantity;
    }
    audit.updatedAt = new Date();
    await audit.save();
    res.json(audit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/complete', requireAuth, requirePermission('collection:manage'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid audit ID' });
    const audit = await InventoryAudit.findOne(buildUserQuery({ _id: req.params.id, status: 'in_progress' }, req));
    if (!audit) return res.status(404).json({ message: 'Active audit not found' });
    if (audit.items.some(item => item.countedQuantity === null || item.countedQuantity === undefined)) {
      return res.status(400).json({ message: 'Count every card before completing the audit' });
    }
    audit.status = 'completed';
    audit.completedAt = new Date();
    audit.updatedAt = audit.completedAt;
    await audit.save();
    res.json(audit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

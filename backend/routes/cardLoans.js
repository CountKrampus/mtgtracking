const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CardLoan = require('../models/CardLoan');
const Card = require('../models/Card');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');

router.get('/', requireAuth, async (req, res) => {
  try {
    const loans = await CardLoan.find(buildUserQuery({}, req)).sort({ status: 1, dueDate: 1, lentAt: -1 }).limit(200).lean();
    const activeCardIds = [...new Set(loans.filter(loan => loan.status === 'out').map(loan => loan.cardId.toString()))];
    const activeCounts = activeCardIds.length
      ? await CardLoan.aggregate([
        { $match: buildUserQuery({ cardId: { $in: activeCardIds.map(id => new mongoose.Types.ObjectId(id)) }, status: 'out' }, req) },
        { $group: { _id: '$cardId', quantity: { $sum: '$quantity' } } }
      ])
      : [];
    const activeByCard = new Map(activeCounts.map(entry => [entry._id.toString(), entry.quantity]));
    res.json(loans.map(loan => ({ ...loan, activeLoanQuantity: activeByCard.get(loan.cardId.toString()) || 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('collection:manage'), async (req, res) => {
  try {
    const { cardId, borrower, quantity = 1, dueDate, notes = '' } = req.body;
    if (!mongoose.isValidObjectId(cardId)) return res.status(400).json({ message: 'Select a valid collection card' });
    if (typeof borrower !== 'string' || !borrower.trim()) return res.status(400).json({ message: 'Borrower name is required' });
    if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Quantity must be a positive whole number' });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ message: 'Due date is invalid' });
    if (typeof notes !== 'string' || notes.length > 1000) return res.status(400).json({ message: 'Notes must be 1000 characters or fewer' });

    const card = await Card.findOne(buildUserQuery({ _id: cardId }, req)).lean();
    if (!card) return res.status(404).json({ message: 'Collection card not found' });
    const activeQuery = buildUserQuery({ cardId: card._id, status: 'out' }, req);
    const activeLoans = await CardLoan.aggregate([
      { $match: activeQuery },
      { $group: { _id: null, quantity: { $sum: '$quantity' } } }
    ]);
    const alreadyOut = activeLoans[0]?.quantity || 0;
    const available = (card.quantity || 0) - alreadyOut;
    if (quantity > available) {
      return res.status(400).json({ message: `Only ${available} copy/copies available to lend`, available });
    }

    const loan = await CardLoan.create({
      userId: getUserId(req),
      cardId: card._id,
      cardName: card.name,
      set: card.set || '',
      condition: card.condition || '',
      borrower: borrower.trim(),
      quantity,
      dueDate: dueDate || null,
      notes: notes.trim()
    });
    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/return', requireAuth, requirePermission('collection:manage'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid loan ID' });
    const loan = await CardLoan.findOne(buildUserQuery({ _id: req.params.id, status: 'out' }, req));
    if (!loan) return res.status(404).json({ message: 'Outstanding loan not found' });
    loan.status = 'returned';
    loan.returnedAt = new Date();
    await loan.save();
    res.json(loan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

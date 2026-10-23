const mongoose = require('mongoose');

const cardLoanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
  cardName: { type: String, required: true },
  set: { type: String, default: '' },
  condition: { type: String, default: '' },
  borrower: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  dueDate: { type: Date, default: null },
  notes: { type: String, default: '', maxlength: 1000 },
  status: { type: String, enum: ['out', 'returned'], default: 'out', index: true },
  lentAt: { type: Date, default: Date.now },
  returnedAt: { type: Date, default: null }
});

cardLoanSchema.index({ userId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('CardLoan', cardLoanSchema);

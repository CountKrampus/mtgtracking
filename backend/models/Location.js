const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ignorePrice: { type: Boolean, default: false },
  maxCapacity: { type: Number, default: null, min: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);

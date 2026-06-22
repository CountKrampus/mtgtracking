const mongoose = require('mongoose');

const valueSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  value: { type: Number, required: true },
  cardCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
valueSnapshotSchema.index({ createdAt: 1 });

module.exports = mongoose.model('ValueSnapshot', valueSnapshotSchema);

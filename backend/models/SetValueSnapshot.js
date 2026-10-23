const mongoose = require('mongoose');

const setValueSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  setKey: { type: String, required: true },
  setCode: { type: String, default: '' },
  setName: { type: String, required: true },
  value: { type: Number, required: true },
  cardCount: { type: Number, required: true },
  quantityCount: { type: Number, required: true },
  snapshotDate: { type: Date, required: true, default: Date.now },
});

setValueSnapshotSchema.index({ userId: 1, setKey: 1, snapshotDate: 1 }, { unique: true });

module.exports = mongoose.model('SetValueSnapshot', setValueSnapshotSchema);

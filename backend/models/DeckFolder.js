const mongoose = require('mongoose');

const deckFolderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeckFolder', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

deckFolderSchema.index({ userId: 1, parentId: 1 });
deckFolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DeckFolder', deckFolderSchema);

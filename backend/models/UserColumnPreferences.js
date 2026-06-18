const mongoose = require('mongoose');

const userColumnPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  visibleColumns: {
    type: [String],
    default: ['cardName', 'quantity', 'condition', 'price']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userColumnPreferencesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userColumnPreferencesSchema.index({ userId: 1 });

module.exports = mongoose.model('UserColumnPreferences', userColumnPreferencesSchema);

const mongoose = require('mongoose');

// UserColumnPreferences stores user UI preferences for column visibility in the collection table
// Each user has exactly one preferences document
const userColumnPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  visibleColumns: {
    type: [String],
    default: ['cardName', 'quantity', 'condition', 'price'],
    validate: {
      validator: function(arr) {
        const validColumns = ['cardName', 'set', 'setCode', 'collectorNumber', 'rarity', 'manaCost', 'colors', 'types', 'location', 'foil', 'token', 'tags', 'quantity', 'condition', 'price', 'total', 'actions', 'buylistValue', 'sellValue'];
        return arr.every(col => validColumns.includes(col));
      },
      message: 'Invalid column name in visibleColumns'
    }
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

module.exports = mongoose.model('UserColumnPreferences', userColumnPreferencesSchema);

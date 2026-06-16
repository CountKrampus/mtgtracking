const mongoose = require('mongoose');

const cosmeticSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  category: {
    type: String,
    enum: ['titleColor', 'profileBorderColor', 'avatarBorder', 'badgeColor'],
    required: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    maxlength: 200
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'legendary'],
    default: 'common'
  },
  color: {
    type: String,
    default: null // hex color or null if not applicable
  },
  icon: {
    type: String,
    default: null // emoji or icon code
  },
  isActive: {
    type: Boolean,
    default: true
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

cosmeticSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

cosmeticSchema.index({ category: 1, rarity: 1 });
cosmeticSchema.index({ isActive: 1 });

module.exports = mongoose.model('Cosmetic', cosmeticSchema);

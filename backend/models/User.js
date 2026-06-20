const mongoose = require('mongoose');
const { getPermissionsForRole } = require('../utils/permissions');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  passwordHash: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  role: {
    type: String,
    enum: [
      // Staff roles (Phase 2)
      'admin',
      'moderator',
      'content_manager',
      'community_manager',
      'support',
      'user',
      // Legacy roles (kept for backward compatibility — existing users)
      'editor',
      'viewer'
    ],
    default: 'editor'
  },
  staffSince: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date
  },
  privacy: {
    isPublic: { type: Boolean, default: false },
    showCollection: { type: Boolean, default: false },
    showDecks: { type: Boolean, default: true },
    showWishlist: { type: Boolean, default: false },
    showForum: { type: Boolean, default: false },
    bio: { type: String, default: '' }
  },
  reputation: {
    type: Number,
    min: 0,
    default: 0
  },
  communityStats: {
    decksShared: { type: Number, default: 0 },
    cardsAdded: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    threadCount: { type: Number, default: 0 },
    monthlyActivityRate: { type: Number, default: 0 },
    lastActivityAt: { type: Date }
  },
  badges: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    earnedAt: { type: Date, default: Date.now }
  }],
  pinnedCards: [{
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', default: null },
    scryfallId: { type: String, default: '' },
    name: { type: String, default: '' },
    imageUrl: { type: String, default: '' }
  }],
  avatarUrl: {
    type: String,
    default: ''
  }
});

// Indexes (email and username already indexed via unique: true)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to update timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for display name fallback
userSchema.virtual('name').get(function() {
  return this.displayName || this.username;
});

// Method to return safe user object (without password hash)
userSchema.methods.toSafeObject = function() {
  return {
    _id: this._id,
    email: this.email,
    username: this.username,
    displayName: this.displayName,
    role: this.role,
    permissions: getPermissionsForRole(this.role),
    staffSince: this.staffSince,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLoginAt: this.lastLoginAt,
    privacy: this.privacy,
    reputation: this.reputation,
    badges: this.badges,
    avatarUrl: this.avatarUrl
  };
};

// Static method to find by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
  const lowerIdentifier = identifier.toLowerCase();
  return this.findOne({
    $or: [
      { email: lowerIdentifier },
      { username: lowerIdentifier }
    ]
  });
};

const User = mongoose.model('User', userSchema);

module.exports = User;

const mongoose = require('mongoose');

const forumLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  coinsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  badges: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    }
  ],
  cosmetics: {
    purchased: [String],
    equipped: {
      titleColor: String,
      profileBorderColor: String,
      avatarBorder: String,
      flairIcon: { type: String, default: null },
      postBackground: { type: String, default: null },
      postFrame: { type: String, default: null },
      memberTitle: { type: String, default: null },
      signature: { type: String, default: null },
      threadHighlight: { type: String, default: null },
      profileBackground: { type: String, default: null },
      profileBanner: { type: String, default: null },
      profileTheme: { type: String, default: null },
      achievementShowcase: { type: String, default: null },
      favoriteCardsShowcase: { type: String, default: null },
      deckShowcase: { type: String, default: null },
      collectionStatsWidget: { type: String, default: null },
      wishlistPreview: { type: String, default: null },
      nameplateBackground: { type: String, default: null },
      formatBadge: { type: String, default: null },
      aboutMe: { type: String, default: null },
      personalLinksUnlock: { type: String, default: null },
      setSymbolFlair: { type: String, default: null }
    }
  },
  memberTitleText: { type: String, default: '', maxlength: 40 },
  signatureText: { type: String, default: '', maxlength: 120 },
  pinnedAchievements: { type: [String], default: [] },
  aboutMeText: { type: String, default: '', maxlength: 300 },
  personalLinks: {
    type: [{
      label: { type: String, default: '', maxlength: 30 },
      url:   { type: String, default: '', maxlength: 200 },
    }],
    default: [],
    validate: [arr => arr.length <= 5, 'Maximum 5 personal links'],
  },
  manaIdentity: {
    type: [{ type: String, enum: ['W', 'U', 'B', 'R', 'G', 'C'] }],
    default: [],
  },
  commanderCard: {
    scryfallId: { type: String, default: '' },
    name:       { type: String, default: '' },
    imageUrl:   { type: String, default: '' },
  },
  achievements: [
    {
      name: String,
      earnedAt: {
        type: Date,
        default: Date.now
      },
      description: String
    }
  ],
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

forumLevelSchema.index({ level: -1, coins: -1 });
forumLevelSchema.index({ userId: 1 }, { unique: true });

forumLevelSchema.virtual('nextLevelExperience').get(function() {
  return this.level * 500;
});

forumLevelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

forumLevelSchema.methods.addExperience = function(amount) {
  this.experience += amount;
  while (this.experience >= this.nextLevelExperience && this.level < 100) {
    this.experience -= this.nextLevelExperience;
    this.level += 1;
  }
};

forumLevelSchema.methods.addCoins = function(amount) {
  this.coins += amount;
  this.coinsEarned += amount;
};

forumLevelSchema.methods.spendCoins = function(amount) {
  if (this.coins < amount) throw new Error('Not enough coins');
  this.coins -= amount;
};

module.exports = mongoose.model('ForumLevel', forumLevelSchema);

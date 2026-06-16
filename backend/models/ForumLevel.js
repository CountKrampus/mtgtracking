const mongoose = require('mongoose');

const forumLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
      avatarBorder: String
    }
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

forumLevelSchema.index({ userId: 1 });
forumLevelSchema.index({ level: -1, coins: -1 });

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

module.exports = mongoose.model('ForumLevel', forumLevelSchema);

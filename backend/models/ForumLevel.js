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
    max: 50
  },
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  experienceToNextLevel: {
    type: Number,
    default: 100
  },
  totalExperience: {
    type: Number,
    default: 0
  },
  postsCount: {
    type: Number,
    default: 0
  },
  threadsCreated: {
    type: Number,
    default: 0
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

forumLevelSchema.index({ userId: 1 });
forumLevelSchema.index({ level: -1, coins: -1 });

forumLevelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

forumLevelSchema.methods.addExperience = async function(amount) {
  this.experience += amount;
  this.totalExperience += amount;

  while (this.experience >= this.experienceToNextLevel && this.level < 50) {
    this.experience -= this.experienceToNextLevel;
    this.level += 1;
    this.coins += Math.floor(100 * (this.level / 10));
    this.experienceToNextLevel = Math.floor(100 * (this.level / 1.5));
  }

  await this.save();
};

forumLevelSchema.methods.addCoins = async function(amount) {
  this.coins += amount;
  await this.save();
};

forumLevelSchema.methods.spendCoins = async function(amount) {
  if (this.coins < amount) {
    throw new Error('Insufficient coins');
  }
  this.coins -= amount;
  await this.save();
};

module.exports = mongoose.model('ForumLevel', forumLevelSchema);

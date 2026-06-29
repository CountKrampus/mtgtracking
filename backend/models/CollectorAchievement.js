const mongoose = require('mongoose');

const collectorAchievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementId: { type: String, required: true },
  earnedAt: { type: Date, default: Date.now },
});
collectorAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('CollectorAchievement', collectorAchievementSchema);

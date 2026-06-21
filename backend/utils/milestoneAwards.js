const mongoose = require('mongoose');
const User = require('../models/User');
const ForumLevel = require('../models/ForumLevel');

// Cross-version ObjectId helper (mongoose v7+ vs older)
const toObjectId = (id) => {
  if (typeof mongoose.Types.ObjectId.createFromHexString === 'function') {
    return mongoose.Types.ObjectId.createFromHexString(id.toString());
  }
  return new mongoose.Types.ObjectId(id.toString());
};

// Collection milestones: granted when user's total card count (sum of quantities) crosses a threshold
const COLLECTION_MILESTONES = [
  { threshold: 100,  name: 'Century Collector',   description: 'Added 100 cards to your collection',  icon: 'lucide:Package' },
  { threshold: 500,  name: 'Seasoned Collector',  description: 'Added 500 cards to your collection',  icon: 'lucide:Archive' },
  { threshold: 1000, name: 'Master Collector',    description: 'Added 1000 cards to your collection', icon: 'lucide:Crown' },
  { threshold: 2500, name: 'Legendary Collector', description: 'Added 2500 cards to your collection', icon: 'lucide:Star' },
];

// Post count milestones: granted when user's forum post count crosses a threshold
const POST_MILESTONES = [
  { threshold: 10,  name: 'First Steps',    description: 'Made 10 forum posts',  icon: 'lucide:MessageSquare' },
  { threshold: 50,  name: 'Regular',        description: 'Made 50 forum posts',  icon: 'lucide:MessageCircle' },
  { threshold: 100, name: 'Veteran Poster', description: 'Made 100 forum posts', icon: 'lucide:Award' },
  { threshold: 500, name: 'Forum Legend',   description: 'Made 500 forum posts', icon: 'lucide:Trophy' },
];

/**
 * Grant a badge to a user if they don't already have it.
 * Returns true if newly granted, false if already owned or user not found.
 */
async function checkAndGrantBadge(userId, badgeName, badgeDescription, badgeIcon) {
  const user = await User.findById(userId).select('badges').lean();
  if (!user) return false;
  if (user.badges.some(b => b.name === badgeName)) return false;
  await User.findByIdAndUpdate(userId, {
    $push: {
      badges: {
        name: badgeName,
        description: badgeDescription,
        icon: badgeIcon,
        earnedAt: new Date()
      }
    }
  });
  return true;
}

/**
 * Add an achievement to a user's ForumLevel if they don't already have it.
 * Returns true if newly granted.
 */
async function checkAndGrantAchievement(userId, achievementName, achievementDescription) {
  const level = await ForumLevel.findOne({ userId }).select('achievements').lean();
  if (!level) return false;
  if (level.achievements.some(a => a.name === achievementName)) return false;
  await ForumLevel.findOneAndUpdate(
    { userId },
    {
      $push: {
        achievements: {
          name: achievementName,
          description: achievementDescription,
          earnedAt: new Date()
        }
      }
    }
  );
  return true;
}

/**
 * Check and grant collection milestone badges/achievements after a card is added or updated.
 * Aggregates the total quantity of all cards owned by userId.
 * Pass the Card mongoose model so this util stays decoupled from server.js globals.
 */
async function checkCollectionMilestones(userId, Card) {
  try {
    const result = await Card.aggregate([
      { $match: { userId: toObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);
    const total = result[0]?.total || 0;
    for (const milestone of COLLECTION_MILESTONES) {
      if (total >= milestone.threshold) {
        await checkAndGrantBadge(userId, milestone.name, milestone.description, milestone.icon);
        await checkAndGrantAchievement(userId, milestone.name, milestone.description);
      }
    }
  } catch (e) {
    // Non-fatal — log but don't break the caller
    console.error('Collection milestone check error:', e.message);
  }
}

/**
 * Check and grant post-count milestone badges/achievements.
 * postCount should be the user's TOTAL post count after the new post was saved.
 */
async function checkPostMilestones(userId, postCount) {
  try {
    for (const milestone of POST_MILESTONES) {
      if (postCount >= milestone.threshold) {
        await checkAndGrantBadge(userId, milestone.name, milestone.description, milestone.icon);
        await checkAndGrantAchievement(userId, milestone.name, milestone.description);
      }
    }
  } catch (e) {
    console.error('Post milestone check error:', e.message);
  }
}

module.exports = {
  checkCollectionMilestones,
  checkPostMilestones,
  COLLECTION_MILESTONES,
  POST_MILESTONES,
};

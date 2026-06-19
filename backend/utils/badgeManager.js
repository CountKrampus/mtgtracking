const User = require('../models/User');

const MILESTONE_BADGES = {
  FIRST_POST: {
    name: 'First Post',
    description: 'Posted your first forum reply',
    emoji: '📝',
    threshold: (stats) => stats.postCount >= 1,
    actions: ['post_create']
  },
  CENTURY: {
    name: 'Century',
    description: '100 forum posts',
    emoji: '💬',
    threshold: (stats) => stats.postCount >= 100,
    actions: ['post_create']
  },
  THREAD_STARTER: {
    name: 'Thread Starter',
    description: 'Created your first forum thread',
    emoji: '🧵',
    threshold: (stats) => stats.threadCount >= 1,
    actions: ['thread_create']
  },
  DECK_BUILDER: {
    name: 'Deck Builder',
    description: 'Shared your first deck',
    emoji: '🃏',
    threshold: (stats) => stats.decksShared >= 1,
    actions: ['deck_share']
  },
  COLLECTOR: {
    name: 'Collector',
    description: 'Added 500+ cards to your collection',
    emoji: '📦',
    threshold: (stats) => stats.cardsAdded >= 500,
    actions: ['card_add']
  },
  VETERAN: {
    name: 'Veteran',
    description: 'Member for 1+ year',
    emoji: '🗓️',
    threshold: (stats, user) => {
      if (!user?.createdAt) return false;
      const ageMs = Date.now() - new Date(user.createdAt).getTime();
      return ageMs >= 365 * 24 * 60 * 60 * 1000;
    },
    actions: ['login']
  }
};

// Kept for backwards compatibility — original activity-based badges
const BADGES = {
  ENGAGED_MEMBER: {
    name: 'Engaged Member',
    description: '20+ community interactions',
    threshold: (stats) => (stats.communityInteractions || 0) >= 20
  }
};

/**
 * Check and award milestone badges for a user after a specific action.
 * @param {string} userId
 * @param {string} action - one of: 'post_create', 'thread_create', 'deck_share', 'card_add', 'login'
 */
async function checkAndAwardBadges(userId, action) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const stats = user.communityStats || {};
    const newBadges = [];

    for (const badge of Object.values(MILESTONE_BADGES)) {
      if (action && !badge.actions.includes(action)) continue;
      const hasBadge = user.badges?.some(b => b.name === badge.name);
      if (!hasBadge && badge.threshold(stats, user)) {
        newBadges.push({ name: badge.name, description: badge.description, earnedAt: new Date() });
      }
    }

    // Also check legacy BADGES (not action-filtered)
    if (!action || action === 'legacy') {
      for (const badge of Object.values(BADGES)) {
        const hasBadge = user.badges?.some(b => b.name === badge.name);
        if (!hasBadge && badge.threshold(stats)) {
          newBadges.push({ name: badge.name, description: badge.description, earnedAt: new Date() });
        }
      }
    }

    if (newBadges.length > 0) {
      user.badges = user.badges || [];
      user.badges.push(...newBadges);
      await user.save();
    }
  } catch (error) {
    console.error('Badge award error:', error.message);
  }
}

// Map badge name → emoji for frontend display
const BADGE_EMOJI = Object.fromEntries(
  Object.values(MILESTONE_BADGES).map(b => [b.name, b.emoji])
);

module.exports = { checkAndAwardBadges, BADGES, MILESTONE_BADGES, BADGE_EMOJI };

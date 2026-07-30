const axios = require('axios');
const mongoose = require('mongoose');
const { isMultiUserEnabled } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const TradeOffer = require('../models/TradeOffer');
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
const ChallengeParticipation = require('../models/ChallengeParticipation');

// Set sizes don't change once a set is fully spoiled, so a long-lived
// module-level cache avoids hammering Scryfall on every progress check.
const setSizeCache = new Map(); // setCode -> { size, cachedAt }
const SET_SIZE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getScryfallSetSize(setCode) {
  const cached = setSizeCache.get(setCode);
  if (cached && Date.now() - cached.cachedAt < SET_SIZE_CACHE_TTL_MS) {
    return cached.size;
  }
  try {
    const response = await axios.get(`https://api.scryfall.com/sets/${setCode.toLowerCase()}`);
    const size = response.data?.card_count || 0;
    setSizeCache.set(setCode, { size, cachedAt: Date.now() });
    return size;
  } catch {
    return cached?.size || 0;
  }
}

// Scopes a query by userId when multi-user mode is on; in single-user mode
// there's only one collection, so no userId filter is applied.
function userFilter(userId, extra = {}) {
  return isMultiUserEnabled() ? { ...extra, userId } : extra;
}

/**
 * Computes a user's current progress toward a challenge's target.
 * Card is passed in rather than required, since it's registered dynamically
 * by server.js (mirrors backend/jobs/dailyPriceSnapshot.js's pattern).
 */
async function computeProgress(challenge, userId, monthStart, monthEnd, Card) {
  const { metric, params = {} } = challenge;

  switch (metric) {
    case 'foils_added':
      return Card.countDocuments(userFilter(userId, {
        isFoil: true, createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'cards_added':
      return Card.countDocuments(userFilter(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'value_added': {
      const cards = await Card.find(userFilter(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }), 'price');
      return cards.reduce((sum, c) => sum + (c.price || 0), 0);
    }

    case 'color_added':
      // Colors are stored as single uppercase Scryfall letters (W/U/B/R/G/C)
      return Card.countDocuments(userFilter(userId, {
        colors: (params.color || '').toUpperCase(),
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'rarity_added':
      // Rarity is stored as a single uppercase letter (C/U/R/M)
      return Card.countDocuments(userFilter(userId, {
        rarity: (params.rarity || '').toUpperCase(),
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'unique_sets': {
      const sets = await Card.distinct('set', userFilter(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));
      return sets.length;
    }

    case 'set_completion': {
      const owned = await Card.countDocuments(userFilter(userId, { setCode: params.setCode }));
      const total = await getScryfallSetSize(params.setCode);
      return total > 0 ? Math.round((owned / total) * 100) : 0;
    }

    case 'high_value_card': {
      const card = await Card.findOne(userFilter(userId, { price: { $gte: params.minValue } }));
      return card ? params.minValue : 0;
    }

    case 'trades_completed':
      return TradeOffer.countDocuments({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        status: 'accepted',
        updatedAt: { $gte: monthStart, $lte: monthEnd }
      });

    case 'wishlist_acquired':
      // WishlistItem is deleted (or merged into a Card) on acquire, so it
      // can't carry its own acquiredAt timestamp — the acquire action is
      // recorded in ActivityLog instead (see middleware/activityLogger.js).
      return ActivityLog.countDocuments({
        userId,
        action: 'wishlist_acquire',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

    case 'forum_posts':
      return ForumPost.countDocuments({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        isHidden: { $ne: true }
      });

    case 'forum_threads':
      return ForumThread.countDocuments({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        isHidden: { $ne: true }
      });

    case 'forum_upvotes': {
      const posts = await ForumPost.find({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }, 'upvotes');
      return posts.reduce((sum, p) => sum + (p.upvotes?.length || 0), 0);
    }

    case 'custom': {
      const p = await ChallengeParticipation.findOne({ userId, challengeId: challenge._id });
      return p?.progress || 0;
    }

    default:
      return 0;
  }
}

const VALID_METRICS = [
  'foils_added', 'cards_added', 'value_added', 'color_added',
  'rarity_added', 'unique_sets', 'set_completion', 'high_value_card',
  'trades_completed', 'wishlist_acquired',
  'forum_posts', 'forum_threads', 'forum_upvotes',
  'custom'
];

const METRIC_REQUIRED_PARAMS = {
  color_added: ['color'],
  rarity_added: ['rarity'],
  set_completion: ['setCode', 'targetPercent'],
  high_value_card: ['minValue'],
};

function validateMetricParams(metric, params = {}) {
  const required = METRIC_REQUIRED_PARAMS[metric];
  if (!required) return null;
  const missing = required.filter(key => params[key] === undefined || params[key] === null || params[key] === '');
  if (missing.length > 0) {
    return `Missing required param(s) for metric "${metric}": ${missing.join(', ')}`;
  }
  return null;
}

module.exports = { computeProgress, getScryfallSetSize, VALID_METRICS, validateMetricParams };

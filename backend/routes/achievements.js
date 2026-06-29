const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CollectorAchievement = require('../models/CollectorAchievement');
const { requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

// Card model is defined inline in server.js; allow injection for testing
let _Card = null;

function injectDependencies(cardModel) {
  _Card = cardModel;
}

function getCard() {
  if (_Card) return _Card;
  // Lazy access — model is registered in server.js before routes are called
  try {
    return mongoose.model('Card');
  } catch {
    return null;
  }
}

const ACHIEVEMENTS = [
  { id: 'first_card',     name: 'First Card',         desc: 'Add your first card to the collection',   icon: '🃏',  check: (s) => s.totalCards >= 1     },
  { id: 'ten_cards',      name: 'Getting Started',     desc: 'Own 10 cards',                            icon: '📦',  check: (s) => s.totalCards >= 10    },
  { id: '100_cards',      name: 'Collector',           desc: 'Own 100 cards',                           icon: '📚',  check: (s) => s.totalCards >= 100   },
  { id: '500_cards',      name: 'Serious Collector',   desc: 'Own 500 cards',                           icon: '🏆',  check: (s) => s.totalCards >= 500   },
  { id: '1000_cards',     name: 'Master Collector',    desc: 'Own 1,000 cards',                         icon: '👑',  check: (s) => s.totalCards >= 1000  },
  { id: 'ten_value',      name: 'First Value',         desc: 'Collection worth $10+',                   icon: '💵',  check: (s) => s.totalValue >= 10    },
  { id: '100_value',      name: 'Valuable',            desc: 'Collection worth $100+',                  icon: '💰',  check: (s) => s.totalValue >= 100   },
  { id: '500_value',      name: 'High Value',          desc: 'Collection worth $500+',                  icon: '💎',  check: (s) => s.totalValue >= 500   },
  { id: '1000_value',     name: 'Premium Collection',  desc: 'Collection worth $1,000+',                icon: '🏅',  check: (s) => s.totalValue >= 1000  },
  { id: 'all_colors',     name: 'Five Colors',         desc: 'Own cards of all 5 mana colors',          icon: '🌈',  check: (s) => s.allColors           },
  { id: 'first_foil',     name: 'First Foil',          desc: 'Own your first foil card',                icon: '✨',  check: (s) => s.foilCount >= 1      },
  { id: 'ten_foils',      name: 'Foil Fan',            desc: 'Own 10 foil cards',                       icon: '⭐',  check: (s) => s.foilCount >= 10     },
  { id: 'five_sets',      name: 'Set Explorer',        desc: 'Own cards from 5+ different sets',        icon: '🗺️',  check: (s) => s.uniqueSets >= 5     },
  { id: 'twenty_sets',    name: 'Set Connoisseur',     desc: 'Own cards from 20+ different sets',       icon: '🌍',  check: (s) => s.uniqueSets >= 20    },
  { id: 'first_mythic',   name: 'Mythic!',             desc: 'Own a Mythic Rare',                       icon: '🔥',  check: (s) => s.mythicCount >= 1    },
];

async function getCollectionStats(userQuery) {
  const Card = getCard();
  if (!Card) {
    return { totalCards: 0, totalValue: 0, foilCount: 0, mythicCount: 0, uniqueSets: 0, allColors: false };
  }
  const cards = await Card.find(userQuery).lean();
  const totalCards = cards.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalValue = cards.reduce((s, c) => s + ((c.price || 0) * (c.quantity || 1)), 0);
  const foilCount  = cards.filter(c => c.isFoil).reduce((s, c) => s + (c.quantity || 1), 0);
  const mythicCount = cards.filter(c => c.rarity === 'M').reduce((s, c) => s + (c.quantity || 1), 0);
  const sets = new Set(cards.map(c => c.set).filter(Boolean));
  const uniqueSets = sets.size;
  const colorSet = new Set(cards.flatMap(c => c.colors || []));
  const allColors = ['W', 'U', 'B', 'R', 'G'].every(c => colorSet.has(c));
  return { totalCards, totalValue, foilCount, mythicCount, uniqueSets, allColors };
}

// GET /api/achievements — returns all achievements with earned status
router.get('/', requireAuth, async (req, res) => {
  try {
    // In single-user mode, requireAuth is a no-op and req.user is null.
    // Return empty array — achievements require per-user context.
    if (!req.user) return res.json([]);

    const userQuery = buildUserQuery({}, req);
    const [stats, earned] = await Promise.all([
      getCollectionStats(userQuery),
      CollectorAchievement.find({ userId: req.user._id }).lean(),
    ]);

    const earnedSet = new Set(earned.map(e => e.achievementId));
    const earnedDates = Object.fromEntries(earned.map(e => [e.achievementId, e.earnedAt]));

    // Auto-grant newly earned achievements
    const toGrant = ACHIEVEMENTS.filter(a => a.check(stats) && !earnedSet.has(a.id));
    if (toGrant.length) {
      try {
        await CollectorAchievement.insertMany(
          toGrant.map(a => ({ userId: req.user._id, achievementId: a.id })),
          { ordered: false }
        );
      } catch (err) {
        // Ignore duplicate key errors (race condition: concurrent request granted first)
        if (!err.writeErrors?.every(e => e.code === 11000)) throw err;
      }
      toGrant.forEach(a => { earnedSet.add(a.id); earnedDates[a.id] = new Date(); });
    }

    const result = ACHIEVEMENTS.map(a => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      icon: a.icon,
      earned: earnedSet.has(a.id),
      earnedAt: earnedDates[a.id] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching achievements', error: err.message });
  }
});

router.injectDependencies = injectDependencies;

module.exports = router;

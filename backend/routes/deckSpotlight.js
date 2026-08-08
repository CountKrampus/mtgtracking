const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deck = require('../models/Deck');
const Card = require('../models/Card');
const DeckSpotlight = require('../models/DeckSpotlight');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { estimatePowerLevel, calculateSaltScore } = require('../utils/deckAnalysis');
const { createMentionNotifications } = require('../utils/notifications');

router.use(verifyToken);

// ─── helpers ────────────────────────────────────────────────────────────────

function getBuildLabel(powerLevel) {
  if (powerLevel >= 9) return 'cEDH Build';
  if (powerLevel >= 7) return 'High Power Build';
  if (powerLevel >= 5) return 'Optimized Build';
  if (powerLevel >= 3) return 'Casual Build';
  return 'Jank Build';
}

function getBudgetTier(totalValue) {
  if (totalValue < 50)  return 'Budget';
  if (totalValue < 200) return 'Mid-range';
  if (totalValue < 500) return 'Tuned';
  return 'Premium';
}

async function computeTotalValue(mainDeck) {
  const names = (mainDeck || []).map(c => c.name);
  if (!names.length) return 0;
  const cards = await Card.find({ name: { $in: names } }).select('name price').lean();
  const priceByName = Object.fromEntries(cards.map(c => [c.name, c.price || 0]));
  return (mainDeck || []).reduce((sum, c) => sum + (priceByName[c.name] || 0) * (c.quantity || 1), 0);
}

function buildThreadContent(deck, owner, buildLabel, budgetTier, totalValue, saltScore) {
  const colorStr = deck.commander?.colorIdentity?.join('') || '?';
  const tagLine = deck.tags?.length ? `Tags: ${deck.tags.join(', ')}` : '';
  const shareLink = deck.shareCode ? `/decks/share/${deck.shareCode}` : '';
  const totalCards = (deck.mainDeck || []).reduce((sum, c) => sum + (c.quantity || 1), 0);

  const deckList = [...(deck.mainDeck || [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => c.quantity > 1 ? `${c.quantity}x ${c.name}` : c.name)
    .join('\n');

  return [
    `This week's spotlight deck is "${deck.name}" by @${owner.username} — a ${budgetTier} ${buildLabel} in the ${deck.format || 'Commander'} format.`,
    '',
    `Commander: ${deck.commander?.name || 'Unknown'} (${colorStr})`,
    `Power Level: ${buildLabel}`,
    `Salt Score: ${saltScore}`,
    `Total Value: $${totalValue.toFixed(2)}`,
    `Card Count: ${totalCards} cards`,
    tagLine,
    shareLink ? `View deck: ${shareLink}` : '',
    '',
    '--- Decklist ---',
    deckList,
    '',
    '---',
    'Think a deck deserves a spotlight? Share your deck publicly in the Community Decks section!',
  ].filter(line => line !== '').join('\n');
}

async function ensureSpotlightsCategory() {
  let category = await ForumCategory.findOne({ slug: 'community-spotlights' });
  if (!category) {
    category = await ForumCategory.create({
      name: 'Community Spotlights',
      slug: 'community-spotlights',
      description: 'Featured community decks and spotlight posts.',
    });
  }
  return category;
}

// ─── routes ─────────────────────────────────────────────────────────────────

// POST /api/deck-spotlight — admin creates a new spotlight
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { deckId } = req.body;

    if (!deckId) {
      return res.status(400).json({ message: 'deckId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(deckId)) {
      return res.status(400).json({ message: 'Invalid deckId' });
    }

    const deck = await Deck.findById(deckId)
      .populate('userId', 'username displayName')
      .lean();

    if (!deck) {
      return res.status(404).json({ message: 'Deck not found' });
    }

    if (!deck.isPublic) {
      return res.status(400).json({ message: 'Deck must be public to be spotlighted' });
    }

    const owner = deck.userId;

    if (!owner) {
      return res.status(400).json({ message: 'Deck owner not found' });
    }

    const powerResult = estimatePowerLevel(deck);
    const saltResult  = calculateSaltScore(deck);
    const totalValue  = await computeTotalValue(deck.mainDeck);
    const buildLabel  = getBuildLabel(powerResult.level);
    const budgetTier  = getBudgetTier(totalValue);

    // Create forum thread
    const category = await ensureSpotlightsCategory();
    const content  = buildThreadContent(deck, owner, buildLabel, budgetTier, totalValue, saltResult.score);
    const title    = `🌟 Deck of the Week: ${deck.name} — ${budgetTier} ${buildLabel}`;

    const thread = await ForumThread.create({
      categoryId:    category._id,
      authorId:      req.user._id,
      title,
      content,
      contentFormat: 'markdown',
      tags:          ['deck-spotlight', (deck.format || 'commander').toLowerCase()],
    });

    await ForumCategory.findByIdAndUpdate(category._id, {
      $inc:           { threadCount: 1 },
      lastActivityAt: new Date(),
    });

    // Notify the deck owner via the forum @mention system
    try {
      await createMentionNotifications(req.user._id, 'mention', content, {
        threadId: thread._id,
        content: `Your deck "${deck.name}" was featured as Deck of the Week!`,
      });
    } catch (err) {
      console.error('[deckSpotlight] mention notification failed:', err.message);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const spotlight = await DeckSpotlight.create({
      deckId:     deck._id,
      featuredBy: req.user._id,
      expiresAt,
      threadId:   thread._id,
      buildLabel,
      budgetTier,
      totalValue,
    });

    return res.status(201).json(spotlight);
  } catch (err) {
    console.error('[deckSpotlight] POST error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/deck-spotlight/active — public, returns the current active spotlight
router.get('/active', async (req, res) => {
  try {
    const spotlight = await DeckSpotlight.findOne({ expiresAt: { $gt: new Date() } })
      .sort({ featuredAt: -1 })
      .populate({
        path: 'deckId',
        select: 'name commander format tags shareCode',
        populate: { path: 'userId', select: 'username displayName' },
      })
      .lean();

    return res.status(200).json({ spotlight: spotlight || null });
  } catch (err) {
    console.error('[deckSpotlight] GET /active error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/deck-spotlight/:id — admin expires a spotlight early
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const spotlight = await DeckSpotlight.findById(req.params.id);

    if (!spotlight) {
      return res.status(404).json({ message: 'Spotlight not found' });
    }

    spotlight.expiresAt = new Date();
    await spotlight.save();

    return res.status(200).json({ message: 'Spotlight expired', spotlight });
  } catch (err) {
    console.error('[deckSpotlight] DELETE error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

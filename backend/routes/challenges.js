const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
const ChallengeParticipation = require('../models/ChallengeParticipation');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { computeProgress, VALID_METRICS, validateMetricParams } = require('../utils/challengeProgress');

router.use(verifyToken);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(month) {
  const [year, mon] = month.split('-').map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

// GET /api/challenges — active challenges for the current month
router.get('/', async (req, res) => {
  try {
    const month = currentMonth();
    const challenges = await Challenge.find({ month, status: 'active' }).sort({ createdAt: 1 }).lean();

    if (!req.user) {
      return res.json({ challenges, month });
    }

    const { monthStart, monthEnd } = monthBounds(month);
    const Card = mongoose.model('Card');
    const enriched = await Promise.all(challenges.map(async (challenge) => {
      const progress = await computeProgress(challenge, req.user._id, monthStart, monthEnd, Card);
      const completed = progress >= challenge.target;

      // Record/update participation so this user shows up on the leaderboard
      // and so completedAt is captured the first time they cross the target.
      // Manual (custom) challenges manage their own participation row via
      // POST /:id/progress instead, since progress there isn't auto-derived.
      if (challenge.metric !== 'custom') {
        const existing = await ChallengeParticipation.findOne({ userId: req.user._id, challengeId: challenge._id });
        await ChallengeParticipation.findOneAndUpdate(
          { userId: req.user._id, challengeId: challenge._id },
          {
            progress,
            completed,
            completedAt: completed && !existing?.completedAt ? new Date() : (existing?.completedAt || null),
            updatedAt: new Date(),
          },
          { upsert: true }
        );
      }

      return { ...challenge, progress, completed };
    }));

    res.json({ challenges: enriched, month });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching challenges', error: err.message });
  }
});

// POST /api/challenges/propose — any logged-in user proposes a challenge
router.post('/propose', requireAuth, async (req, res) => {
  try {
    const { title, description, metric, params = {}, target, suggestedMonth } = req.body;

    if (!title || !description || !metric || target === undefined) {
      return res.status(400).json({ message: 'title, description, metric, and target are required' });
    }
    if (!VALID_METRICS.includes(metric)) {
      return res.status(400).json({ message: `Invalid metric: ${metric}` });
    }
    const paramError = validateMetricParams(metric, params);
    if (paramError) {
      return res.status(400).json({ message: paramError });
    }

    const challenge = await Challenge.create({
      title,
      description,
      metric,
      params,
      target,
      month: suggestedMonth || currentMonth(),
      status: 'draft',
      isProposal: true,
      proposedBy: req.user._id,
    });

    res.status(201).json(challenge);
  } catch (err) {
    res.status(500).json({ message: 'Error creating proposal', error: err.message });
  }
});

// POST /api/challenges/:id/progress — manual proof submission (custom metric only)
router.post('/:id/progress', requireAuth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });
    if (challenge.metric !== 'custom') {
      return res.status(400).json({ message: 'Manual progress submission is only for custom-metric challenges' });
    }

    const { proofNote = '' } = req.body;
    const participation = await ChallengeParticipation.findOneAndUpdate(
      { userId: req.user._id, challengeId: challenge._id },
      { proofNote, progress: 1, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json(participation);
  } catch (err) {
    res.status(500).json({ message: 'Error submitting progress', error: err.message });
  }
});

// GET /api/challenges/:id/leaderboard — top 20 by progress
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

    if (challenge.metric === 'custom') {
      const entries = await ChallengeParticipation.find({ challengeId: challenge._id })
        .sort({ progress: -1, completedAt: 1 })
        .limit(20)
        .populate('userId', 'username avatarUrl');

      return res.json(entries.map((p, i) => ({
        rank: i + 1,
        username: p.userId?.username,
        avatarUrl: p.userId?.avatarUrl,
        progress: p.progress,
        completed: p.completed,
        completedAt: p.completedAt,
      })));
    }

    // Auto-computed metrics: only users who have interacted with this
    // challenge so far (i.e. have a participation row) are ranked — a full
    // leaderboard of "everyone in the app" would mean recomputing progress
    // for every user on every fetch, which doesn't scale.
    const { monthStart, monthEnd } = monthBounds(challenge.month);
    const Card = mongoose.model('Card');
    const participants = await ChallengeParticipation.find({ challengeId: challenge._id })
      .populate('userId', 'username avatarUrl');

    const ranked = await Promise.all(participants.map(async (p) => {
      const progress = await computeProgress(challenge, p.userId._id, monthStart, monthEnd, Card);
      return {
        username: p.userId?.username,
        avatarUrl: p.userId?.avatarUrl,
        progress,
        completed: progress >= challenge.target,
        completedAt: p.completedAt,
      };
    }));

    ranked.sort((a, b) => b.progress - a.progress);
    res.json(ranked.slice(0, 20).map((entry, i) => ({ rank: i + 1, ...entry })));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching leaderboard', error: err.message });
  }
});

module.exports = router;

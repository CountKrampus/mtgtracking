const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const DiscordLink = require('../models/DiscordLink');
const LinkCode = require('../models/LinkCode');
const Notification = require('../models/Notification');

// Guards the routes the bot calls as *itself* (not as a resolved user) -
// establishing a link and polling notifications across all linked users
// happen before/outside the per-user req.user resolution in verifyToken.
function requireBotServiceToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expected = process.env.DISCORD_BOT_SERVICE_TOKEN;
  const valid = !!expected && !!token && token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!valid) {
    return res.status(401).json({ message: 'Invalid bot service token' });
  }
  next();
}

// POST /api/discord/link-code - normal authenticated web session generates
// a short code the user then enters into the Discord bot via /link.
router.post('/link-code', requireAuth, async (req, res) => {
  try {
    const linkCode = await LinkCode.generateForUser(req.user._id);
    res.status(201).json({ code: linkCode.code, expiresAt: linkCode.expiresAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/discord/exchange - bot-only. Exchanges a valid link code for a
// DiscordLink record. Uses requireBotServiceToken directly (not requireAuth)
// since no DiscordLink exists yet for this Discord user at this point.
router.post('/exchange', requireBotServiceToken, async (req, res) => {
  try {
    const { code, discordUserId } = req.body;
    if (typeof code !== 'string' || !code || !discordUserId) {
      return res.status(400).json({ message: 'code and discordUserId are required' });
    }

    const linkCode = await LinkCode.findOne({
      code: code.toUpperCase(),
      expiresAt: { $gt: new Date() }
    });
    if (!linkCode) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // Clear out any prior link involving either side before creating the new one.
    await DiscordLink.deleteMany({ $or: [{ userId: linkCode.userId }, { discordUserId }] });
    const link = await DiscordLink.create({ userId: linkCode.userId, discordUserId });
    await LinkCode.deleteOne({ _id: linkCode._id });

    res.status(201).json({ linked: true, userId: link.userId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/discord/link - unlink. Works for both a normal web session
// (req.user resolved from a JWT) and the bot's /unlink command (req.user
// resolved via DiscordLink in verifyToken's bot-auth branch) - either way
// req.user._id is the real account to unlink.
router.delete('/link', requireAuth, async (req, res) => {
  try {
    await DiscordLink.deleteOne({ userId: req.user._id });
    res.json({ unlinked: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/discord/notifications/pending - bot-only. Polled on an interval;
// returns price_alert Notifications for ALL linked users created after
// ?since, mapped to their discordUserId so the bot can DM each one.
router.get('/notifications/pending', requireBotServiceToken, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const links = await DiscordLink.find({});
    const discordIdByUserId = new Map(links.map(l => [l.userId.toString(), l.discordUserId]));
    const userIds = links.map(l => l.userId);

    const notifications = await Notification.find({
      userId: { $in: userIds },
      type: 'price_alert',
      createdAt: { $gt: since }
    }).sort({ createdAt: 1 }).lean();

    const results = notifications.map(n => ({
      discordUserId: discordIdByUserId.get(n.userId.toString()),
      content: n.content,
      cardId: n.cardId,
      createdAt: n.createdAt
    }));

    res.json({ notifications: results, polledAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

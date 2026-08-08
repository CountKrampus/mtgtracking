const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth, isMultiUserEnabled } = require('../middleware/auth');
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

// Discord linking only makes sense when accounts exist to link to.
// requireAuth is a no-op (doesn't populate req.user at all) when multi-user
// mode is off, so without this guard req.user._id below would throw a raw
// TypeError instead of a clear error response.
function requireMultiUser(req, res, next) {
  if (!isMultiUserEnabled()) {
    return res.status(400).json({ message: 'Discord account linking requires multi-user mode to be enabled' });
  }
  next();
}

const DISCORD_NOTIF_TYPES = [
  'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected',
  'trade_countered', 'mention', 'reply', 'upvote', 'dm',
  'collection_health_report', 'price_flag_resolved',
];

// GET /api/discord/link - normal authenticated web session checks whether
// it currently has a linked Discord account, for the Settings UI.
router.get('/link', requireMultiUser, requireAuth, async (req, res) => {
  try {
    const link = await DiscordLink.findOne({ userId: req.user._id });
    res.json({ linked: !!link });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/discord/link-code - normal authenticated web session generates
// a short code the user then enters into the Discord bot via /link.
router.post('/link-code', requireMultiUser, requireAuth, async (req, res) => {
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
router.delete('/link', requireMultiUser, requireAuth, async (req, res) => {
  try {
    await DiscordLink.deleteOne({ userId: req.user._id });
    res.json({ unlinked: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/discord/link/prefs - returns notification preferences for the
// linked Discord account of the authenticated user.
router.get('/link/prefs', requireMultiUser, requireAuth, async (req, res) => {
  try {
    const link = await DiscordLink.findOne({ userId: req.user._id });
    if (!link) return res.status(404).json({ message: 'No Discord account linked' });
    res.json(link.notificationPrefs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/discord/link/prefs - update one or more notification preference
// flags. Unknown keys are rejected; valid keys are coerced to Boolean.
router.patch('/link/prefs', requireMultiUser, requireAuth, async (req, res) => {
  try {
    const link = await DiscordLink.findOne({ userId: req.user._id });
    if (!link) return res.status(404).json({ message: 'No Discord account linked' });
    const unknownKeys = Object.keys(req.body).filter(k => !DISCORD_NOTIF_TYPES.includes(k));
    if (unknownKeys.length > 0) {
      return res.status(400).json({ message: `Unknown notification type(s): ${unknownKeys.join(', ')}` });
    }
    for (const [key, val] of Object.entries(req.body)) {
      link.notificationPrefs[key] = Boolean(val);
    }
    await link.save();
    res.json(link.notificationPrefs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/discord/notifications/pending - bot-only. Polled on an interval;
// returns price_alert Notifications for ALL linked users that haven't been
// marked as Discord-delivered yet, mapped to their discordUserId so the bot
// can DM each one. Undelivered state lives on the Notification row itself
// (discordDeliveredAt) rather than a poll-side "since" cursor, so a bot
// restart or a single failed DM can't cause an alert to be silently skipped
// forever - it just stays undelivered until a later poll's DM succeeds and
// the bot calls POST /notifications/mark-delivered for it.
router.get('/notifications/pending', requireBotServiceToken, async (req, res) => {
  try {
    const links = await DiscordLink.find({});
    const discordIdByUserId = new Map(links.map(l => [l.userId.toString(), l.discordUserId]));

    const orClauses = links
      .map(link => {
        const prefs = link.notificationPrefs || {};
        const enabledTypes = DISCORD_NOTIF_TYPES.filter(t =>
          t === 'price_alert' ? (prefs.price_alert !== false) : prefs[t] === true
        );
        return enabledTypes.length > 0
          ? { userId: link.userId, type: { $in: enabledTypes } }
          : null;
      })
      .filter(Boolean);

    if (orClauses.length === 0) {
      return res.json({ notifications: [], polledAt: new Date().toISOString() });
    }

    const notifications = await Notification.find({
      $or: orClauses,
      discordDeliveredAt: null,
    }).sort({ createdAt: 1 }).lean();

    const results = notifications.map(n => ({
      id: n._id,
      discordUserId: discordIdByUserId.get(n.userId.toString()),
      type: n.type,
      content: n.content,
      cardId: n.cardId,
      createdAt: n.createdAt
    }));

    res.json({ notifications: results, polledAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/discord/notifications/mark-delivered - bot-only. Called after
// the bot successfully DMs a notification, so it drops out of future
// /notifications/pending polls.
router.post('/notifications/mark-delivered', requireBotServiceToken, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await Notification.updateMany(
      { _id: { $in: ids } },
      { $set: { discordDeliveredAt: new Date() } }
    );
    res.json({ marked: ids.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

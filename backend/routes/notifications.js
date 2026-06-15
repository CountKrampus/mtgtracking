const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const { getUserId } = require('../middleware/multiUser');

// Exported helper for creating notifications from other route files
async function createNotification(userId, type, title, body, link) {
  try {
    await Notification.create({ userId, type, title, body: body || '', link: link || '' });
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
}

// GET /api/notifications — most recent 20 for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const query = { userId };
    if (req.query.unreadOnly === 'true') query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: getUserId(req), read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: getUserId(req) },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: getUserId(req), read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;

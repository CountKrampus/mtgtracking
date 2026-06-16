const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { verifyToken, requireAuth } = require('../middleware/auth');

// GET /api/notifications - Get user's notifications
router.get('/', verifyToken, requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { unreadOnly = false } = req.query;

    // Build query
    const query = { userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    // Fetch notifications sorted by isRead (unread first) then by createdAt
    const notifications = await Notification.find(query)
      .sort({ isRead: 1, createdAt: -1 })
      .populate('fromUserId', 'username displayName')
      .populate('threadId', 'title')
      .populate('postId', 'body')
      .populate('messageId', 'content');

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false
    });

    res.json({
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/notifications/:id/read - Mark single notification as read
router.post('/:id/read', verifyToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    // Find notification and verify ownership
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Mark as read
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    // Populate references for response
    await notification.populate('fromUserId', 'username displayName');
    await notification.populate('threadId', 'title');
    await notification.populate('postId', 'body');
    await notification.populate('messageId', 'content');

    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    // Find notification and verify ownership
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete notification
    await Notification.findByIdAndDelete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/notifications/mark-all-read - Mark all user's notifications as read
router.post('/mark-all-read', verifyToken, requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Update all unread notifications for this user
    const result = await Notification.updateMany(
      { userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json({ markedCount: result.modifiedCount });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

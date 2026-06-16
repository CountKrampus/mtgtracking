const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DirectMessage = require('../models/DirectMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken, requireAuth } = require('../middleware/auth');

// GET /api/messages/:userId - Get DM thread with specific user
router.get('/:userId', verifyToken, requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Find the other user
    const otherUser = await User.findById(userId).select('username displayName');
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch all messages in conversation (both directions)
    const messages = await DirectMessage.find({
      $or: [
        { fromUserId: currentUserId, toUserId: userId },
        { fromUserId: userId, toUserId: currentUserId }
      ]
    })
      .populate('fromUserId', 'username displayName')
      .populate('toUserId', 'username displayName')
      .sort({ createdAt: 1 });

    // Mark messages TO current user FROM otherUser as read
    const messagesToMarkAsRead = messages.filter(
      msg => msg.toUserId._id.toString() === currentUserId.toString() &&
             msg.fromUserId._id.toString() === userId.toString() &&
             !msg.isRead
    );

    for (const msg of messagesToMarkAsRead) {
      msg.isRead = true;
      msg.readAt = new Date();
      await msg.save();
    }

    res.json({
      messages,
      user: {
        id: otherUser._id,
        username: otherUser.username,
        displayName: otherUser.displayName
      }
    });
  } catch (error) {
    console.error('Get DM thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/messages - Get list of DM conversations
router.get('/', verifyToken, requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all unique conversations by getting latest message from each user pair
    const conversations = await DirectMessage.aggregate([
      {
        // Get messages from or to current user
        $match: {
          $or: [
            { fromUserId: new mongoose.Types.ObjectId(currentUserId) },
            { toUserId: new mongoose.Types.ObjectId(currentUserId) }
          ]
        }
      },
      {
        // Group by conversation partner
        $group: {
          _id: {
            user1: {
              $min: [
                '$fromUserId',
                '$toUserId'
              ]
            },
            user2: {
              $max: [
                '$fromUserId',
                '$toUserId'
              ]
            }
          },
          lastMessage: { $last: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$toUserId', new mongoose.Types.ObjectId(currentUserId)] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        // Sort by last message time
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Populate user details for last message and get conversation partner
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Determine which user is the conversation partner
        const partnerId = conv._id.user1.toString() === currentUserId.toString()
          ? conv._id.user2
          : conv._id.user1;

        // Populate the last message with user details
        const lastMsg = await DirectMessage.findById(conv.lastMessage._id)
          .populate('fromUserId', 'username displayName')
          .populate('toUserId', 'username displayName');

        // Fetch partner user details
        const partner = await User.findById(partnerId).select('username displayName');

        return {
          otherUserId: partner._id,
          otherUser: {
            id: partner._id,
            username: partner.username,
            displayName: partner.displayName
          },
          lastMessage: lastMsg.content.substring(0, 100), // Preview (first 100 chars)
          unreadCount: conv.unreadCount
        };
      })
    );

    // Calculate total unread count
    const totalUnread = enrichedConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

    res.json({
      conversations: enrichedConversations,
      totalUnread
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/messages - Send DM
router.post('/', verifyToken, requireAuth, async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    const fromUserId = req.user._id;

    // Validate inputs
    if (!toUserId || !content) {
      return res.status(400).json({ message: 'toUserId and content are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({ message: 'Invalid recipient user ID' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ message: 'Message cannot exceed 5000 characters' });
    }

    // Verify recipient exists
    const recipient = await User.findById(toUserId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient user not found' });
    }

    // Prevent self-messaging
    if (fromUserId.toString() === toUserId.toString()) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    // Create message
    const message = new DirectMessage({
      fromUserId,
      toUserId,
      content: content.trim()
    });

    await message.save();

    // Populate for response
    await message.populate('fromUserId', 'username displayName');
    await message.populate('toUserId', 'username displayName');

    // Create notification for recipient
    const notification = new Notification({
      userId: toUserId,
      type: 'dm',
      fromUserId,
      messageId: message._id,
      content: content.substring(0, 100) // First 100 chars for preview
    });

    await notification.save();

    res.status(201).json(message);
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/messages/:id/read - Mark single message as read
router.post('/:id/read', verifyToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    // Find message
    const message = await DirectMessage.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify current user is the recipient
    if (message.toUserId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized - only recipient can mark as read' });
    }

    // Mark as read
    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    // Populate for response
    await message.populate('fromUserId', 'username displayName');
    await message.populate('toUserId', 'username displayName');

    res.json(message);
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Extract mentions from text in format @username
 * Valid usernames: 3-30 characters, alphanumeric + underscore/hyphen
 * Returns array of unique usernames mentioned
 */
function extractMentions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match @username patterns: @ followed by alphanumeric, underscore, or hyphen (3-30 chars)
  // User model requires minlength: 3, maxlength: 30, so we need 3-30 after @
  const mentions = text.match(/@[a-zA-Z0-9_-]{3,29}/g) || [];

  // Remove @ symbol and convert to lowercase for lookup
  const usernames = mentions
    .map(mention => mention.substring(1).toLowerCase())
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  return usernames;
}

/**
 * Create a notification with duplicate prevention
 * Prevents creating similar notifications within 1 minute window
 *
 * @param {string|ObjectId} userId - User to notify
 * @param {string} type - Notification type (mention, reply, upvote, dm)
 * @param {string|ObjectId} fromUserId - User who triggered notification
 * @param {object} data - Additional data { threadId, postId, messageId, content }
 * @returns {object} Created notification or null if duplicate prevented
 */
async function createNotification(userId, type, fromUserId, data = {}) {
  if (type === 'price_alert') {
    throw new Error('Use createPriceAlertNotification for price_alert notifications');
  }
  try {
    // Don't create notification if user is notifying themselves
    if (userId.toString() === fromUserId.toString()) {
      return null;
    }

    // Build notification object
    const notification = new Notification({
      userId,
      type,
      fromUserId,
      threadId: data.threadId || undefined,
      postId: data.postId || undefined,
      messageId: data.messageId || undefined,
      content: (data.content || '').substring(0, 200) // Enforce max length
    });

    // Check for duplicate notifications within 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentSimilar = await Notification.findOne({
      userId,
      type,
      fromUserId,
      postId: data.postId || undefined,
      threadId: data.threadId || undefined,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (recentSimilar) {
      // Duplicate notification exists, don't create
      return null;
    }

    // Create the notification
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Create mention notifications for all @mentioned users in text
 * Looks up users by username and creates notifications
 *
 * @param {string|ObjectId} fromUserId - User who created the post/message
 * @param {string} type - Notification type (mention, reply, upvote, etc.)
 * @param {string} text - Text containing @mentions
 * @param {object} data - Additional data { threadId, postId, messageId, content }
 * @returns {array} Array of created notifications (may include nulls for duplicates)
 */
async function createMentionNotifications(fromUserId, type, text, data = {}) {
  const usernames = extractMentions(text);

  if (usernames.length === 0) {
    return [];
  }

  // Find all users with mentioned usernames
  const mentionedUsers = await User.find({
    username: { $in: usernames },
    isActive: true
  }).select('_id username');

  // Create notifications for each mentioned user
  const notifications = await Promise.all(
    mentionedUsers.map(user =>
      createNotification(user._id, type, fromUserId, data)
    )
  );

  return notifications.filter(n => n !== null);
}

/**
 * Create a reply notification for post author
 *
 * @param {string|ObjectId} postAuthorId - Author of the parent post
 * @param {string|ObjectId} fromUserId - User who replied
 * @param {string|ObjectId} threadId - Thread ID
 * @param {string|ObjectId} postId - Reply post ID
 * @param {string} contentPreview - First 100 chars of reply
 * @returns {object} Created notification or null
 */
async function createReplyNotification(postAuthorId, fromUserId, threadId, postId, contentPreview) {
  return createNotification(postAuthorId, 'reply', fromUserId, {
    threadId,
    postId,
    content: `Replied to your post: ${contentPreview}`
  });
}

/**
 * Create an upvote notification for post author
 *
 * @param {string|ObjectId} postAuthorId - Author of the post
 * @param {string|ObjectId} fromUserId - User who upvoted
 * @param {string|ObjectId} postId - Post ID
 * @param {string} contentPreview - First 50 chars of post
 * @returns {object} Created notification or null
 */
async function createUpvoteNotification(postAuthorId, fromUserId, postId, contentPreview) {
  return createNotification(postAuthorId, 'upvote', fromUserId, {
    postId,
    content: `Your post received an upvote: "${contentPreview}"`
  });
}

/**
 * Create a price alert notification (system-generated, no fromUserId required)
 *
 * @param {string|ObjectId} userId - User who set the alert
 * @param {string|ObjectId} cardId - Card that triggered the alert
 * @param {string} cardName - Card name for display
 * @param {number} targetPrice - The alert target price
 * @param {number} actualPrice - The current price that triggered the alert
 * @returns {object} Created notification or null on error
 */
async function createPriceAlertNotification(userId, cardId, cardName, targetPrice, actualPrice) {
  try {
    const content = `${cardName} dropped to $${actualPrice.toFixed(2)} (target: $${targetPrice.toFixed(2)})`;
    const notification = await Notification.create({
      userId,
      type: 'price_alert',
      cardId,
      content: content.substring(0, 200)
    });
    return notification;
  } catch (error) {
    console.error('Error creating price alert notification:', error);
    return null;
  }
}

module.exports = {
  extractMentions,
  createNotification,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification,
  createPriceAlertNotification
};

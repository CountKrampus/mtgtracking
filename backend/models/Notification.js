const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['mention', 'reply', 'upvote', 'dm'],
    required: [true, 'Notification type is required']
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'From User ID is required']
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread'
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage'
  },
  content: {
    type: String,
    maxlength: [200, 'Content cannot exceed 200 characters']
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
});

// Compound indexes for common queries
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware: update readAt when isRead changes
notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead')) {
    if (this.isRead && !this.readAt) {
      this.readAt = new Date();
    } else if (!this.isRead) {
      this.readAt = null;
    }
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);

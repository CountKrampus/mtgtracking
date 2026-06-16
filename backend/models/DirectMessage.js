const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender user ID is required'],
    index: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient user ID is required'],
    index: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
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
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for conversation thread lookup (sorted alphabetically)
directMessageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
directMessageSchema.index({ toUserId: 1, fromUserId: 1, createdAt: -1 });

// Compound index for efficient unread queries
directMessageSchema.index({ toUserId: 1, fromUserId: 1, isRead: 1 });

// Pre-save middleware: auto-update updatedAt timestamp
directMessageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save middleware: update readAt when isRead changes
directMessageSchema.pre('save', function(next) {
  if (this.isModified('isRead')) {
    if (this.isRead && !this.readAt) {
      this.readAt = new Date();
    } else if (!this.isRead) {
      this.readAt = null;
    }
  }
  next();
});

module.exports = mongoose.model('DirectMessage', directMessageSchema);

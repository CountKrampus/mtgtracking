const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Thread title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  contentFormat: {
    type: String,
    enum: ['plain', 'markdown'],
    default: 'markdown'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    lowercase: true,
    maxlength: 30
  }],
  postCount: {
    type: Number,
    default: 0
  },
  lastPostAt: {
    type: Date,
    default: null
  },
  lastPostAuthorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  mergeRequest: {
    suggestedThreadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumThread',
      default: null
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

threadSchema.index({ categoryId: 1, isPinned: -1, createdAt: -1 });
threadSchema.index({ authorId: 1, createdAt: -1 });
threadSchema.index({ lastPostAt: -1 });
threadSchema.index({ tags: 1 });

threadSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ForumThread', threadSchema);

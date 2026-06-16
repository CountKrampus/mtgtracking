const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    required: [true, 'Thread ID is required']
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required']
  },
  authorUsername: {
    type: String,
    default: ''
  },
  authorAvatarUrl: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    required: [true, 'Post body is required']
  },
  bodyFormat: {
    type: String,
    enum: ['plain', 'markdown'],
    default: 'markdown'
  },
  editHistory: [{
    originalBody: String,
    editedAt: {
      type: Date,
      default: Date.now
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  lastEditedAt: Date,
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  hiddenReason: String,
  isFlagHidden: {
    type: Boolean,
    default: false
  },
  isShadowHidden: {
    type: Boolean,
    default: false
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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

postSchema.index({ threadId: 1, createdAt: 1 });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ threadId: 1, isHidden: 1 });

postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ForumPost', postSchema);

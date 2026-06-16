const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const Notification = require('../models/Notification');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { checkMute } = require('../middleware/muteEnforcer');
const { checkSpam } = require('../utils/spamFilter');
const {
  extractMentions,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification
} = require('../utils/notifications');
const Ban = require('../models/Ban');
const User = require('../models/User');

// GET /api/forum/categories - List all categories with subcategories
router.get('/categories', async (req, res) => {
  try {
    const categories = await ForumCategory.find({ parentCategoryId: null, isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    const withChildren = await Promise.all(categories.map(async (cat) => {
      const children = await ForumCategory.find({ parentCategoryId: cat._id, isActive: true })
        .sort({ displayOrder: 1 })
        .lean();
      return { ...cat, children };
    }));

    res.json(withChildren);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/categories/:categoryId/threads - List threads in category
router.get('/categories/:categoryId/threads', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const threads = await ForumThread.find({ categoryId, isLocked: false })
      .sort({ isPinned: -1, lastPostAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-editHistory')
      .populate('authorId', 'username displayName')
      .populate('lastPostAuthorId', 'username displayName');

    const total = await ForumThread.countDocuments({ categoryId });

    res.json({
      threads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/threads/:threadId - Get single thread with posts
router.get('/threads/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const thread = await ForumThread.findByIdAndUpdate(
      threadId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('authorId', 'username displayName');

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const posts = await ForumPost.find({ threadId, isHidden: false })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('authorId', 'username displayName');

    const total = await ForumPost.countDocuments({ threadId, isHidden: false });

    res.json({
      thread,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/threads - Create new thread (requires auth)
router.post('/threads', verifyToken, requireAuth, async (req, res) => {
  try {
    const { categoryId, title, content, contentFormat = 'markdown', tags = [] } = req.body;

    if (!categoryId || !title || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const category = await ForumCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const thread = new ForumThread({
      categoryId,
      title,
      content,
      contentFormat,
      tags,
      authorId: req.user._id
    });

    await thread.save();
    await ForumCategory.findByIdAndUpdate(categoryId, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date()
    });

    await thread.populate('authorId', 'username displayName');

    res.status(201).json(thread);
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/posts - Create new post (requires auth)
router.post('/posts', verifyToken, requireAuth, checkMute, async (req, res) => {
  try {
    const { threadId, body, bodyFormat = 'markdown' } = req.body;

    if (!threadId || !body) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ message: 'Thread is locked' });
    }

    // Check spam
    const user = await User.findById(req.user._id);
    const { flagged, reasons } = await checkSpam(req.user._id, body, user.reputation || 0);

    if (flagged) {
      return res.status(400).json({
        message: 'Your post was flagged as spam',
        reasons
      });
    }

    const post = new ForumPost({
      threadId,
      body,
      bodyFormat,
      authorId: req.user._id
    });

    await post.save();

    await ForumThread.findByIdAndUpdate(threadId, {
      $inc: { postCount: 1 },
      lastPostAt: new Date(),
      lastPostAuthorId: req.user._id
    });

    await post.populate('authorId', 'username displayName');

    // Handle notifications asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Extract mentions and create mention notifications
        const mentionedUsernames = extractMentions(body);
        if (mentionedUsernames.length > 0) {
          const contentPreview = body.substring(0, 100);
          await createMentionNotifications(req.user._id, 'mention', body, {
            threadId,
            postId: post._id,
            content: `Mentioned you in a post: "${contentPreview}"`
          });
        }

        // If this is a reply to another post (check for parentPostId in future enhancement)
        // For now, notifications will be created via explicit reply mechanism
      } catch (notifError) {
        console.error('Error creating post notifications:', notifError);
        // Don't fail the request if notification creation fails
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/posts/:postId - Edit post (requires auth, author only)
router.put('/posts/:postId', verifyToken, requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { body, reason = '' } = req.body;

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    // Add to edit history
    post.editHistory.push({
      originalBody: post.body,
      editedBy: req.user._id,
      reason
    });

    post.body = body;
    post.isEdited = true;
    post.lastEditedAt = new Date();
    post.lastEditedBy = req.user._id;

    await post.save();
    await post.populate('authorId', 'username displayName');

    res.json(post);
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/posts/:postId/edits - Get post edit history
router.get('/posts/:postId/edits', async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId)
      .populate('editHistory.editedBy', 'username displayName');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({
      originalBody: post.body,
      isEdited: post.isEdited,
      editHistory: post.editHistory.map(edit => ({
        originalBody: edit.originalBody,
        editedAt: edit.editedAt,
        editedBy: edit.editedBy,
        reason: edit.reason
      }))
    });
  } catch (error) {
    console.error('Get edit history error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/posts/:postId/upvote - Upvote a post (requires auth)
router.post('/posts/:postId/upvote', verifyToken, requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user already upvoted
    const hasUpvoted = post.upvotes.some(id => id.toString() === userId.toString());

    if (hasUpvoted) {
      // Remove upvote
      post.upvotes = post.upvotes.filter(id => id.toString() !== userId.toString());
      await post.save();
      await post.populate('authorId', 'username displayName');
      return res.json({ post, action: 'removed' });
    }

    // Add upvote
    post.upvotes.push(userId);
    await post.save();

    // Create upvote notification asynchronously
    setImmediate(async () => {
      try {
        const contentPreview = post.body.substring(0, 50);
        await createUpvoteNotification(post.authorId, userId, post._id, contentPreview);
      } catch (notifError) {
        console.error('Error creating upvote notification:', notifError);
      }
    });

    await post.populate('authorId', 'username displayName');

    res.json({ post, action: 'added' });
  } catch (error) {
    console.error('Upvote post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Advanced Features: Duplicates, Merges, Deck Import

const { findDuplicateThreads } = require('../utils/threadDuplicateDetector');
const ForumLevel = require('../models/ForumLevel');

// POST /api/forum/threads/check-duplicates
router.post('/threads/check-duplicates', async (req, res) => {
  try {
    const { title, categoryId } = req.body;
    if (!title || !categoryId) {
      return res.status(400).json({ message: 'Title and categoryId required' });
    }

    const duplicates = await findDuplicateThreads(title, categoryId);
    res.json(duplicates);
  } catch (error) {
    console.error('Check duplicates error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/threads/:threadId/merge-request
router.put('/threads/:threadId/merge-request', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { status, reviewedBy } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const thread = await ForumThread.findByIdAndUpdate(
      threadId,
      {
        'mergeRequest.status': status,
        'mergeRequest.reviewedBy': reviewedBy,
        'mergeRequest.reviewedAt': new Date()
      },
      { new: true }
    );

    if (status === 'approved' && thread.mergeRequest.suggestedThreadId) {
      await ForumPost.updateMany(
        { threadId },
        { threadId: thread.mergeRequest.suggestedThreadId }
      );

      const postCount = await ForumPost.countDocuments({
        threadId: thread.mergeRequest.suggestedThreadId
      });

      await ForumThread.findByIdAndUpdate(
        thread.mergeRequest.suggestedThreadId,
        { postCount }
      );

      thread.postCount = 0;
      await thread.save();
    }

    res.json(thread);
  } catch (error) {
    console.error('Merge threads error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/threads/:threadId/import-deck
router.post('/threads/:threadId/import-deck', verifyToken, requireAuth, async (req, res) => {
  try {
    const { deckId } = req.body;
    if (!deckId) {
      return res.status(400).json({ message: 'deckId required' });
    }

    const Deck = mongoose.model('Deck');
    const originalDeck = await Deck.findById(deckId);

    if (!originalDeck) {
      return res.status(404).json({ message: 'Deck not found' });
    }

    const newDeck = new Deck({
      ...originalDeck.toObject(),
      _id: undefined,
      userId: req.user._id,
      name: `${originalDeck.name} (from forum)`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newDeck.save();

    res.json({
      message: 'Deck imported',
      deckId: newDeck._id
    });
  } catch (error) {
    console.error('Import deck error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/forum/threads/:threadId
router.delete('/threads/:threadId', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Delete all posts in this thread
    await ForumPost.deleteMany({ threadId });

    // Delete the thread itself
    await ForumThread.findByIdAndDelete(threadId);

    // Update category's thread count
    await ForumCategory.findByIdAndUpdate(
      thread.categoryId,
      { $inc: { threadCount: -1 } }
    );

    res.json({ success: true, message: 'Thread deleted' });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Forum Economy Endpoints

// GET /api/forum/user-level
router.get('/user-level', async (req, res) => {
  try {
    let level = await ForumLevel.findOne({ userId: req.user?._id });
    if (!level && req.user) {
      level = await ForumLevel.create({ userId: req.user._id });
    }
    res.json(level);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/shop/purchase
router.post('/shop/purchase', verifyToken, requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body;
    const PRICES = {
      'avatar_frame_1': 500,
      'username_color_1': 300,
      'badge_vip': 1000,
      'thread_bump': 100
    };

    if (!PRICES[itemId]) {
      return res.status(400).json({ message: 'Invalid item' });
    }

    const userLevel = await ForumLevel.findOne({ userId: req.user._id });
    await userLevel.spendCoins(PRICES[itemId]);

    res.json({ message: 'Purchased', updatedLevel: userLevel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

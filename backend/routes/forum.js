const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const Notification = require('../models/Notification');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { checkMute } = require('../middleware/muteEnforcer');
const { checkSpam } = require('../utils/spamFilter');
const {
  extractMentions,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification
} = require('../utils/notifications');
const { generateDiff, recordEdit } = require('../utils/postEditHistory');
const Ban = require('../models/Ban');
const User = require('../models/User');

// POST /api/forum/categories - Create category (admin only)
router.post('/categories', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, parentCategoryId, displayOrder = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = new ForumCategory({
      name,
      description,
      parentCategoryId: parentCategoryId || null,
      displayOrder
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/categories/:id - Update category (admin only)
router.put('/categories/:id', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentCategoryId, displayOrder, isActive } = req.body;

    const category = await ForumCategory.findByIdAndUpdate(
      id,
      { name, description, parentCategoryId, displayOrder, isActive },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/forum/categories/:id - Delete category (admin only, cascade)
router.delete('/categories/:id', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ForumCategory.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Cascade: find all threads in this category and subcategories
    const subcategories = await ForumCategory.find({ parentCategoryId: id });
    const categoryIds = [id, ...subcategories.map(s => s._id.toString())];

    for (const catId of categoryIds) {
      const threads = await ForumThread.find({ categoryId: catId });
      for (const thread of threads) {
        await ForumPost.deleteMany({ threadId: thread._id });
      }
      await ForumThread.deleteMany({ categoryId: catId });
    }

    await ForumCategory.deleteMany({ parentCategoryId: id });
    await ForumCategory.findByIdAndDelete(id);

    res.json({ success: true, message: 'Category and all contents deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: error.message });
  }
});

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
router.post('/threads', verifyToken, requireAuth, checkMute, async (req, res) => {
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

    // Check for duplicate threads using Jaccard similarity
    const suggestedDuplicates = await findDuplicates(title, categoryId, 0.6);

    res.status(201).json({ thread, suggestedDuplicates });
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
      authorId: req.user._id,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl || ''
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
router.put('/posts/:postId', verifyToken, requireAuth, checkMute, async (req, res) => {
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

    const oldBody = post.body;

    // Record edit history using utility (also sets isEdited, lastEditedAt, lastEditedBy)
    recordEdit(post, oldBody, req.user._id, reason);

    post.body = body;

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

// PUT /api/forum/threads/:threadId - Update thread (author or admin)
router.put('/threads/:threadId', verifyToken, requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title, content, tags } = req.body;

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const isAuthor = thread.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this thread' });
    }

    if (title !== undefined) thread.title = title;
    if (content !== undefined) thread.content = content;
    if (tags !== undefined) thread.tags = tags;

    await thread.save();
    await thread.populate('authorId', 'username displayName');

    res.json(thread);
  } catch (error) {
    console.error('Update thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/threads/:threadId/pin - Pin/unpin thread (admin only)
router.put('/threads/:threadId/pin', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    thread.isPinned = !thread.isPinned;
    await thread.save();

    res.json({ thread, pinned: thread.isPinned });
  } catch (error) {
    console.error('Pin thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/threads/:threadId/lock - Lock/unlock thread (admin only)
router.put('/threads/:threadId/lock', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    thread.isLocked = !thread.isLocked;
    await thread.save();

    res.json({ thread, locked: thread.isLocked });
  } catch (error) {
    console.error('Lock thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/threads/:threadId/posts - Create post in thread (authenticated)
router.post('/threads/:threadId/posts', verifyToken, requireAuth, checkMute, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { body, bodyFormat = 'markdown' } = req.body;

    if (!body) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ message: 'Thread is locked' });
    }

    const user = await User.findById(req.user._id);
    const { flagged, reasons } = await checkSpam(req.user._id, body, user.reputation || 0);

    if (flagged) {
      return res.status(400).json({ message: 'Your post was flagged as spam', reasons });
    }

    const post = new ForumPost({
      threadId,
      body,
      bodyFormat,
      authorId: req.user._id,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl || ''
    });

    await post.save();

    await ForumThread.findByIdAndUpdate(threadId, {
      $inc: { postCount: 1 },
      lastPostAt: new Date(),
      lastPostAuthorId: req.user._id
    });

    await post.populate('authorId', 'username displayName');

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post (nested) error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/forum/posts/:postId - Delete post (author or admin)
router.delete('/posts/:postId', verifyToken, requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isAuthor = post.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await ForumPost.findByIdAndDelete(postId);

    await ForumThread.findByIdAndUpdate(post.threadId, {
      $inc: { postCount: -1 }
    });

    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Advanced Features: Duplicates, Merges, Deck Import

const { findDuplicateThreads } = require('../utils/threadDuplicateDetector');
const { findDuplicateThreads: findDuplicates } = require('../utils/duplicateDetector');
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

// GET /api/forum/threads/:threadId/duplicates
router.get('/threads/:threadId/duplicates', async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.threadId).select('title categoryId').lean();
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const duplicates = await findDuplicates(thread.title, thread.categoryId, 0.6);

    res.json({ duplicates: duplicates.filter(d => d.threadId.toString() !== req.params.threadId) });
  } catch (error) {
    console.error('Get thread duplicates error:', error);
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

// GET /api/forum/users/:username/activity — public profile forum activity
router.get('/users/:username/activity', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('privacy reputation badges createdAt').lean();

    if (!user || !user.privacy?.isPublic || !user.privacy?.showForum) {
      return res.status(404).json({ message: 'Forum activity not available' });
    }

    const postQuery = {
      authorId: user._id,
      isFlagHidden: { $ne: true },
      isShadowHidden: { $ne: true }
    };

    const [recentPostDocs, threadCount, upvotesResult, postCount] = await Promise.all([
      ForumPost.find(postQuery).sort({ createdAt: -1 }).limit(10).lean(),
      ForumThread.countDocuments({ authorId: user._id }),
      ForumPost.aggregate([
        { $match: { authorId: user._id, isFlagHidden: { $ne: true }, isShadowHidden: { $ne: true } } },
        { $project: { upvoteCount: { $size: '$upvotes' } } },
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
      ]),
      ForumPost.countDocuments(postQuery)
    ]);

    // Populate thread titles for recent posts
    const threadIds = [...new Set(recentPostDocs.map(p => p.threadId?.toString()).filter(Boolean))];
    const recentThreads = await ForumThread.find({ _id: { $in: threadIds } }).select('title').lean();
    const recentThreadMap = Object.fromEntries(recentThreads.map(t => [t._id.toString(), t.title]));

    const recentPosts = recentPostDocs.map(p => ({
      _id: p._id,
      body: p.body.slice(0, 200),
      threadId: p.threadId,
      threadTitle: recentThreadMap[p.threadId?.toString()] || 'Unknown thread',
      createdAt: p.createdAt
    }));

    // Top 5 posts by upvotes
    const topPostDocs = await ForumPost.find(postQuery)
      .sort({ 'upvotes': -1 }).limit(5).lean();

    const topThreadIds = [...new Set(topPostDocs.map(p => p.threadId?.toString()).filter(Boolean))];
    const topThreadDocs = await ForumThread.find({ _id: { $in: topThreadIds } }).select('title').lean();
    const topThreadMap = Object.fromEntries(topThreadDocs.map(t => [t._id.toString(), t.title]));

    res.json({
      reputation: user.reputation || 0,
      badges: user.badges || [],
      stats: {
        postCount,
        threadCount,
        upvotesReceived: upvotesResult[0]?.total || 0,
        memberSince: user.createdAt
      },
      recentPosts,
      topPosts: topPostDocs.map(p => ({
        _id: p._id,
        body: p.body.slice(0, 200),
        threadId: p.threadId,
        threadTitle: topThreadMap[p.threadId?.toString()] || 'Unknown thread',
        upvoteCount: p.upvotes.length,
        createdAt: p.createdAt
      }))
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { checkMute } = require('../middleware/muteEnforcer');
const { checkSpam } = require('../utils/spamFilter');
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

// ─────────────────────────────────────────────────────────────
// ADMIN CATEGORY MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────

// POST /api/forum/admin/categories - Create new category
router.post('/admin/categories', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, parentCategoryId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if slug already exists
    const existing = await ForumCategory.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }

    const category = await ForumCategory.create({
      name,
      slug,
      description: description || '',
      parentCategoryId: parentCategoryId || null
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/admin/categories/:id - Update category
router.put('/admin/categories/:id', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, displayOrder, isActive } = req.body;
    const updates = {};

    if (name) {
      updates.name = name;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check if slug already exists (excluding current category)
      const existing = await ForumCategory.findOne({ slug, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'A category with this name already exists' });
      }
      updates.slug = slug;
    }

    if (description !== undefined) updates.description = description;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    const category = await ForumCategory.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/forum/admin/categories/:id - Delete category
router.delete('/admin/categories/:id', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const category = await ForumCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has subcategories
    const children = await ForumCategory.countDocuments({ parentCategoryId: category._id });
    if (children > 0) {
      return res.status(400).json({ message: 'Cannot delete category with subcategories' });
    }

    // Check if category has threads
    const threads = await ForumThread.countDocuments({ categoryId: category._id });
    if (threads > 0) {
      return res.status(400).json({ message: 'Cannot delete category with threads' });
    }

    await ForumCategory.deleteOne({ _id: req.params.id });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/admin/categories/reorder - Reorder categories (drag-drop)
router.put('/admin/categories/reorder', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { categoryOrders } = req.body; // Array of { id, displayOrder }

    if (!Array.isArray(categoryOrders)) {
      return res.status(400).json({ message: 'categoryOrders must be an array' });
    }

    // Update all categories in parallel
    await Promise.all(
      categoryOrders.map(({ id, displayOrder }) =>
        ForumCategory.updateOne({ _id: id }, { displayOrder })
      )
    );

    res.json({ message: 'Categories reordered' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

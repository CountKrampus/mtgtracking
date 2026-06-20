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
const { extractDeckFromText } = require('../utils/deckExtractor');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const { checkAndAwardBadges } = require('../utils/badgeManager');

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
    const subcategories = await ForumCategory.find({ parentCategoryId: id }).lean();
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

// GET /api/forum/leaderboard — top 10 users by reputation
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find({ reputation: { $gt: 0 }, isActive: true })
      .sort({ reputation: -1 })
      .limit(10)
      .select('username displayName reputation badges')
      .lean();
    res.json({ leaderboard: leaders });
  } catch (e) { res.status(500).json({ message: e.message }); }
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

    // Batch-fetch author rep/badges for all unique authors
    const flatPostsList = Array.isArray(posts) ? posts : [];
    const threadAuthorId = thread.authorId?._id?.toString() || thread.authorId?.toString();
    const authorIds = [...new Set(
      [threadAuthorId,
       ...flatPostsList.map(p => p.authorId?._id?.toString() || p.authorId?.toString())]
        .filter(Boolean)
    )];
    const authorDocs = await User.find({ _id: { $in: authorIds } })
      .select('reputation badges').lean();
    const authorMap = Object.fromEntries(authorDocs.map(u => [u._id.toString(), u]));

    res.json({
      thread: {
        ...thread.toObject(),
        authorReputation: authorMap[threadAuthorId]?.reputation || 0,
        authorBadges: (authorMap[threadAuthorId]?.badges || []).slice(0, 5)
      },
      posts: flatPostsList.map(p => {
        const postAuthorId = p.authorId?._id?.toString() || p.authorId?.toString();
        return {
          ...p.toObject(),
          authorReputation: authorMap[postAuthorId]?.reputation || 0,
          authorBadges: (authorMap[postAuthorId]?.badges || []).slice(0, 5)
        };
      }),
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
    const { categoryId, title, contentFormat = 'markdown', tags = [], isQA: isQAOverride } = req.body;
    const content = req.body.content || req.body.body;

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
      authorId: req.user._id,
      isQA: isQAOverride !== undefined ? Boolean(isQAOverride) : Boolean(category.isQA)
    });

    await thread.save();
    await ForumCategory.findByIdAndUpdate(categoryId, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date()
    });

    // Award XP and coins for creating a thread (async, non-blocking)
    setImmediate(async () => {
      try {
        let level = await ForumLevel.findOne({ userId: req.user._id });
        if (!level) level = await ForumLevel.create({ userId: req.user._id });
        level.addExperience(50);
        level.addCoins(10);
        await level.save();
      } catch (xpErr) {
        console.error('XP/coin award error (thread creation):', xpErr);
      }
    });

    await thread.populate('authorId', 'username displayName');

    // Check for duplicate threads using Jaccard similarity
    const suggestedDuplicates = await findDuplicates(title, categoryId, 0.6);

    // Rep + badge side effects (fire-and-forget, don't block response)
    User.findByIdAndUpdate(req.user._id, {
      $inc: { reputation: 2, 'communityStats.threadCount': 1 }
    }).then(() => checkAndAwardBadges(req.user._id, 'thread_create')).catch(() => {});

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

    // Award XP and coins for creating a post (async, non-blocking)
    setImmediate(async () => {
      try {
        let level = await ForumLevel.findOne({ userId: req.user._id });
        if (!level) level = await ForumLevel.create({ userId: req.user._id });
        level.addExperience(25);
        level.addCoins(5);
        await level.save();
      } catch (xpErr) {
        console.error('XP/coin award error (post creation):', xpErr);
      }
    });

    // Rep + badge side effects (fire-and-forget)
    User.findByIdAndUpdate(req.user._id, {
      $inc: { reputation: 1, 'communityStats.postCount': 1 }
    }).then(() => checkAndAwardBadges(req.user._id, 'post_create')).catch(() => {});

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

// POST /api/forum/posts/:postId/upvote — toggle
router.post('/posts/:postId/upvote', verifyToken, requireAuth, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const uid = req.user._id;
    const idx = post.upvotes.findIndex(id => id.toString() === uid.toString());
    const isAdding = idx === -1;
    const postAuthorId = post.authorId;
    const isSelfVote = postAuthorId.toString() === uid.toString();

    if (isAdding) {
      post.upvotes.push(uid);

      // Create upvote notification asynchronously
      setImmediate(async () => {
        try {
          const contentPreview = post.body.substring(0, 50);
          await createUpvoteNotification(postAuthorId, uid, post._id, contentPreview);
        } catch (notifError) {
          console.error('Error creating upvote notification:', notifError);
        }
      });

      // Award XP and coins to post author for receiving an upvote (async, non-blocking)
      setImmediate(async () => {
        try {
          let level = await ForumLevel.findOne({ userId: postAuthorId });
          if (!level) level = await ForumLevel.create({ userId: postAuthorId });
          level.addExperience(10);
          level.addCoins(2);
          await level.save();
        } catch (xpErr) {
          console.error('XP/coin award error (upvote):', xpErr);
        }
      });
    } else {
      post.upvotes.splice(idx, 1);
      // No rep deduction on unvote
    }
    await post.save();

    // Best-answer detection for Q&A threads
    let awardedBestAnswer = false;
    const thread = await ForumThread.findById(post.threadId);
    if (thread && thread.isQA) {
      const allPosts = await ForumPost.find({ threadId: thread._id })
        .select('_id authorId upvotes').lean();
      const topPost = allPosts.reduce((best, p) =>
        p.upvotes.length > (best ? best.upvotes.length : 0) ? p : best, null);

      const prevBestId = thread.bestAnswerPostId ? thread.bestAnswerPostId.toString() : null;
      const newBestId = topPost && topPost.upvotes.length >= 3 ? topPost._id.toString() : null;

      thread.bestAnswerPostId = newBestId ? topPost._id : null;
      await thread.save();

      // Award +15 rep to new best-answer author (one-time: only when bestAnswerPostId changes to this post)
      if (newBestId && newBestId !== prevBestId && !isSelfVote) {
        User.findByIdAndUpdate(topPost.authorId, { $inc: { reputation: 15 } }).catch(() => {});
        awardedBestAnswer = true;
      }
    }

    // Award +5 rep to post author for regular upvote (skip if best-answer rep was just awarded)
    if (isAdding && !isSelfVote && !awardedBestAnswer) {
      User.findByIdAndUpdate(postAuthorId, { $inc: { reputation: 5 } }).catch(() => {});
    }

    res.json({ upvoteCount: post.upvotes.length, hasUpvoted: isAdding });
  } catch (e) {
    console.error('Upvote post error:', e);
    res.status(500).json({ message: e.message });
  }
});

// POST /api/forum/threads/:id/upvote — toggle
router.post('/threads/:id/upvote', verifyToken, requireAuth, async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const uid = req.user._id;
    const idx = thread.upvotes.findIndex(id => id.toString() === uid.toString());
    if (idx === -1) {
      thread.upvotes.push(uid);
      // Award +10 rep to thread author (fire-and-forget)
      if (thread.authorId.toString() !== uid.toString()) {
        User.findByIdAndUpdate(thread.authorId, { $inc: { reputation: 10 } }).catch(() => {});
      }
    } else {
      thread.upvotes.splice(idx, 1);
      // No rep deduction on unvote
    }
    await thread.save();
    res.json({ upvoteCount: thread.upvotes.length, hasUpvoted: idx === -1 });
  } catch (e) { res.status(500).json({ message: e.message }); }
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

// PUT /api/forum/threads/:threadId/move - Move thread to different category (admin only)
router.put('/threads/:threadId/move', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: 'categoryId required' });
    }

    const thread = await ForumThread.findByIdAndUpdate(
      threadId,
      { categoryId },
      { new: true }
    ).populate('categoryId');

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Move thread error:', error);
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

    // Award XP and coins for creating a post (async, non-blocking)
    setImmediate(async () => {
      try {
        let level = await ForumLevel.findOne({ userId: req.user._id });
        if (!level) level = await ForumLevel.create({ userId: req.user._id });
        level.addExperience(25);
        level.addCoins(5);
        await level.save();
      } catch (xpErr) {
        console.error('XP/coin award error (nested post creation):', xpErr);
      }
    });

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

// GET /api/forum/admin/flagged-posts - list flagged/hidden posts (admin only)
router.get('/admin/flagged-posts', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const flaggedPosts = await ForumPost.find({ isHidden: true })
      .select('body threadId authorId hiddenReason createdAt')
      .populate('authorId', 'username displayName')
      .populate('threadId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ForumPost.countDocuments({ isHidden: true });

    res.json({
      flaggedPosts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Fetch flagged posts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/admin/merge-requests - list pending merge requests
router.get('/admin/merge-requests', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const pending = await ForumThread.find({ 'mergeRequest.status': 'pending' })
      .select('title postCount mergeRequest createdAt')
      .populate('mergeRequest.suggestedThreadId', 'title')
      .sort({ 'mergeRequest.status': 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ForumThread.countDocuments({ 'mergeRequest.status': 'pending' });

    res.json({
      pending,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Fetch merge requests error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/threads/:threadId/merge - approve and merge threads
router.post('/threads/:threadId/merge', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = await ForumThread.findById(threadId);

    if (!thread || !thread.mergeRequest.suggestedThreadId) {
      return res.status(400).json({ message: 'No merge request found' });
    }

    // Move all posts from source thread to target thread
    await ForumPost.updateMany(
      { threadId },
      { threadId: thread.mergeRequest.suggestedThreadId }
    );

    // Update postCount on target thread
    const postCount = await ForumPost.countDocuments({
      threadId: thread.mergeRequest.suggestedThreadId
    });

    await ForumThread.findByIdAndUpdate(
      thread.mergeRequest.suggestedThreadId,
      { postCount }
    );

    // Mark source thread as merged
    thread.mergeRequest.status = 'approved';
    thread.mergeRequest.reviewedBy = req.user._id;
    thread.mergeRequest.reviewedAt = new Date();
    thread.postCount = 0;
    await thread.save();

    res.json({ success: true, message: 'Threads merged successfully' });
  } catch (error) {
    console.error('Merge threads error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/threads/:threadId/merge-request/reject - reject merge request
router.post('/threads/:threadId/merge-request/reject', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason } = req.body;

    const thread = await ForumThread.findByIdAndUpdate(
      threadId,
      {
        'mergeRequest.status': 'rejected',
        'mergeRequest.reviewedBy': req.user._id,
        'mergeRequest.reviewedAt': new Date(),
        'mergeRequest.reason': reason || 'Rejected by admin'
      },
      { new: true }
    );

    res.json({ success: true, message: 'Merge request rejected', thread });
  } catch (error) {
    console.error('Reject merge request error:', error);
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

// POST /api/forum/threads/:threadId/extract-deck
router.post('/threads/:threadId/extract-deck', verifyToken, requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await ForumThread.findById(threadId).select('content title').lean();
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const result = extractDeckFromText(thread.content || '');

    res.json({
      cards: result.cards,
      total: result.total,
      format: 'detected',
      threadTitle: thread.title
    });
  } catch (error) {
    console.error('Extract deck error:', error);
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
    if (!level) return res.json(null);
    const data = level.toObject();
    data.experienceToNextLevel = level.nextLevelExperience;
    res.json(data);
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
      .select('username privacy reputation badges createdAt').lean();

    if (!user || !user.privacy?.isPublic || !user.privacy?.showForum) {
      return res.status(404).json({ message: 'Forum activity not available' });
    }

    const baseMatch = {
      authorId: user._id,
      isHidden: { $ne: true },
      isFlagHidden: { $ne: true },
      isShadowHidden: { $ne: true }
    };

    // Single aggregation per list joins thread titles via $lookup (avoids N+1 thread fetches)
    const [recentPosts, topPosts, threadCount, upvotesResult, postCount] = await Promise.all([
      ForumPost.aggregate([
        { $match: baseMatch },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'forumthreads', localField: 'threadId', foreignField: '_id', as: 'thread' } },
        { $project: {
            _id: 1,
            body: { $substrCP: ['$body', 0, 200] },
            threadId: 1,
            threadTitle: { $ifNull: [{ $arrayElemAt: ['$thread.title', 0] }, 'Unknown thread'] },
            createdAt: 1
          }
        }
      ]),
      ForumPost.aggregate([
        { $match: baseMatch },
        { $addFields: { upvoteCount: { $size: { $ifNull: ['$upvotes', []] } } } },
        { $sort: { upvoteCount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'forumthreads', localField: 'threadId', foreignField: '_id', as: 'thread' } },
        { $project: {
            _id: 1,
            body: { $substrCP: ['$body', 0, 200] },
            threadId: 1,
            threadTitle: { $ifNull: [{ $arrayElemAt: ['$thread.title', 0] }, 'Unknown thread'] },
            upvoteCount: 1,
            createdAt: 1
          }
        }
      ]),
      ForumThread.countDocuments({ authorId: user._id }),
      ForumPost.aggregate([
        { $match: baseMatch },
        { $project: { upvoteCount: { $size: { $ifNull: ['$upvotes', []] } } } },
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } }
      ]),
      ForumPost.countDocuments(baseMatch)
    ]);

    res.json({
      username: user.username,
      reputation: user.reputation || 0,
      badges: user.badges || [],
      stats: {
        posts: postCount,
        postCount,
        threads: threadCount,
        threadCount,
        upvotes: upvotesResult[0]?.total || 0,
        memberSince: user.createdAt
      },
      recentPosts,
      topPosts
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Cosmetics catalog (hardcoded)
const COSMETICS_CATALOG = [
  { id: 'titleColor_gold', name: 'Gold Title Color', category: 'titleColor', cost: 500, color: '#FFD700', description: 'Golden color for your forum title', rarity: 'uncommon' },
  { id: 'titleColor_purple', name: 'Purple Title Color', category: 'titleColor', cost: 300, color: '#9B59B6', description: 'Purple color for your forum title', rarity: 'common' },
  { id: 'titleColor_red', name: 'Crimson Title Color', category: 'titleColor', cost: 400, color: '#E74C3C', description: 'Crimson color for your forum title', rarity: 'common' },
  { id: 'titleColor_teal', name: 'Teal Title Color', category: 'titleColor', cost: 350, color: '#1ABC9C', description: 'Teal color for your forum title', rarity: 'common' },
  { id: 'titleColor_rainbow', name: 'Rainbow Title', category: 'titleColor', cost: 2000, color: 'rainbow', description: 'Animated rainbow color for your title', rarity: 'legendary' },
  { id: 'avatarBorder_gold', name: 'Gold Avatar Border', category: 'avatarBorder', cost: 600, color: '#FFD700', description: 'Gold border around your avatar', rarity: 'uncommon' },
  { id: 'avatarBorder_silver', name: 'Silver Avatar Border', category: 'avatarBorder', cost: 400, color: '#C0C0C0', description: 'Silver border around your avatar', rarity: 'common' },
  { id: 'avatarBorder_diamond', name: 'Diamond Avatar Border', category: 'avatarBorder', cost: 2500, color: '#B9F2FF', description: 'Sparkling diamond border', rarity: 'legendary' },
  { id: 'avatarBorder_fire', name: 'Flame Avatar Border', category: 'avatarBorder', cost: 1500, color: '#FF6B35', description: 'Animated flame border', rarity: 'rare' },
  { id: 'profileBorderColor_gold', name: 'Gold Profile Border', category: 'profileBorderColor', cost: 700, color: '#FFD700', description: 'Gold border for your profile', rarity: 'uncommon' },
  { id: 'profileBorderColor_neon', name: 'Neon Profile Border', category: 'profileBorderColor', cost: 1000, color: '#39FF14', description: 'Neon green profile border', rarity: 'rare' },
  { id: 'profileBorderColor_royal', name: 'Royal Blue Profile Border', category: 'profileBorderColor', cost: 800, color: '#4169E1', description: 'Royal blue profile border', rarity: 'uncommon' },
];

const COSMETICS_PRICES = Object.fromEntries(COSMETICS_CATALOG.map(c => [c.id, c.cost]));

// GET /api/forum/cosmetics - list available cosmetics with user's purchased/equipped state
router.get('/cosmetics', verifyToken, async (req, res) => {
  try {
    const cosmetics = await Cosmetic.find({ isActive: true }).lean();

    if (!req.user) return res.json({ cosmetics, purchased: [], equipped: {} });

    const level = await ForumLevel.findOne({ userId: req.user._id });
    res.json({
      cosmetics,
      purchased: level?.cosmetics?.purchased || [],
      equipped: level?.cosmetics?.equipped || {}
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/forum/level/cosmetics/purchase
router.post('/level/cosmetics/purchase', verifyToken, requireAuth, async (req, res) => {
  const { cosmeticId } = req.body;
  try {
    const cosmetic = await Cosmetic.findById(cosmeticId);
    if (!cosmetic || !cosmetic.isActive) return res.status(400).json({ message: 'Invalid cosmetic' });
    const cost = cosmetic.cost;
    const level = await ForumLevel.findOne({ userId: req.user._id });
    if (!level) return res.status(404).json({ message: 'Level not found' });
    if (level.cosmetics.purchased.includes(cosmeticId))
      return res.status(400).json({ message: 'Already owned' });
    try {
      level.spendCoins(cost);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    level.cosmetics.purchased.push(cosmeticId);
    await level.save();
    res.json({ success: true, newCoins: level.coins, message: 'Purchased!' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/forum/level/cosmetics/equip
router.post('/level/cosmetics/equip', verifyToken, requireAuth, async (req, res) => {
  const { cosmeticId, category } = req.body;
  const VALID_CATEGORIES = ['titleColor', 'profileBorderColor', 'avatarBorder'];
  if (!VALID_CATEGORIES.includes(category))
    return res.status(400).json({ message: 'Invalid category' });
  try {
    const level = await ForumLevel.findOne({ userId: req.user._id });
    if (!level) return res.status(404).json({ message: 'Level not found' });
    if (!level.cosmetics.purchased.includes(cosmeticId))
      return res.status(403).json({ message: 'You do not own this cosmetic' });
    level.cosmetics.equipped[category] = cosmeticId;
    level.markModified('cosmetics.equipped');
    await level.save();
    res.json({ success: true, newEquipped: level.cosmetics.equipped });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/forum/level - Get authenticated user's level
router.get('/level', verifyToken, requireAuth, async (req, res) => {
  try {
    let level = await ForumLevel.findOne({ userId: req.user._id });
    if (!level) {
      level = await ForumLevel.create({ userId: req.user._id });
    }
    const data = level.toObject();
    data.experienceToNextLevel = level.nextLevelExperience;
    res.json(data);
  } catch (error) {
    console.error('Get level error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/level/:userId - Get public level (respects privacy)
router.get('/level/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('privacy').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.privacy?.showForum) {
      return res.status(403).json({ message: 'Forum level not public' });
    }
    const level = await ForumLevel.findOne({ userId }).lean();
    if (!level) return res.status(404).json({ message: 'Level not found' });
    res.json(level);
  } catch (error) {
    console.error('Get public level error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/leaderboard-levels - Get level leaderboard (public)
router.get('/leaderboard-levels', async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Only include users who have opted into public forum visibility
    const publicUserIds = await User.find({ 'privacy.showForum': true }).select('_id').lean();
    const publicUserIdSet = publicUserIds.map(u => u._id);

    const entries = await ForumLevel.find({ userId: { $in: publicUserIdSet } })
      .sort({ level: -1, coins: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username displayName')
      .lean();
    const total = await ForumLevel.countDocuments({ userId: { $in: publicUserIdSet } });
    res.json({
      leaderboard: entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/level/award-xp - Award XP to a user (admin only)
router.post('/level/award-xp', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ message: 'userId and amount required' });
    }
    let level = await ForumLevel.findOne({ userId });
    if (!level) {
      level = await ForumLevel.create({ userId });
    }
    const oldLevel = level.level;
    level.addExperience(amount);
    await level.save();
    const leveledUp = level.level > oldLevel;
    res.json({ newLevel: level.level, newXP: level.experience, leveledUp });
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/level/coins/spend - Spend coins (authenticated)
router.post('/level/coins/spend', verifyToken, requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount required' });
    }
    const level = await ForumLevel.findOne({ userId: req.user._id });
    if (!level) return res.status(404).json({ message: 'Level not found' });
    try {
      level.spendCoins(amount);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message, newCoins: level.coins });
    }
    await level.save();
    res.json({ success: true, newCoins: level.coins, message: 'Coins spent successfully' });
  } catch (error) {
    console.error('Spend coins error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/level/coins/earn - Award coins to a user (admin only)
router.post('/level/coins/earn', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ message: 'userId and amount required' });
    }
    let level = await ForumLevel.findOne({ userId });
    if (!level) {
      level = await ForumLevel.create({ userId });
    }
    level.addCoins(amount);
    await level.save();
    res.json({ newCoins: level.coins });
  } catch (error) {
    console.error('Earn coins error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============ COSMETICS MANAGEMENT (ADMIN) ============

// GET /api/forum/admin/cosmetics - list all cosmetics for admin
router.get('/admin/cosmetics', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const cosmetics = await Cosmetic.find({}).sort({ category: 1, rarity: 1 }).lean();
    res.json({ cosmetics });
  } catch (error) {
    console.error('Fetch cosmetics error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/admin/cosmetics - create new cosmetic
router.post('/admin/cosmetics', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, cost, description, rarity, color, icon } = req.body;

    if (!name || !category || cost === undefined) {
      return res.status(400).json({ message: 'Missing required fields: name, category, cost' });
    }

    const cosmetic = await Cosmetic.create({
      name,
      category,
      cost: parseInt(cost),
      description,
      rarity,
      color,
      icon
    });

    res.status(201).json({ cosmetic });
  } catch (error) {
    console.error('Create cosmetic error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/forum/admin/cosmetics/:cosmeticId - update cosmetic
router.put('/admin/cosmetics/:cosmeticId', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, cost, description, rarity, color, icon, isActive } = req.body;

    const cosmetic = await Cosmetic.findByIdAndUpdate(
      req.params.cosmeticId,
      {
        name,
        category,
        cost: cost !== undefined ? parseInt(cost) : undefined,
        description,
        rarity,
        color,
        icon,
        isActive: isActive !== undefined ? isActive : undefined
      },
      { new: true }
    );

    if (!cosmetic) {
      return res.status(404).json({ message: 'Cosmetic not found' });
    }

    res.json({ cosmetic });
  } catch (error) {
    console.error('Update cosmetic error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/forum/admin/cosmetics/:cosmeticId - delete cosmetic
router.delete('/admin/cosmetics/:cosmeticId', verifyToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const cosmetic = await Cosmetic.findByIdAndDelete(req.params.cosmeticId);

    if (!cosmetic) {
      return res.status(404).json({ message: 'Cosmetic not found' });
    }

    res.json({ success: true, message: 'Cosmetic deleted' });
  } catch (error) {
    console.error('Delete cosmetic error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/forum/feed - combined threads and posts feed
router.get('/feed', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    const visibleFilter = { isFlagHidden: { $ne: true }, isShadowHidden: { $ne: true } };

    // Fetch recent threads
    const threads = await ForumThread.find({ isLocked: false })
      .populate('authorId', 'username displayName avatar')
      .select('title content createdAt categoryId authorId')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch recent posts
    const posts = await ForumPost.find(visibleFilter)
      .populate('threadId', 'title')
      .populate('authorId', 'username displayName avatar')
      .select('body threadId createdAt upvotes likes authorId')
      .sort({ createdAt: -1 })
      .lean();

    // Merge and sort by creation date
    const feedItems = [
      ...threads.map(t => ({ ...t, type: 'thread' })),
      ...posts.map(p => ({ ...p, type: 'post' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const paginatedFeed = feedItems.slice(skip, skip + limit);

    res.json({
      items: paginatedFeed,
      total: feedItems.length,
      limit,
      skip
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching feed', error: err.message });
  }
});

module.exports = router;

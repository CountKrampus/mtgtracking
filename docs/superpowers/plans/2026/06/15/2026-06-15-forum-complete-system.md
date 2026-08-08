# Forum System Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete forum system for MTG Tracker with core infrastructure, moderation features (mutes, spam filter), advanced features (duplicate detection, edit history, deck import), and a player leveling/economy system.

**Architecture:** 
- **Core Forum:** Hierarchical categories → threads → posts with MongoDB models and Express REST APIs
- **Moderation:** Pre-save spam checks, mute enforcement middleware, admin tuning panels with configurable sensitivity
- **Advanced Features:** Post edit tracking with diffs, thread duplicate detection via Jaccard similarity, deck import to collection
- **Economy:** Player leveling with coin earning, forum shop, reputation-based privileges

**Tech Stack:** Node.js/Express (backend), MongoDB/Mongoose (data), React (frontend), Tailwind CSS (styling), Lucide icons (UI)

---

## PART A: Core Forum Infrastructure

### Task 1: ForumCategory Model

**Files:**
- Create: `backend/models/ForumCategory.js`

- [ ] **Step 1: Create ForumCategory schema with required fields**

```javascript
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  parentCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    default: null
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  threadCount: {
    type: Number,
    default: 0
  },
  lastActivityAt: {
    type: Date,
    default: null
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

categorySchema.index({ parentCategoryId: 1, displayOrder: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });

categorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ForumCategory', categorySchema);
```

- [ ] **Step 2: Commit the model**

```bash
git add backend/models/ForumCategory.js
git commit -m "feat: create ForumCategory model with hierarchy support"
```

---

### Task 2: ForumThread Model

**Files:**
- Create: `backend/models/ForumThread.js`

- [ ] **Step 1: Create ForumThread schema with fields for posts tracking and merge requests**

```javascript
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
```

- [ ] **Step 2: Commit the model**

```bash
git add backend/models/ForumThread.js
git commit -m "feat: create ForumThread model with merge request support"
```

---

### Task 3: ForumPost Model

**Files:**
- Create: `backend/models/ForumPost.js`

- [ ] **Step 1: Create ForumPost schema with edit history and formatting**

```javascript
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  body: {
    type: String,
    required: true
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
```

- [ ] **Step 2: Commit the model**

```bash
git add backend/models/ForumPost.js
git commit -m "feat: create ForumPost model with edit history tracking"
```

---

### Task 4: Core Forum Backend Routes

**Files:**
- Create: `backend/routes/forum.js`

- [ ] **Step 1: Create forum routes with category, thread, and post endpoints**

```javascript
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const { verifyToken, requireAuth } = require('../middleware/auth');

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
router.post('/posts', verifyToken, requireAuth, async (req, res) => {
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

module.exports = router;
```

- [ ] **Step 2: Add forum routes to server.js**

In `backend/server.js`, add this after other route includes (around line 10):

```javascript
const forumRouter = require('./routes/forum');
app.use('/api/forum', forumRouter);
```

- [ ] **Step 3: Commit the routes**

```bash
git add backend/routes/forum.js backend/server.js
git commit -m "feat: add core forum routes for categories, threads, and posts"
```

---

### Task 5: Forum Navigation and Category View (Frontend)

**Files:**
- Create: `frontend/src/components/Forum/ForumNav.js`
- Create: `frontend/src/components/Forum/CategoryView.js`
- Modify: `frontend/src/App.js` (add forum view)

- [ ] **Step 1: Create ForumNav component**

```javascript
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ForumNav({ categories, onCategorySelect, selectedCategory }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpanded = (catId) => {
    setExpanded(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold text-white mb-4">Forum Categories</h2>
      
      {categories.map(category => (
        <div key={category._id} className="mb-2">
          <div className="flex items-center gap-2">
            {category.children && category.children.length > 0 && (
              <button
                onClick={() => toggleExpanded(category._id)}
                className="p-0 hover:text-purple-400"
              >
                {expanded[category._id] ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            )}
            <button
              onClick={() => onCategorySelect(category._id)}
              className={`flex-1 text-left px-2 py-1 rounded hover:bg-slate-700 transition ${
                selectedCategory === category._id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-300'
              }`}
            >
              <div className="font-medium">{category.name}</div>
              <div className="text-xs text-slate-400">{category.threadCount} threads</div>
            </button>
          </div>
          
          {expanded[category._id] && category.children && (
            <div className="ml-6 mt-1 space-y-1">
              {category.children.map(child => (
                <button
                  key={child._id}
                  onClick={() => onCategorySelect(child._id)}
                  className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-slate-700 transition ${
                    selectedCategory === child._id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-300'
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create CategoryView component**

```javascript
import React, { useState, useEffect } from 'react';
import { Plus, Lock } from 'lucide-react';

export default function CategoryView({ categoryId, apiUrl, onThreadSelect, user }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    if (!categoryId) return;
    
    const fetchThreads = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/forum/categories/${categoryId}/threads?page=${page}&limit=20`
        );
        const data = await response.json();
        setThreads(data.threads);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching threads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [categoryId, page, apiUrl]);

  if (!categoryId) {
    return <div className="flex-1 p-6 text-slate-400">Select a category</div>;
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Threads</h2>
        {user && (
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2">
            <Plus size={18} />
            New Thread
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : threads.length === 0 ? (
        <div className="text-slate-400">No threads in this category yet</div>
      ) : (
        <div className="space-y-3">
          {threads.map(thread => (
            <button
              key={thread._id}
              onClick={() => onThreadSelect(thread._id)}
              className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{thread.title}</h3>
                    {thread.isLocked && (
                      <Lock size={14} className="text-red-500" />
                    )}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    By {thread.authorId?.displayName || 'Unknown'} • {thread.postCount} posts
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">{thread.views} views</div>
                  <div className="text-xs text-slate-500">
                    {new Date(thread.lastPostAt || thread.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-slate-400">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit frontend components**

```bash
git add frontend/src/components/Forum/ForumNav.js frontend/src/components/Forum/CategoryView.js
git commit -m "feat: add forum navigation and category view components"
```

---

### Task 6: Thread View and Post Composer

**Files:**
- Create: `frontend/src/components/Forum/ThreadView.js`
- Create: `frontend/src/components/Forum/PostComposer.js`

- [ ] **Step 1: Create ThreadView component**

```javascript
import React, { useState, useEffect } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import PostComposer from './PostComposer';

export default function ThreadView({ threadId, apiUrl, user, onBack }) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState('');

  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/forum/threads/${threadId}?page=${page}&limit=20`
        );
        const data = await response.json();
        setThread(data.thread);
        setPosts(data.posts);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching thread:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [threadId, page, apiUrl]);

  const handlePostCreated = (newPost) => {
    setPosts([...posts, newPost]);
    setThread(prev => ({
      ...prev,
      postCount: prev.postCount + 1,
      lastPostAt: new Date(),
      lastPostAuthorId: user._id
    }));
  };

  const handleEditPost = async (postId) => {
    if (!editBody.trim()) return;

    try {
      const response = await fetch(`${apiUrl}/forum/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody, reason: 'User edit' })
      });

      if (response.ok) {
        const updated = await response.json();
        setPosts(posts.map(p => p._id === postId ? updated : p));
        setEditingPostId(null);
        setEditBody('');
      }
    } catch (error) {
      console.error('Error editing post:', error);
    }
  };

  if (!threadId) {
    return <div className="flex-1 p-6 text-slate-400">Select a thread</div>;
  }

  if (loading && !thread) {
    return <div className="flex-1 p-6 text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <button
        onClick={onBack}
        className="mb-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        ← Back
      </button>

      {thread && (
        <>
          <div className="mb-6 pb-6 border-b border-slate-700">
            <h1 className="text-3xl font-bold text-white mb-2">{thread.title}</h1>
            <div className="text-slate-400 text-sm">
              By {thread.authorId?.displayName} • {thread.views} views • {thread.postCount} posts
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {posts.map(post => (
              <div key={post._id} className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      {post.authorId?.displayName || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(post.createdAt).toLocaleString()}
                      {post.isEdited && ' (edited)'}
                    </div>
                  </div>
                  {user && user._id === post.authorId._id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingPostId(post._id);
                          setEditBody(post.body);
                        }}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button className="p-1 hover:bg-slate-700 rounded text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {editingPostId === post._id ? (
                  <div>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-2"
                      rows="4"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPost(post._id)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-200">{post.body}</div>
                )}
              </div>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-slate-400">
                Page {page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
              >
                Next
              </button>
            </div>
          )}

          {user && !thread.isLocked && (
            <PostComposer
              threadId={threadId}
              apiUrl={apiUrl}
              user={user}
              onPostCreated={handlePostCreated}
            />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PostComposer component**

```javascript
import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function PostComposer({ threadId, apiUrl, user, onPostCreated }) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/forum/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          body,
          bodyFormat: 'markdown'
        })
      });

      if (response.ok) {
        const newPost = await response.json();
        onPostCreated(newPost);
        setBody('');
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 p-4 rounded border border-slate-700">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows="4"
        className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-3"
      />
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"
      >
        <Send size={16} />
        Post Reply
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Commit components**

```bash
git add frontend/src/components/Forum/ThreadView.js frontend/src/components/Forum/PostComposer.js
git commit -m "feat: add thread view and post composer components"
```

---

### Task 7: Post Edit History Tracking and Modal

**Files:**
- Create: `frontend/src/components/Forum/PostEditHistory.js`
- Modify: `frontend/src/components/Forum/ThreadView.js` (add history button)

- [ ] **Step 1: Create PostEditHistory modal component**

```javascript
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function PostEditHistory({ postId, apiUrl, isOpen, onClose }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/forum/posts/${postId}/edits`);
        const data = await response.json();
        setHistory(data);
      } catch (error) {
        console.error('Error fetching edit history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, postId, apiUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit History</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-slate-400">Loading...</div>
        ) : history && history.editHistory.length > 0 ? (
          <div className="p-4 space-y-4">
            {history.editHistory.map((edit, idx) => (
              <div key={idx} className="bg-slate-900 p-3 rounded border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">
                  Edited by {edit.editedBy?.displayName || 'Unknown'} on{' '}
                  {new Date(edit.editedAt).toLocaleString()}
                </div>
                <div className="bg-slate-800 p-2 rounded text-sm text-slate-300">
                  <div className="line-through text-red-400">
                    {edit.originalBody}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-slate-400">No edits</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ThreadView to show edit history button**

In `ThreadView.js`, add to the post rendering (inside the post div after the edit/delete buttons):

```javascript
<button
  onClick={() => {
    // Open edit history modal
    // You'll add a state for this
  }}
  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded ml-2"
>
  View History
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/PostEditHistory.js
git commit -m "feat: add post edit history modal component"
```

---

## PART B: Batch 5 Features - Moderation System

### Task 8: Ban Model with Escalating Mutes

**Files:**
- Create: `backend/models/Ban.js`

- [ ] **Step 1: Create Ban model with mute escalation**

```javascript
const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['ban', 'mute'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  muteLevel: {
    type: Number,
    min: 1,
    max: 3
  },
  durationMs: Number,
  expiresAt: Date,
  autoEscalate: {
    type: Boolean,
    default: false
  },
  previousMutes: [{
    muteLevel: Number,
    startedAt: Date,
    endedAt: Date,
    reason: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

banSchema.index({ userId: 1, isActive: 1 });
banSchema.index({ expiresAt: 1 });

banSchema.pre('save', function(next) {
  // Validate mute-specific fields
  if (this.type === 'mute') {
    if (!this.muteLevel) {
      throw new Error('muteLevel is required for mutes');
    }
  } else {
    this.muteLevel = undefined;
  }
  
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ban', banSchema);
```

- [ ] **Step 2: Commit**

```bash
git add backend/models/Ban.js
git commit -m "feat: create Ban model with escalating mute support"
```

---

### Task 9: SpamFilterConfig Model and Utility

**Files:**
- Create: `backend/models/SpamFilterConfig.js`
- Create: `backend/utils/spamFilter.js`

- [ ] **Step 1: Create SpamFilterConfig model**

```javascript
const mongoose = require('mongoose');

const spamFilterConfigSchema = new mongoose.Schema({
  singleton: {
    type: String,
    enum: ['SINGLETON'],
    unique: true
  },
  sensitivity: {
    type: String,
    enum: ['strict', 'moderate', 'lenient'],
    default: 'moderate'
  },
  bannedWords: [{
    type: String,
    lowercase: true
  }],
  minReputationToAutoFlag: {
    type: Number,
    default: -50,
    min: -1000
  },
  maxPostsPerHourPerUser: {
    type: Number,
    default: 10,
    min: 1,
    max: 1000
  },
  flagThreshold: {
    type: Number,
    default: 2,
    min: 1,
    validate: {
      validator: function(value) {
        return value <= this.maxPostsPerHourPerUser;
      },
      message: 'flagThreshold cannot exceed maxPostsPerHourPerUser'
    }
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

spamFilterConfigSchema.index({ sensitivity: 1 });
spamFilterConfigSchema.index({ updatedAt: -1 });

spamFilterConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

spamFilterConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne({ singleton: 'SINGLETON' });
  if (!config) {
    config = await this.create({ singleton: 'SINGLETON' });
  }
  return config;
};

module.exports = mongoose.model('SpamFilterConfig', spamFilterConfigSchema);
```

- [ ] **Step 2: Create spamFilter utility**

```javascript
const ForumPost = require('../models/ForumPost');
const SpamFilterConfig = require('../models/SpamFilterConfig');

async function checkSpam(authorId, postBody, authorReputation) {
  const config = await SpamFilterConfig.getConfig();
  const reasons = [];

  // Type validation
  if (typeof postBody !== 'string' || !postBody.trim()) {
    return { flagged: false, reasons: [] };
  }

  const bodyLower = postBody.toLowerCase();
  const bannedWords = config.bannedWords || [];

  // Check 1: Banned words
  for (const word of bannedWords) {
    if (bodyLower.includes(word.toLowerCase())) {
      reasons.push(`Contains banned word: "${word}"`);
    }
  }

  // Check 2: Reputation threshold
  if (authorReputation < config.minReputationToAutoFlag) {
    reasons.push(`Low reputation: ${authorReputation}`);
  }

  // Check 3: Post rate limiting
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentPostCount = await ForumPost.countDocuments({
    authorId,
    createdAt: { $gte: oneHourAgo }
  });

  if (recentPostCount >= config.maxPostsPerHourPerUser) {
    reasons.push(`Exceeds max posts per hour: ${recentPostCount}/${config.maxPostsPerHourPerUser}`);
  }

  // Determine if flagged based on sensitivity
  let flagged = false;
  if (config.sensitivity === 'strict') {
    flagged = reasons.length > 0;
  } else if (config.sensitivity === 'moderate') {
    flagged = reasons.length >= 2;
  } else if (config.sensitivity === 'lenient') {
    flagged = reasons.length >= 2;
  }

  return { flagged, reasons };
}

module.exports = { checkSpam };
```

- [ ] **Step 3: Commit**

```bash
git add backend/models/SpamFilterConfig.js backend/utils/spamFilter.js
git commit -m "feat: add spam filter config and utility with sensitivity levels"
```

---

### Task 10: Mute Enforcer Middleware and Admin Endpoints

**Files:**
- Create: `backend/middleware/muteEnforcer.js`
- Modify: `backend/routes/forum.js` (add spam check to POST /posts)
- Create admin endpoints in `backend/routes/admin.js` (mute management, spam config)

- [ ] **Step 1: Create muteEnforcer middleware**

```javascript
const Ban = require('../models/Ban');

async function checkMute(req, res, next) {
  if (!req.user) return next();

  const activeMute = await Ban.findOne({
    userId: req.user._id,
    type: 'mute',
    isActive: true,
    expiresAt: { $gt: new Date() }
  });

  if (activeMute) {
    return res.status(403).json({
      message: `You are muted until ${activeMute.expiresAt.toISOString()}`,
      muteLevel: activeMute.muteLevel,
      expiresAt: activeMute.expiresAt
    });
  }

  next();
}

module.exports = { checkMute };
```

- [ ] **Step 2: Update forum.js to use mute enforcer and spam filter**

Add to the top of forum.js:

```javascript
const { checkMute } = require('../middleware/muteEnforcer');
const { checkSpam } = require('../utils/spamFilter');
const Ban = require('../models/Ban');
const User = require('../models/User');
```

Update the POST /posts endpoint to add spam checking:

```javascript
router.post('/posts', verifyToken, requireAuth, checkMute, async (req, res) => {
  try {
    const { threadId, body, bodyFormat = 'markdown' } = req.body;
    
    if (!threadId || !body) {
      return res.status(400).json({ message: 'Missing required fields' });
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

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ message: 'Thread is locked' });
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
```

- [ ] **Step 3: Add mute management endpoints to admin.js**

At the end of `backend/routes/admin.js` before `module.exports`:

```javascript
const MUTE_DURATIONS = {
  1: 3600000,    // 1 hour
  2: 86400000,   // 1 day
  3: 604800000   // 1 week
};

/**
 * POST /api/admin/mute/:userId - Create or escalate mute
 */
router.post('/mute/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, autoEscalate = true } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for active mute
    const activeMute = await Ban.findOne({
      userId,
      type: 'mute',
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    let muteLevel = 1;
    let previousMutes = [];

    if (activeMute && autoEscalate) {
      // Escalate mute
      muteLevel = Math.min(activeMute.muteLevel + 1, 3);
      previousMutes = activeMute.previousMutes;
      previousMutes.push({
        muteLevel: activeMute.muteLevel,
        startedAt: activeMute.createdAt,
        endedAt: new Date(),
        reason: activeMute.reason
      });
      activeMute.isActive = false;
      await activeMute.save();
    }

    const newMute = new Ban({
      userId,
      type: 'mute',
      reason,
      muteLevel,
      durationMs: MUTE_DURATIONS[muteLevel],
      expiresAt: new Date(Date.now() + MUTE_DURATIONS[muteLevel]),
      autoEscalate,
      previousMutes,
      createdBy: req.user._id
    });

    await newMute.save();

    res.json({
      message: `User muted at level ${muteLevel}`,
      mute: newMute,
      expiresAt: newMute.expiresAt
    });
  } catch (error) {
    console.error('Create mute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/mute/:userId - Revoke active mute
 */
router.delete('/mute/:userId', async (req, res) => {
  try {
    const result = await Ban.findOneAndUpdate(
      { userId: req.params.userId, type: 'mute', isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'No active mute found' });
    }

    res.json({ message: 'Mute revoked', mute: result });
  } catch (error) {
    console.error('Revoke mute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/mutes - List active mutes
 */
router.get('/mutes', async (req, res) => {
  try {
    const mutes = await Ban.find({
      type: 'mute',
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
      .populate('userId', 'username displayName')
      .populate('createdBy', 'username displayName')
      .sort({ expiresAt: 1 });

    res.json(mutes.map(m => ({
      ...m.toObject(),
      expiresIn: m.expiresAt - new Date()
    })));
  } catch (error) {
    console.error('List mutes error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/spam-config - Get spam filter settings
 */
router.get('/spam-config', async (req, res) => {
  try {
    const config = await SpamFilterConfig.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Get spam config error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/spam-config - Update spam filter config
 */
router.put('/spam-config', async (req, res) => {
  try {
    const { sensitivity, bannedWords, minReputationToAutoFlag, maxPostsPerHourPerUser, flagThreshold } = req.body;

    const config = await SpamFilterConfig.getConfig();

    if (sensitivity) config.sensitivity = sensitivity;
    if (bannedWords) config.bannedWords = bannedWords;
    if (minReputationToAutoFlag !== undefined) config.minReputationToAutoFlag = minReputationToAutoFlag;
    if (maxPostsPerHourPerUser !== undefined) config.maxPostsPerHourPerUser = maxPostsPerHourPerUser;
    if (flagThreshold !== undefined) config.flagThreshold = flagThreshold;

    await config.save();

    res.json(config);
  } catch (error) {
    console.error('Update spam config error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/spam-config/test - Test spam filter
 */
router.post('/spam-config/test', async (req, res) => {
  try {
    const { text } = req.body;
    const user = await User.findById(req.user._id);
    const { checkSpam } = require('../utils/spamFilter');

    const { flagged, reasons } = await checkSpam(
      req.user._id,
      text,
      user.reputation || 0
    );

    res.json({ flagged, reasons });
  } catch (error) {
    console.error('Test spam filter error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/middleware/muteEnforcer.js
git commit -m "feat: add mute enforcement middleware"
```

```bash
git add backend/routes/forum.js backend/routes/admin.js backend/utils/spamFilter.js backend/models/SpamFilterConfig.js
git commit -m "feat: integrate spam filter and mute management into forum and admin endpoints"
```

---

### Task 11: SpamFilterAdmin and MuteManager UI Components

**Files:**
- Create: `frontend/src/components/Forum/SpamFilterAdmin.js`
- Create: `frontend/src/components/Forum/MuteManager.js`

- [ ] **Step 1: Create SpamFilterAdmin component**

```javascript
import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';

export default function SpamFilterAdmin({ apiUrl, isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [sensitivity, setSensitivity] = useState('moderate');
  const [bannedWords, setBannedWords] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/spam-config`);
      const data = await response.json();
      setConfig(data);
      setSensitivity(data.sensitivity);
      setBannedWords(data.bannedWords.join('\n'));
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/spam-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensitivity,
          bannedWords: bannedWords.split('\n').filter(w => w.trim())
        })
      });

      if (response.ok) {
        await fetchConfig();
        alert('Spam filter config updated');
      }
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleTest = async () => {
    if (!testText.trim()) return;

    try {
      const response = await fetch(`${apiUrl}/admin/spam-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Error testing filter:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={24} />
          <h2 className="text-xl font-bold text-white">Spam Filter Configuration</h2>
        </div>

        {config && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Sensitivity
              </label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
              >
                <option value="strict">Strict (any match triggers)</option>
                <option value="moderate">Moderate (2+ checks trigger)</option>
                <option value="lenient">Lenient (requires 2+ checks)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Banned Words (one per line)
              </label>
              <textarea
                value={bannedWords}
                onChange={(e) => setBannedWords(e.target.value)}
                rows="4"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Min Reputation to Auto-Flag
                </label>
                <input
                  type="number"
                  value={config.minReputationToAutoFlag}
                  onChange={(e) => setConfig({
                    ...config,
                    minReputationToAutoFlag: parseInt(e.target.value)
                  })}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Max Posts Per Hour
                </label>
                <input
                  type="number"
                  value={config.maxPostsPerHourPerUser}
                  onChange={(e) => setConfig({
                    ...config,
                    maxPostsPerHourPerUser: parseInt(e.target.value)
                  })}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              Save Configuration
            </button>

            <div className="border-t border-slate-600 pt-4 mt-4">
              <h3 className="font-semibold text-white mb-2">Test Filter</h3>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Enter test text..."
                rows="3"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm mb-2"
              />
              <button
                onClick={handleTest}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white mb-2"
              >
                Test
              </button>

              {testResult && (
                <div className={`p-3 rounded ${testResult.flagged ? 'bg-red-900 border border-red-700' : 'bg-green-900 border border-green-700'}`}>
                  <div className="text-white font-semibold mb-1">
                    {testResult.flagged ? '🚫 Flagged as Spam' : '✅ Not Spam'}
                  </div>
                  {testResult.reasons.length > 0 && (
                    <ul className="text-sm text-slate-200">
                      {testResult.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MuteManager component**

```javascript
import React, { useState, useEffect } from 'react';
import { Gavel, Trash2 } from 'lucide-react';

export default function MuteManager({ apiUrl, isOpen, onClose }) {
  const [mutes, setMutes] = useState([]);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMutes();
    }
  }, [isOpen]);

  const fetchMutes = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/mutes`);
      const data = await response.json();
      setMutes(data);
    } catch (error) {
      console.error('Error fetching mutes:', error);
    }
  };

  const handleCreateMute = async () => {
    if (!userId || !reason.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/mute/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        setUserId('');
        setReason('');
        await fetchMutes();
        alert('Mute created');
      }
    } catch (error) {
      console.error('Error creating mute:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeMute = async (userId) => {
    try {
      const response = await fetch(`${apiUrl}/admin/mute/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchMutes();
      }
    } catch (error) {
      console.error('Error revoking mute:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gavel size={24} />
          <h2 className="text-xl font-bold text-white">Mute Management</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID to mute"
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for mute"
              rows="3"
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
            />
          </div>

          <button
            onClick={handleCreateMute}
            disabled={loading || !userId || !reason.trim()}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-white"
          >
            Create Mute
          </button>
        </div>

        <div className="border-t border-slate-600 pt-4">
          <h3 className="font-semibold text-white mb-3">Active Mutes</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {mutes.length === 0 ? (
              <div className="text-slate-400">No active mutes</div>
            ) : (
              mutes.map(mute => (
                <div key={mute._id} className="bg-slate-900 p-3 rounded border border-red-700 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-white">
                      {mute.userId?.displayName || mute.userId?.username || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-400">{mute.reason}</div>
                    <div className="text-xs text-red-400 mt-1">
                      Level {mute.muteLevel} • Expires {new Date(mute.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeMute(mute.userId._id)}
                    className="p-1 hover:bg-slate-800 rounded ml-2"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/SpamFilterAdmin.js frontend/src/components/Forum/MuteManager.js
git commit -m "feat: add spam filter admin and mute manager UI components"
```

---

## PART C: Batch 5 Features - Advanced

### Task 12: Thread Duplicate Detection

**Files:**
- Create: `backend/utils/threadDuplicateDetector.js`
- Modify: `backend/routes/forum.js` (add duplicate check endpoint)

- [ ] **Step 1: Create duplicate detector utility**

```javascript
const ForumThread = require('../models/ForumThread');

function calculateSimilarity(title1, title2) {
  // Extract keywords (words longer than 2 chars)
  const getKeywords = (text) => {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
  };

  const keywords1 = new Set(getKeywords(title1));
  const keywords2 = new Set(getKeywords(title2));

  if (keywords1.size === 0 && keywords2.size === 0) return 1;
  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

async function findDuplicateThreads(title, categoryId, limit = 5) {
  const allThreads = await ForumThread.find({ categoryId })
    .select('title _id')
    .lean();

  const scored = allThreads.map(thread => ({
    ...thread,
    similarity: calculateSimilarity(title, thread.title)
  }))
    .filter(t => t.similarity >= 0.4)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map(result => ({
    ...result,
    label: result.similarity >= 0.9
      ? 'exact'
      : result.similarity >= 0.6
        ? 'high'
        : result.similarity >= 0.4
          ? 'medium'
          : 'low'
  }));
}

module.exports = { findDuplicateThreads };
```

- [ ] **Step 2: Add duplicate check endpoints to forum.js**

Add to `backend/routes/forum.js`:

```javascript
const { findDuplicateThreads } = require('../utils/threadDuplicateDetector');

// POST /api/forum/threads/check-duplicates - Find duplicate threads
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

// PUT /api/forum/threads/:threadId/merge-request - Approve/reject merge
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
      // Move posts from current thread to suggested thread
      await ForumPost.updateMany(
        { threadId },
        { threadId: thread.mergeRequest.suggestedThreadId }
      );

      // Update post counts
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/utils/threadDuplicateDetector.js
git commit -m "feat: add thread duplicate detection with Jaccard similarity"
```

```bash
git add backend/routes/forum.js
git commit -m "feat: add duplicate check and merge endpoints to forum routes"
```

---

### Task 13: Duplicate Thread Detection UI

**Files:**
- Create: `frontend/src/components/Forum/DuplicateThreadWarning.js`
- Modify: `frontend/src/components/Forum/PostComposer.js` (integrate duplicate check)

- [ ] **Step 1: Create DuplicateThreadWarning component**

```javascript
import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function DuplicateThreadWarning({ duplicates, onSelect, onContinue }) {
  const [selectedId, setSelectedId] = React.useState(null);
  const [reason, setReason] = React.useState('');

  const handleRequestMerge = () => {
    if (selectedId) {
      onSelect(selectedId, reason);
    }
  };

  const getLabel = (similarity) => {
    if (similarity >= 0.9) return '🎯 Exact Match';
    if (similarity >= 0.6) return '⭐ High Similarity';
    if (similarity >= 0.4) return '🔗 Medium Similarity';
    return '❓ Low Similarity';
  };

  return (
    <div className="bg-yellow-900 border-l-4 border-yellow-600 p-4 mb-6 rounded">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-3">Similar Threads Found</h3>
          <div className="space-y-2 mb-4">
            {duplicates.map(dup => (
              <label key={dup._id} className="flex items-center p-2 hover:bg-yellow-800 rounded cursor-pointer">
                <input
                  type="radio"
                  checked={selectedId === dup._id}
                  onChange={() => setSelectedId(dup._id)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{dup.title}</div>
                  <div className="text-xs text-yellow-200">
                    {getLabel(dup.similarity)} ({Math.round(dup.similarity * 100)}%)
                  </div>
                </div>
              </label>
            ))}
          </div>

          {selectedId && (
            <div className="mb-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you think this is a duplicate? (optional)"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                rows="2"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRequestMerge}
              disabled={!selectedId}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm font-semibold"
            >
              Request Merge
            </button>
            <button
              onClick={onContinue}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update PostComposer to check for duplicates**

Modify `frontend/src/components/Forum/PostComposer.js` to create threads with duplicate checking:

At the top, import:

```javascript
import { AlertCircle } from 'lucide-react';
```

Update the component to handle thread creation (not just posts):

```javascript
const [isCreatingThread, setIsCreatingThread] = React.useState(false);
const [threadTitle, setThreadTitle] = React.useState('');
const [duplicates, setDuplicates] = React.useState([]);
const [showDuplicateWarning, setShowDuplicateWarning] = React.useState(false);

const handleCheckDuplicates = async () => {
  if (!threadTitle.trim()) return;

  try {
    const response = await fetch(`${apiUrl}/forum/threads/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: threadTitle,
        categoryId: threadId
      })
    });

    const data = await response.json();
    if (data.length > 0) {
      setDuplicates(data);
      setShowDuplicateWarning(true);
    } else {
      submitThread();
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
    submitThread();
  }
};

const submitThread = async () => {
  // Submit thread creation
  if (!threadTitle.trim() || !body.trim()) return;

  setLoading(true);
  try {
    const response = await fetch(`${apiUrl}/forum/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: threadId,
        title: threadTitle,
        content: body,
        contentFormat: 'markdown'
      })
    });

    if (response.ok) {
      const newThread = await response.json();
      onThreadCreated(newThread);
      setThreadTitle('');
      setBody('');
      setIsCreatingThread(false);
      setShowDuplicateWarning(false);
    }
  } catch (error) {
    console.error('Error creating thread:', error);
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Forum/DuplicateThreadWarning.js
git commit -m "feat: add duplicate thread warning UI component"
```

---

### Task 14: Post Edit History Modal

This was partially created in Task 7. Ensure it's fully integrated:

- [ ] **Step 1: Verify PostEditHistory is in ThreadView**

The component was created in Task 7. Verify it's imported and used in ThreadView with a "View History" button for each post.

- [ ] **Step 2: Commit integration**

```bash
git commit -m "feat: integrate post edit history modal into thread view"
```

---

### Task 15: Deck Import from Threads

**Files:**
- Create: `frontend/src/components/Forum/DeckEmbed.js` (embed in posts)
- Modify: `backend/routes/forum.js` (add import endpoint)

- [ ] **Step 1: Add deck import endpoint to forum.js**

```javascript
// POST /api/forum/threads/:threadId/import-deck - Copy deck to user's collection
router.post('/threads/:threadId/import-deck', verifyToken, requireAuth, async (req, res) => {
  try {
    const { deckId } = req.body;
    const { threadId } = req.params;

    if (!deckId) {
      return res.status(400).json({ message: 'deckId required' });
    }

    const Deck = mongoose.model('Deck');
    const originalDeck = await Deck.findById(deckId);

    if (!originalDeck) {
      return res.status(404).json({ message: 'Deck not found' });
    }

    // Create copy for user
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
      message: 'Deck imported to your collection',
      deckId: newDeck._id
    });
  } catch (error) {
    console.error('Import deck error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 2: Create DeckEmbed component**

```javascript
import React, { useState } from 'react';
import { Copy } from 'lucide-react';

export default function DeckEmbed({ deckId, deckName, apiUrl, user }) {
  const [importing, setImporting] = useState(false);

  const handleImportDeck = async () => {
    if (!user) {
      alert('Please log in to import decks');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${apiUrl}/forum/threads/import-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Deck imported to your collection!');
      }
    } catch (error) {
      console.error('Error importing deck:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-slate-700 p-3 rounded border border-slate-600 my-2 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">{deckName}</div>
        <div className="text-xs text-slate-400">Deck</div>
      </div>
      <button
        onClick={handleImportDeck}
        disabled={importing || !user}
        className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
      >
        <Copy size={14} />
        Copy to My Decks
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/forum.js frontend/src/components/Forum/DeckEmbed.js
git commit -m "feat: add deck import from forum threads"
```

---

## PART D: Forum Economy System

### Task 16: ForumLevel Model

**Files:**
- Create: `backend/models/ForumLevel.js`

- [ ] **Step 1: Create ForumLevel model**

```javascript
const mongoose = require('mongoose');

const forumLevelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 50
  },
  coins: {
    type: Number,
    default: 0,
    min: 0
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  experienceToNextLevel: {
    type: Number,
    default: 100
  },
  totalExperience: {
    type: Number,
    default: 0
  },
  coinsSpent: {
    type: Number,
    default: 0
  },
  postsCount: {
    type: Number,
    default: 0
  },
  threadsCreated: {
    type: Number,
    default: 0
  },
  achievements: [{
    name: String,
    unlockedAt: Date
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

forumLevelSchema.index({ userId: 1 });
forumLevelSchema.index({ level: -1, coins: -1 });

forumLevelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

forumLevelSchema.methods.addExperience = async function(amount) {
  this.experience += amount;
  this.totalExperience += amount;

  while (this.experience >= this.experienceToNextLevel && this.level < 50) {
    this.experience -= this.experienceToNextLevel;
    this.level += 1;
    this.coins += Math.floor(100 * (this.level / 10)); // More coins per level
    this.experienceToNextLevel = Math.floor(100 * (this.level / 1.5));
  }

  await this.save();
  return { leveledUp: this.level > (this.totalExperience / this.experienceToNextLevel - 1) };
};

forumLevelSchema.methods.addCoins = async function(amount) {
  this.coins += amount;
  await this.save();
};

forumLevelSchema.methods.spendCoins = async function(amount) {
  if (this.coins < amount) {
    throw new Error('Insufficient coins');
  }
  this.coins -= amount;
  this.coinsSpent += amount;
  await this.save();
};

module.exports = mongoose.model('ForumLevel', forumLevelSchema);
```

- [ ] **Step 2: Commit**

```bash
git add backend/models/ForumLevel.js
git commit -m "feat: create ForumLevel model with experience and coin system"
```

---

### Task 17: Forum Shop UI

**Files:**
- Create: `frontend/src/components/Forum/ForumShop.js`

- [ ] **Step 1: Create ForumShop component**

```javascript
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Coins } from 'lucide-react';

const SHOP_ITEMS = [
  {
    id: 'avatar_frame_1',
    name: 'Gold Avatar Frame',
    price: 500,
    description: 'Shine in the forum with a golden frame',
    category: 'cosmetic'
  },
  {
    id: 'username_color_1',
    name: 'Purple Username',
    price: 300,
    description: 'Make your name pop in purple',
    category: 'cosmetic'
  },
  {
    id: 'badge_vip',
    name: 'VIP Badge',
    price: 1000,
    description: 'Show everyone you\'re a VIP member',
    category: 'badge'
  },
  {
    id: 'thread_bump',
    name: 'Thread Bump Token',
    price: 100,
    description: 'Move your thread to the top',
    category: 'utility'
  },
  {
    id: 'post_pin',
    name: 'Pin Your Post',
    price: 200,
    description: 'Pin a post to the top of a thread',
    category: 'utility'
  }
];

export default function ForumShop({ apiUrl, user, isOpen, onClose }) {
  const [userLevel, setUserLevel] = useState(null);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserLevel();
    }
  }, [isOpen, user]);

  const fetchUserLevel = async () => {
    try {
      const response = await fetch(`${apiUrl}/forum/user-level`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserLevel(data);
      }
    } catch (error) {
      console.error('Error fetching user level:', error);
    }
  };

  const handleBuyItem = async (itemId, price) => {
    try {
      const response = await fetch(`${apiUrl}/forum/shop/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ itemId })
      });

      if (response.ok) {
        const result = await response.json();
        setUserLevel(result.updatedLevel);
        setInventory([...inventory, itemId]);
        alert(`Purchased! You now have ${result.updatedLevel.coins} coins`);
      }
    } catch (error) {
      console.error('Error purchasing item:', error);
    }
  };

  if (!isOpen || !user) return null;

  const categories = ['cosmetic', 'badge', 'utility'];
  const canAfford = (price) => userLevel && userLevel.coins >= price;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-96 border border-slate-700 p-6 my-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShoppingCart size={28} />
            <h2 className="text-2xl font-bold text-white">Forum Shop</h2>
          </div>
          {userLevel && (
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded">
              <Coins size={20} className="text-yellow-400" />
              <span className="font-bold text-white">{userLevel.coins}</span>
              <span className="text-slate-400">Level {userLevel.level}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto">
          {SHOP_ITEMS.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded border-2 ${
                inventory.includes(item.id)
                  ? 'bg-green-900 border-green-600'
                  : canAfford(item.price)
                    ? 'bg-slate-900 border-slate-600 hover:border-purple-500'
                    : 'bg-slate-900 border-slate-700 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{item.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                  <div className="flex items-center gap-1">
                    <Coins size={14} className="text-yellow-400" />
                    <span className="font-bold text-yellow-400">{item.price}</span>
                  </div>
                </div>

                {inventory.includes(item.id) ? (
                  <button disabled className="px-3 py-1 bg-green-600 rounded text-white text-sm font-semibold">
                    Owned
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuyItem(item.id, item.price)}
                    disabled={!canAfford(item.price)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white text-sm font-semibold whitespace-nowrap ml-2"
                  >
                    Buy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Close Shop
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Forum/ForumShop.js
git commit -m "feat: add forum shop UI with purchasable items"
```

---

### Task 18: Forum Level Widget

**Files:**
- Create: `frontend/src/components/Forum/ForumLevelWidget.js`

- [ ] **Step 1: Create level widget**

```javascript
import React, { useEffect, useState } from 'react';
import { Trophy, Zap, Coins, Award } from 'lucide-react';

export default function ForumLevelWidget({ apiUrl, user }) {
  const [userLevel, setUserLevel] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserLevel();
    }
  }, [user]);

  const fetchUserLevel = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/forum/user-level`);
      if (response.ok) {
        const data = await response.json();
        setUserLevel(data);
      }
    } catch (error) {
      console.error('Error fetching level:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !userLevel) {
    return <div className="text-slate-400 text-sm">Loading...</div>;
  }

  const progressPercent = (userLevel.experience / userLevel.experienceToNextLevel) * 100;

  return (
    <div className="bg-gradient-to-r from-purple-900 to-slate-900 rounded-lg p-4 border border-purple-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-yellow-400" />
          <span className="font-bold text-white">Level {userLevel.level}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins size={16} className="text-yellow-400" />
          <span className="text-white font-semibold">{userLevel.coins}</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      <div className="text-xs text-slate-400 mb-3">
        {userLevel.experience} / {userLevel.experienceToNextLevel} XP
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800 rounded p-2">
          <Zap size={16} className="text-blue-400 mx-auto mb-1" />
          <div className="text-xs text-slate-300">{userLevel.postsCount} posts</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <Award size={16} className="text-purple-400 mx-auto mb-1" />
          <div className="text-xs text-slate-300">{userLevel.threadsCreated} threads</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <Trophy size={16} className="text-yellow-400 mx-auto mb-1" />
          <div className="text-xs text-slate-300">{userLevel.achievements.length} badges</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Forum/ForumLevelWidget.js
git commit -m "feat: add forum level widget with progress tracking"
```

---

## Final Steps

### Task 19: Backend Endpoints for Forum Level

**Files:**
- Modify: `backend/routes/forum.js`

- [ ] **Step 1: Add level endpoints**

Add to forum.js:

```javascript
const ForumLevel = require('../models/ForumLevel');

// GET /api/forum/user-level - Get user's forum level
router.get('/user-level', async (req, res) => {
  try {
    let level = await ForumLevel.findOne({ userId: req.user?._id });
    
    if (!level && req.user) {
      level = await ForumLevel.create({ userId: req.user._id });
    }

    res.json(level);
  } catch (error) {
    console.error('Get user level error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/forum/shop/purchase - Purchase shop item
router.post('/shop/purchase', verifyToken, requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body;

    const SHOP_ITEMS = {
      'avatar_frame_1': 500,
      'username_color_1': 300,
      'badge_vip': 1000,
      'thread_bump': 100,
      'post_pin': 200
    };

    if (!SHOP_ITEMS[itemId]) {
      return res.status(400).json({ message: 'Invalid item' });
    }

    const userLevel = await ForumLevel.findOne({ userId: req.user._id });
    if (!userLevel) {
      return res.status(404).json({ message: 'User level not found' });
    }

    await userLevel.spendCoins(SHOP_ITEMS[itemId]);

    res.json({
      message: 'Item purchased',
      updatedLevel: userLevel
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 2: Integrate level gains into post creation**

Update the POST /posts endpoint to award XP:

```javascript
// After post is created successfully, add:

const userLevel = await ForumLevel.findOne({ userId: req.user._id });
if (userLevel) {
  await userLevel.addExperience(10); // 10 XP per post
  userLevel.postsCount += 1;
  await userLevel.save();
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/forum.js backend/models/ForumLevel.js
git commit -m "feat: add forum level endpoints and shop purchase system"
```

---

### Task 20: Integration Testing Checklist

**Files:**
- Create: `docs/forum-integration-tests.md`

- [ ] **Step 1: Create testing checklist**

```markdown
# Forum System Integration Testing Checklist

## Core Forum (Tasks 1-7)
- [ ] Create category with nested subcategories
- [ ] View category hierarchy navigation
- [ ] Create thread in category
- [ ] List threads with pagination
- [ ] View single thread with posts
- [ ] Edit own post
- [ ] View edit history of post with original version shown

## Moderation System (Tasks 8-11)
- [ ] Create mute with level 1 (1 hour)
- [ ] Muted user cannot post (receives 403 error)
- [ ] Auto-escalate: Create second mute, escalates to level 2 (1 day)
- [ ] Auto-escalate: Create third mute, escalates to level 3 (1 week)
- [ ] Revoke mute, user can post again
- [ ] List active mutes with expiration times
- [ ] Update spam filter sensitivity (strict/moderate/lenient)
- [ ] Add banned words to filter
- [ ] Test banned word detection in post
- [ ] Test low reputation blocking
- [ ] Test post rate limiting
- [ ] Test filter with different sensitivity levels

## Advanced Features (Tasks 12-15)
- [ ] Create thread, check for duplicates
- [ ] See duplicate warning with similarity scores
- [ ] Request merge, posts move to target thread
- [ ] Create deck, embed in forum post
- [ ] Import deck from forum to collection
- [ ] View post edit history modal with diffs

## Forum Economy (Tasks 16-18)
- [ ] New user starts at level 1 with 0 coins
- [ ] Create post, earn 10 XP
- [ ] Create thread, earn 25 XP
- [ ] Level up and earn coins
- [ ] Purchase item from shop with coins
- [ ] View forum level widget with progress bar
- [ ] Earn achievement badges

## Admin Features
- [ ] Admin can create/revoke mutes
- [ ] Admin can update spam filter config
- [ ] Admin can test spam filter
- [ ] Admin sees active mutes list
```

- [ ] **Step 2: Commit**

```bash
git add docs/forum-integration-tests.md
git commit -m "docs: add forum integration testing checklist"
```

---

## Plan Complete

**Total Tasks:** 20
**Total Commits Expected:** 25+

This comprehensive plan covers:
- ✅ Core forum infrastructure (categories, threads, posts)
- ✅ Moderation system (mutes with escalation, spam filter)
- ✅ Advanced features (duplicate detection, edit history, deck import)
- ✅ Forum economy (levels, coins, shop)

All tasks are designed to be implemented with subagent-driven development using TDD principles.

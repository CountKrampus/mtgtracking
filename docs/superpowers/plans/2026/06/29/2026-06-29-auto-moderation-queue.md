# Auto-Moderation Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unified moderation review queue fed by user reports and automated spam detection. Moderators see flagged content with suggested actions and can hide, warn, or dismiss in one click.

**Architecture:** New ContentReport model with computeSuggestedAction helper; report button on forum posts/threads; three admin routes; AutoModQueue component wired into ForumAdminPanel.

**Tech Stack:** Node.js/Express/Mongoose, React, Tailwind CSS, Lucide icons (Flag), useAuthContext authFetch.

> **Implementation notes:**
> - `requireModerator` is a **factory function** — use `requireModerator()` with parentheses in route middleware, not bare `requireModerator`
> - `admin.js` already applies `router.use(verifyToken)` and `router.use(requireAuth)` globally — do not add them again on individual routes
> - `forum.js` chains middleware inline per-route: `router.post('/report', verifyToken, requireAuth, async ...)` — include `verifyToken` before `requireAuth`
> - `ForumAdminPanel` uses a `loadedTabs` lazy-loading pattern with `activeTab` state — follow that pattern when adding the Mod Queue tab

---

## Task 1 — ContentReport Model

**File:** `backend/models/ContentReport.js`
**Test file:** `backend/tests/contentReport.test.js`

### Steps

- [ ] **1.1 — Write failing test for computeSuggestedAction**

  Create `backend/tests/contentReport.test.js`:

  ```js
  const { computeSuggestedAction } = require('../models/ContentReport');

  describe('computeSuggestedAction', () => {
    it('returns hide_post for automated source', () => {
      expect(computeSuggestedAction('automated', 'other', 0)).toBe('hide_post');
    });

    it('returns hide_and_warn for harassment reason', () => {
      expect(computeSuggestedAction('user', 'harassment', 0)).toBe('hide_and_warn');
    });

    it('returns hide_and_warn for spam reason', () => {
      expect(computeSuggestedAction('user', 'spam', 0)).toBe('hide_and_warn');
    });

    it('returns hide_post when pendingCount >= 3', () => {
      expect(computeSuggestedAction('user', 'other', 3)).toBe('hide_post');
    });

    it('returns hide_post when pendingCount > 3', () => {
      expect(computeSuggestedAction('user', 'off-topic', 5)).toBe('hide_post');
    });

    it('returns review as default', () => {
      expect(computeSuggestedAction('user', 'other', 0)).toBe('review');
    });

    it('returns review for off-topic with pendingCount < 3', () => {
      expect(computeSuggestedAction('user', 'off-topic', 2)).toBe('review');
    });

    it('automated source takes priority over pendingCount check', () => {
      expect(computeSuggestedAction('automated', 'off-topic', 1)).toBe('hide_post');
    });
  });
  ```

  Run: `cd backend && npx jest tests/contentReport.test.js`
  Expected: 8 tests fail (module not found)

- [ ] **1.2 — Create the ContentReport model**

  Create `backend/models/ContentReport.js`:

  ```js
  const mongoose = require('mongoose');

  function computeSuggestedAction(source, reason, pendingCount) {
    if (source === 'automated') return 'hide_post';
    if (reason === 'harassment' || reason === 'spam') return 'hide_and_warn';
    if (pendingCount >= 3) return 'hide_post';
    return 'review';
  }

  const ContentReportSchema = new mongoose.Schema({
    contentId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    contentType:     { type: String, enum: ['post','thread'], required: true },
    reportedBy:      { type: mongoose.Schema.Types.Mixed, required: true },
    reason:          { type: String, enum: ['spam','harassment','off-topic','other'], required: true },
    source:          { type: String, enum: ['user','automated'], required: true },
    triggeredRule:   { type: String, default: '' },
    status:          { type: String, enum: ['pending','actioned','dismissed'], default: 'pending' },
    suggestedAction: { type: String, enum: ['hide_post','hide_and_warn','review'], required: true },
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:      { type: Date, default: null },
    createdAt:       { type: Date, default: Date.now }
  });

  ContentReportSchema.index({ contentId: 1, status: 1 });

  module.exports = mongoose.model('ContentReport', ContentReportSchema);
  module.exports.computeSuggestedAction = computeSuggestedAction;
  ```

  Run: `cd backend && npx jest tests/contentReport.test.js`
  Expected: 8 tests pass

- [ ] **1.3 — Commit**

  ```
  git add backend/models/ContentReport.js backend/tests/contentReport.test.js
  git commit -m "feat: ContentReport model with computeSuggestedAction helper"
  ```

---

## Task 2 — POST /api/forum/report Route

**File:** `backend/routes/forum.js` (add route to existing file)
**Test file:** `backend/tests/forumReport.test.js`

### Steps

- [ ] **2.1 — Write failing tests for the report route**

  Create `backend/tests/forumReport.test.js`:

  ```js
  const request = require('supertest');
  const mongoose = require('mongoose');
  const app = require('../server');
  const ContentReport = require('../models/ContentReport');
  const ForumPost = require('../models/ForumPost');

  const MOCK_USER_ID = new mongoose.Types.ObjectId();
  const MOCK_POST_ID = new mongoose.Types.ObjectId();

  // Mock requireAuth middleware
  jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
      req.user = { _id: MOCK_USER_ID };
      next();
    },
    requireAdmin: (req, res, next) => next(),
    requireModerator: (req, res, next) => next(),
  }));

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mtg-tracker-test');
  });

  afterEach(async () => {
    await ContentReport.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/forum/report', () => {
    it('returns 201 and creates a report', async () => {
      const res = await request(app)
        .post('/api/forum/report')
        .send({ contentId: MOCK_POST_ID, contentType: 'post', reason: 'other' });
      expect(res.status).toBe(201);
      const reports = await ContentReport.find({ contentId: MOCK_POST_ID });
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('user');
    });

    it('returns 409 when same user already reported same content', async () => {
      await ContentReport.create({
        contentId: MOCK_POST_ID,
        contentType: 'post',
        reportedBy: MOCK_USER_ID,
        reason: 'other',
        source: 'user',
        status: 'pending',
        suggestedAction: 'review',
      });

      const res = await request(app)
        .post('/api/forum/report')
        .send({ contentId: MOCK_POST_ID, contentType: 'post', reason: 'other' });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already reported/i);
    });

    it('returns 429 when user exceeds 5 reports per hour', async () => {
      const reports = Array.from({ length: 5 }, (_, i) => ({
        contentId: new mongoose.Types.ObjectId(),
        contentType: 'post',
        reportedBy: MOCK_USER_ID,
        reason: 'other',
        source: 'user',
        status: 'pending',
        suggestedAction: 'review',
        createdAt: new Date(),
      }));
      await ContentReport.insertMany(reports);

      const res = await request(app)
        .post('/api/forum/report')
        .send({ contentId: MOCK_POST_ID, contentType: 'post', reason: 'other' });
      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/too frequently/i);
    });

    it('auto-hides post when total pending reports reaches 3', async () => {
      // Pre-create 2 pending reports from other users
      await ContentReport.insertMany([
        {
          contentId: MOCK_POST_ID,
          contentType: 'post',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'spam',
          source: 'user',
          status: 'pending',
          suggestedAction: 'hide_and_warn',
        },
        {
          contentId: MOCK_POST_ID,
          contentType: 'post',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'spam',
          source: 'user',
          status: 'pending',
          suggestedAction: 'hide_and_warn',
        },
      ]);

      // Ensure the post exists and is not hidden
      await ForumPost.findByIdAndUpdate(
        MOCK_POST_ID,
        { $setOnInsert: { body: 'test post', isHidden: false } },
        { upsert: true, new: true }
      );

      const res = await request(app)
        .post('/api/forum/report')
        .send({ contentId: MOCK_POST_ID, contentType: 'post', reason: 'other' });
      expect(res.status).toBe(201);

      const post = await ForumPost.findById(MOCK_POST_ID);
      expect(post.isHidden).toBe(true);
      expect(post.hiddenReason).toMatch(/auto-hidden/i);
    });
  });
  ```

  Run: `cd backend && npx jest tests/forumReport.test.js`
  Expected: All tests fail (route not found / 404)

- [ ] **2.2 — Add the report route to forum.js**

  In `backend/routes/forum.js`, add the following imports at the top (after existing requires):

  ```js
  const ContentReport = require('../models/ContentReport');
  const { computeSuggestedAction } = require('../models/ContentReport');
  const ForumPost = require('../models/ForumPost');
  const ForumThread = require('../models/ForumThread');
  ```

  Add the route before `module.exports`:

  ```js
  // POST /api/forum/report
  router.post('/report', requireAuth, async (req, res) => {
    try {
      const { contentId, contentType, reason } = req.body;

      if (!contentId || !contentType || !reason) {
        return res.status(400).json({ message: 'contentId, contentType, and reason are required' });
      }

      if (!['post', 'thread'].includes(contentType)) {
        return res.status(400).json({ message: 'contentType must be post or thread' });
      }

      if (!['spam', 'harassment', 'off-topic', 'other'].includes(reason)) {
        return res.status(400).json({ message: 'Invalid reason' });
      }

      // Rate-limit: max 5 reports per user per hour
      const recentCount = await ContentReport.countDocuments({
        reportedBy: req.user._id,
        createdAt: { $gte: new Date(Date.now() - 3600000) },
      });
      if (recentCount >= 5) {
        return res.status(429).json({ message: 'Reporting too frequently. Please wait before submitting more reports.' });
      }

      // Duplicate check: same user + same content already pending
      const existing = await ContentReport.findOne({
        contentId,
        reportedBy: req.user._id,
        status: 'pending',
      });
      if (existing) {
        return res.status(409).json({ message: 'You have already reported this content.' });
      }

      // Count existing pending reports for this content
      const pendingCount = await ContentReport.countDocuments({ contentId, status: 'pending' });

      const suggestedAction = computeSuggestedAction('user', reason, pendingCount);

      const report = await ContentReport.create({
        contentId,
        contentType,
        reportedBy: req.user._id,
        reason,
        source: 'user',
        status: 'pending',
        suggestedAction,
      });

      // Auto-hide if total pending (including new report) reaches 3
      const newTotal = pendingCount + 1;
      if (newTotal >= 3) {
        const hiddenData = { isHidden: true, hiddenReason: 'Auto-hidden: multiple reports' };
        if (contentType === 'post') {
          await ForumPost.findByIdAndUpdate(contentId, hiddenData);
        } else {
          await ForumThread.findByIdAndUpdate(contentId, hiddenData);
        }
      }

      return res.status(201).json({ message: 'Report submitted', report });
    } catch (err) {
      console.error('Error submitting report:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });
  ```

  Run: `cd backend && npx jest tests/forumReport.test.js`
  Expected: All 4 tests pass

- [ ] **2.3 — Commit**

  ```
  git add backend/routes/forum.js backend/tests/forumReport.test.js
  git commit -m "feat: POST /api/forum/report with rate-limit, duplicate check, and auto-hide"
  ```

---

## Task 3 — Admin Moderation Queue Routes

**File:** `backend/routes/admin.js` (add routes to existing file)
**Test file:** `backend/tests/adminModerationQueue.test.js`

### Steps

- [ ] **3.1 — Write failing tests for admin moderation queue routes**

  Create `backend/tests/adminModerationQueue.test.js`:

  ```js
  const request = require('supertest');
  const mongoose = require('mongoose');
  const app = require('../server');
  const ContentReport = require('../models/ContentReport');
  const ForumPost = require('../models/ForumPost');
  const UserWarning = require('../models/UserWarning');
  const ModerationHistory = require('../models/ModerationHistory');

  const MOCK_MOD_ID = new mongoose.Types.ObjectId();
  const MOCK_POST_ID = new mongoose.Types.ObjectId();
  const MOCK_AUTHOR_ID = new mongoose.Types.ObjectId();

  jest.mock('../middleware/auth', () => ({
    requireAuth: (req, res, next) => {
      req.user = { _id: MOCK_MOD_ID };
      next();
    },
    requireAdmin: (req, res, next) => next(),
    requireModerator: (req, res, next) => next(),
  }));

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mtg-tracker-test');
  });

  afterEach(async () => {
    await ContentReport.deleteMany({});
    await UserWarning.deleteMany({});
    await ModerationHistory.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/admin/moderation-queue', () => {
    it('returns 200 with grouped results', async () => {
      await ContentReport.insertMany([
        {
          contentId: MOCK_POST_ID,
          contentType: 'post',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'spam',
          source: 'user',
          status: 'pending',
          suggestedAction: 'hide_and_warn',
        },
        {
          contentId: MOCK_POST_ID,
          contentType: 'post',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'harassment',
          source: 'user',
          status: 'pending',
          suggestedAction: 'hide_and_warn',
        },
      ]);

      const res = await request(app).get('/api/admin/moderation-queue');
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBeGreaterThan(0);
      const item = res.body.items.find(i => i.contentId === MOCK_POST_ID.toString());
      expect(item).toBeDefined();
      expect(item.reportCount).toBe(2);
    });

    it('filters by status query param', async () => {
      await ContentReport.create({
        contentId: MOCK_POST_ID,
        contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(),
        reason: 'other',
        source: 'user',
        status: 'actioned',
        suggestedAction: 'review',
      });

      const res = await request(app).get('/api/admin/moderation-queue?status=actioned');
      expect(res.status).toBe(200);
      const item = res.body.items.find(i => i.contentId === MOCK_POST_ID.toString());
      expect(item).toBeDefined();
    });

    it('filters by contentType query param', async () => {
      const MOCK_THREAD_ID = new mongoose.Types.ObjectId();
      await ContentReport.insertMany([
        {
          contentId: MOCK_POST_ID,
          contentType: 'post',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'other',
          source: 'user',
          status: 'pending',
          suggestedAction: 'review',
        },
        {
          contentId: MOCK_THREAD_ID,
          contentType: 'thread',
          reportedBy: new mongoose.Types.ObjectId(),
          reason: 'spam',
          source: 'user',
          status: 'pending',
          suggestedAction: 'hide_and_warn',
        },
      ]);

      const res = await request(app).get('/api/admin/moderation-queue?contentType=thread');
      expect(res.status).toBe(200);
      const postItem = res.body.items.find(i => i.contentId === MOCK_POST_ID.toString());
      const threadItem = res.body.items.find(i => i.contentId === MOCK_THREAD_ID.toString());
      expect(postItem).toBeUndefined();
      expect(threadItem).toBeDefined();
    });
  });

  describe('POST /api/admin/moderation-queue/:contentId/action', () => {
    beforeEach(async () => {
      // Ensure the post exists with an author
      await ForumPost.findByIdAndUpdate(
        MOCK_POST_ID,
        { $setOnInsert: { body: 'Test post body content', author: MOCK_AUTHOR_ID, isHidden: false } },
        { upsert: true, new: true }
      );
      await ContentReport.create({
        contentId: MOCK_POST_ID,
        contentType: 'post',
        reportedBy: new mongoose.Types.ObjectId(),
        reason: 'spam',
        source: 'user',
        status: 'pending',
        suggestedAction: 'hide_and_warn',
      });
    });

    it('hide action sets isHidden=true on content', async () => {
      const res = await request(app)
        .post(`/api/admin/moderation-queue/${MOCK_POST_ID}/action`)
        .send({ action: 'hide', contentType: 'post' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const post = await ForumPost.findById(MOCK_POST_ID);
      expect(post.isHidden).toBe(true);
      expect(post.hiddenReason).toBe('Moderator action');
    });

    it('hide_and_warn action creates a UserWarning', async () => {
      const res = await request(app)
        .post(`/api/admin/moderation-queue/${MOCK_POST_ID}/action`)
        .send({ action: 'hide_and_warn', contentType: 'post' });
      expect(res.status).toBe(200);

      const warnings = await UserWarning.find({ userId: MOCK_AUTHOR_ID });
      expect(warnings).toHaveLength(1);
      expect(warnings[0].escalationLevel).toBe(1);
      expect(warnings[0].warnedBy.toString()).toBe(MOCK_MOD_ID.toString());
    });

    it('dismiss action marks reports as dismissed', async () => {
      const res = await request(app)
        .post(`/api/admin/moderation-queue/${MOCK_POST_ID}/action`)
        .send({ action: 'dismiss', contentType: 'post' });
      expect(res.status).toBe(200);

      const reports = await ContentReport.find({ contentId: MOCK_POST_ID });
      expect(reports.every(r => r.status === 'dismissed')).toBe(true);
    });

    it('all actions mark pending reports as actioned/dismissed with reviewedBy', async () => {
      await request(app)
        .post(`/api/admin/moderation-queue/${MOCK_POST_ID}/action`)
        .send({ action: 'hide', contentType: 'post' });

      const reports = await ContentReport.find({ contentId: MOCK_POST_ID });
      expect(reports.every(r => r.status === 'actioned')).toBe(true);
      expect(reports.every(r => r.reviewedBy?.toString() === MOCK_MOD_ID.toString())).toBe(true);
      expect(reports.every(r => r.reviewedAt !== null)).toBe(true);
    });
  });
  ```

  Run: `cd backend && npx jest tests/adminModerationQueue.test.js`
  Expected: All tests fail (routes not found)

- [ ] **3.2 — Add GET /api/admin/moderation-queue to admin.js**

  In `backend/routes/admin.js`, add these imports (after existing requires):

  ```js
  const ContentReport = require('../models/ContentReport');
  const ForumPost = require('../models/ForumPost');
  const ForumThread = require('../models/ForumThread');
  ```

  Add the GET route:

  ```js
  // GET /api/admin/moderation-queue
  router.get('/moderation-queue', requireModerator, async (req, res) => {
    try {
      const {
        status = 'pending',
        contentType,
        limit = 50,
        offset = 0,
      } = req.query;

      const matchStage = { status };
      if (contentType && ['post', 'thread'].includes(contentType)) {
        matchStage.contentType = contentType;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: '$contentId',
            contentType: { $first: '$contentType' },
            reportCount: { $sum: 1 },
            reasons: { $addToSet: '$reason' },
            sources: { $addToSet: '$source' },
            suggestedActions: { $addToSet: '$suggestedAction' },
            oldestReportAt: { $min: '$createdAt' },
          },
        },
        { $sort: { reportCount: -1 } },
        { $skip: Number(offset) },
        { $limit: Number(limit) },
      ];

      const grouped = await ContentReport.aggregate(pipeline);

      // Severity ranking for suggested actions
      const actionSeverity = { hide_and_warn: 3, hide_post: 2, review: 1 };

      const items = await Promise.all(
        grouped.map(async (group) => {
          // Most severe suggested action
          const suggestedAction = group.suggestedActions.reduce((prev, curr) =>
            (actionSeverity[curr] || 0) > (actionSeverity[prev] || 0) ? curr : prev
          , 'review');

          // Fetch content preview and author
          let contentPreview = '';
          let authorUsername = 'Unknown';

          try {
            if (group.contentType === 'post') {
              const post = await ForumPost.findById(group._id)
                .populate('author', 'username')
                .lean();
              if (post) {
                contentPreview = (post.body || '').substring(0, 200);
                authorUsername = post.author?.username || 'Unknown';
              }
            } else {
              const thread = await ForumThread.findById(group._id)
                .populate('author', 'username')
                .lean();
              if (thread) {
                contentPreview = (thread.title || '').substring(0, 200);
                authorUsername = thread.author?.username || 'Unknown';
              }
            }
          } catch (e) {
            // Content may have been deleted — leave defaults
          }

          return {
            contentId: group._id.toString(),
            contentType: group.contentType,
            reportCount: group.reportCount,
            reasons: group.reasons,
            sources: group.sources,
            suggestedAction,
            oldestReportAt: group.oldestReportAt,
            contentPreview,
            authorUsername,
          };
        })
      );

      return res.status(200).json({ items, total: items.length });
    } catch (err) {
      console.error('Error fetching moderation queue:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });
  ```

  Run: `cd backend && npx jest tests/adminModerationQueue.test.js --testNamePattern="GET"`
  Expected: GET tests pass

- [ ] **3.3 — Add POST /api/admin/moderation-queue/:contentId/action to admin.js**

  Add the POST route in `backend/routes/admin.js`:

  ```js
  // POST /api/admin/moderation-queue/:contentId/action
  router.post('/moderation-queue/:contentId/action', requireModerator, async (req, res) => {
    try {
      const { contentId } = req.params;
      const { action, contentType } = req.body;

      if (!['hide', 'hide_and_warn', 'dismiss'].includes(action)) {
        return res.status(400).json({ message: 'action must be hide, hide_and_warn, or dismiss' });
      }
      if (!['post', 'thread'].includes(contentType)) {
        return res.status(400).json({ message: 'contentType must be post or thread' });
      }

      const now = new Date();
      let contentAuthorId = null;

      // Fetch content to get the author
      if (contentType === 'post') {
        const post = await ForumPost.findById(contentId);
        if (post) contentAuthorId = post.author;
      } else {
        const thread = await ForumThread.findById(contentId);
        if (thread) contentAuthorId = thread.author;
      }

      // Hide content for hide and hide_and_warn actions
      if (action === 'hide' || action === 'hide_and_warn') {
        const hiddenData = { isHidden: true, hiddenReason: 'Moderator action' };
        if (contentType === 'post') {
          await ForumPost.findByIdAndUpdate(contentId, hiddenData);
        } else {
          await ForumThread.findByIdAndUpdate(contentId, hiddenData);
        }
      }

      // Create UserWarning for hide_and_warn
      if (action === 'hide_and_warn' && contentAuthorId) {
        await UserWarning.create({
          userId: contentAuthorId,
          reason: 'Content removed by moderator',
          warnedBy: req.user._id,
          escalationLevel: 1,
        });
      }

      // Mark all pending reports for this content
      const newStatus = action === 'dismiss' ? 'dismissed' : 'actioned';
      await ContentReport.updateMany(
        { contentId, status: 'pending' },
        {
          $set: {
            status: newStatus,
            reviewedBy: req.user._id,
            reviewedAt: now,
          },
        }
      );

      // Log to ModerationHistory
      await ModerationHistory.create({
        contentId,
        contentType,
        action,
        moderatorId: req.user._id,
        performedAt: now,
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Error performing moderation action:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });
  ```

  Run: `cd backend && npx jest tests/adminModerationQueue.test.js`
  Expected: All tests pass

- [ ] **3.4 — Commit**

  ```
  git add backend/routes/admin.js backend/tests/adminModerationQueue.test.js
  git commit -m "feat: GET + POST admin moderation-queue routes with hide, warn, dismiss actions"
  ```

---

## Task 4 — AutoModQueue Component

**File:** `frontend/src/components/Forum/AutoModQueue.js` (new file)

### Steps

- [ ] **4.1 — Write failing test for AutoModQueue**

  Create `frontend/src/components/Forum/__tests__/AutoModQueue.test.js`:

  ```js
  import React from 'react';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import AutoModQueue from '../AutoModQueue';

  const mockAuthFetch = jest.fn();
  jest.mock('../../../contexts/AuthContext', () => ({
    useAuthContext: () => ({ authFetch: mockAuthFetch }),
  }));

  const MOCK_ITEMS = [
    {
      contentId: 'abc123',
      contentType: 'post',
      reportCount: 3,
      reasons: ['spam', 'harassment'],
      sources: ['user'],
      suggestedAction: 'hide_and_warn',
      oldestReportAt: '2026-06-29T00:00:00.000Z',
      contentPreview: 'This is a spammy post',
      authorUsername: 'badactor',
    },
    {
      contentId: 'def456',
      contentType: 'thread',
      reportCount: 1,
      reasons: ['off-topic'],
      sources: ['user'],
      suggestedAction: 'review',
      oldestReportAt: '2026-06-29T01:00:00.000Z',
      contentPreview: 'Off-topic thread title',
      authorUsername: 'anotheruser',
    },
  ];

  beforeEach(() => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS, total: 2 }),
    });
  });

  afterEach(() => jest.clearAllMocks());

  describe('AutoModQueue', () => {
    it('renders the queue heading', async () => {
      render(<AutoModQueue />);
      expect(screen.getByText(/moderation queue/i)).toBeInTheDocument();
    });

    it('fetches and displays queue items', async () => {
      render(<AutoModQueue />);
      await waitFor(() => {
        expect(screen.getByText('This is a spammy post')).toBeInTheDocument();
      });
      expect(screen.getByText('Off-topic thread title')).toBeInTheDocument();
    });

    it('displays suggested action badge with correct text', async () => {
      render(<AutoModQueue />);
      await waitFor(() => {
        expect(screen.getByText('hide_and_warn')).toBeInTheDocument();
      });
      expect(screen.getByText('review')).toBeInTheDocument();
    });

    it('filters by content type when Posts tab is clicked', async () => {
      render(<AutoModQueue />);
      await waitFor(() => screen.getByText('This is a spammy post'));

      fireEvent.click(screen.getByRole('button', { name: /posts/i }));
      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('contentType=post'),
          expect.anything()
        );
      });
    });

    it('calls action endpoint when Hide button is clicked', async () => {
      mockAuthFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: MOCK_ITEMS, total: 2 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [], total: 0 }),
        });

      render(<AutoModQueue />);
      await waitFor(() => screen.getByText('This is a spammy post'));

      const hideButtons = screen.getAllByRole('button', { name: /^hide$/i });
      fireEvent.click(hideButtons[0]);

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('abc123/action'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('shows refresh button', async () => {
      render(<AutoModQueue />);
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });
  });
  ```

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=AutoModQueue`
  Expected: Tests fail (module not found)

- [ ] **4.2 — Create AutoModQueue component**

  Create `frontend/src/components/Forum/AutoModQueue.js`:

  ```js
  import React, { useState, useEffect, useCallback } from 'react';
  import { RefreshCw, Flag } from 'lucide-react';
  import { useAuthContext } from '../../contexts/AuthContext';
  import { API_URL } from '../../config';

  const SEVERITY = { hide_and_warn: 3, hide_post: 2, review: 1 };

  const BADGE_COLORS = {
    hide_and_warn: 'bg-red-500 text-white',
    hide_post: 'bg-orange-500 text-white',
    review: 'bg-yellow-500 text-black',
  };

  function SuggestedActionBadge({ action }) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${BADGE_COLORS[action] || 'bg-gray-400 text-white'}`}>
        {action}
      </span>
    );
  }

  const CONTENT_TYPE_FILTERS = [
    { label: 'All', value: '' },
    { label: 'Posts', value: 'post' },
    { label: 'Threads', value: 'thread' },
  ];

  const STATUS_OPTIONS = [
    { label: 'Pending', value: 'pending' },
    { label: 'Actioned', value: 'actioned' },
    { label: 'Dismissed', value: 'dismissed' },
  ];

  export default function AutoModQueue() {
    const { authFetch } = useAuthContext();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [contentTypeFilter, setContentTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [actionInProgress, setActionInProgress] = useState(null);

    const fetchQueue = useCallback(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: statusFilter });
        if (contentTypeFilter) params.set('contentType', contentTypeFilter);
        const res = await authFetch(`${API_URL}/admin/moderation-queue?${params.toString()}`, {
          method: 'GET',
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error('Failed to fetch moderation queue:', err);
      } finally {
        setLoading(false);
      }
    }, [authFetch, statusFilter, contentTypeFilter]);

    useEffect(() => {
      fetchQueue();
    }, [fetchQueue]);

    const handleAction = async (contentId, contentType, action) => {
      setActionInProgress(contentId);
      try {
        const res = await authFetch(
          `${API_URL}/admin/moderation-queue/${contentId}/action`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, contentType }),
          }
        );
        if (res.ok) {
          await fetchQueue();
        }
      } catch (err) {
        console.error('Moderation action failed:', err);
      } finally {
        setActionInProgress(null);
      }
    };

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Flag size={20} />
            Moderation Queue
          </h2>
          <button
            aria-label="Refresh"
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1">
            {CONTENT_TYPE_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setContentTypeFilter(value)}
                className={`px-3 py-1 rounded text-sm ${
                  contentTypeFilter === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-white/60 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-white/60 text-sm">No items in queue.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 text-left text-white/60">
                  <th className="pb-2 pr-3">Content Preview</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Author</th>
                  <th className="pb-2 pr-3">Reports</th>
                  <th className="pb-2 pr-3">Reasons</th>
                  <th className="pb-2 pr-3">Suggested Action</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.contentId}
                    className="border-b border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2 pr-3 max-w-xs truncate" title={item.contentPreview}>
                      {item.contentPreview || <span className="text-white/40 italic">Deleted</span>}
                    </td>
                    <td className="py-2 pr-3 capitalize">{item.contentType}</td>
                    <td className="py-2 pr-3">{item.authorUsername}</td>
                    <td className="py-2 pr-3 font-semibold">{item.reportCount}</td>
                    <td className="py-2 pr-3">
                      <span className="text-white/70">{item.reasons.join(', ')}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <SuggestedActionBadge action={item.suggestedAction} />
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => handleAction(item.contentId, item.contentType, 'hide')}
                          disabled={actionInProgress === item.contentId}
                          className="px-2 py-0.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium disabled:opacity-50"
                        >
                          Hide
                        </button>
                        <button
                          onClick={() => handleAction(item.contentId, item.contentType, 'hide_and_warn')}
                          disabled={actionInProgress === item.contentId}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium disabled:opacity-50"
                        >
                          Hide + Warn
                        </button>
                        <button
                          onClick={() => handleAction(item.contentId, item.contentType, 'dismiss')}
                          disabled={actionInProgress === item.contentId}
                          className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  ```

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=AutoModQueue`
  Expected: All 6 tests pass

- [ ] **4.3 — Commit**

  ```
  git add frontend/src/components/Forum/AutoModQueue.js frontend/src/components/Forum/__tests__/AutoModQueue.test.js
  git commit -m "feat: AutoModQueue component with filter bar, badge colors, and action buttons"
  ```

---

## Task 5 — ReportModal + Report Button in ThreadView

**File:** `frontend/src/components/Forum/ThreadView.js` (modify existing file)

### Steps

- [ ] **5.1 — Write failing tests for ReportModal**

  Create `frontend/src/components/Forum/__tests__/ReportModal.test.js`:

  ```js
  import React from 'react';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  // ReportModal is exported as a named export from ThreadView
  import { ReportModal } from '../ThreadView';

  const mockAuthFetch = jest.fn();
  jest.mock('../../../contexts/AuthContext', () => ({
    useAuthContext: () => ({ authFetch: mockAuthFetch }),
  }));

  afterEach(() => jest.clearAllMocks());

  describe('ReportModal', () => {
    const defaultProps = {
      contentId: 'abc123',
      contentType: 'post',
      onClose: jest.fn(),
    };

    it('renders reason dropdown', () => {
      render(<ReportModal {...defaultProps} />);
      expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    });

    it('submits report with selected reason', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      render(<ReportModal {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'spam' } });
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('/forum/report'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"reason":"spam"'),
          })
        );
      });
    });

    it('shows "already reported" message on 409', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: 'You have already reported this content.' }),
      });

      render(<ReportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/already reported/i)).toBeInTheDocument();
      });
    });

    it('shows "too frequently" message on 429', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Reporting too frequently. Please wait before submitting more reports.' }),
      });

      render(<ReportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/too frequently/i)).toBeInTheDocument();
      });
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<ReportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
  ```

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ReportModal`
  Expected: Tests fail (named export not found)

- [ ] **5.2 — Add ReportModal as a named export ABOVE ThreadView in ThreadView.js**

  In `frontend/src/components/Forum/ThreadView.js`, add the following **before** the `ThreadView` function definition (at module scope, never inside another component):

  ```js
  import { Flag } from 'lucide-react';
  import { API_URL } from '../../config';
  ```

  Then add `ReportModal` as a named export at module scope:

  ```js
  export function ReportModal({ contentId, contentType, onClose }) {
    const { authFetch } = useAuthContext();
    const [reason, setReason] = useState('other');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setError('');
      try {
        const res = await authFetch(`${API_URL}/forum/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentId, contentType, reason }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Failed to submit report');
        } else {
          setSuccess(true);
          setTimeout(onClose, 1500);
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-900 border border-white/20 rounded-lg p-6 w-full max-w-sm shadow-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Flag size={18} />
            Report Content
          </h3>

          {success ? (
            <p className="text-green-400 text-sm">Report submitted. Thank you.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="report-reason" className="block text-sm font-medium mb-1">
                Reason
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm mb-3"
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="off-topic">Off-topic</option>
                <option value="other">Other</option>
              </select>

              {error && (
                <p className="text-red-400 text-xs mb-2">{error}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **5.3 — Add report Flag button to each post and to the thread header inside ThreadView**

  Inside the `ThreadView` component, add state for the report modal:

  ```js
  const [reportTarget, setReportTarget] = useState(null); // { contentId, contentType }
  ```

  In the post render (where each post's action buttons appear), add:

  ```js
  <button
    onClick={() => setReportTarget({ contentId: post._id, contentType: 'post' })}
    className="p-1 text-white/40 hover:text-red-400 transition-colors"
    title="Report post"
    aria-label="Report post"
  >
    <Flag size={16} />
  </button>
  ```

  In the thread header area, add:

  ```js
  <button
    onClick={() => setReportTarget({ contentId: thread._id, contentType: 'thread' })}
    className="p-1 text-white/40 hover:text-red-400 transition-colors"
    title="Report thread"
    aria-label="Report thread"
  >
    <Flag size={16} />
  </button>
  ```

  At the bottom of the `ThreadView` JSX return (before the closing tag), add the modal:

  ```js
  {reportTarget && (
    <ReportModal
      contentId={reportTarget.contentId}
      contentType={reportTarget.contentType}
      onClose={() => setReportTarget(null)}
    />
  )}
  ```

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ReportModal`
  Expected: All 5 tests pass

- [ ] **5.4 — Commit**

  ```
  git add frontend/src/components/Forum/ThreadView.js frontend/src/components/Forum/__tests__/ReportModal.test.js
  git commit -m "feat: ReportModal named export and Flag report button on posts/threads in ThreadView"
  ```

---

## Task 6 — Wire Mod Queue Tab into ForumAdminPanel

**File:** `frontend/src/components/Forum/ForumAdminPanel.js` (modify existing file)

### Steps

- [ ] **6.1 — Write failing test for Mod Queue tab**

  Create `frontend/src/components/Forum/__tests__/ForumAdminPanel.modqueue.test.js`:

  ```js
  import React from 'react';
  import { render, screen, fireEvent } from '@testing-library/react';
  import ForumAdminPanel from '../ForumAdminPanel';

  const mockAuthFetch = jest.fn();
  jest.mock('../../../contexts/AuthContext', () => ({
    useAuthContext: () => ({ authFetch: mockAuthFetch }),
  }));

  // AutoModQueue makes its own fetch — resolve it immediately
  beforeEach(() => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
  });

  afterEach(() => jest.clearAllMocks());

  describe('ForumAdminPanel — Mod Queue tab', () => {
    it('renders a Mod Queue tab button', () => {
      render(<ForumAdminPanel />);
      expect(screen.getByRole('button', { name: /mod queue/i })).toBeInTheDocument();
    });

    it('shows AutoModQueue when Mod Queue tab is clicked', async () => {
      render(<ForumAdminPanel />);
      fireEvent.click(screen.getByRole('button', { name: /mod queue/i }));
      expect(screen.getByText(/moderation queue/i)).toBeInTheDocument();
    });
  });
  ```

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ForumAdminPanel.modqueue`
  Expected: Tests fail (Mod Queue button not found)

- [ ] **6.2 — Add Mod Queue tab to ForumAdminPanel**

  In `frontend/src/components/Forum/ForumAdminPanel.js`, add the import at the top:

  ```js
  import AutoModQueue from './AutoModQueue';
  ```

  Locate the tabs array (or the inline tab buttons) and add a new tab entry. The existing pattern will look something like:

  ```js
  const TABS = ['Overview', 'Users', 'Reports']; // (existing tabs — exact names may differ)
  ```

  Add `'Mod Queue'` to that array:

  ```js
  const TABS = ['Overview', 'Users', 'Reports', 'Mod Queue'];
  ```

  In the tab content rendering section (the `if/else` or `switch` block that renders panel content based on active tab), add a case for `'Mod Queue'`:

  ```js
  {activeTab === 'Mod Queue' && <AutoModQueue />}
  ```

  If the panel uses a different tab-switching mechanism (e.g., a state variable checked with `===`), ensure the Mod Queue tab sets `activeTab` to the string `'Mod Queue'` and the content area renders `<AutoModQueue />` when that tab is active.

  Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ForumAdminPanel.modqueue`
  Expected: Both tests pass

- [ ] **6.3 — Run full test suite to verify no regressions**

  ```
  cd backend && npx jest
  cd frontend && npx react-scripts test --watchAll=false
  ```

  Expected: All existing tests continue to pass; new tests all pass.

- [ ] **6.4 — Commit**

  ```
  git add frontend/src/components/Forum/ForumAdminPanel.js frontend/src/components/Forum/__tests__/ForumAdminPanel.modqueue.test.js
  git commit -m "feat: wire AutoModQueue into ForumAdminPanel as Mod Queue tab"
  ```

---

## Final Checklist

- [ ] `backend/models/ContentReport.js` exists with `computeSuggestedAction` exported
- [ ] `POST /api/forum/report` rate-limits at 5/hour, rejects duplicates (409), auto-hides at 3 pending
- [ ] `GET /api/admin/moderation-queue` returns grouped results with content preview, sorted by report count
- [ ] `POST /api/admin/moderation-queue/:contentId/action` hides content, creates warnings, updates reports
- [ ] `AutoModQueue` renders badge colors: red=hide_and_warn, orange=hide_post, yellow=review
- [ ] `ReportModal` is defined at module scope (above `ThreadView`), not inside it
- [ ] Flag button appears on both posts and thread header in `ThreadView`
- [ ] `ForumAdminPanel` has a working "Mod Queue" tab that renders `AutoModQueue`
- [ ] All tests pass, no regressions

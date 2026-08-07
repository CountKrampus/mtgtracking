# User Feedback System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working feedback loop — any logged-in user can submit a bug/feature/other report from a header button; admins/moderators with the `feedback:read`/`feedback:manage` permissions (already defined in the permissions catalog, unused until now) can view and triage it from the existing (currently-stubbed) admin table.

**Architecture:** A new `Feedback` Mongoose model. A new small route file `backend/routes/feedback.js` (mounted at `/api/feedback`) handles the public `POST` — any authenticated user can submit. The admin `GET`/`PATCH` routes are added directly into the existing `backend/routes/admin.js`, matching that file's established pattern (Bans, Warnings, Badges, etc. are all inlined there rather than split into per-resource files — only `roles.js` broke out separately). Frontend: a new header icon button (`AppHeader.js`, matching the existing Notifications/Messages button pattern) opens a new `FeedbackModal.js` (matching the `AccountSettings`/`showAccountSettings` boolean-state-in-App.js pattern). The existing `FeedbackTab.js` admin table UI is already fully built — only its `handleMarkReviewed` needs to call a real endpoint instead of faking a local state update, plus a new "Close" action.

**Tech Stack:** Node/Express (backend, TDD via jest), React (frontend, no test infra).

**Spec:** `docs/superpowers/specs/2026-08-07-feedback-system-design.md`

---

## Task 1: `Feedback` model + `POST /api/feedback`

**Files:**
- Create: `backend/models/Feedback.js`
- Create: `backend/routes/feedback.js`
- Create: `backend/__tests__/feedback-submit.test.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/feedback-submit.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Feedback = require('../models/Feedback');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', require('../routes/feedback'));
  return app;
}

describe('POST /api/feedback', () => {
  let app, user;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    user = await User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    app = buildApp();
  });

  test('creates a feedback doc with the submitting user, message, and category', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'The deck builder crashes on save', category: 'bug', pageUrl: '/decks/123', userAgent: 'Mozilla/5.0 Test' })
      .expect(201);

    expect(res.body.feedback.message).toBe('The deck builder crashes on save');
    expect(res.body.feedback.category).toBe('bug');
    expect(res.body.feedback.status).toBe('pending');
    expect(res.body.feedback.pageUrl).toBe('/decks/123');

    const stored = await Feedback.findOne({});
    expect(stored.submitter.toString()).toBe(user._id.toString());
  });

  test('rejects an empty or missing message', async () => {
    await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: '   ', category: 'bug' })
      .expect(400);

    await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ category: 'bug' })
      .expect(400);
  });

  test('defaults an invalid or missing category to "other"', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'General thought' })
      .expect(201);
    expect(res.body.feedback.category).toBe('other');

    const res2 = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${makeToken(user)}`)
      .send({ message: 'General thought 2', category: 'not-a-real-category' })
      .expect(201);
    expect(res2.body.feedback.category).toBe('other');
  });

  test('rejects unauthenticated requests', async () => {
    await request(app)
      .post('/api/feedback')
      .send({ message: 'Anonymous attempt', category: 'bug' })
      .expect(401);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest feedback-submit --silent` (use `dangerouslyDisableSandbox: true`)
Expected: FAIL — `Feedback` model and `routes/feedback.js` don't exist yet.

- [ ] **Step 3: Create the `Feedback` model**

Create `backend/models/Feedback.js`:

```js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['bug', 'feature', 'other'], default: 'other' },
  status: { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
  pageUrl: { type: String },
  userAgent: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
```

(`{ timestamps: true }` gives `createdAt`/`updatedAt` automatically, matching this codebase's convention on several other simpler models — check `backend/models/PriceFlag.js` if uncertain about the exact convention used for similar admin-triage models.)

- [ ] **Step 4: Create `POST /api/feedback`**

Create `backend/routes/feedback.js`:

```js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { verifyToken, requireAuth } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireAuth);

const VALID_CATEGORIES = ['bug', 'feature', 'other'];

router.post('/', async (req, res) => {
  try {
    const { message, category, pageUrl, userAgent } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }

    const feedback = await Feedback.create({
      submitter: req.user._id,
      message: message.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : 'other',
      pageUrl: pageUrl || '',
      userAgent: userAgent || '',
    });

    res.status(201).json({ feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

(`req.user` is set by `verifyToken` to `user.toSafeObject()` — confirmed via `backend/models/User.js`, `_id` is the correct field, not `userId` or `id`.)

- [ ] **Step 5: Mount the route**

In `backend/server.js`, add near the other route mounts (e.g. near `app.use('/api/challenges', ...)`):
```js
app.use('/api/feedback', require('./routes/feedback'));
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `cd backend && npx jest feedback-submit --silent` (sandbox disabled)
Expected: 4/4 pass.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add backend/models/Feedback.js backend/routes/feedback.js backend/server.js backend/__tests__/feedback-submit.test.js
git commit -m "feat: add Feedback model and POST /api/feedback submission endpoint"
```

---

## Task 2: Admin `GET`/`PATCH /api/admin/feedback` routes

**Files:**
- Modify: `backend/routes/admin.js`
- Create: `backend/__tests__/feedback-admin.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/feedback-admin.test.js`, following the exact pattern in `backend/__tests__/admin-badges-permissions.test.js` (read that file first for the full `Role.seedBuiltInRoles()`/`Role.grantMigrationPermissions()`/`refreshRoleCache()` setup):

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Feedback = require('../models/Feedback');
const { refreshRoleCache } = require('../utils/permissions');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('Admin feedback routes', () => {
  let app, admin, supportAgent, regularUser;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Role.syncIndexes();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await Role.create({ name: 'support_agent', displayName: 'Support Agent', permissions: ['feedback:read', 'feedback:manage'] });
    await refreshRoleCache();

    admin = await User.create({ email: 'admin@test.com', username: 'admin1', passwordHash: 'x', role: 'admin' });
    supportAgent = await User.create({ email: 'sa@test.com', username: 'sa1', passwordHash: 'x', role: 'support_agent' });
    regularUser = await User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
    app = buildApp();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  test('feedback:read can list feedback with submitter info', async () => {
    await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });

    const res = await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .expect(200);

    expect(res.body.feedback).toHaveLength(1);
    expect(res.body.feedback[0].submitter.username).toBe('user1');
  });

  test('a role without feedback:read cannot list feedback', async () => {
    await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(regularUser)}`)
      .expect(403);
  });

  test('feedback:manage can update status, rejects an invalid status value', async () => {
    const item = await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });

    const res = await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .send({ status: 'reviewed' })
      .expect(200);
    expect(res.body.feedback.status).toBe('reviewed');

    await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(supportAgent)}`)
      .send({ status: 'not-a-real-status' })
      .expect(400);
  });

  test('admin (has "all" permissions) can list and update feedback', async () => {
    const item = await Feedback.create({ submitter: regularUser._id, message: 'A bug report', category: 'bug' });
    await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);
    await request(app)
      .patch(`/api/admin/feedback/${item._id}`)
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .send({ status: 'closed' })
      .expect(200);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest feedback-admin --silent` (sandbox disabled)
Expected: FAIL — routes don't exist (404).

- [ ] **Step 3: Add the routes to `backend/routes/admin.js`**

Add near the top with the other model imports:
```js
const Feedback = require('../models/Feedback');
```

Add the routes after the Badges routes block (`router.delete('/badges/:id', ...)`, matching this file's grouping — Feedback lives in the same "Community" admin category as Badges/Challenges in the frontend nav):

```js
// GET /api/admin/feedback — list all feedback submissions, newest first
router.get('/feedback', requirePermission('feedback:read'), async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate('submitter', 'username displayName')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ feedback });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PATCH /api/admin/feedback/:id — update a feedback item's status
router.patch('/feedback/:id', requirePermission('feedback:manage'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'reviewed', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'status must be one of: pending, reviewed, closed' });
    }
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
    res.json({ feedback });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest feedback-admin --silent` (sandbox disabled)
Expected: 4/4 pass.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/feedback-admin.test.js
git commit -m "feat: add admin GET/PATCH feedback routes gated by feedback:read/feedback:manage"
```

---

## Task 3: Frontend — submission button + modal

**Files:**
- Create: `frontend/src/components/FeedbackModal.js`
- Modify: `frontend/src/components/AppHeader.js`
- Modify: `frontend/src/App.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Read the reference files this task mirrors**

Read `frontend/src/components/auth/AccountSettings.js`'s opening (props, how it's a self-contained modal component with an `onClose` prop) and `frontend/src/App.js` around `showAccountSettings` (state declaration ~line 136, render block ~line 431) — this new component and its wiring follow that exact pattern.

- [ ] **Step 2: Create `FeedbackModal.js`**

```js
import React, { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

function FeedbackModal({ onClose }) {
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/feedback`, {
        message: message.trim(),
        category,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent,
      });
      alert('Thanks for the feedback!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Send Feedback</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="bug">Bug</option>
              <option value="feature">Feature request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What's on your mind?"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedbackModal;
```

- [ ] **Step 3: Add the header button**

In `frontend/src/components/AppHeader.js`, add the import:
```js
import { MessageCircle } from 'lucide-react'; // add to the existing lucide-react import line, alongside MessageSquare
```

Add a new prop `onOpenFeedback` to the component signature, and a new button right after the existing Messages button (before `UserMenu`):
```jsx
        <button
          onClick={onOpenFeedback}
          className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
          title="Send Feedback"
        >
          <MessageCircle size={20} />
        </button>
```

(Use a visually distinct icon from the existing `MessageSquare` used for Messages — `MessageCircle` is a reasonable pick; swap if it doesn't read clearly next to the existing icon during Step 5's manual check.)

- [ ] **Step 4: Wire it into `App.js`**

Add the import near the top:
```js
import FeedbackModal from './components/FeedbackModal';
```

Add state alongside `showAccountSettings` (~line 136):
```js
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
```

Pass the new prop to `<AppHeader ... />` (~line 328, alongside `onOpenAccountSettings`):
```jsx
        onOpenFeedback={() => setShowFeedbackModal(true)}
```

Add the modal render block right after the Account Settings modal block (~line 433):
```jsx
      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
```

- [ ] **Step 5: Verify it compiles and smoke-test**

Run: `cd frontend && npm run build`
Expected: succeeds.

With the dev server running, click the new header button, submit a test feedback item, confirm the success alert appears and the modal closes. Confirm a validation error shows inline (not a crash) if you try to submit with an empty message.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FeedbackModal.js frontend/src/components/AppHeader.js frontend/src/App.js
git commit -m "feat: add feedback submission button and modal"
```

---

## Task 4: Frontend — wire the admin table to real endpoints

**Files:**
- Modify: `frontend/src/components/admin/community/FeedbackTab.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Read the current file in full**

Read `frontend/src/components/admin/community/FeedbackTab.js` — you'll be replacing `handleMarkReviewed`'s fake local-state-only update with a real API call, and adding a second action for "Close". The existing `fetchFeedback`'s 404-handling (`notImplemented` state) can stay as-is (harmless defensive fallback, now dead in practice since the route exists, per the plan's own note — no need to remove it).

- [ ] **Step 2: Replace `handleMarkReviewed` with a real status-update function**

Replace:
```js
  const handleMarkReviewed = useCallback((id) => {
    setFeedback((prev) =>
      prev.map((f) =>
        f._id === id ? { ...f, status: 'reviewed' } : f
      )
    );
  }, []);
```
with:
```js
  const updateStatus = useCallback(async (id, status) => {
    try {
      const res = await authFetch(`${API_URL}/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setFeedback((prev) => prev.map((f) => (f._id === id ? data.feedback : f)));
    } catch (error) {
      console.error('Error updating feedback status:', error);
      alert('Failed to update feedback status');
    }
  }, [authFetch]);
```

(`authFetch(url, options)` — confirmed via `frontend/src/contexts/AuthContext.js`'s `createAuthFetch` — is a thin wrapper around native `fetch` that injects the `Authorization` header and auto-retries once on a 401 after a token refresh; it accepts the same `options` shape as `fetch` itself, so passing `method`/`headers`/`body` as above is correct.)

- [ ] **Step 3: Update the Actions column to offer both Review and Close**

Replace the existing single conditional button:
```jsx
                <td className="px-4 py-3 text-right">
                  {item.status !== 'reviewed' && (
                    <button
                      onClick={() => handleMarkReviewed(item._id)}
                      className="p-1 text-green-400 hover:text-green-300 transition-colors"
                      title="Mark as reviewed"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                </td>
```
with:
```jsx
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {item.status !== 'reviewed' && item.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(item._id, 'reviewed')}
                        className="p-1 text-green-400 hover:text-green-300 transition-colors"
                        title="Mark as reviewed"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {item.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(item._id, 'closed')}
                        className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                        title="Close"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </td>
```

Add `XCircle` to the existing `lucide-react` import line (`import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';` → add `XCircle`).

- [ ] **Step 4: Verify it compiles and smoke-test**

Run: `cd frontend && npm run build`
Expected: succeeds.

With the dev server running (and a user with `feedback:read`/`feedback:manage` permissions — likely the built-in `admin` role, which has `all`), submit a test feedback item via Task 3's modal, then open the admin panel's Feedback tab, confirm the item appears with real submitter/message/category, click the reviewed checkmark, confirm the status updates and persists across a page refresh, then click Close and confirm the same.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/community/FeedbackTab.js
git commit -m "feat: wire admin feedback table to real status-update endpoint, add Close action"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all pass.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: End-to-end manual smoke test**

With both servers running: submit feedback as a non-admin user from the header button → confirm it appears in the admin Feedback tab as an admin/support-permission user → mark it reviewed → mark it closed → refresh the page and confirm the status persisted (not reverted to pending) → confirm a user WITHOUT `feedback:read` gets a 403/can't see the Feedback tab data.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

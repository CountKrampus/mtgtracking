# Bulk User Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins select multiple users in the user management table and perform batch operations (email blast, badge grant, 2FA reset) with confirmation modals and a full audit trail.

**Architecture:** Four new admin routes (bulk-select, bulk-email, bulk-badge, bulk-2fa-reset) added to `backend/routes/admin.js`; three new modal components imported into `UserManagement.js`; checkbox selection + floating action bar added to `UserManagement.js`.

**Tech Stack:** Node.js/Express/Mongoose, React, Tailwind CSS, Lucide icons (Mail, Award, Shield, X), useAuthContext authFetch.

---

## Files

| File | Action |
|------|--------|
| `backend/routes/admin.js` | Add 4 routes |
| `backend/__tests__/bulk-user-actions.test.js` | New test file |
| `frontend/src/components/admin/BulkEmailModal.js` | New component |
| `frontend/src/components/admin/BulkBadgeModal.js` | New component |
| `frontend/src/components/admin/Bulk2FAResetModal.js` | New component |
| `frontend/src/components/admin/UserManagement.js` | Add checkboxes + floating bar + modal imports |

---

## Task 1: Backend bulk routes

**Files:**
- Modify: `backend/routes/admin.js`
- Create: `backend/__tests__/bulk-user-actions.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/bulk-user-actions.test.js`:

```js
const mongoose = require('mongoose');

jest.mock('../models/User');
jest.mock('../models/Badge');
jest.mock('../models/ModerationHistory');
jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => next(),
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireModerator: (req, res, next) => next(),
  isMultiUserEnabled: () => true,
}));

const User = require('../models/User');
const Badge = require('../models/Badge');
const ModerationHistory = require('../models/ModerationHistory');

const express = require('express');
const request = require('supertest');

// We'll test the route logic directly via mock setup
describe('Bulk User Action Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/admin', require('../routes/admin'));
  });

  describe('GET /api/admin/users/bulk-select', () => {
    it('returns array of _ids matching query', async () => {
      const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
      User.find = jest.fn().mockResolvedValue(ids.map(id => ({ _id: id })));
      const res = await request(app).get('/api/admin/users/bulk-select');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/admin/users/bulk-badge', () => {
    it('returns 404 when badge does not exist', async () => {
      Badge.findById = jest.fn().mockResolvedValue(null);
      const res = await request(app)
        .post('/api/admin/users/bulk-badge')
        .send({ userIds: [new mongoose.Types.ObjectId().toString()], badgeId: 'fakeid' });
      expect(res.status).toBe(404);
    });

    it('updates users and returns modifiedCount when badge exists', async () => {
      Badge.findById = jest.fn().mockResolvedValue({ _id: 'bid', name: 'Gold' });
      User.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
      ModerationHistory.insertMany = jest.fn().mockResolvedValue([]);
      const res = await request(app)
        .post('/api/admin/users/bulk-badge')
        .send({ userIds: ['uid1', 'uid2'], badgeId: 'bid' });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);
    });
  });

  describe('POST /api/admin/users/bulk-2fa-reset', () => {
    it('returns 400 when userIds is empty', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk-2fa-reset')
        .send({ userIds: [] });
      expect(res.status).toBe(400);
    });

    it('clears twoFactorEnabled for all userIds', async () => {
      User.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 3 });
      ModerationHistory.insertMany = jest.fn().mockResolvedValue([]);
      const res = await request(app)
        .post('/api/admin/users/bulk-2fa-reset')
        .send({ userIds: ['u1', 'u2', 'u3'] });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(3);
      expect(User.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['u1', 'u2', 'u3'] } },
        { $set: { twoFactorSecret: null, twoFactorEnabled: false } }
      );
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Add routes to `backend/routes/admin.js`**

At the top of `admin.js`, the following are already imported: `User`, `Badge`, `ModerationHistory`, `requireAdmin`, `requireModerator`. Add these four routes anywhere after the existing routes (before `module.exports`):

```js
// ── Bulk user operations ──────────────────────────────────────────────────

// GET /api/admin/users/bulk-select
// Returns _id array for all users matching current filter (no pagination)
router.get('/users/bulk-select', requireAdmin, async (req, res) => {
  try {
    const { search, role, isActive } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(query, '_id');
    res.json(users.map(u => u._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/users/bulk-email
router.post('/users/bulk-email', requireAdmin, async (req, res) => {
  try {
    const { userIds, subject, body } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 500)
      return res.status(400).json({ message: 'userIds must be an array of 1–500 items' });
    if (!subject || subject.length > 200)
      return res.status(400).json({ message: 'subject required and max 200 chars' });
    if (!body || body.length > 5000)
      return res.status(400).json({ message: 'body required and max 5000 chars' });

    const users = await User.find({ _id: { $in: userIds } }, 'email username');

    // Try nodemailer — fail gracefully if not configured
    let sent = 0, failed = 0;
    const errors = [];
    try {
      const nodemailer = require('nodemailer');
      if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST not configured');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      for (const user of users) {
        try {
          await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@mtgtracker.app', to: user.email, subject, text: body });
          sent++;
        } catch (e) {
          failed++;
          errors.push(`${user.email}: ${e.message}`);
        }
      }
    } catch (e) {
      if (e.message.includes('SMTP_HOST')) return res.status(503).json({ message: 'Email not configured' });
      return res.status(503).json({ message: `Email transport error: ${e.message}` });
    }

    await ModerationHistory.insertMany(
      users.map(u => ({ actionType: 'bulk_email', actionDetails: { subject }, performedBy: req.user._id, userId: u._id, createdAt: new Date() }))
    );

    res.json({ sent, failed, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/users/bulk-badge
router.post('/users/bulk-badge', requireAdmin, async (req, res) => {
  try {
    const { userIds, badgeId } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 500)
      return res.status(400).json({ message: 'userIds must be an array of 1–500 items' });

    const badge = await Badge.findById(badgeId);
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $addToSet: { badges: badgeId } }
    );

    await ModerationHistory.insertMany(
      userIds.map(uid => ({ actionType: 'bulk_badge_grant', actionDetails: { badgeId }, performedBy: req.user._id, userId: uid, createdAt: new Date() }))
    );

    res.json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/users/bulk-2fa-reset
router.post('/users/bulk-2fa-reset', requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 500)
      return res.status(400).json({ message: 'userIds must be an array of 1–500 items' });

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { twoFactorSecret: null, twoFactorEnabled: false } }
    );

    await ModerationHistory.insertMany(
      userIds.map(uid => ({ actionType: 'bulk_2fa_reset', actionDetails: {}, performedBy: req.user._id, userId: uid, createdAt: new Date() }))
    );

    res.json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx jest __tests__/bulk-user-actions.test.js --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/routes/admin.js backend/__tests__/bulk-user-actions.test.js
git commit -m "feat: add bulk user action routes (email, badge, 2FA reset, bulk-select)"
```

---

## Task 2: BulkEmailModal component

**Files:**
- Create: `frontend/src/components/admin/BulkEmailModal.js`

- [ ] **Step 1: Create `frontend/src/components/admin/BulkEmailModal.js`**

```jsx
import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function BulkEmailModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/users/bulk-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, subject, body }),
      });
      if (res.status === 503) { setError('Email is not configured on this server.'); return; }
      if (!res.ok) { const d = await res.json(); setError(d.message || 'Failed'); return; }
      const data = await res.json();
      onSuccess(`Sent to ${data.sent} users${data.failed ? `, ${data.failed} failed` : ''}.`);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Mail size={18} /> Email {userIds.length} users</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div>
          <label className="text-gray-300 text-sm block mb-1">Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
            className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-gray-300 text-sm block mb-1">Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={5000}
            className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <p className="text-gray-500 text-xs text-right">{body.length}/5000</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSend} disabled={loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition">
            {loading ? 'Sending...' : `Send to ${userIds.length} users`}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/BulkEmailModal.js
git commit -m "feat: add BulkEmailModal admin component"
```

---

## Task 3: BulkBadgeModal component

**Files:**
- Create: `frontend/src/components/admin/BulkBadgeModal.js`

- [ ] **Step 1: Create `frontend/src/components/admin/BulkBadgeModal.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { X, Award } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function BulkBadgeModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [badges, setBadges] = useState([]);
  const [badgeId, setBadgeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch(`${API_URL}/admin/badges`).then(r => r.json()).then(data => {
      setBadges(Array.isArray(data) ? data : (data.badges || []));
    }).catch(() => setError('Failed to load badges.'));
  }, []);

  const handleGrant = async () => {
    if (!badgeId) { setError('Select a badge.'); return; }
    setLoading(true); setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/users/bulk-badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, badgeId }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.message || 'Failed'); return; }
      const data = await res.json();
      onSuccess(`Badge granted to ${data.updated} users.`);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Award size={18} /> Grant Badge to {userIds.length} users</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div>
          <label className="text-gray-300 text-sm block mb-1">Badge</label>
          <select value={badgeId} onChange={e => setBadgeId(e.target.value)}
            className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">Select a badge...</option>
            {badges.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGrant} disabled={loading || !badgeId}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition">
            {loading ? 'Granting...' : `Grant to ${userIds.length} users`}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/BulkBadgeModal.js
git commit -m "feat: add BulkBadgeModal admin component"
```

---

## Task 4: Bulk2FAResetModal component

**Files:**
- Create: `frontend/src/components/admin/Bulk2FAResetModal.js`

- [ ] **Step 1: Create `frontend/src/components/admin/Bulk2FAResetModal.js`**

```jsx
import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function Bulk2FAResetModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/users/bulk-2fa-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.message || 'Failed'); return; }
      const data = await res.json();
      onSuccess(`2FA reset for ${data.updated} users.`);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Shield size={18} /> Reset 2FA</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="bg-orange-900/30 border border-orange-500/40 rounded-lg p-3">
          <p className="text-orange-200 text-sm">
            This will force <strong>{userIds.length} user{userIds.length !== 1 ? 's' : ''}</strong> to re-enroll in 2FA on their next login. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold transition">
            {loading ? 'Resetting...' : `Confirm Reset for ${userIds.length} users`}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/Bulk2FAResetModal.js
git commit -m "feat: add Bulk2FAResetModal admin component"
```

---

## Task 5: UserManagement checkbox selection + floating bar

**Files:**
- Modify: `frontend/src/components/admin/UserManagement.js`

- [ ] **Step 1: Add imports to `UserManagement.js`**

At the top of the file, add:
```js
import { Mail, Award, Shield, X } from 'lucide-react';
import BulkEmailModal from './BulkEmailModal';
import BulkBadgeModal from './BulkBadgeModal';
import Bulk2FAResetModal from './Bulk2FAResetModal';
```

- [ ] **Step 2: Add selection state**

Inside the `UserManagement` component function, add these state variables:
```js
const [selectedUserIds, setSelectedUserIds] = useState(new Set());
const [showEmailModal, setShowEmailModal] = useState(false);
const [showBadgeModal, setShowBadgeModal] = useState(false);
const [show2FAModal, setShow2FAModal] = useState(false);
const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');
```

- [ ] **Step 3: Add select-all helpers**

Inside the component, add:
```js
const toggleSelectUser = (id) => {
  setSelectedUserIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
};

const selectAllOnPage = () => {
  setSelectedUserIds(prev => {
    const next = new Set(prev);
    users.forEach(u => next.add(u._id.toString()));
    return next;
  });
};

const clearSelection = () => setSelectedUserIds(new Set());

const selectAllMatching = async () => {
  try {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (filterRole) params.set('role', filterRole);
    const res = await authFetch(`${API_URL}/admin/users/bulk-select?${params}`);
    const ids = await res.json();
    setSelectedUserIds(new Set(ids.map(id => id.toString())));
  } catch { /* ignore */ }
};
```

- [ ] **Step 4: Add checkbox column to user table**

In the table header row, prepend:
```jsx
<th className="px-3 py-3 text-left">
  <input type="checkbox"
    checked={users.length > 0 && users.every(u => selectedUserIds.has(u._id.toString()))}
    onChange={e => e.target.checked ? selectAllOnPage() : clearSelection()}
    className="rounded border-gray-600 bg-white/10 text-purple-500 focus:ring-purple-500"
  />
</th>
```

In each table body row, prepend:
```jsx
<td className="px-3 py-3">
  <input type="checkbox"
    checked={selectedUserIds.has(user._id.toString())}
    onChange={() => toggleSelectUser(user._id.toString())}
    className="rounded border-gray-600 bg-white/10 text-purple-500 focus:ring-purple-500"
  />
</td>
```

- [ ] **Step 5: Add "Select all matching" button**

Below the search/filter bar (but above the table), add:
```jsx
{selectedUserIds.size > 0 && (
  <button onClick={selectAllMatching}
    className="text-sm text-purple-400 hover:text-purple-300 underline">
    Select all users matching current filter
  </button>
)}
```

- [ ] **Step 6: Add floating action bar**

At the bottom of the UserManagement return, before the closing `</div>`, add:
```jsx
{selectedUserIds.size > 0 && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-white/20 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
    <span className="text-white text-sm font-semibold">{selectedUserIds.size} selected</span>
    <button onClick={clearSelection} className="text-gray-400 hover:text-white"><X size={16} /></button>
    <div className="w-px h-5 bg-white/20" />
    <button onClick={() => setShowEmailModal(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition">
      <Mail size={14} /> Email
    </button>
    <button onClick={() => setShowBadgeModal(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
      <Award size={14} /> Grant Badge
    </button>
    <button onClick={() => setShow2FAModal(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition">
      <Shield size={14} /> Reset 2FA
    </button>
  </div>
)}

{bulkSuccessMsg && (
  <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-green-800 text-green-100 px-4 py-2 rounded-lg text-sm shadow-xl">
    {bulkSuccessMsg}
  </div>
)}

{showEmailModal && (
  <BulkEmailModal
    userIds={[...selectedUserIds]}
    onClose={() => setShowEmailModal(false)}
    onSuccess={(msg) => { setShowEmailModal(false); clearSelection(); setBulkSuccessMsg(msg); setTimeout(() => setBulkSuccessMsg(''), 4000); }}
  />
)}
{showBadgeModal && (
  <BulkBadgeModal
    userIds={[...selectedUserIds]}
    onClose={() => setShowBadgeModal(false)}
    onSuccess={(msg) => { setShowBadgeModal(false); clearSelection(); setBulkSuccessMsg(msg); setTimeout(() => setBulkSuccessMsg(''), 4000); }}
  />
)}
{show2FAModal && (
  <Bulk2FAResetModal
    userIds={[...selectedUserIds]}
    onClose={() => setShow2FAModal(false)}
    onSuccess={(msg) => { setShow2FAModal(false); clearSelection(); setBulkSuccessMsg(msg); setTimeout(() => setBulkSuccessMsg(''), 4000); }}
  />
)}
```

- [ ] **Step 7: Run all backend tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/UserManagement.js
git commit -m "feat: bulk user selection, floating action bar, and modal wiring in UserManagement"
```

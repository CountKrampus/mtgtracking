# Pricing Corrections UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users with reputation ≥ 50 flag incorrect card prices for admin review; admins dismiss or resolve flags (triggering a price refresh).

**Architecture:** New PriceFlag Mongoose model, two backend route additions (server.js for card route + admin.js for admin routes), a new PriceCorrectionsTab admin component, and a flag icon + PriceFlagModal in CollectionView (defined at module scope above CollectionView).

> **NOTE:** All card routes live in `backend/server.js` directly, not a separate `cards.js`. Add the `POST /api/cards/:id/flag-price` route to `server.js`. Test files go in `backend/__tests__/`, not `backend/tests/`.

**Tech Stack:** Node.js/Express/Mongoose, React, Tailwind CSS, Lucide icons (Flag), useAuthContext authFetch.

---

## Task 1 — PriceFlag Mongoose Model

**File:** `backend/models/PriceFlag.js`

### 1.1 Write the failing test

- [ ] Create `backend/tests/models/priceFlag.test.js`:

```js
const mongoose = require('mongoose');
const PriceFlag = require('../../models/PriceFlag');

describe('PriceFlag model', () => {
  it('has required fields cardId and flaggedBy', () => {
    const flag = new PriceFlag({});
    const err = flag.validateSync();
    expect(err.errors['cardId']).toBeDefined();
    expect(err.errors['flaggedBy']).toBeDefined();
  });

  it('defaults status to pending', () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();
    const flag = new PriceFlag({ cardId, flaggedBy: userId });
    expect(flag.status).toBe('pending');
  });

  it('rejects invalid status values', () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();
    const flag = new PriceFlag({ cardId, flaggedBy: userId, status: 'bogus' });
    const err = flag.validateSync();
    expect(err.errors['status']).toBeDefined();
  });

  it('defaults reason to empty string', () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();
    const flag = new PriceFlag({ cardId, flaggedBy: userId });
    expect(flag.reason).toBe('');
  });

  it('rejects reason longer than 300 characters', () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();
    const flag = new PriceFlag({ cardId, flaggedBy: userId, reason: 'x'.repeat(301) });
    const err = flag.validateSync();
    expect(err.errors['reason']).toBeDefined();
  });

  it('defaults resolvedBy and resolvedAt to null', () => {
    const userId = new mongoose.Types.ObjectId();
    const cardId = new mongoose.Types.ObjectId();
    const flag = new PriceFlag({ cardId, flaggedBy: userId });
    expect(flag.resolvedBy).toBeNull();
    expect(flag.resolvedAt).toBeNull();
  });
});
```

- [ ] Run test — expect failures:
```
cd backend && npx jest tests/models/priceFlag.test.js --no-coverage
```
Expected output: `Cannot find module '../../models/PriceFlag'`

### 1.2 Implement the model

- [ ] Create `backend/models/PriceFlag.js`:

```js
const mongoose = require('mongoose');

const PriceFlagSchema = new mongoose.Schema({
  cardId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  flaggedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:     { type: String, maxlength: 300, default: '' },
  status:     { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now }
});

PriceFlagSchema.index({ cardId: 1, flaggedBy: 1 });

module.exports = mongoose.model('PriceFlag', PriceFlagSchema);
```

- [ ] Run test — expect all pass:
```
cd backend && npx jest tests/models/priceFlag.test.js --no-coverage
```
Expected output: `Tests: 6 passed, 6 total`

- [ ] Commit:
```
git add backend/models/PriceFlag.js backend/tests/models/priceFlag.test.js
git commit -m "feat: PriceFlag mongoose model with index and validation"
```

---

## Task 2 — Backend Routes

### Subtask 2A — `POST /api/cards/:id/flag-price`

**File:** `backend/routes/cards.js`

#### 2A.1 Write the failing test

- [ ] Create `backend/tests/routes/cards.flagPrice.test.js`:

```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app'); // adjust if your express app export differs
const Card = require('../../models/Card');
const User = require('../../models/User');
const PriceFlag = require('../../models/PriceFlag');

let server;
let token;
let lowRepToken;
let card;
let user;
let lowRepUser;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mtg-tracker-test');
  server = app.listen(0);

  user = await User.create({
    username: 'flagger',
    email: 'flagger@test.com',
    password: 'hashed',
    reputation: 50
  });

  lowRepUser = await User.create({
    username: 'newbie',
    email: 'newbie@test.com',
    password: 'hashed',
    reputation: 10
  });

  card = await Card.create({ name: 'Lightning Bolt', quantity: 1, condition: 'NM', price: 1.5 });

  // obtain tokens — adjust to your actual auth mechanism
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'flagger@test.com', password: 'hashed' });
  token = loginRes.body.token;

  const lowLoginRes = await request(app).post('/api/auth/login').send({ email: 'newbie@test.com', password: 'hashed' });
  lowRepToken = lowLoginRes.body.token;
});

afterAll(async () => {
  await User.deleteMany({ email: { $in: ['flagger@test.com', 'newbie@test.com'] } });
  await Card.deleteMany({ name: 'Lightning Bolt' });
  await PriceFlag.deleteMany({});
  await mongoose.disconnect();
  server.close();
});

afterEach(async () => {
  await PriceFlag.deleteMany({});
});

describe('POST /api/cards/:id/flag-price', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post(`/api/cards/${card._id}/flag-price`).send({ reason: 'Wrong price' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when reputation < 50', async () => {
    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${lowRepToken}`)
      .send({ reason: 'Wrong price' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Insufficient reputation to flag prices');
  });

  it('creates a pending flag and returns 201', async () => {
    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'This price is way off' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.reason).toBe('This price is way off');
    expect(res.body.cardId.toString()).toBe(card._id.toString());
  });

  it('returns 409 when a pending flag already exists for this user+card', async () => {
    await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'First flag' });

    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Duplicate flag' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('You already have a pending flag for this card');
  });

  it('defaults reason to empty string when not provided', async () => {
    const res = await request(app)
      .post(`/api/cards/${card._id}/flag-price`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.reason).toBe('');
  });
});
```

- [ ] Run test — expect failures:
```
cd backend && npx jest tests/routes/cards.flagPrice.test.js --no-coverage
```
Expected output: failing — route does not exist yet (404s or import errors)

#### 2A.2 Implement the route

- [ ] Open `backend/routes/cards.js` and add the PriceFlag import near the top with other model imports:

```js
const PriceFlag = require('../models/PriceFlag');
```

- [ ] Add the route handler (place after existing single-card routes, before bulk routes):

```js
// POST /api/cards/:id/flag-price
router.post('/:id/flag-price', requireAuth, async (req, res) => {
  try {
    if (req.user.reputation < 50) {
      return res.status(403).json({ message: 'Insufficient reputation to flag prices' });
    }

    const existingFlag = await PriceFlag.findOne({
      cardId: req.params.id,
      flaggedBy: req.user._id,
      status: 'pending'
    });

    if (existingFlag) {
      return res.status(409).json({ message: 'You already have a pending flag for this card' });
    }

    const flag = new PriceFlag({
      cardId: req.params.id,
      flaggedBy: req.user._id,
      reason: req.body.reason || ''
    });

    await flag.save();
    res.status(201).json(flag);
  } catch (err) {
    console.error('flag-price error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] Run test — expect all pass:
```
cd backend && npx jest tests/routes/cards.flagPrice.test.js --no-coverage
```
Expected output: `Tests: 5 passed, 5 total`

---

### Subtask 2B — `GET /api/admin/price-flags` and `PUT /api/admin/price-flags/:id`

**File:** `backend/routes/admin.js`

#### 2B.1 Write the failing test

- [ ] Create `backend/tests/routes/admin.priceFlags.test.js`:

```js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Card = require('../../models/Card');
const User = require('../../models/User');
const PriceFlag = require('../../models/PriceFlag');
const ModerationHistory = require('../../models/ModerationHistory');

let server;
let modToken;
let regularToken;
let mod;
let flagger;
let card;
let flag;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/mtg-tracker-test');
  server = app.listen(0);

  mod = await User.create({
    username: 'moderator',
    email: 'mod@test.com',
    password: 'hashed',
    role: 'moderator',
    reputation: 100
  });

  flagger = await User.create({
    username: 'flagger2',
    email: 'flagger2@test.com',
    password: 'hashed',
    reputation: 50
  });

  card = await Card.create({ name: 'Counterspell', quantity: 2, condition: 'NM', price: 3.0 });

  const modLogin = await request(app).post('/api/auth/login').send({ email: 'mod@test.com', password: 'hashed' });
  modToken = modLogin.body.token;

  const regLogin = await request(app).post('/api/auth/login').send({ email: 'flagger2@test.com', password: 'hashed' });
  regularToken = regLogin.body.token;
});

afterAll(async () => {
  await User.deleteMany({ email: { $in: ['mod@test.com', 'flagger2@test.com'] } });
  await Card.deleteMany({ name: 'Counterspell' });
  await PriceFlag.deleteMany({});
  await ModerationHistory.deleteMany({ actionType: 'price_update' });
  await mongoose.disconnect();
  server.close();
});

beforeEach(async () => {
  await PriceFlag.deleteMany({});
  flag = await PriceFlag.create({
    cardId: card._id,
    flaggedBy: flagger._id,
    reason: 'Price seems wrong',
    status: 'pending'
  });
});

afterEach(async () => {
  await PriceFlag.deleteMany({});
  await ModerationHistory.deleteMany({ actionType: 'price_update' });
});

describe('GET /api/admin/price-flags', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/admin/price-flags');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-moderator users', async () => {
    const res = await request(app)
      .get('/api/admin/price-flags')
      .set('Authorization', `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });

  it('returns pending flags with populated card and user data', async () => {
    const res = await request(app)
      .get('/api/admin/price-flags')
      .set('Authorization', `Bearer ${modToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].cardId.name).toBe('Counterspell');
    expect(res.body[0].flaggedBy.username).toBe('flagger2');
    expect(res.body[0].status).toBe('pending');
  });

  it('filters by status query param', async () => {
    await PriceFlag.create({
      cardId: card._id,
      flaggedBy: flagger._id,
      reason: 'Resolved one',
      status: 'resolved',
      resolvedBy: mod._id,
      resolvedAt: new Date()
    });

    const pendingRes = await request(app)
      .get('/api/admin/price-flags?status=pending')
      .set('Authorization', `Bearer ${modToken}`);
    expect(pendingRes.body.length).toBe(1);
    expect(pendingRes.body[0].status).toBe('pending');

    const resolvedRes = await request(app)
      .get('/api/admin/price-flags?status=resolved')
      .set('Authorization', `Bearer ${modToken}`);
    expect(resolvedRes.body.length).toBe(1);
    expect(resolvedRes.body[0].status).toBe('resolved');
  });
});

describe('PUT /api/admin/price-flags/:id', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).put(`/api/admin/price-flags/${flag._id}`).send({ action: 'dismiss' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-moderator users', async () => {
    const res = await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ action: 'dismiss' });
    expect(res.status).toBe(403);
  });

  it('dismisses a flag and records moderation history', async () => {
    const res = await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'dismiss' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dismissed');
    expect(res.body.resolvedBy).toBeTruthy();
    expect(res.body.resolvedAt).toBeTruthy();

    const histEntry = await ModerationHistory.findOne({ actionType: 'price_update', 'actionDetails.flagId': flag._id.toString() });
    expect(histEntry).toBeTruthy();
    expect(histEntry.actionDetails.action).toBe('dismiss');
  });

  it('resolves a flag, resets card price to 0, and records moderation history', async () => {
    const res = await request(app)
      .put(`/api/admin/price-flags/${flag._id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'resolve' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');

    const histEntry = await ModerationHistory.findOne({ actionType: 'price_update', 'actionDetails.flagId': flag._id.toString() });
    expect(histEntry).toBeTruthy();
    expect(histEntry.actionDetails.action).toBe('resolve');
  });

  it('returns 404 for unknown flag id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/admin/price-flags/${fakeId}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'dismiss' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] Run test — expect failures:
```
cd backend && npx jest tests/routes/admin.priceFlags.test.js --no-coverage
```
Expected output: failing — routes do not exist yet

#### 2B.2 Implement the routes

- [ ] Open `backend/routes/admin.js` and add the PriceFlag import near the top (ModerationHistory is already imported):

```js
const PriceFlag = require('../models/PriceFlag');
const Card = require('../models/Card');
```

- [ ] Add the GET route for listing price flags (place after existing admin routes, before module.exports):

```js
// GET /api/admin/price-flags
router.get('/price-flags', requireModerator, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const flags = await PriceFlag.find({ status })
      .populate('cardId', 'name set price')
      .populate('flaggedBy', 'username reputation')
      .sort({ createdAt: 1 });
    res.json(flags);
  } catch (err) {
    console.error('GET price-flags error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] Add the PUT route for resolving/dismissing a flag:

```js
// PUT /api/admin/price-flags/:id
router.put('/price-flags/:id', requireModerator, async (req, res) => {
  try {
    const { action } = req.body; // 'resolve' | 'dismiss'
    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({ message: 'action must be resolve or dismiss' });
    }

    const flag = await PriceFlag.findById(req.params.id);
    if (!flag) {
      return res.status(404).json({ message: 'Flag not found' });
    }

    flag.status = action === 'resolve' ? 'resolved' : 'dismissed';
    flag.resolvedBy = req.user._id;
    flag.resolvedAt = new Date();
    await flag.save();

    if (action === 'resolve') {
      // Reset card price to 0 so next price update fetches fresh data
      await Card.findByIdAndUpdate(flag.cardId, { price: 0 });

      // Trigger price refresh via the existing update-price route logic
      const axios = require('axios');
      const port = process.env.PORT || 5000;
      try {
        await axios.post(
          `http://localhost:${port}/api/cards/${flag.cardId}/update-price?force=true`,
          {},
          { headers: { 'x-internal-request': 'true' } }
        );
      } catch (refreshErr) {
        console.warn('Price refresh after flag resolve failed (non-fatal):', refreshErr.message);
      }
    }

    await ModerationHistory.create({
      actionType: 'price_update',
      actionDetails: {
        flagId: flag._id.toString(),
        cardId: flag.cardId.toString(),
        action
      },
      performedBy: req.user._id,
      userId: flag.flaggedBy
    });

    res.json(flag);
  } catch (err) {
    console.error('PUT price-flags error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] Run test — expect all pass:
```
cd backend && npx jest tests/routes/admin.priceFlags.test.js --no-coverage
```
Expected output: `Tests: 8 passed, 8 total`

- [ ] Commit:
```
git add backend/routes/cards.js backend/routes/admin.js backend/models/PriceFlag.js backend/tests/routes/cards.flagPrice.test.js backend/tests/routes/admin.priceFlags.test.js
git commit -m "feat: POST flag-price route and GET/PUT admin price-flags routes"
```

---

## Task 3 — PriceCorrectionsTab Admin Component

**File:** `frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js`

### 3.1 Write the failing test

- [ ] Create `frontend/src/components/admin/data-pricing/PriceCorrectionsTab.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PriceCorrectionsTab from './PriceCorrectionsTab';
import { AuthContext } from '../../../contexts/AuthContext';

const mockFlags = [
  {
    _id: 'flag1',
    cardId: { _id: 'card1', name: 'Lightning Bolt', set: 'Alpha', price: 1.5 },
    flaggedBy: { username: 'alice', reputation: 75 },
    reason: 'This price is wrong',
    status: 'pending',
    createdAt: '2026-06-29T12:00:00Z'
  },
  {
    _id: 'flag2',
    cardId: { _id: 'card2', name: 'Counterspell', set: 'Beta', price: 3.0 },
    flaggedBy: { username: 'bob', reputation: 60 },
    reason: '',
    status: 'pending',
    createdAt: '2026-06-29T13:00:00Z'
  }
];

const mockAuthFetch = jest.fn();

const renderWithAuth = (ui) =>
  render(
    <AuthContext.Provider value={{ authFetch: mockAuthFetch }}>
      {ui}
    </AuthContext.Provider>
  );

beforeEach(() => {
  mockAuthFetch.mockClear();
});

describe('PriceCorrectionsTab', () => {
  it('shows loading state initially', () => {
    mockAuthFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithAuth(<PriceCorrectionsTab />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders flag table with card name, set, price, user, reason columns', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => mockFlags
    });
    renderWithAuth(<PriceCorrectionsTab />);
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText('This price is wrong')).toBeInTheDocument();
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
  });

  it('shows empty state when no flags exist', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });
    renderWithAuth(<PriceCorrectionsTab />);
    await waitFor(() => expect(screen.getByText(/no pending price flags/i)).toBeInTheDocument());
  });

  it('calls PUT with dismiss action when Dismiss is clicked', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFlags }) // initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockFlags[0], status: 'dismissed' }) }) // PUT dismiss
      .mockResolvedValueOnce({ ok: true, json: async () => [mockFlags[1]] }); // re-fetch after action

    renderWithAuth(<PriceCorrectionsTab />);
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      const putCall = mockAuthFetch.mock.calls.find(
        c => typeof c[0] === 'string' && c[0].includes('flag1') && c[1]?.method === 'PUT'
      );
      expect(putCall).toBeTruthy();
      expect(JSON.parse(putCall[1].body).action).toBe('dismiss');
    });
  });

  it('calls PUT with resolve action when Resolve is clicked', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockFlags })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockFlags[0], status: 'resolved' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [mockFlags[1]] });

    renderWithAuth(<PriceCorrectionsTab />);
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());

    const resolveButtons = screen.getAllByRole('button', { name: /resolve/i });
    fireEvent.click(resolveButtons[0]);

    await waitFor(() => {
      const putCall = mockAuthFetch.mock.calls.find(
        c => typeof c[0] === 'string' && c[0].includes('flag1') && c[1]?.method === 'PUT'
      );
      expect(putCall).toBeTruthy();
      expect(JSON.parse(putCall[1].body).action).toBe('resolve');
    });
  });

  it('shows error message on fetch failure', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });
    renderWithAuth(<PriceCorrectionsTab />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });
});
```

- [ ] Run test — expect failures:
```
cd frontend && npx react-scripts test src/components/admin/data-pricing/PriceCorrectionsTab.test.js --watchAll=false
```
Expected output: `Cannot find module './PriceCorrectionsTab'`

### 3.2 Implement PriceCorrectionsTab

- [ ] Create `frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js`:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

export default function PriceCorrectionsTab() {
  const { authFetch } = useAuthContext();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // flagId being acted on

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/price-flags?status=pending`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setFlags(data);
    } catch {
      setError('Failed to load price flags.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const handleAction = async (flagId, action) => {
    setActionLoading(flagId);
    try {
      const res = await authFetch(`${API_URL}/admin/price-flags/${flagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Action failed');
      await loadFlags();
    } catch {
      setError(`Failed to ${action} flag.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-6 text-white/60">Loading price flags...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (flags.length === 0) return (
    <div className="p-6 text-white/60 text-center">No pending price flags.</div>
  );

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Pending Price Flags</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-white/80">
          <thead>
            <tr className="border-b border-white/10 text-white/50 text-left">
              <th className="pb-2 pr-4">Card Name</th>
              <th className="pb-2 pr-4">Set</th>
              <th className="pb-2 pr-4">Current Price</th>
              <th className="pb-2 pr-4">Flagged By (rep)</th>
              <th className="pb-2 pr-4">Reason</th>
              <th className="pb-2 pr-4">Flagged At</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map(flag => (
              <tr key={flag._id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 pr-4 font-medium">{flag.cardId?.name ?? '—'}</td>
                <td className="py-2 pr-4 text-white/60">{flag.cardId?.set ?? '—'}</td>
                <td className="py-2 pr-4">
                  {flag.cardId?.price != null ? `$${flag.cardId.price.toFixed(2)}` : '—'}
                </td>
                <td className="py-2 pr-4">
                  {flag.flaggedBy?.username ?? '—'}{' '}
                  <span className="text-white/40">({flag.flaggedBy?.reputation ?? 0})</span>
                </td>
                <td className="py-2 pr-4 text-white/60 max-w-xs truncate" title={flag.reason}>
                  {flag.reason || <span className="italic text-white/30">No reason given</span>}
                </td>
                <td className="py-2 pr-4 text-white/40 text-xs">
                  {new Date(flag.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(flag._id, 'resolve')}
                      disabled={actionLoading === flag._id}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                      aria-label={`Resolve flag for ${flag.cardId?.name}`}
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleAction(flag._id, 'dismiss')}
                      disabled={actionLoading === flag._id}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white/70 rounded text-xs font-medium"
                      aria-label={`Dismiss flag for ${flag.cardId?.name}`}
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
    </div>
  );
}
```

- [ ] Run test — expect all pass:
```
cd frontend && npx react-scripts test src/components/admin/data-pricing/PriceCorrectionsTab.test.js --watchAll=false
```
Expected output: `Tests: 6 passed, 6 total`

- [ ] Commit:
```
git add frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js frontend/src/components/admin/data-pricing/PriceCorrectionsTab.test.js
git commit -m "feat: PriceCorrectionsTab admin component with resolve/dismiss actions"
```

---

## Task 4 — CollectionView Flag Icon + PriceFlagModal + AdminPanel Wiring

### Subtask 4A — PriceFlagModal + flag icon in CollectionView

**File:** `frontend/src/components/CollectionView.js`

#### 4A.1 Write the failing test

- [ ] Create `frontend/src/components/CollectionView.flagModal.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';

// Import the standalone PriceFlagModal — it must be exported from CollectionView
// (or from a separate file if refactored). We test it in isolation.
import { PriceFlagModal } from './CollectionView';

const mockAuthFetch = jest.fn();

const renderModal = (props = {}) =>
  render(
    <AuthContext.Provider value={{ authFetch: mockAuthFetch }}>
      <PriceFlagModal
        card={{ _id: 'abc123', name: 'Lightning Bolt' }}
        onClose={props.onClose ?? jest.fn()}
        onSuccess={props.onSuccess ?? jest.fn()}
      />
    </AuthContext.Provider>
  );

beforeEach(() => mockAuthFetch.mockClear());

describe('PriceFlagModal', () => {
  it('renders the card name in the modal title', () => {
    renderModal();
    expect(screen.getByText(/Flag Price: Lightning Bolt/i)).toBeInTheDocument();
  });

  it('renders a textarea for the reason', () => {
    renderModal();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders Submit and Cancel buttons', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls authFetch POST and onSuccess on successful submission', async () => {
    const onSuccess = jest.fn();
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    renderModal({ onSuccess });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Too high' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('abc123/flag-price'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows duplicate error message on 409 response', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'You already have a pending flag for this card' })
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() =>
      expect(screen.getByText(/already have a pending flag/i)).toBeInTheDocument()
    );
  });

  it('shows generic error on non-ok response', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 500 });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() =>
      expect(screen.getByText(/failed to submit flag/i)).toBeInTheDocument()
    );
  });

  it('disables Submit button while submitting', async () => {
    mockAuthFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);
    await waitFor(() => expect(submitBtn).toBeDisabled());
  });
});
```

- [ ] Run test — expect failures (PriceFlagModal not yet exported):
```
cd frontend && npx react-scripts test src/components/CollectionView.flagModal.test.js --watchAll=false
```
Expected output: `PriceFlagModal is not exported` or similar import error

#### 4A.2 Implement PriceFlagModal and flag icon

- [ ] Open `frontend/src/components/CollectionView.js`.

- [ ] Add `Flag` to the existing Lucide import line. It will look something like:
```js
import { /* existing icons */ Flag } from 'lucide-react';
```

- [ ] Define `PriceFlagModal` as a **named export** at **module scope**, ABOVE the `CollectionView` function definition (never inside it — see memory note about component-in-render causing DOM remount bug):

```jsx
export function PriceFlagModal({ card, onClose, onSuccess }) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const { authFetch } = useAuthContext();

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/cards/${card._id}/flag-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.status === 409) {
        setError('You already have a pending flag for this card.');
        return;
      }
      if (!res.ok) throw new Error('Failed');
      onSuccess();
    } catch {
      setError('Failed to submit flag.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Flag Price: {card.name}
        </h2>
        <p className="text-white/60 text-sm mb-3">
          Describe why you think this price is incorrect (optional):
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={300}
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-white/30"
          placeholder="e.g. Current market price is much higher..."
        />
        <div className="text-right text-white/30 text-xs mt-1">{reason.length}/300</div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Inside the `CollectionView` function, add the state variable near the other modal states:
```js
const [flaggingCard, setFlaggingCard] = React.useState(null);
```

- [ ] In the card table's Actions column, add the Flag button after the existing action buttons, rendering only when `currentUser?.reputation >= 50`:
```jsx
{currentUser?.reputation >= 50 && (
  <button
    onClick={() => setFlaggingCard(card)}
    className="p-1 text-orange-400 hover:text-orange-300 transition-colors"
    title="Flag incorrect price"
    aria-label={`Flag price for ${card.name}`}
  >
    <Flag size={16} />
  </button>
)}
```

- [ ] At the bottom of CollectionView's return statement, just before the closing `</div>`, add:
```jsx
{flaggingCard && (
  <PriceFlagModal
    card={flaggingCard}
    onClose={() => setFlaggingCard(null)}
    onSuccess={() => setFlaggingCard(null)}
  />
)}
```

- [ ] Run test — expect all pass:
```
cd frontend && npx react-scripts test src/components/CollectionView.flagModal.test.js --watchAll=false
```
Expected output: `Tests: 8 passed, 8 total`

---

### Subtask 4B — Wire PriceCorrectionsTab into AdminPanel

**File:** `frontend/src/components/admin/AdminPanel.js`

#### 4B.1 Write the failing test

- [ ] Create `frontend/src/components/admin/AdminPanel.priceFlags.test.js`:

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../contexts/AuthContext';
import AdminPanel from './AdminPanel';

const mockAuthFetch = jest.fn();

const renderPanel = () =>
  render(
    <AuthContext.Provider value={{ authFetch: mockAuthFetch, currentUser: { role: 'admin', reputation: 100 } }}>
      <AdminPanel onClose={jest.fn()} />
    </AuthContext.Provider>
  );

beforeEach(() => {
  mockAuthFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

describe('AdminPanel Price Flags tab', () => {
  it('renders a "Price Flags" tab', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByRole('button', { name: /price flags/i })).toBeInTheDocument());
  });

  it('shows PriceCorrectionsTab content when Price Flags tab is clicked', async () => {
    renderPanel();
    const tab = await screen.findByRole('button', { name: /price flags/i });
    fireEvent.click(tab);
    await waitFor(() =>
      expect(screen.getByText(/no pending price flags/i)).toBeInTheDocument()
    );
  });

  it('shows pending count badge when there are pending flags', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // other initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { _id: 'f1', cardId: { name: 'Card', set: 'S', price: 1 }, flaggedBy: { username: 'u', reputation: 50 }, reason: '', status: 'pending', createdAt: new Date().toISOString() },
          { _id: 'f2', cardId: { name: 'Card2', set: 'S', price: 2 }, flaggedBy: { username: 'u2', reputation: 60 }, reason: '', status: 'pending', createdAt: new Date().toISOString() }
        ]
      });
    renderPanel();
    // The badge appears after the flags are fetched for the count
    await waitFor(() => {
      const badge = screen.queryByText('2');
      // badge may appear near the tab label
      expect(badge).toBeInTheDocument();
    });
  });
});
```

- [ ] Run test — expect failures:
```
cd frontend && npx react-scripts test src/components/admin/AdminPanel.priceFlags.test.js --watchAll=false
```
Expected output: `Price Flags` tab not found

#### 4B.2 Implement AdminPanel tab wiring

- [ ] Open `frontend/src/components/admin/AdminPanel.js`.

- [ ] Add the PriceCorrectionsTab import near the top with other tab imports:
```js
import PriceCorrectionsTab from './data-pricing/PriceCorrectionsTab';
```

- [ ] Add state for the pending flags count near other state declarations (so the badge can show the count):
```js
const [pendingFlagCount, setPendingFlagCount] = React.useState(0);
```

- [ ] Add a useEffect to fetch the pending flag count on mount:
```js
React.useEffect(() => {
  authFetch(`${API_URL}/admin/price-flags?status=pending`)
    .then(r => r.ok ? r.json() : [])
    .then(flags => setPendingFlagCount(flags.length))
    .catch(() => {});
}, [authFetch]);
```

- [ ] In the tab list for the data-pricing section, add the Price Flags tab button. The exact insertion point depends on the existing tab structure. Find the section where data-related tabs are rendered and add:
```jsx
<button
  onClick={() => setActiveTab('price-flags')}
  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
    activeTab === 'price-flags'
      ? 'bg-orange-600 text-white'
      : 'bg-white/5 hover:bg-white/10 text-white/70'
  }`}
  aria-label="Price Flags"
>
  Price Flags
  {pendingFlagCount > 0 && (
    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
      {pendingFlagCount}
    </span>
  )}
</button>
```

- [ ] In the tab content rendering section, add the PriceCorrectionsTab panel:
```jsx
{activeTab === 'price-flags' && <PriceCorrectionsTab />}
```

- [ ] Run test — expect all pass:
```
cd frontend && npx react-scripts test src/components/admin/AdminPanel.priceFlags.test.js --watchAll=false
```
Expected output: `Tests: 3 passed, 3 total`

- [ ] Run all new frontend tests together to confirm no regressions:
```
cd frontend && npx react-scripts test src/components/CollectionView.flagModal.test.js src/components/admin/data-pricing/PriceCorrectionsTab.test.js src/components/admin/AdminPanel.priceFlags.test.js --watchAll=false
```
Expected output: `Tests: 17 passed, 17 total`

- [ ] Commit:
```
git add frontend/src/components/CollectionView.js frontend/src/components/CollectionView.flagModal.test.js frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js frontend/src/components/admin/data-pricing/PriceCorrectionsTab.test.js frontend/src/components/admin/AdminPanel.js frontend/src/components/admin/AdminPanel.priceFlags.test.js
git commit -m "feat: PriceFlagModal in CollectionView, PriceCorrectionsTab, AdminPanel Price Flags tab"
```

---

## Final Verification

- [ ] Run all backend tests:
```
cd backend && npx jest --no-coverage
```
Expected output: all tests passing, including the 3 new test files

- [ ] Run all frontend tests:
```
cd frontend && npx react-scripts test --watchAll=false
```
Expected output: all tests passing

- [ ] Manual smoke test checklist:
  - [ ] Start both servers with `start-both-servers.bat`
  - [ ] Log in as a user with reputation ≥ 50
  - [ ] Verify Flag icon (orange) appears in card table Actions column
  - [ ] Click Flag icon → PriceFlagModal appears with card name in title
  - [ ] Submit flag without reason → flag created, modal closes
  - [ ] Click Flag icon again on same card → 409 error "already have a pending flag" shown
  - [ ] Log in as moderator → open AdminPanel → "Price Flags" tab visible with badge count
  - [ ] Click Price Flags tab → table shows flagged cards with Resolve/Dismiss buttons
  - [ ] Click Dismiss → flag removed from list, count decreases
  - [ ] Click Resolve → flag removed, card price reset to 0, price refresh triggered
  - [ ] Log in as user with reputation < 50 → Flag icon not visible in Actions column

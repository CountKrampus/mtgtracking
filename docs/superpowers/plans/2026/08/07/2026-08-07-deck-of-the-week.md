# Deck of the Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-curated weekly deck spotlight — pins a featured deck banner on CommunityDecks for 7 days, auto-posts a forum thread with auto-generated content, and makes "Most Popular" the default sort.

**Architecture:** New `DeckSpotlight` model stores the active spotlight with time-based expiry (`expiresAt`). Three backend routes handle create/read/expire. CommunityDecks fetches the active spotlight on mount and renders a banner. Admins trigger spotlights from CommunityDecks or a new Admin Panel tab. No cron job — expiry is purely time-based.

**Tech Stack:** Node.js/Express/Mongoose (backend), React + Tailwind (frontend), existing `deckAnalysis.js` utils for power level, existing `ForumThread`/`ForumCategory` models for thread creation.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/models/DeckSpotlight.js` | Create | DeckSpotlight schema |
| `backend/routes/deckSpotlight.js` | Create | POST/GET/DELETE routes |
| `backend/server.js` | Modify | Mount `/api/deck-spotlight` router |
| `backend/__tests__/deckSpotlight.test.js` | Create | Route tests |
| `frontend/src/components/CommunityDecks/CommunityDecks.js` | Modify | Sort default, rename, banner, feature button |
| `frontend/src/components/admin/community/DeckSpotlightTab.js` | Create | Admin tab UI |
| `frontend/src/components/admin/AdminPanel.js` | Modify | Register new tab |

---

## Task 1 — DeckSpotlight Model

**Files:**
- Create: `backend/models/DeckSpotlight.js`

- [ ] **Step 1: Create the model**

```js
// backend/models/DeckSpotlight.js
const mongoose = require('mongoose');

const deckSpotlightSchema = new mongoose.Schema({
  deckId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  featuredAt: { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true },
  threadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread' },
  buildLabel: { type: String, default: 'Community Build' },
  budgetTier: { type: String, default: 'Unknown' },
  totalValue: { type: Number, default: 0 },
});

deckSpotlightSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('DeckSpotlight', deckSpotlightSchema);
```

- [ ] **Step 2: Commit**

```bash
git add backend/models/DeckSpotlight.js
git commit -m "feat: add DeckSpotlight model"
```

---

## Task 2 — Backend Routes

**Files:**
- Create: `backend/routes/deckSpotlight.js`
- Create: `backend/__tests__/deckSpotlight.test.js`

### Helpers used

- `estimatePowerLevel(deck)` and `calculateSaltScore(deck)` from `../utils/deckAnalysis`
- `requireAuth`, `requireAdmin` from `../middleware/auth`
- `ForumThread`, `ForumCategory`, `Card`, `Deck`, `DeckSpotlight` models

### Build label helper

```js
function getBuildLabel(powerLevel) {
  if (powerLevel >= 9) return 'cEDH Build';
  if (powerLevel >= 7) return 'High Power Build';
  if (powerLevel >= 5) return 'Optimized Build';
  if (powerLevel >= 3) return 'Casual Build';
  return 'Jank Build';
}
```

### Budget tier helper

```js
function getBudgetTier(totalValue) {
  if (totalValue < 50)  return 'Budget';
  if (totalValue < 200) return 'Mid-range';
  if (totalValue < 500) return 'Tuned';
  return 'Premium';
}
```

### Total value helper

Looks up stored prices from the Card collection by card name, multiplied by quantity. Cards not in the collection default to $0.

```js
async function computeTotalValue(mainDeck) {
  const names = mainDeck.map(c => c.name);
  const cards = await Card.find({ name: { $in: names } }).select('name price').lean();
  const priceByName = Object.fromEntries(cards.map(c => [c.name, c.price || 0]));
  return mainDeck.reduce((sum, c) => sum + (priceByName[c.name] || 0) * (c.quantity || 1), 0);
}
```

### Thread content helper

```js
function buildThreadContent(deck, owner, buildLabel, budgetTier, totalValue, saltScore) {
  const colorStr = deck.commander?.colorIdentity?.join('') || '?';
  const tagLine = deck.tags?.length ? `\n**Tags:** ${deck.tags.join(', ')}` : '';
  const shareLink = deck.shareCode ? `/decks/share/${deck.shareCode}` : '';
  return [
    `This week's spotlight deck is **${deck.name}** by **@${owner.username}** — a ${budgetTier} ${buildLabel} in the ${deck.format || 'Commander'} format.`,
    '',
    `**Commander:** ${deck.commander?.name || 'Unknown'} (${colorStr})`,
    `**Power Level:** ${buildLabel}`,
    `**Salt Score:** ${saltScore}`,
    `**Total Value:** $${totalValue.toFixed(2)}`,
    `**Card Count:** ${deck.mainDeck?.length || 0} cards`,
    tagLine,
    '',
    shareLink ? `[View this deck →](${shareLink})` : '',
    '',
    '---',
    '*Think a deck deserves a spotlight? Share your deck publicly in the Community Decks section!*',
  ].join('\n').trim();
}
```

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/deckSpotlight.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const DeckSpotlight = require('../models/DeckSpotlight');
const Deck = require('../models/Deck');
const User = require('../models/User');

let adminToken, adminUser, publicDeck;

beforeAll(async () => {
  // Create admin user
  adminUser = await User.create({
    username: 'spotlightadmin',
    email: 'spotlightadmin@test.com',
    password: 'hashedpassword',
    role: 'admin',
  });

  // Sign JWT for admin
  const jwt = require('jsonwebtoken');
  adminToken = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET || 'test-secret');

  // Create a public deck
  publicDeck = await Deck.create({
    userId: adminUser._id,
    name: 'Test Spotlight Deck',
    format: 'Commander',
    isPublic: true,
    mainDeck: [{ name: 'Sol Ring', quantity: 1 }],
    importCount: 5,
  });
});

afterAll(async () => {
  await DeckSpotlight.deleteMany({});
  await Deck.deleteMany({ name: 'Test Spotlight Deck' });
  await User.deleteMany({ username: 'spotlightadmin' });
});

describe('POST /api/deck-spotlight', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app).post('/api/deck-spotlight').send({ deckId: publicDeck._id });
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-public deck', async () => {
    const privateDeck = await Deck.create({
      userId: adminUser._id,
      name: 'Private Deck',
      format: 'Commander',
      isPublic: false,
      mainDeck: [],
    });
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deckId: privateDeck._id });
    expect(res.status).toBe(400);
    await Deck.deleteOne({ _id: privateDeck._id });
  });

  it('creates spotlight and returns 201 for admin with public deck', async () => {
    const res = await request(app)
      .post('/api/deck-spotlight')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deckId: publicDeck._id });
    expect(res.status).toBe(201);
    expect(res.body.deckId.toString()).toBe(publicDeck._id.toString());
    expect(res.body.buildLabel).toBeDefined();
    expect(res.body.budgetTier).toBeDefined();
    const expiresAt = new Date(res.body.expiresAt);
    const diff = expiresAt - Date.now();
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // ~7 days
  });
});

describe('GET /api/deck-spotlight/active', () => {
  it('returns active spotlight', async () => {
    const res = await request(app).get('/api/deck-spotlight/active');
    expect(res.status).toBe(200);
    expect(res.body.spotlight).not.toBeNull();
  });
});

describe('DELETE /api/deck-spotlight/:id', () => {
  it('returns 403 for non-admin', async () => {
    const spotlight = await DeckSpotlight.findOne({});
    const res = await request(app).delete(`/api/deck-spotlight/${spotlight._id}`);
    expect(res.status).toBe(403);
  });

  it('expires spotlight early for admin', async () => {
    const spotlight = await DeckSpotlight.findOne({});
    const res = await request(app)
      .delete(`/api/deck-spotlight/${spotlight._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const updated = await DeckSpotlight.findById(spotlight._id);
    expect(updated.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest __tests__/deckSpotlight.test.js --no-coverage
```
Expected: fail with "Cannot find module '../routes/deckSpotlight'" or route 404s.

- [ ] **Step 3: Create the routes file**

```js
// backend/routes/deckSpotlight.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DeckSpotlight = require('../models/DeckSpotlight');
const Deck = require('../models/Deck');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const Card = require('../models/Card');
const User = require('../models/User');
const { verifyToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { estimatePowerLevel, calculateSaltScore } = require('../utils/deckAnalysis');

router.use(verifyToken);

const COMMUNITY_SPOTLIGHTS_SLUG = 'community-spotlights';
const SPOTLIGHT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getBuildLabel(powerLevel) {
  if (powerLevel >= 9) return 'cEDH Build';
  if (powerLevel >= 7) return 'High Power Build';
  if (powerLevel >= 5) return 'Optimized Build';
  if (powerLevel >= 3) return 'Casual Build';
  return 'Jank Build';
}

function getBudgetTier(totalValue) {
  if (totalValue < 50)  return 'Budget';
  if (totalValue < 200) return 'Mid-range';
  if (totalValue < 500) return 'Tuned';
  return 'Premium';
}

async function computeTotalValue(mainDeck) {
  const names = (mainDeck || []).map(c => c.name);
  if (!names.length) return 0;
  const cards = await Card.find({ name: { $in: names } }).select('name price').lean();
  const priceByName = Object.fromEntries(cards.map(c => [c.name, c.price || 0]));
  return (mainDeck || []).reduce((sum, c) => sum + (priceByName[c.name] || 0) * (c.quantity || 1), 0);
}

function buildThreadContent(deck, owner, buildLabel, budgetTier, totalValue, saltScore) {
  const colorStr = deck.commander?.colorIdentity?.join('') || '?';
  const tagLine = deck.tags?.length ? `\n**Tags:** ${deck.tags.join(', ')}` : '';
  const shareLink = deck.shareCode ? `/decks/share/${deck.shareCode}` : '';
  return [
    `This week's spotlight deck is **${deck.name}** by **@${owner.username}** — a ${budgetTier} ${buildLabel} in the ${deck.format || 'Commander'} format.`,
    '',
    `**Commander:** ${deck.commander?.name || 'Unknown'} (${colorStr})`,
    `**Power Level:** ${buildLabel}`,
    `**Salt Score:** ${saltScore}`,
    `**Total Value:** $${totalValue.toFixed(2)}`,
    `**Card Count:** ${(deck.mainDeck || []).length} cards`,
    tagLine,
    '',
    shareLink ? `[View this deck →](${shareLink})` : '',
    '',
    '---',
    '*Think a deck deserves a spotlight? Share your deck publicly in the Community Decks section!*',
  ].join('\n').trim();
}

async function ensureSpotlightsCategory() {
  let category = await ForumCategory.findOne({ slug: COMMUNITY_SPOTLIGHTS_SLUG });
  if (!category) {
    category = await ForumCategory.create({
      name: 'Community Spotlights',
      slug: COMMUNITY_SPOTLIGHTS_SLUG,
      description: 'Weekly featured decks and community highlights.',
    });
  }
  return category;
}

// POST /api/deck-spotlight — feature a deck (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { deckId } = req.body;
    if (!deckId) return res.status(400).json({ message: 'deckId is required' });

    const deck = await Deck.findById(deckId).populate('userId', 'username displayName').lean();
    if (!deck) return res.status(400).json({ message: 'Deck not found' });
    if (!deck.isPublic) return res.status(400).json({ message: 'Deck must be public to spotlight' });

    const powerLevel = estimatePowerLevel(deck);
    const saltScore  = calculateSaltScore(deck);
    const buildLabel = getBuildLabel(powerLevel);
    const totalValue = await computeTotalValue(deck.mainDeck);
    const budgetTier = getBudgetTier(totalValue);

    const category = await ensureSpotlightsCategory();
    const owner = deck.userId;
    const content = buildThreadContent(deck, owner, buildLabel, budgetTier, totalValue, saltScore);

    const thread = await ForumThread.create({
      categoryId: category._id,
      authorId: req.user._id,
      title: `🌟 Deck of the Week: ${deck.name} — ${budgetTier} ${buildLabel}`,
      content,
      contentFormat: 'markdown',
      tags: ['deck-spotlight', deck.format || 'commander'].map(t => t.toLowerCase()),
    });

    await ForumCategory.findByIdAndUpdate(category._id, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date(),
    });

    const spotlight = await DeckSpotlight.create({
      deckId:     deck._id,
      featuredBy: req.user._id,
      expiresAt:  new Date(Date.now() + SPOTLIGHT_DURATION_MS),
      threadId:   thread._id,
      buildLabel,
      budgetTier,
      totalValue,
    });

    res.status(201).json(spotlight);
  } catch (err) {
    res.status(500).json({ message: 'Error creating spotlight', error: err.message });
  }
});

// GET /api/deck-spotlight/active — public
router.get('/active', async (req, res) => {
  try {
    const spotlight = await DeckSpotlight.findOne({ expiresAt: { $gt: new Date() } })
      .sort({ featuredAt: -1 })
      .populate({
        path: 'deckId',
        select: 'name commander format tags shareCode',
        populate: { path: 'userId', select: 'username displayName' },
      })
      .lean();

    res.json({ spotlight: spotlight || null });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching spotlight', error: err.message });
  }
});

// DELETE /api/deck-spotlight/:id — expire early (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const spotlight = await DeckSpotlight.findById(req.params.id);
    if (!spotlight) return res.status(404).json({ message: 'Spotlight not found' });

    spotlight.expiresAt = new Date();
    await spotlight.save();

    res.json({ message: 'Spotlight expired', spotlight });
  } catch (err) {
    res.status(500).json({ message: 'Error expiring spotlight', error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the router in server.js**

In `backend/server.js`, after the existing route mounts (around line 160), add:

```js
app.use('/api/deck-spotlight', require('./routes/deckSpotlight'));
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npx jest __tests__/deckSpotlight.test.js --no-coverage
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/models/DeckSpotlight.js backend/routes/deckSpotlight.js backend/server.js backend/__tests__/deckSpotlight.test.js
git commit -m "feat: add DeckSpotlight model, routes, and server mount"
```

---

## Task 3 — CommunityDecks: Sort Rename + Default

**Files:**
- Modify: `frontend/src/components/CommunityDecks/CommunityDecks.js`

The current sort dropdown has `useState('newest')` default and `<option value="imported">Most Imported</option>`.

- [ ] **Step 1: Change default sort and rename option**

Find and change:
```js
const [sort, setSort] = useState('newest');
```
to:
```js
const [sort, setSort] = useState('imported');
```

Find and change:
```html
<option value="imported">Most Imported</option>
```
to:
```html
<option value="imported">Most Popular</option>
```

- [ ] **Step 2: Verify in browser**

Start both servers with `start-both-servers.bat`. Open the Community Decks page. Confirm decks are sorted by most popular by default and the dropdown reads "Most Popular".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CommunityDecks/CommunityDecks.js
git commit -m "feat: make Most Popular the default sort on Community Decks"
```

---

## Task 4 — CommunityDecks: Spotlight Banner + Feature Button

**Files:**
- Modify: `frontend/src/components/CommunityDecks/CommunityDecks.js`

- [ ] **Step 1: Add spotlight state and fetch**

At the top of the `CommunityDecks` component, alongside existing `useAuthContext`:

```js
const { user: authUser, authFetch } = useAuthContext();
const [spotlight, setSpotlight] = useState(null);
const [spotlightLoading, setSpotlightLoading] = useState(true);

useEffect(() => {
  fetch('/api/deck-spotlight/active')
    .then(r => r.json())
    .then(data => setSpotlight(data.spotlight))
    .catch(() => {})
    .finally(() => setSpotlightLoading(false));
}, []);

const handleFeatureDeck = async (deckId) => {
  try {
    const res = await authFetch('/api/deck-spotlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to feature deck');
      return;
    }
    // Refresh active spotlight
    const activeRes = await fetch('/api/deck-spotlight/active');
    const activeData = await activeRes.json();
    setSpotlight(activeData.spotlight);
  } catch {
    alert('Failed to feature deck');
  }
};

const handleRemoveSpotlight = async () => {
  if (!spotlight) return;
  try {
    await authFetch(`/api/deck-spotlight/${spotlight._id}`, { method: 'DELETE' });
    setSpotlight(null);
  } catch {
    alert('Failed to remove spotlight');
  }
};
```

- [ ] **Step 2: Add spotlight banner above the deck grid**

Directly above the deck grid (after the filters, before the deck list), add:

```jsx
{!spotlightLoading && spotlight && (
  <div className="mb-6 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 backdrop-blur">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <span className="text-sm font-semibold uppercase tracking-wide text-yellow-300">Deck of the Week</span>
        </div>
        <h3 className="text-lg font-bold text-white">{spotlight.deckId?.name}</h3>
        <p className="mt-0.5 text-sm text-white/70">
          {spotlight.budgetTier} {spotlight.buildLabel}
          {spotlight.deckId?.commander?.name && ` · ${spotlight.deckId.commander.name}`}
          {spotlight.deckId?.userId?.username && ` · by @${spotlight.deckId.userId.username}`}
        </p>
        <div className="mt-2 flex gap-2">
          {spotlight.deckId?.shareCode && (
            <button
              onClick={() => setViewingShareCode(spotlight.deckId.shareCode)}
              className="rounded-lg bg-yellow-400/20 px-3 py-1 text-sm text-yellow-200 hover:bg-yellow-400/30"
            >
              View Deck
            </button>
          )}
          {spotlight.threadId && (
            <a
              href={`/forum/thread/${spotlight.threadId}`}
              className="rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70 hover:bg-white/20"
            >
              Discussion →
            </a>
          )}
        </div>
      </div>
      {authUser?.role === 'admin' && (
        <button
          onClick={handleRemoveSpotlight}
          className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"
          title="Remove spotlight"
        >
          ✕ Remove
        </button>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add "Feature this deck" button to each deck card**

Inside the deck card component (wherever the deck actions are rendered), add a star button visible only to admins:

```jsx
{authUser?.role === 'admin' && (
  <button
    onClick={() => handleFeatureDeck(deck._id)}
    title="Feature as Deck of the Week"
    className="rounded p-1 text-yellow-400/60 hover:text-yellow-300"
  >
    ⭐
  </button>
)}
```

- [ ] **Step 4: Verify in browser**

With both servers running, confirm:
- The spotlight banner appears when a spotlight is active
- "View Deck" opens the SharedDeckView
- Admin star button appears on each deck card
- Clicking star on a deck creates a spotlight and shows the banner
- "✕ Remove" button expires the spotlight and hides the banner

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommunityDecks/CommunityDecks.js
git commit -m "feat: add deck-of-the-week spotlight banner and admin feature button to CommunityDecks"
```

---

## Task 5 — Admin Panel: Deck Spotlight Tab

**Files:**
- Create: `frontend/src/components/admin/community/DeckSpotlightTab.js`
- Modify: `frontend/src/components/admin/AdminPanel.js` (add tab registration)

- [ ] **Step 1: Create the tab component**

```jsx
// frontend/src/components/admin/community/DeckSpotlightTab.js
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';

export default function DeckSpotlightTab() {
  const { authFetch } = useAuthContext();
  const [spotlight, setSpotlight] = useState(null);
  const [decks, setDecks] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [loading, setLoading] = useState(true);
  const [featuring, setFeaturing] = useState(false);

  useEffect(() => {
    fetch('/api/deck-spotlight/active')
      .then(r => r.json())
      .then(d => setSpotlight(d.spotlight))
      .finally(() => setLoading(false));
    // Load all public decks for the picker
    fetch('/api/decks/community?sort=imported&limit=200')
      .then(r => r.json())
      .then(d => setDecks(d.decks || []));
  }, []);

  const filteredDecks = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.commander?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const daysLeft = spotlight
    ? Math.max(0, Math.ceil((new Date(spotlight.expiresAt) - Date.now()) / 86400000))
    : 0;

  const handleFeature = async () => {
    if (!selectedDeckId) return;
    if (spotlight && !window.confirm('Replace the current spotlight?')) return;
    setFeaturing(true);
    try {
      if (spotlight) {
        await authFetch(`/api/deck-spotlight/${spotlight._id}`, { method: 'DELETE' });
      }
      const res = await authFetch('/api/deck-spotlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Failed'); return; }
      const activeRes = await fetch('/api/deck-spotlight/active');
      const activeData = await activeRes.json();
      setSpotlight(activeData.spotlight);
      setSelectedDeckId('');
    } catch {
      alert('Failed to feature deck');
    } finally {
      setFeaturing(false);
    }
  };

  const handleRemove = async () => {
    if (!spotlight || !window.confirm('Remove current spotlight?')) return;
    await authFetch(`/api/deck-spotlight/${spotlight._id}`, { method: 'DELETE' });
    setSpotlight(null);
  };

  if (loading) return <p className="p-4 text-white/50">Loading…</p>;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-lg font-bold text-white">Deck of the Week</h2>

      {/* Current spotlight */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Current Spotlight</h3>
        {spotlight ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-white">{spotlight.deckId?.name}</p>
              <p className="mt-0.5 text-sm text-white/60">
                {spotlight.budgetTier} {spotlight.buildLabel} · Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </p>
              {spotlight.threadId && (
                <a href={`/forum/thread/${spotlight.threadId}`} className="mt-1 block text-xs text-indigo-400 hover:underline">
                  View Forum Thread →
                </a>
              )}
            </div>
            <button
              onClick={handleRemove}
              className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/40">No active spotlight.</p>
        )}
      </div>

      {/* Feature a deck */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Feature a Deck</h3>
        <input
          type="text"
          placeholder="Search by deck name or commander…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
        />
        <select
          value={selectedDeckId}
          onChange={e => setSelectedDeckId(e.target.value)}
          className="mb-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none"
          size={5}
        >
          <option value="">— select a deck —</option>
          {filteredDecks.map(d => (
            <option key={d._id} value={d._id}>
              {d.name}{d.commander?.name ? ` · ${d.commander.name}` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={handleFeature}
          disabled={!selectedDeckId || featuring}
          className="w-full rounded-lg bg-yellow-500/80 py-2 text-sm font-semibold text-black disabled:opacity-40 hover:bg-yellow-400"
        >
          {featuring ? 'Featuring…' : '⭐ Feature this deck'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the tab in AdminPanel.js**

Find where community tabs are defined in `AdminPanel.js` (look for existing tabs like `BadgesTab`, `FeedbackTab`, `ChallengesTab`). Add `DeckSpotlightTab` alongside them:

```js
import DeckSpotlightTab from './community/DeckSpotlightTab';
```

Then in the tab list for the Community section, add an entry:
```js
{ id: 'deck-spotlight', label: 'Deck Spotlight', component: DeckSpotlightTab }
```

(Match the exact structure of how other tabs are registered in AdminPanel — look at how `BadgesTab` or `FeedbackTab` is added as a reference.)

- [ ] **Step 3: Verify in browser**

Navigate to Admin Panel → Community → Deck Spotlight. Confirm:
- Current spotlight shows with correct deck name, label, days remaining
- Search filters the deck list
- Selecting a deck and clicking "Feature this deck" creates a spotlight
- Replacing an active spotlight shows a confirmation prompt

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/community/DeckSpotlightTab.js frontend/src/components/admin/AdminPanel.js
git commit -m "feat: add Deck Spotlight tab to Admin Panel community section"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `DeckSpotlight` model with all fields — Task 1
- ✅ `POST /api/deck-spotlight` validates public deck, computes labels, creates thread and spotlight — Task 2
- ✅ `GET /api/deck-spotlight/active` time-based expiry query — Task 2
- ✅ `DELETE /api/deck-spotlight/:id` expires early — Task 2
- ✅ "Community Spotlights" category auto-created — Task 2 (`ensureSpotlightsCategory`)
- ✅ Thread title format: `🌟 Deck of the Week: [Name] — [Budget] [Label]` — Task 2
- ✅ Thread content with commander, power level, salt score, value, card count, tags, share link — Task 2
- ✅ Sort renamed to "Most Popular" and set as default — Task 3
- ✅ Spotlight banner on CommunityDecks with View Deck + Discussion links — Task 4
- ✅ Admin "⭐ Feature" button on each deck card — Task 4
- ✅ Admin "✕ Remove" on banner — Task 4
- ✅ Admin Panel Deck Spotlight tab with current spotlight + deck picker — Task 5
- ✅ Replace confirmation dialog — Task 5

**Placeholder scan:** No TBDs or vague steps found.

**Type consistency:**
- `spotlight._id` used in DELETE calls matches `DeckSpotlight` `_id` — ✅
- `spotlight.deckId` populated object matches `.populate('deckId', ...)` in GET route — ✅
- `buildLabel`, `budgetTier`, `totalValue` set on create and read on GET — ✅
- `handleFeatureDeck(deck._id)` in CommunityDecks, `{ deckId }` in POST body — ✅

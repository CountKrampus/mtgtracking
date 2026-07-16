# Trading Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a peer-to-peer trading board where users post "have" and "want" card listings, browse others' listings, and exchange structured trade offers with accept/reject/counter flow.

**Architecture:** Two Mongoose models (`TradeListing`, `TradeOffer`) in `backend/models/`, a dedicated route file `backend/routes/trades.js` registered in `server.js`, a React context `TradesContext.js`, and a `TradingBoard.js` component with four tabs (Browse, My Listings, Offers Received, Offers Sent). Notifications reuse the existing `Notification` model with four new type values.

**Tech Stack:** Node.js + Express + Mongoose, React + Tailwind CSS + Lucide React, `authFetch` from `AuthContext`, `useAuthContext` hook pattern.

---

## File Map

**Create:**
- `backend/models/TradeListing.js`
- `backend/models/TradeOffer.js`
- `backend/routes/trades.js`
- `frontend/src/contexts/TradesContext.js`
- `frontend/src/components/TradingBoard.js`

**Modify:**
- `backend/models/Notification.js` — add 4 trade notification types to enum, add `tradeOfferId` field
- `backend/server.js` — register `app.use('/api/trades', require('./routes/trades'))`
- `frontend/src/App.js` — import TradingBoard + TradesProvider, add nav button, add view render

---

### Task 1: Backend Models

**Files:**
- Create: `backend/models/TradeListing.js`
- Create: `backend/models/TradeOffer.js`
- Modify: `backend/models/Notification.js`

- [ ] **Step 1: Create TradeListing model**

Create `backend/models/TradeListing.js`:

```js
const mongoose = require('mongoose');

const tradeListingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true },
  type: { type: String, enum: ['have', 'want'], required: true },
  cardName: { type: String, required: true },
  cardSet: { type: String, default: '' },
  cardSetCode: { type: String, default: '' },
  scryfallId: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  quantity: { type: Number, default: 1, min: 1 },
  estimatedValue: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

tradeListingSchema.index({ status: 1, type: 1, createdAt: -1 });
tradeListingSchema.index({ userId: 1, status: 1 });

tradeListingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TradeListing', tradeListingSchema);
```

- [ ] **Step 2: Create TradeOffer model**

Create `backend/models/TradeOffer.js`:

```js
const mongoose = require('mongoose');

const offeredCardSchema = new mongoose.Schema({
  cardName: { type: String, required: true },
  cardSet: { type: String, default: '' },
  condition: { type: String, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'], default: 'NM' },
  quantity: { type: Number, default: 1 },
  estimatedValue: { type: Number, default: 0 },
  scryfallId: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
}, { _id: false });

const tradeOfferSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeListing', required: true, index: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromUsername: { type: String, required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toUsername: { type: String, required: true },
  offeredCards: [offeredCardSchema],
  message: { type: String, default: '', maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'countered'],
    default: 'pending',
    index: true,
  },
  counterOffer: {
    offeredCards: [offeredCardSchema],
    message: { type: String, default: '' },
    createdAt: { type: Date },
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

tradeOfferSchema.index({ toUserId: 1, status: 1 });
tradeOfferSchema.index({ fromUserId: 1, status: 1 });

tradeOfferSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TradeOffer', tradeOfferSchema);
```

- [ ] **Step 3: Extend Notification model**

Read `backend/models/Notification.js`. Find the `type` enum:
```js
enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert'],
```
Change to:
```js
enum: ['mention', 'reply', 'upvote', 'dm', 'price_alert', 'trade_offer', 'trade_accepted', 'trade_rejected', 'trade_countered'],
```

Add `tradeOfferId` field after the `cardId` field:
```js
tradeOfferId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'TradeOffer',
},
```

- [ ] **Step 4: Verify models load**

```powershell
cd "d:\Card Tracker\mtg-tracker\backend"
node -e "require('./models/TradeListing'); require('./models/TradeOffer'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```powershell
cd "d:\Card Tracker\mtg-tracker"
git add backend/models/TradeListing.js backend/models/TradeOffer.js backend/models/Notification.js
git commit -m "feat: add TradeListing and TradeOffer models, extend Notification types for trades"
```

---

### Task 2: Listing Routes + Server Registration

**Files:**
- Create: `backend/routes/trades.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create routes/trades.js with listing CRUD**

Create `backend/routes/trades.js`:

```js
const express = require('express');
const router = express.Router();
const TradeListing = require('../models/TradeListing');
const TradeOffer = require('../models/TradeOffer');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

// GET /api/trades — browse active listings
// Query: ?type=have|want&card=name&condition=NM&limit=20&offset=0
router.get('/', async (req, res) => {
  try {
    const { type, card, condition, limit = 20, offset = 0 } = req.query;
    const filter = { status: 'active' };
    if (type === 'have' || type === 'want') filter.type = type;
    if (condition) filter.condition = condition;
    if (card) filter.cardName = { $regex: card, $options: 'i' };

    const [listings, total] = await Promise.all([
      TradeListing.find(filter).sort({ createdAt: -1 }).skip(Number(offset)).limit(Number(limit)).lean(),
      TradeListing.countDocuments(filter),
    ]);

    res.json({ listings, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/my-listings
router.get('/my-listings', requireAuth, async (req, res) => {
  try {
    const listings = await TradeListing.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trades — create listing
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, cardName, cardSet, cardSetCode, scryfallId, imageUrl, condition, quantity, estimatedValue, notes } = req.body;
    if (!type || !cardName) return res.status(400).json({ message: 'type and cardName are required' });

    const listing = new TradeListing({
      userId: req.user._id,
      username: req.user.username,
      type, cardName,
      cardSet: cardSet || '',
      cardSetCode: cardSetCode || '',
      scryfallId: scryfallId || '',
      imageUrl: imageUrl || '',
      condition: condition || 'NM',
      quantity: quantity || 1,
      estimatedValue: estimatedValue || 0,
      notes: notes || '',
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/trades/:id — cancel listing (must be owner)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const listing = await TradeListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your listing' });

    listing.status = 'cancelled';
    await listing.save();
    await TradeOffer.updateMany({ listingId: listing._id, status: 'pending' }, { status: 'cancelled' });

    res.json({ message: 'Listing cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/offers/received
router.get('/offers/received', requireAuth, async (req, res) => {
  try {
    const offers = await TradeOffer.find({ toUserId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('listingId', 'cardName type condition quantity imageUrl')
      .lean();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trades/offers/sent
router.get('/offers/sent', requireAuth, async (req, res) => {
  try {
    const offers = await TradeOffer.find({ fromUserId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('listingId', 'cardName type condition quantity imageUrl')
      .lean();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/trades/:listingId/offers — make an offer
router.post('/:listingId/offers', requireAuth, async (req, res) => {
  try {
    const listing = await TradeListing.findById(req.params.listingId);
    if (!listing || listing.status !== 'active') return res.status(404).json({ message: 'Listing not found or no longer active' });
    if (listing.userId.toString() === req.user._id.toString()) return res.status(400).json({ message: 'Cannot offer on your own listing' });

    const { offeredCards, message } = req.body;
    if (!offeredCards || offeredCards.length === 0) return res.status(400).json({ message: 'Must offer at least one card' });

    const offer = new TradeOffer({
      listingId: listing._id,
      fromUserId: req.user._id,
      fromUsername: req.user.username,
      toUserId: listing.userId,
      toUsername: listing.username,
      offeredCards,
      message: message || '',
    });
    await offer.save();

    await Notification.create({
      userId: listing.userId,
      type: 'trade_offer',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} made a trade offer on your "${listing.cardName}" listing`,
    });

    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/accept
router.put('/offers/:offerId/accept', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to accept' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    offer.status = 'accepted';
    await offer.save();

    await TradeListing.findByIdAndUpdate(offer.listingId, { status: 'completed' });
    await TradeOffer.updateMany({ listingId: offer.listingId, _id: { $ne: offer._id }, status: 'pending' }, { status: 'cancelled' });

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_accepted',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} accepted your trade offer!`,
    });

    res.json({ message: 'Offer accepted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/reject
router.put('/offers/:offerId/reject', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to reject' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    offer.status = 'rejected';
    await offer.save();

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_rejected',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} declined your trade offer.`,
    });

    res.json({ message: 'Offer rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/counter
router.put('/offers/:offerId/counter', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.toUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer to counter' });
    if (offer.status !== 'pending') return res.status(400).json({ message: 'Offer is no longer pending' });

    const { offeredCards, message } = req.body;
    if (!offeredCards || offeredCards.length === 0) return res.status(400).json({ message: 'Must include cards in counter offer' });

    offer.status = 'countered';
    offer.counterOffer = { offeredCards, message: message || '', createdAt: new Date() };
    await offer.save();

    await Notification.create({
      userId: offer.fromUserId,
      type: 'trade_countered',
      fromUserId: req.user._id,
      tradeOfferId: offer._id,
      content: `${req.user.username} countered your trade offer.`,
    });

    res.json({ message: 'Counter offer sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/trades/offers/:offerId/cancel — cancel own offer
router.put('/offers/:offerId/cancel', requireAuth, async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.fromUserId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your offer' });
    if (!['pending', 'countered'].includes(offer.status)) return res.status(400).json({ message: 'Cannot cancel this offer' });

    offer.status = 'cancelled';
    await offer.save();
    res.json({ message: 'Offer cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register in server.js**

Read `backend/server.js`. Find where other route files are registered (search for `app.use('/api/forum'` or similar). Add alongside them:

```js
app.use('/api/trades', require('./routes/trades'));
```

- [ ] **Step 3: Verify server loads**

```powershell
cd "d:\Card Tracker\mtg-tracker\backend"
node -e "require('./server.js')" 2>&1 | Select-Object -First 8
```

Expected: No errors about trades routes. `Server running on port 5000` appears.

- [ ] **Step 4: Commit**

```powershell
cd "d:\Card Tracker\mtg-tracker"
git add backend/routes/trades.js backend/server.js
git commit -m "feat: add all trade listing and offer routes (CRUD, accept, reject, counter, cancel)"
```

---

### Task 3: Frontend Context

**Files:**
- Create: `frontend/src/contexts/TradesContext.js`

- [ ] **Step 1: Create TradesContext**

Create `frontend/src/contexts/TradesContext.js`:

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from './AuthContext';
import { API_URL } from '../config';

const TradesContext = createContext(null);

const LIMIT = 20;

export function TradesProvider({ children }) {
  const { authFetch, user } = useAuthContext();

  const [listings, setListings] = useState([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [myListings, setMyListings] = useState([]);
  const [offersReceived, setOffersReceived] = useState([]);
  const [offersSent, setOffersSent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterType, setFilterType] = useState('all');
  const [filterCard, setFilterCard] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [offset, setOffset] = useState(0);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset });
      if (filterType !== 'all') params.set('type', filterType);
      if (filterCard) params.set('card', filterCard);
      if (filterCondition) params.set('condition', filterCondition);
      const res = await fetch(`${API_URL}/trades?${params}`);
      const data = await res.json();
      setListings(data.listings || []);
      setListingsTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCard, filterCondition, offset]);

  const fetchMyListings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`${API_URL}/trades/my-listings`);
      setMyListings(await res.json());
    } catch (err) {
      console.error('fetchMyListings:', err);
    }
  }, [authFetch, user]);

  const fetchOffers = useCallback(async () => {
    if (!user) return;
    try {
      const [recv, sent] = await Promise.all([
        authFetch(`${API_URL}/trades/offers/received`).then(r => r.json()),
        authFetch(`${API_URL}/trades/offers/sent`).then(r => r.json()),
      ]);
      setOffersReceived(Array.isArray(recv) ? recv : []);
      setOffersSent(Array.isArray(sent) ? sent : []);
    } catch (err) {
      console.error('fetchOffers:', err);
    }
  }, [authFetch, user]);

  const createListing = useCallback(async (data) => {
    const res = await authFetch(`${API_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings()]);
  }, [authFetch, fetchListings, fetchMyListings]);

  const cancelListing = useCallback(async (id) => {
    const res = await authFetch(`${API_URL}/trades/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings()]);
  }, [authFetch, fetchListings, fetchMyListings]);

  const makeOffer = useCallback(async (listingId, offeredCards, message) => {
    const res = await authFetch(`${API_URL}/trades/${listingId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeredCards, message }),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await fetchOffers();
  }, [authFetch, fetchOffers]);

  const respondToOffer = useCallback(async (offerId, action, counterData = null) => {
    const res = await authFetch(`${API_URL}/trades/offers/${offerId}/${action}`, {
      method: 'PUT',
      headers: counterData ? { 'Content-Type': 'application/json' } : {},
      body: counterData ? JSON.stringify(counterData) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchOffers(), fetchMyListings(), fetchListings()]);
  }, [authFetch, fetchOffers, fetchMyListings, fetchListings]);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { if (user) { fetchMyListings(); fetchOffers(); } }, [user, fetchMyListings, fetchOffers]);

  const value = useMemo(() => ({
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, error, LIMIT,
    filterType, setFilterType,
    filterCard, setFilterCard,
    filterCondition, setFilterCondition,
    offset, setOffset,
    fetchListings, fetchMyListings, fetchOffers,
    createListing, cancelListing, makeOffer, respondToOffer,
  }), [
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, error, filterType, filterCard, filterCondition, offset,
    fetchListings, fetchMyListings, fetchOffers,
    createListing, cancelListing, makeOffer, respondToOffer,
  ]);

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>;
}

export function useTrades() {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error('useTrades must be used inside TradesProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```powershell
cd "d:\Card Tracker\mtg-tracker"
git add frontend/src/contexts/TradesContext.js
git commit -m "feat: add TradesContext with listing and offer state management"
```

---

### Task 4: TradingBoard Component

**Files:**
- Create: `frontend/src/components/TradingBoard.js`

- [ ] **Step 1: Create component**

Create `frontend/src/components/TradingBoard.js`:

```jsx
import React, { useState } from 'react';
import { ArrowLeftRight, Plus, X, Check, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrades } from '../contexts/TradesContext';
import { useAuthContext } from '../contexts/AuthContext';
import { API_URL } from '../config';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const CONDITION_COLORS = {
  NM: 'text-green-400', LP: 'text-blue-400',
  MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400',
};

function ListingCard({ listing, onOffer, isOwn }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 p-4 flex gap-3">
      {listing.imageUrl && (
        <img src={listing.imageUrl} alt={listing.cardName}
          className="w-14 h-20 object-cover rounded-lg flex-shrink-0 shadow-lg" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{listing.cardName}</p>
            {listing.cardSet && <p className="text-white/50 text-xs">{listing.cardSet}</p>}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
            listing.type === 'have' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {listing.type === 'have' ? 'HAVE' : 'WANT'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-xs font-semibold ${CONDITION_COLORS[listing.condition] || 'text-white/60'}`}>
            {listing.condition}
          </span>
          {listing.quantity > 1 && <span className="text-white/50 text-xs">×{listing.quantity}</span>}
          {listing.estimatedValue > 0 && <span className="text-white/60 text-xs">${listing.estimatedValue.toFixed(2)}</span>}
        </div>
        {listing.notes && <p className="text-white/40 text-xs mt-1 truncate">{listing.notes}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/40 text-xs">by {listing.username}</span>
          {!isOwn && onOffer && listing.status === 'active' && (
            <button onClick={() => onOffer(listing)}
              className="px-3 py-1 bg-purple-600/60 hover:bg-purple-600 text-white text-xs rounded-lg transition">
              Make Offer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateListingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    type: 'have', cardName: '', cardSet: '', condition: 'NM',
    quantity: 1, estimatedValue: '', notes: '',
    scryfallId: '', imageUrl: '',
  });
  const [autocomplete, setAutocomplete] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = async (val) => {
    setForm(f => ({ ...f, cardName: val }));
    if (val.length >= 2) {
      try {
        const res = await fetch(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(val)}`);
        setAutocomplete(await res.json());
      } catch { setAutocomplete([]); }
    } else {
      setAutocomplete([]);
    }
  };

  const selectCard = async (name) => {
    try {
      const res = await fetch(`${API_URL}/scryfall/search?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setForm(f => ({
        ...f,
        cardName: data.name,
        cardSet: data.set || '',
        scryfallId: data.scryfallId || '',
        imageUrl: data.imageUrl || '',
        estimatedValue: data.prices?.usd || '',
      }));
    } catch {}
    setAutocomplete([]);
  };

  const handleSubmit = async () => {
    if (!form.cardName) return;
    setSubmitting(true);
    try {
      await onCreate({ ...form, estimatedValue: parseFloat(form.estimatedValue) || 0 });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-gray-900 border border-white/20 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">Post a Listing</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            {['have', 'want'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  form.type === t
                    ? (t === 'have' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}>
                {t === 'have' ? 'I Have (for trade)' : 'I Want (looking for)'}
              </button>
            ))}
          </div>

          <div className="relative">
            <input value={form.cardName} onChange={e => handleNameChange(e.target.value)}
              placeholder="Card name..."
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              style={{ fontSize: '16px' }} />
            {autocomplete.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-gray-800 border border-white/20 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-2xl">
                {autocomplete.slice(0, 8).map(name => (
                  <button key={name} onClick={() => selectCard(name)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition">
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs mb-1 block">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">Quantity</label>
              <input type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1 block">Estimated Value (USD)</label>
            <input type="number" step="0.01" placeholder="0.00" value={form.estimatedValue}
              onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none" />
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1 block">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Condition details, preferred trades, etc." rows={2}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none resize-none"
              style={{ fontSize: '16px' }} />
          </div>

          <button onClick={handleSubmit} disabled={submitting || !form.cardName}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition">
            {submitting ? 'Posting...' : 'Post Listing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MakeOfferModal({ listing, onClose, onSubmit }) {
  const [cards, setCards] = useState([{ cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateCard = (i, field, val) => setCards(c => c.map((card, idx) => idx === i ? { ...card, [field]: val } : card));

  const handleSubmit = async () => {
    const valid = cards.filter(c => c.cardName.trim());
    if (valid.length === 0) { alert('Add at least one card to offer'); return; }
    setSubmitting(true);
    try {
      await onSubmit(
        listing._id,
        valid.map(c => ({ ...c, estimatedValue: parseFloat(c.estimatedValue) || 0 })),
        message
      );
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-gray-900 border border-white/20 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-900 border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-semibold">Make an Offer</h3>
            <p className="text-white/50 text-xs">for: {listing.cardName}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-white/60 text-sm font-medium">Cards you're offering:</p>
          {cards.map((card, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input value={card.cardName} onChange={e => updateCard(i, 'cardName', e.target.value)}
                  placeholder="Card name"
                  className="flex-1 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none"
                  style={{ fontSize: '16px' }} />
                {cards.length > 1 && (
                  <button onClick={() => setCards(c => c.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"><X size={14} /></button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={card.condition} onChange={e => updateCard(i, 'condition', e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min="1" value={card.quantity}
                  onChange={e => updateCard(i, 'quantity', parseInt(e.target.value) || 1)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                  placeholder="Qty" />
                <input type="number" step="0.01" value={card.estimatedValue}
                  onChange={e => updateCard(i, 'estimatedValue', e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                  placeholder="$" />
              </div>
            </div>
          ))}
          <button onClick={() => setCards(c => [...c, { cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }])}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm">
            <Plus size={14} /> Add another card
          </button>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Message (optional)" rows={2}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none resize-none"
            style={{ fontSize: '16px' }} />
        </div>
        <div className="border-t border-white/10 p-4 flex-shrink-0">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition">
            {submitting ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, mode, onAccept, onReject, onCounter, onCancel }) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterCards, setCounterCards] = useState([{ cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }]);
  const [counterMessage, setCounterMessage] = useState('');

  const statusColors = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    accepted: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
    cancelled: 'text-white/40 bg-white/5',
    countered: 'text-blue-400 bg-blue-500/10',
  };

  const handleCounter = async () => {
    const valid = counterCards.filter(c => c.cardName.trim());
    if (valid.length === 0) return;
    await onCounter(offer._id, {
      offeredCards: valid.map(c => ({ ...c, estimatedValue: parseFloat(c.estimatedValue) || 0 })),
      message: counterMessage,
    });
    setShowCounter(false);
  };

  return (
    <div className="bg-white/10 rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white text-sm font-semibold">
            {mode === 'received' ? `From: ${offer.fromUsername}` : `To: ${offer.toUsername}`}
          </p>
          {offer.listingId && (
            <p className="text-white/50 text-xs">For: {offer.listingId.cardName}</p>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${statusColors[offer.status] || ''}`}>
          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
        </span>
      </div>

      <div>
        <p className="text-white/60 text-xs mb-1">Offering:</p>
        <div className="flex flex-wrap gap-1">
          {offer.offeredCards.map((card, i) => (
            <span key={i} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded">
              {card.quantity > 1 ? `${card.quantity}× ` : ''}{card.cardName} ({card.condition})
              {card.estimatedValue > 0 ? ` $${card.estimatedValue.toFixed(2)}` : ''}
            </span>
          ))}
        </div>
      </div>

      {offer.message && <p className="text-white/50 text-xs italic">"{offer.message}"</p>}

      {offer.status === 'countered' && offer.counterOffer && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-blue-400 text-xs font-semibold mb-1">Counter offer:</p>
          <div className="flex flex-wrap gap-1">
            {offer.counterOffer.offeredCards.map((card, i) => (
              <span key={i} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded">
                {card.quantity > 1 ? `${card.quantity}× ` : ''}{card.cardName} ({card.condition})
              </span>
            ))}
          </div>
          {offer.counterOffer.message && (
            <p className="text-white/50 text-xs italic mt-1">"{offer.counterOffer.message}"</p>
          )}
        </div>
      )}

      {mode === 'received' && offer.status === 'pending' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onAccept(offer._id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600/60 hover:bg-green-600 text-white text-xs rounded-lg transition">
            <Check size={12} /> Accept
          </button>
          <button onClick={() => setShowCounter(s => !s)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/60 hover:bg-blue-600 text-white text-xs rounded-lg transition">
            <RotateCcw size={12} /> Counter
          </button>
          <button onClick={() => onReject(offer._id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/60 hover:bg-red-600 text-white text-xs rounded-lg transition">
            <X size={12} /> Reject
          </button>
        </div>
      )}

      {mode === 'sent' && ['pending', 'countered'].includes(offer.status) && (
        <button onClick={() => onCancel(offer._id)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 text-xs rounded-lg transition">
          Cancel Offer
        </button>
      )}

      {showCounter && (
        <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10">
          <p className="text-white/60 text-xs font-semibold">Your counter offer:</p>
          {counterCards.map((card, i) => (
            <div key={i} className="space-y-1">
              <input value={card.cardName}
                onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, cardName: e.target.value } : c))}
                placeholder="Card name"
                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none"
                style={{ fontSize: '16px' }} />
              <div className="grid grid-cols-3 gap-2">
                <select value={card.condition}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, condition: e.target.value } : c))}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min="1" value={card.quantity}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, quantity: parseInt(e.target.value) || 1 } : c))}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
                <input type="number" step="0.01" value={card.estimatedValue}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, estimatedValue: e.target.value } : c))}
                  placeholder="$" className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
              </div>
            </div>
          ))}
          <button onClick={() => setCounterCards(cs => [...cs, { cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }])}
            className="text-purple-400 text-xs">+ Add card</button>
          <textarea value={counterMessage} onChange={e => setCounterMessage(e.target.value)}
            placeholder="Message..." rows={2}
            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs resize-none"
            style={{ fontSize: '16px' }} />
          <button onClick={handleCounter}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition">
            Send Counter
          </button>
        </div>
      )}
    </div>
  );
}

export default function TradingBoard() {
  const { user } = useAuthContext();
  const {
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, LIMIT,
    filterType, setFilterType, filterCard, setFilterCard,
    filterCondition, setFilterCondition, offset, setOffset,
    createListing, cancelListing, makeOffer, respondToOffer,
  } = useTrades();

  const [activeTab, setActiveTab] = useState('browse');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [offerTarget, setOfferTarget] = useState(null);

  const pendingReceived = offersReceived.filter(o => o.status === 'pending').length;

  const tabs = [
    { id: 'browse', label: 'Browse' },
    { id: 'mine', label: 'My Listings' },
    { id: 'received', label: pendingReceived > 0 ? `Received (${pendingReceived})` : 'Received' },
    { id: 'sent', label: 'Sent' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={20} className="text-green-400" />
          <h2 className="text-xl font-bold text-white">Trading Board</h2>
        </div>
        {user && (
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/60 hover:bg-green-600 text-white text-sm rounded-lg transition">
            <Plus size={15} /> Post Listing
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-white/5 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition ${
              activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={filterCard} onChange={e => { setFilterCard(e.target.value); setOffset(0); }}
              placeholder="Search card name..."
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none"
              style={{ fontSize: '16px' }} />
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
              <option value="all">All Types</option>
              <option value="have">Have (for trade)</option>
              <option value="want">Want (looking for)</option>
            </select>
            <select value={filterCondition} onChange={e => { setFilterCondition(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
              <option value="">All Conditions</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
            </div>
          ) : listings.length === 0 ? (
            <p className="text-white/40 text-center py-12">No listings found. Be the first to post one!</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {listings.map(l => (
                  <ListingCard key={l._id} listing={l}
                    isOwn={user && l.userId === user._id?.toString()}
                    onOffer={user ? setOfferTarget : null} />
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-white/40 text-sm">{listingsTotal} listing{listingsTotal !== 1 ? 's' : ''}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg transition">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-white/60 text-sm">
                    {Math.floor(offset / LIMIT) + 1} / {Math.max(1, Math.ceil(listingsTotal / LIMIT))}
                  </span>
                  <button onClick={() => setOffset(o => o + LIMIT)} disabled={offset + LIMIT >= listingsTotal}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg transition">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-3">
          {!user ? (
            <p className="text-white/40 text-center py-8">Sign in to manage your listings</p>
          ) : myListings.length === 0 ? (
            <p className="text-white/40 text-center py-8">No listings yet. Click "Post Listing" to add one.</p>
          ) : (
            myListings.map(l => (
              <div key={l._id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <ListingCard listing={l} isOwn />
                </div>
                {l.status === 'active' ? (
                  <button onClick={() => cancelListing(l._id)}
                    className="p-2 bg-red-600/40 hover:bg-red-600 text-white rounded-lg transition flex-shrink-0"
                    title="Cancel listing">
                    <X size={15} />
                  </button>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                    l.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {l.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'received' && (
        <div className="space-y-3">
          {offersReceived.length === 0 ? (
            <p className="text-white/40 text-center py-8">No offers received yet</p>
          ) : (
            offersReceived.map(o => (
              <OfferCard key={o._id} offer={o} mode="received"
                onAccept={id => respondToOffer(id, 'accept')}
                onReject={id => respondToOffer(id, 'reject')}
                onCounter={(id, data) => respondToOffer(id, 'counter', data)}
                onCancel={null} />
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="space-y-3">
          {offersSent.length === 0 ? (
            <p className="text-white/40 text-center py-8">No offers sent yet</p>
          ) : (
            offersSent.map(o => (
              <OfferCard key={o._id} offer={o} mode="sent"
                onAccept={null} onReject={null} onCounter={null}
                onCancel={id => respondToOffer(id, 'cancel')} />
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateListingModal onClose={() => setShowCreateModal(false)} onCreate={createListing} />
      )}
      {offerTarget && (
        <MakeOfferModal listing={offerTarget} onClose={() => setOfferTarget(null)} onSubmit={makeOffer} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```powershell
cd "d:\Card Tracker\mtg-tracker\frontend"
$env:CI="false"; npm run build 2>&1 | Select-Object -Last 10
```

Expected: `Compiled successfully.`

- [ ] **Step 3: Commit**

```powershell
cd "d:\Card Tracker\mtg-tracker"
git add frontend/src/components/TradingBoard.js
git commit -m "feat: add TradingBoard component with browse, my listings, and offer flow"
```

---

### Task 5: Wire into App

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Read App.js to find integration points**

Read `frontend/src/App.js`. Look for:
1. Where view imports live (e.g., `import WishlistView from './components/WishlistView'`)
2. The view state variable (e.g., `activeView` or `showWishlist`)
3. Where header nav buttons are rendered (look for the Wishlist or Deck Builder buttons)
4. Where `<WishlistView />` or `<DeckBuilder />` are rendered conditionally
5. Where `WishlistProvider` wraps the tree (to add `TradesProvider` alongside it)

- [ ] **Step 2: Add imports**

Near the other component/context imports, add:
```js
import TradingBoard from './components/TradingBoard';
import { TradesProvider } from './contexts/TradesContext';
```

Add `ArrowLeftRight` to the lucide-react import line if not present.

- [ ] **Step 3: Add nav button**

In the header button group (near Wishlist / Deck Builder buttons), add:
```jsx
<button
  onClick={() => setActiveView(activeView === 'trading' ? 'collection' : 'trading')}
  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium transition ${
    activeView === 'trading'
      ? 'bg-green-600 text-white'
      : 'bg-white/10 hover:bg-white/20 text-white'
  }`}
>
  <ArrowLeftRight size={16} /> Trading
</button>
```

**Note:** The exact view state variable name must match what's already in App.js. Read Step 1 first to confirm it before writing this code.

- [ ] **Step 4: Add conditional render**

Alongside the other view renders (e.g., `{activeView === 'wishlist' && <WishlistView />}`), add:
```jsx
{activeView === 'trading' && <TradingBoard />}
```

- [ ] **Step 5: Wrap with TradesProvider**

Find where `WishlistProvider` wraps the JSX tree. Wrap `TradesProvider` around the same content (or alongside the other providers):
```jsx
<TradesProvider>
  {/* existing content */}
</TradesProvider>
```

- [ ] **Step 6: Build check**

```powershell
cd "d:\Card Tracker\mtg-tracker\frontend"
$env:CI="false"; npm run build 2>&1 | Select-Object -Last 10
```

Expected: `Compiled successfully.`

- [ ] **Step 7: Commit**

```powershell
cd "d:\Card Tracker\mtg-tracker"
git add frontend/src/App.js
git commit -m "feat: wire TradingBoard into app nav and view system with TradesProvider"
```

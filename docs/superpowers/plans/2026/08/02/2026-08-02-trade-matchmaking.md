# Trade Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Matches" view to the Trading Board showing which of your `have` listings other people currently want, and which of your `want` listings other people currently have — card-name match only (case-insensitive, no set/printing requirement), one-directional (no two-way swap detection), web app only.

**Architecture:** One new backend route (`GET /api/trades/matches`) computes both lists in-memory using the same lowercased-name-set diffing approach already used by `usersPublic.js`'s collection-comparison route. `TradesContext.js` gets a parallel `matches`/`fetchMatches` following the exact shape of its existing `fetchListings`/`fetchMyListings`. `TradingBoard.js` gets a new tab reusing the existing `ListingCard`/`MakeOfferModal` components — no new UI components needed.

**Tech Stack:** Express + Mongoose (backend), React (frontend, no existing test infrastructure — this repo currently has zero frontend test files, so frontend tasks in this plan are verified via `npm run build` + manual smoke test rather than TDD, matching the codebase's actual existing convention).

---

## Task 1: Backend `GET /api/trades/matches`

**Files:**
- Modify: `backend/routes/trades.js`
- Test: `backend/__tests__/trades-matches.test.js` (new — no test file exists yet for `trades.js` at all; this is the first one, scoped only to the new route)

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/trades-matches.test.js
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TradeListing = require('../models/TradeListing');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

function makeToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trades', require('../routes/trades'));
  return app;
}

describe('GET /api/trades/matches', () => {
  let app, me, other;

  beforeEach(async () => {
    app = buildApp();
    me = await User.create({ email: 'me@test.com', username: 'me', passwordHash: 'x', role: 'user' });
    other = await User.create({ email: 'other@test.com', username: 'other', passwordHash: 'x', role: 'user' });
  });

  test('401 without auth', async () => {
    await request(app).get('/api/trades/matches').expect(401);
  });

  test('finds another user\'s want listing matching one of your have listings', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'sol ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(1);
    expect(res.body.havesTheyWant[0].listing.cardName).toBe('Sol Ring');
    expect(res.body.havesTheyWant[0].matches).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches[0].username).toBe('other');
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });

  test('finds another user\'s have listing matching one of your want listings', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'want', cardName: 'Counterspell', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'have', cardName: 'Counterspell', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.wantsTheyHave).toHaveLength(1);
    expect(res.body.wantsTheyHave[0].listing.cardName).toBe('Counterspell');
    expect(res.body.wantsTheyHave[0].matches).toHaveLength(1);
    expect(res.body.havesTheyWant).toHaveLength(0);
  });

  test('omits your own listings from matching against each other', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'want', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });

  test('ignores cancelled/completed listings on both sides', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'Sol Ring', status: 'cancelled',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
  });

  test('groups multiple matching users under the same listing', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'have', cardName: 'Sol Ring', status: 'active',
    });
    const other2 = await User.create({ email: 'other2@test.com', username: 'other2', passwordHash: 'x', role: 'user' });
    await TradeListing.create({
      userId: other._id, username: 'other', type: 'want', cardName: 'Sol Ring', status: 'active',
    });
    await TradeListing.create({
      userId: other2._id, username: 'other2', type: 'want', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(1);
    expect(res.body.havesTheyWant[0].matches).toHaveLength(2);
  });

  test('omits a listing entirely when it has no matches', async () => {
    await TradeListing.create({
      userId: me._id, username: 'me', type: 'have', cardName: 'Sol Ring', status: 'active',
    });

    const res = await request(app)
      .get('/api/trades/matches')
      .set('Authorization', `Bearer ${makeToken(me)}`)
      .expect(200);

    expect(res.body.havesTheyWant).toHaveLength(0);
    expect(res.body.wantsTheyHave).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && timeout 60 npx jest trades-matches --runInBand`
Expected: FAIL — `GET /api/trades/matches` doesn't exist yet (404 on all tests, or the 401 test fails differently since the route isn't registered at all — Express would 404 rather than 401).

- [ ] **Step 3: Implement**

Add to `backend/routes/trades.js`, placed after the existing `GET /my-listings` route (before `GET /offers/received`) — route ordering matters here only in that it must come before any route pattern that could shadow `/matches` as a param (there is none currently, but placing it alongside the other `requireAuth` GET routes keeps the file organized):

```js
// GET /api/trades/matches — cards you have that others want, and cards you want that others have
router.get('/matches', requireAuth, async (req, res) => {
  try {
    const [myHaves, myWants] = await Promise.all([
      TradeListing.find({ userId: req.user._id, status: 'active', type: 'have' }).lean(),
      TradeListing.find({ userId: req.user._id, status: 'active', type: 'want' }).lean(),
    ]);

    const myHaveNames = new Set(myHaves.map(l => l.cardName.toLowerCase()));
    const myWantNames = new Set(myWants.map(l => l.cardName.toLowerCase()));

    const [othersWants, othersHaves] = await Promise.all([
      myHaveNames.size > 0
        ? TradeListing.find({ status: 'active', type: 'want', userId: { $ne: req.user._id } }).lean()
        : [],
      myWantNames.size > 0
        ? TradeListing.find({ status: 'active', type: 'have', userId: { $ne: req.user._id } }).lean()
        : [],
    ]);

    const havesTheyWant = myHaves
      .map(listing => ({
        listing,
        matches: othersWants.filter(w => w.cardName.toLowerCase() === listing.cardName.toLowerCase()),
      }))
      .filter(group => group.matches.length > 0);

    const wantsTheyHave = myWants
      .map(listing => ({
        listing,
        matches: othersHaves.filter(h => h.cardName.toLowerCase() === listing.cardName.toLowerCase()),
      }))
      .filter(group => group.matches.length > 0);

    res.json({ havesTheyWant, wantsTheyHave });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && timeout 60 npx jest trades-matches --runInBand`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && timeout 120 npx jest --runInBand`
Expected: all tests pass (this is a large suite — see prior session notes: ~80-100s runtime, "did not exit one second after..." warning is cosmetic)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/trades.js backend/__tests__/trades-matches.test.js
git commit -m "feat: add GET /api/trades/matches for trade matchmaking"
```

---

## Task 2: `TradesContext.js` — add matches state

**Files:**
- Modify: `frontend/src/contexts/TradesContext.js`

No test infrastructure exists for frontend contexts in this repo — verify via `cd frontend && npm run build` (confirms no syntax/type errors) rather than TDD.

- [ ] **Step 1: Add state and a `fetchMatches` callback**

In `frontend/src/contexts/TradesContext.js`, add new state alongside the existing `listings`/`myListings` state (after line 18, `const [error, setError] = useState(null);`):

```js
  const [matches, setMatches] = useState({ havesTheyWant: [], wantsTheyHave: [] });
```

Add a new callback alongside `fetchMyListings`/`fetchOffers` (after the `fetchOffers` definition, before `createListing`):

```js
  const fetchMatches = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`${API_URL}/trades/matches`);
      const data = await res.json();
      setMatches({
        havesTheyWant: data.havesTheyWant || [],
        wantsTheyHave: data.wantsTheyHave || [],
      });
    } catch (err) {
      console.error('fetchMatches:', err);
    }
  }, [authFetch, user]);
```

- [ ] **Step 2: Wire it into the existing sign-in effect and mutation-triggered refreshes**

Change the existing effect (currently `useEffect(() => { if (user) { fetchMyListings(); fetchOffers(); } }, [user, fetchMyListings, fetchOffers]);`) to also call `fetchMatches`:

```js
  useEffect(() => { if (user) { fetchMyListings(); fetchOffers(); fetchMatches(); } }, [user, fetchMyListings, fetchOffers, fetchMatches]);
```

Also refresh matches after `createListing` and `cancelListing`, since posting or cancelling a listing changes what could match — update both:

```js
  const createListing = useCallback(async (data) => {
    const res = await authFetch(`${API_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings(), fetchMatches()]);
  }, [authFetch, fetchListings, fetchMyListings, fetchMatches]);

  const cancelListing = useCallback(async (id) => {
    const res = await authFetch(`${API_URL}/trades/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings(), fetchMatches()]);
  }, [authFetch, fetchListings, fetchMyListings, fetchMatches]);
```

- [ ] **Step 3: Expose `matches`/`fetchMatches` from the context value**

Update the `useMemo` value object and its dependency array to include `matches` and `fetchMatches`:

```js
  const value = useMemo(() => ({
    listings, listingsTotal, myListings, offersReceived, offersSent, matches,
    loading, error, LIMIT,
    filterType, setFilterType,
    filterCard, setFilterCard,
    filterCondition, setFilterCondition,
    offset, setOffset,
    fetchListings, fetchMyListings, fetchOffers, fetchMatches,
    createListing, cancelListing, makeOffer, respondToOffer,
  }), [
    listings, listingsTotal, myListings, offersReceived, offersSent, matches,
    loading, error, filterType, filterCard, filterCondition, offset,
    fetchListings, fetchMyListings, fetchOffers, fetchMatches,
    createListing, cancelListing, makeOffer, respondToOffer,
  ]);
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds with no new errors/warnings introduced by this change (pre-existing warnings, if any, are not this task's concern).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/TradesContext.js
git commit -m "feat: add matches state and fetchMatches to TradesContext"
```

---

## Task 3: `TradingBoard.js` — add the Matches tab

**Files:**
- Modify: `frontend/src/components/TradingBoard.js`

- [ ] **Step 1: Pull `matches` out of the context hook**

Change the destructuring at the top of the `TradingBoard` component:

```js
  const {
    listings, listingsTotal, myListings, offersReceived, offersSent, matches,
    loading, LIMIT,
    filterType, setFilterType, filterCard, setFilterCard,
    filterCondition, setFilterCondition, offset, setOffset,
    createListing, cancelListing, makeOffer, respondToOffer,
  } = useTrades();
```

- [ ] **Step 2: Add the tab entry**

Update the `tabs` array to insert a `matches` tab right after `mine`, with a badge showing the total match-group count:

```js
  const matchCount = matches.havesTheyWant.length + matches.wantsTheyHave.length;

  const tabs = [
    { id: 'browse', label: 'Browse' },
    { id: 'mine', label: 'My Listings' },
    { id: 'matches', label: matchCount > 0 ? `Matches (${matchCount})` : 'Matches' },
    { id: 'received', label: pendingReceived > 0 ? `Received (${pendingReceived})` : 'Received' },
    { id: 'sent', label: 'Sent' },
  ];
```

- [ ] **Step 3: Add the tab content**

Add a new conditional block, placed after the `activeTab === 'mine'` block and before `activeTab === 'received'`:

```jsx
      {activeTab === 'matches' && (
        <div className="space-y-6">
          {!user ? (
            <p className="text-white/40 text-center py-8">Sign in to see your matches</p>
          ) : matchCount === 0 ? (
            <p className="text-white/40 text-center py-12">No matches right now — list more cards or check back later.</p>
          ) : (
            <>
              {matches.havesTheyWant.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/80 font-semibold text-sm">People want your cards</h3>
                  {matches.havesTheyWant.map(group => (
                    <div key={group.listing._id} className="space-y-2">
                      <ListingCard listing={group.listing} isOwn />
                      <div className="pl-4 space-y-2 border-l-2 border-green-500/30">
                        {group.matches.map(m => (
                          <ListingCard key={m._id} listing={m}
                            onOffer={setOfferTarget}
                            onCompare={setComparisonTarget} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {matches.wantsTheyHave.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/80 font-semibold text-sm">People have your wants</h3>
                  {matches.wantsTheyHave.map(group => (
                    <div key={group.listing._id} className="space-y-2">
                      <ListingCard listing={group.listing} isOwn />
                      <div className="pl-4 space-y-2 border-l-2 border-blue-500/30">
                        {group.matches.map(m => (
                          <ListingCard key={m._id} listing={m}
                            onOffer={setOfferTarget}
                            onCompare={setComparisonTarget} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
```

This reuses `ListingCard` exactly as the `mine`/`browse` tabs already do — no new component needed. `onOffer={setOfferTarget}` and `onCompare={setComparisonTarget}` are the same state setters already used by the `browse` tab, so the existing `MakeOfferModal`/`CollectionComparison` modals at the bottom of the component work unchanged for matched listings too.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds with no new errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TradingBoard.js
git commit -m "feat: add Matches tab to Trading Board"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run the full backend test suite one more time**

Run: `cd backend && timeout 120 npx jest --runInBand`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke test**

Start the app (backend + frontend). Using two different user accounts (or manually inserting `TradeListing` documents via the API/UI):
- Post a `have` listing for "Sol Ring" as User A, then a `want` listing for "Sol Ring" as User B. As User A, open the Trading Board's Matches tab — confirm "People want your cards" shows Sol Ring with User B listed underneath, and "Make Offer" opens the offer modal targeting User B's listing.
- Post a `want` listing as User A for a card User B has listed as `have` — confirm it shows up under "People have your wants" for User A.
- Confirm the Matches tab badge count updates correctly as listings are posted/cancelled.
- Confirm signing out (or viewing as a logged-out visitor) shows the "Sign in to see your matches" message instead of erroring.
- Confirm a user with zero matches sees the empty-state message, not a blank/broken section.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 3) before considering this done.

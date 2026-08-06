# Smart Deck Recommendations (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Recommendations" section to Deck Detail with Ramp/Draw/Removal tabs, defaulting to cards already in the user's collection (toggle to expand to all of Magic), letting the user one-click add owned recommendations to the deck or wishlist unowned ones.

**Architecture:** A new `GET /api/decks/:id/recommendations` route in `backend/routes/decks.js` (not `cardInsights.js` — see spec's file-placement note), reusing `cardInsights.js`'s existing Scryfall-search-plus-EDHREC-ordering pattern and `cachedApiCall` helper. A new "Recommendations" section in `frontend/src/components/DeckDetail.js`, below the Phase 1 Smart Deck Score panel, reusing the existing `POST /:id/add-card` route and the existing `addToWishlist` context function.

**Tech Stack:** Node/Express (backend, TDD via jest), React (frontend, no test infra).

**Spec:** `docs/superpowers/specs/2026-08-06-smart-deck-recommendations-design.md`

---

## Task 1: `GET /api/decks/:id/recommendations` (backend)

**Files:**
- Modify: `backend/routes/decks.js`
- Create: `backend/__tests__/deckRecommendations.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/deckRecommendations.test.js`:

```js
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const axios = require('axios');

jest.mock('axios');

const User = require('../models/User');
const Deck = require('../models/Deck');
const Card = require('../models/Card');
const { verifyToken } = require('../middleware/auth');

let mongoServer;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  // decks.js does not call verifyToken itself (unlike cardInsights.js) - it
  // expects the caller to apply it before mounting, same as
  // deck-stats-power-salt.test.js and deck-sharing.test.js already do.
  a.use(verifyToken);
  const decksRouter = require('../routes/decks');
  decksRouter.injectDependencies(Card, null, null);
  a.use('/api/decks', decksRouter);
  return a;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, 'test-secret');
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
  jest.clearAllMocks();
});

async function makeUser() {
  return User.create({ email: 'u@test.com', username: 'user1', passwordHash: 'x', role: 'editor' });
}

function scryfallCard(overrides) {
  return { id: 'sf-' + Math.random().toString(36).slice(2), name: 'Test Card', mana_cost: '{1}{G}', type_line: 'Sorcery', ...overrides };
}

describe('GET /api/decks/:id/recommendations', () => {
  test('requires a valid category', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    const token = tokenFor(user);

    await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=bogus`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  test('returns Scryfall results filtered to the deck color identity, excluding cards already in the deck', async () => {
    const user = await makeUser();
    const deck = await Deck.create({
      userId: user._id,
      name: 'Test Deck',
      commander: { name: 'Test Commander', colors: ['G'] },
      mainDeck: [{ name: 'Rampant Growth', manaCost: '{1}{G}', types: ['Sorcery'], colors: ['G'], scryfallId: 'already-in-deck' }]
    });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.category).toBe('ramp');
    expect(res.body.scope).toBe('all');
    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate', 'Kodama\'s Reach']);
    const requestedUrl = axios.get.mock.calls[0][0];
    expect(requestedUrl).toContain('id%3C%3Dg'); // id<=g, url-encoded
  });

  test('scope=owned filters results down to cards in the collection by scryfallId', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', scryfallId: 'candidate-1', quantity: 1 });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate']);
    expect(res.body.cards[0].owned).toBe(true);
  });

  test('scope=owned falls back to name matching for collection cards missing a scryfallId', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', quantity: 1 }); // no scryfallId (offline import)
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Cultivate']);
  });

  test('scope=all marks each card with the correct owned flag rather than filtering', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await Card.create({ userId: user._id, name: 'Cultivate', condition: 'NM', scryfallId: 'candidate-1', quantity: 1 });
    const token = tokenFor(user);

    axios.get.mockResolvedValueOnce({
      data: { data: [scryfallCard({ id: 'candidate-1', name: 'Cultivate' }), scryfallCard({ id: 'candidate-2', name: 'Kodama\'s Reach' })] }
    });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards).toHaveLength(2);
    const byName = Object.fromEntries(res.body.cards.map(c => [c.name, c.owned]));
    expect(byName['Cultivate']).toBe(true);
    expect(byName["Kodama's Reach"]).toBe(false);
  });

  test('scope=owned finds an owned card ranked outside the top 20 Scryfall results, not just the first page', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    // The owned card is ranked 21st by Scryfall/EDHREC popularity - a naive
    // slice(0, 20) applied before ownership filtering would never see it.
    await Card.create({ userId: user._id, name: 'Card 21', condition: 'NM', scryfallId: 'candidate-21', quantity: 1 });
    const token = tokenFor(user);

    const results = Array.from({ length: 25 }, (_, i) => scryfallCard({ id: `candidate-${i + 1}`, name: `Card ${i + 1}` }));
    axios.get.mockResolvedValueOnce({ data: { data: results } });

    const res = await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp&scope=owned`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cards.map(c => c.name)).toEqual(['Card 21']);
  });

  test('rejects unauthenticated requests', async () => {
    const user = await makeUser();
    const deck = await Deck.create({ userId: user._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });
    await request(app).get(`/api/decks/${deck._id}/recommendations?category=ramp`).expect(401);
  });

  test('404s for a deck that does not belong to the requesting user', async () => {
    const owner = await makeUser();
    const otherUser = await User.create({ email: 'other@test.com', username: 'other', passwordHash: 'x', role: 'editor' });
    const deck = await Deck.create({ userId: owner._id, name: 'Test Deck', commander: { name: 'Test Commander', colors: ['G'] }, mainDeck: [] });

    await request(app)
      .get(`/api/decks/${deck._id}/recommendations?category=ramp`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .expect(404);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd backend && npx jest deckRecommendations --silent` (use `dangerouslyDisableSandbox: true`)
Expected: FAIL — route doesn't exist (404/500 where 200/400 expected).

- [ ] **Step 3: Add the route to `backend/routes/decks.js`**

Add this import near the top of the file, alongside the existing `require('../utils/deckAnalysis')` line:
```js
const { cachedApiCall } = require('../utils/apiCache');
```

Add this curated table and helper function after the existing top-of-file requires/constants, before the first `router.get`/`router.post` call:

```js
// Category search queries for GET /:id/recommendations - matches the style
// of cardInsights.js's MECHANIC_PATTERNS/KEYWORD_PATTERNS, but lives here
// (not cardInsights.js) since this route is deck-scoped, not card-scoped,
// and needs the Deck model this file already has access to.
const RECOMMENDATION_CATEGORIES = {
  ramp: 'o:"search your library" o:"land" OR o:"add" o:"mana"',
  draw: 'o:"draw a card" OR o:"draw two cards"',
  removal: 'o:"destroy target" OR o:"exile target"',
};

// Union of colors from the commander(s) and every mainDeck card - the same
// "what colors does this deck actually play" signal already used by
// calculateManabaseScore/estimatePowerLevel in utils/deckAnalysis.js.
function getDeckColorIdentity(deck) {
  const colors = new Set();
  [deck.commander, deck.partnerCommander, ...deck.mainDeck].forEach(card => {
    (card?.colors || []).forEach(c => colors.add(c));
  });
  return Array.from(colors);
}
```

Add the route itself, placed near the other `/:id/...` GET routes (e.g. directly after the `/:id/stats` route):

```js
router.get('/:id/recommendations', requireAuth, async (req, res) => {
  try {
    const { category, scope = 'owned' } = req.query;
    if (!RECOMMENDATION_CATEGORIES[category]) {
      return res.status(400).json({ message: `category must be one of: ${Object.keys(RECOMMENDATION_CATEGORIES).join(', ')}` });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const colors = getDeckColorIdentity(deck);
    const colorQuery = colors.length > 0 ? `id<=${colors.map(c => c.toLowerCase()).join('')}` : 'id:c';

    const excludedNames = new Set([
      ...deck.mainDeck.map(c => c.name),
      deck.commander?.name,
      deck.partnerCommander?.name,
    ].filter(Boolean));

    const searchQuery = `(${RECOMMENDATION_CATEGORIES[category]}) ${colorQuery}`;
    let data;
    try {
      data = await cachedApiCall(`scryfall-search:${searchQuery}`, async () => {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
        return response.data;
      });
    } catch (scryfallError) {
      // Matches cardInsights.js's similar/synergies pattern: a failed/rate-
      // limited Scryfall call degrades to a fallback query rather than 500ing
      // the whole route. Here the fallback drops the color-identity filter
      // (the category query alone still returns something useful).
      try {
        data = await cachedApiCall(`scryfall-search:${RECOMMENDATION_CATEGORIES[category]}`, async () => {
          const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(RECOMMENDATION_CATEGORIES[category])}&order=edhrec&unique=cards`);
          return fallback.data;
        });
      } catch (fallbackError) {
        data = { data: [] };
      }
    }

    // Ownership is determined and filtered BEFORE truncating to a display
    // count - candidates are Scryfall-popularity-ordered, so a user's owned
    // matches often rank outside any small fixed window. Truncating first
    // would make scope=owned look sparse/empty for real collections even
    // when good matches exist further down the same result page.
    const candidates = (data.data || []).filter(c => !excludedNames.has(c.name));

    const ownedScryfallIds = new Set();
    const ownedNames = new Set();
    if (Card) {
      const cardQuery = buildUserQuery({}, req);
      const collectionCards = await Card.find(cardQuery);
      collectionCards.forEach(c => {
        if (c.scryfallId) ownedScryfallIds.add(c.scryfallId);
        else ownedNames.add(c.name);
      });
    }

    const isOwned = (scryfallCard) => ownedScryfallIds.has(scryfallCard.id) || ownedNames.has(scryfallCard.name);

    const cardsWithOwnership = candidates.map(c => ({ ...c, owned: isOwned(c) }));
    const scoped = scope === 'owned' ? cardsWithOwnership.filter(c => c.owned) : cardsWithOwnership;
    const cards = scoped.slice(0, 20);

    res.json({ category, scope, cards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd backend && npx jest deckRecommendations --silent` (sandbox disabled)
Expected: 8/8 pass.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all suites pass — confirms this route's `axios` mock (via `jest.mock('axios')` in the new test file) doesn't leak into or break other test files (jest mocks are scoped per test file by default, so this should be a non-issue, but verify).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/decks.js backend/__tests__/deckRecommendations.test.js
git commit -m "feat: add GET /api/decks/:id/recommendations (ramp/draw/removal, owned or all-of-Magic)"
```

---

## Task 2: Frontend — Recommendations section on Deck Detail

**Files:**
- Modify: `frontend/src/components/DeckDetail.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Add the `useWishlist` import and new state**

Add to the imports at the top of `frontend/src/components/DeckDetail.js`:
```js
import { useWishlist } from '../contexts/WishlistContext';
```

Inside the `DeckDetail` function, add alongside the other hook calls (near the top of the function body):
```js
  const { addToWishlist } = useWishlist();
```

Add new state alongside the other `useState` declarations:
```js
  const [recCategory, setRecCategory] = useState('ramp'); // 'ramp' | 'draw' | 'removal'
  const [recScope, setRecScope] = useState('owned'); // 'owned' | 'all'
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
```

- [ ] **Step 2: Fetch recommendations on category/scope change**

Add this `useEffect` near the other data-fetching `useEffect` (the one that fetches `/stats`, `/value-history`, `/changelog`):

```js
  useEffect(() => {
    if (!deck._id) return;
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setLoadingRecs(true);
    fetch(`${API_URL}/decks/${deck._id}/recommendations?category=${recCategory}&scope=${recScope}`, { headers })
      .then(r => r.ok ? r.json() : { cards: [] })
      .then(data => setRecommendations(data.cards || []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoadingRecs(false));
  }, [deck._id, recCategory, recScope]);
```

- [ ] **Step 3: Add the add-to-deck and add-to-wishlist handlers**

Add these functions in the component body, near the other handler functions:

```js
  const addRecommendationToDeck = async (scryfallCard) => {
    try {
      // No manual auth header here - App.js already registers a global
      // axios.interceptors.request.use() that attaches the token to every
      // axios request. Every other axios call in this file relies on that
      // interceptor rather than building headers manually; only the plain
      // fetch() calls above need the header built by hand.
      const response = await axios.post(`${API_URL}/decks/${deck._id}/add-card`, {
        scryfallId: scryfallCard.id,
        name: scryfallCard.name,
        manaCost: scryfallCard.mana_cost,
        types: (scryfallCard.type_line || '').split('—')[0].trim().split(' '),
        colors: scryfallCard.colors || [],
        imageUrl: scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal,
      });
      if (response.status === 200) {
        setRecommendations(prev => prev.filter(c => c.id !== scryfallCard.id));
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error adding recommendation to deck:', error);
      alert('Error adding card to deck');
    }
  };

  const addRecommendationToWishlist = (scryfallCard) => {
    addToWishlist(scryfallCard, deck.name);
  };
```

(`addToWishlist(scryfallCard, sourceName)` is the same function `CollectionView.js`'s Similar Cards feature already calls this exact way — matches `frontend/src/contexts/WishlistContext.js:197`.)

- [ ] **Step 4: Render the Recommendations section**

Add this new section directly after the Smart Deck Score panel added in Phase 1's Task 4 (i.e., right after that panel's closing `</div>`, before whatever section currently follows it — locate by finding the Smart Deck Score panel's closing tag):

```jsx
          {/* Recommendations */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Recommendations</h3>

            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {['ramp', 'draw', 'removal'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRecCategory(cat)}
                    className={`px-3 py-1 rounded text-sm font-medium capitalize transition ${
                      recCategory === cat ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecScope('owned')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    recScope === 'owned' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  My Collection
                </button>
                <button
                  onClick={() => setRecScope('all')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    recScope === 'all' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  All of Magic
                </button>
              </div>
            </div>

            {loadingRecs ? (
              <div className="text-white/40 text-center text-sm py-8">Loading recommendations...</div>
            ) : recommendations.length === 0 ? (
              <div className="text-white/40 text-center text-sm py-8">
                No {recCategory} recommendations found for this deck's colors.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendations.map(card => (
                  <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden">
                    {(card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal) ? (
                      <img
                        src={card.image_uris?.normal || card.card_faces[0].image_uris.normal}
                        alt={card.name}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                        <span className="text-white/60 text-xs text-center p-2">{card.name}</span>
                      </div>
                    )}
                    <div className="p-2">
                      <h4 className="text-white text-xs font-semibold truncate" title={card.name}>{card.name}</h4>
                      {card.owned ? (
                        <button
                          onClick={() => addRecommendationToDeck(card)}
                          className="w-full mt-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition"
                        >
                          + Add to Deck
                        </button>
                      ) : (
                        <button
                          onClick={() => addRecommendationToWishlist(card)}
                          className="w-full mt-1 px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded transition"
                        >
                          + Add to Wishlist
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DeckDetail.js
git commit -m "feat: add Recommendations section (Ramp/Draw/Removal) to Deck Detail"
```

---

## Task 3: Final verification

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npx jest --silent` (sandbox disabled)
Expected: all pass.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual smoke test**

With both servers running, open a Commander deck in Deck Builder → Deck Detail:
- Confirm the Recommendations section renders below the Smart Deck Score panel (Phase 1), defaulting to the Ramp tab and "My Collection" scope.
- Switch between Ramp/Draw/Removal tabs — confirm each re-fetches and shows different results.
- Toggle to "All of Magic" — confirm more results appear (or at least different action buttons: "Add to Wishlist" instead of "Add to Deck" for unowned cards).
- Click "+ Add to Deck" on an owned recommendation — confirm it disappears from the recommendations list and actually appears in the deck's card list after the page refreshes its data.
- Click "+ Add to Wishlist" on an unowned recommendation (in "All of Magic" mode) — confirm it's added to the Wishlist view.
- Confirm a deck with no commander/colors (if reachable) or a very narrow color identity doesn't crash the section — shows the empty state instead.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

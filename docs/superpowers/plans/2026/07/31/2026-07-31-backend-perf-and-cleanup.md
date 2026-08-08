# Backend Performance & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two duplicate-index warnings, cache Scryfall set metadata to speed up repeat `/sets/completion` requests, and extract the remaining 17 inline `/api/cards/*` routes out of `backend/server.js` into `backend/routes/cards.js`.

**Architecture:** Extract three small shared-state modules (`apiCache.js`, `statsCache.js`, `imageCache.js`) from `server.js` first, since both `server.js`'s remaining routes and the new `routes/cards.js` depend on them. Then relocate the routes themselves verbatim (no logic changes — this is a pure refactor, not a rewrite).

**Tech Stack:** Node/Express/Mongoose backend, Jest + supertest + mongodb-memory-server tests (existing conventions).

---

## Task 1: Remove duplicate index declarations

**Files:**
- Modify: `backend/models/PasswordResetToken.js`
- Modify: `backend/models/ForumCategory.js`

- [ ] **Step 1: Remove the redundant index call in PasswordResetToken.js**

In `backend/models/PasswordResetToken.js`, the `token` field already has `unique: true` (line 12), which Mongoose auto-indexes. Delete this now-redundant line:

```js
passwordResetTokenSchema.index({ token: 1 });
```

(Leave `passwordResetTokenSchema.index({ expiresAt: 1 });` and `passwordResetTokenSchema.index({ used: 1 });` — those are on different fields, not duplicates.)

- [ ] **Step 2: Remove the redundant index call in ForumCategory.js**

In `backend/models/ForumCategory.js`, the `slug` field already has `unique: true` (line 13). Delete this now-redundant line:

```js
categorySchema.index({ slug: 1 });
```

- [ ] **Step 3: Run the full backend test suite and confirm the warnings are gone**

Run (foreground, with a timeout wrapper): `cd backend && timeout 300 npx jest --runInBand 2>&1 | tee /tmp/task1-output.txt`
Expected: all tests still pass, and `grep -c "Duplicate schema index" /tmp/task1-output.txt` returns `0` (down from repeated occurrences per test file before this change).

- [ ] **Step 4: Commit**

```bash
git add backend/models/PasswordResetToken.js backend/models/ForumCategory.js
git commit -m "fix: remove redundant duplicate index declarations"
```

---

## Task 2: Extract ApiCache model and cachedApiCall into backend/utils/apiCache.js

**Files:**
- Create: `backend/utils/apiCache.js`
- Modify: `backend/server.js`
- Test: `backend/__tests__/apiCache.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/apiCache.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { cachedApiCall } = require('../utils/apiCache');

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

describe('cachedApiCall', () => {
  test('calls fetchFn and caches the result on first call', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ value: 42 });
    const result = await cachedApiCall('test-key-1', fetchFn);
    expect(result).toEqual({ value: 42 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('returns the cached value on a second call without calling fetchFn again', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ value: 99 });
    await cachedApiCall('test-key-2', fetchFn);
    const result = await cachedApiCall('test-key-2', fetchFn);
    expect(result).toEqual({ value: 99 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('different keys are cached independently', async () => {
    const fetchFnA = jest.fn().mockResolvedValue({ value: 'a' });
    const fetchFnB = jest.fn().mockResolvedValue({ value: 'b' });
    const resultA = await cachedApiCall('test-key-a', fetchFnA);
    const resultB = await cachedApiCall('test-key-b', fetchFnB);
    expect(resultA).toEqual({ value: 'a' });
    expect(resultB).toEqual({ value: 'b' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 60 npx jest apiCache --runInBand`
Expected: FAIL with "Cannot find module '../utils/apiCache'"

- [ ] **Step 3: Implement**

Read `backend/server.js` lines 380-411 first (the existing `apiCacheSchema`/`ApiCache`/`cachedApiCall` definitions) to confirm you're moving them verbatim.

```js
// backend/utils/apiCache.js
const mongoose = require('mongoose');

// API Response Cache Schema (24-hour TTL)
const apiCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

const ApiCache = mongoose.models.ApiCache || mongoose.model('ApiCache', apiCacheSchema);

// Cached API call helper
async function cachedApiCall(key, fetchFn) {
  try {
    const cached = await ApiCache.findOne({ key });
    if (cached) return cached.data;
  } catch {
    // Cache miss or error, proceed to fetch
  }

  const data = await fetchFn();

  try {
    await ApiCache.findOneAndUpdate(
      { key },
      { key, data, createdAt: new Date() },
      { upsert: true, new: true }
    );
  } catch {
    // Cache write failure is non-critical
  }

  return data;
}

module.exports = { ApiCache, cachedApiCall };
```

Note the `mongoose.models.ApiCache || mongoose.model(...)` guard (not present in the original `server.js` code) — this is needed because the test file above connects to its own MongoMemoryServer instance and requires this module directly, without going through `server.js`; the guard prevents an `OverwriteModelError` if the module is required more than once across the test suite (a pattern already used elsewhere in this codebase, e.g. `backend/__tests__/commanders.test.js`'s local Card schema registration).

- [ ] **Step 4: Update server.js to use the extracted module**

In `backend/server.js`:
1. Delete the `apiCacheSchema`, `ApiCache`, and `cachedApiCall` definitions (originally lines 380-411).
2. Add near the top with the other requires: `const { cachedApiCall } = require('./utils/apiCache');`
3. Confirm all existing call sites of `cachedApiCall` in `server.js` (in `/api/scryfall/autocomplete` and `/api/scryfall/search`) still work unchanged — they call the same function, just imported now instead of module-scope.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && timeout 60 npx jest apiCache --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass, in particular any existing tests touching `/api/scryfall/autocomplete` or `/api/scryfall/search`.

- [ ] **Step 7: Commit**

```bash
git add backend/utils/apiCache.js backend/server.js backend/__tests__/apiCache.test.js
git commit -m "refactor: extract ApiCache/cachedApiCall into backend/utils/apiCache.js"
```

---

## Task 3: Cache Scryfall set metadata in GET /api/sets/completion

**Files:**
- Modify: `backend/routes/sets.js`
- Modify: `backend/__tests__/sets-completion.test.js`

- [ ] **Step 1: Write the new/updated failing test**

Add this test to `backend/__tests__/sets-completion.test.js` (in the existing `describe('GET /api/sets/completion', ...)` block):

```js
  test('caches set metadata so a second request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'user3', passwordHash: 'x', role: 'editor' });
    await Card.create({ userId: user._id, name: 'Card A', set: 'Alpha', setCode: 'lea', quantity: 1, condition: 'NM', price: 0 });
    axios.get.mockResolvedValue({ data: { name: 'Limited Edition Alpha', card_count: 100, released_at: '1993-08-05', set_type: 'core' } });

    const app = buildApp();
    await request(app).get('/api/sets/completion').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    await request(app).get('/api/sets/completion').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 60 npx jest sets-completion --runInBand`
Expected: FAIL — `axios.get` is called twice (once per request), not once.

- [ ] **Step 3: Implement**

In `backend/routes/sets.js`, add the import:

```js
const { cachedApiCall } = require('../utils/apiCache');
```

Replace the direct Scryfall call inside the `for (const code of setCodes.slice(0, 20))` loop:

```js
      try {
        const setInfo = await cachedApiCall(`scryfall-set:${code}`, async () => {
          const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
          return setResponse.data;
        });
        completionData.push({
          setCode: code.toUpperCase(),
          setName: setInfo.name,
          ownedUnique: cardsBySet[code].ownedCards.size,
          totalInSet: setInfo.card_count,
          totalOwned: cardsBySet[code].totalOwned,
          releasedAt: setInfo.released_at,
          setType: setInfo.set_type
        });
      } catch (e) {
        // Skip sets Scryfall can't find - matches frontend behavior at App.js:508-511
      }
```

Remove the `await new Promise(resolve => setTimeout(resolve, 100));` line that previously followed the push — it existed to rate-limit *live* Scryfall calls, but now that most calls are cache hits after the first request, the delay would be pure waste on cache hits and Scryfall's own 24h-cached data doesn't need a delay between reads from Mongo. (The 100ms delay only mattered for the uncached path; since `cachedApiCall` doesn't distinguish cache-hit from cache-miss internally, removing this delay is intentional and matches the design's stated goal that "on a fully-cached request, `/sets/completion` should return near-instantly with no artificial delay" — the plan accepts a small increase in Scryfall request rate on the very first, cold-cache pass through a large collection, in exchange for near-instant repeat requests.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && timeout 60 npx jest sets-completion --runInBand`
Expected: PASS (3 tests total in the file)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/routes/sets.js backend/__tests__/sets-completion.test.js
git commit -m "perf: cache Scryfall set metadata in /api/sets/completion"
```

---

## Task 4: Extract the in-memory cards/stats cache into backend/utils/statsCache.js

**Files:**
- Create: `backend/utils/statsCache.js`
- Modify: `backend/server.js`
- Test: `backend/__tests__/statsCache.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/statsCache.test.js
const { getFromCache, setInCache, clearCache } = require('../utils/statsCache');

describe('statsCache', () => {
  test('returns null for a key with nothing cached', () => {
    expect(getFromCache('cards', 'user-1')).toBeNull();
  });

  test('setInCache then getFromCache returns the stored data for that user', () => {
    setInCache('cards', 'user-2', [{ name: 'Sol Ring' }]);
    expect(getFromCache('cards', 'user-2')).toEqual([{ name: 'Sol Ring' }]);
  });

  test('clearCache removes both cards and stats entries for a user', () => {
    setInCache('cards', 'user-3', ['a']);
    setInCache('stats', 'user-3', { totalCards: 1 });
    clearCache('user-3');
    expect(getFromCache('cards', 'user-3')).toBeNull();
    expect(getFromCache('stats', 'user-3')).toBeNull();
  });

  test('different users are cached independently', () => {
    setInCache('cards', 'user-4', ['x']);
    setInCache('cards', 'user-5', ['y']);
    expect(getFromCache('cards', 'user-4')).toEqual(['x']);
    expect(getFromCache('cards', 'user-5')).toEqual(['y']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 60 npx jest statsCache --runInBand`
Expected: FAIL with "Cannot find module '../utils/statsCache'"

- [ ] **Step 3: Implement**

Read `backend/server.js` lines 111-136 first (the existing `cache`/`getFromCache`/`setInCache`/`clearCache` definitions) to confirm verbatim relocation.

```js
// backend/utils/statsCache.js

// In-memory cache for cards and stats - relocated verbatim from server.js.
// Per-process, non-persistent: acceptable since it's a 5-minute TTL read-through
// cache, not a source of truth, and the app runs as a single backend process.
const cache = {
  cards: new Map(),
  stats: new Map(),
  ttl: 5 * 60 * 1000 // 5 minute TTL
};

function getFromCache(key, userId) {
  const entry = cache[key]?.get(userId?.toString());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > cache.ttl) {
    cache[key].delete(userId?.toString());
    return null;
  }
  return entry.data;
}

function setInCache(key, userId, data) {
  if (!cache[key]) cache[key] = new Map();
  cache[key].set(userId?.toString(), { data, timestamp: Date.now() });
}

function clearCache(userId) {
  cache.cards.delete(userId?.toString());
  cache.stats.delete(userId?.toString());
}

module.exports = { getFromCache, setInCache, clearCache };
```

- [ ] **Step 4: Update server.js to use the extracted module**

In `backend/server.js`:
1. Delete the `cache`/`getFromCache`/`setInCache`/`clearCache` definitions (originally lines 111-136).
2. Add near the top with the other requires: `const { getFromCache, setInCache, clearCache } = require('./utils/statsCache');`
3. All existing call sites in `server.js` (in `/api/stats` and the `/api/cards/*` routes, which move to `routes/cards.js` in Task 6) keep working unchanged — same function names, same behavior, just imported.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && timeout 60 npx jest statsCache --runInBand`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/utils/statsCache.js backend/server.js backend/__tests__/statsCache.test.js
git commit -m "refactor: extract cards/stats cache into backend/utils/statsCache.js"
```

---

## Task 5: Extract the image cache into backend/utils/imageCache.js

**Files:**
- Create: `backend/utils/imageCache.js`
- Modify: `backend/server.js`
- Test: `backend/__tests__/imageCache.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/imageCache.test.js
const fs = require('fs');
const path = require('path');

jest.mock('axios');
const axios = require('axios');

describe('cacheCardImage', () => {
  const testCacheDir = path.join(__dirname, '__tmp_image_cache__');

  beforeEach(() => {
    jest.resetModules();
    process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS = testCacheDir;
  });

  afterEach(() => {
    delete process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS;
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  test('returns null if scryfallId or imageUrl is missing', async () => {
    const { cacheCardImage } = require('../utils/imageCache');
    expect(await cacheCardImage(null, 'http://example.com/x.jpg')).toBeNull();
    expect(await cacheCardImage('abc', null)).toBeNull();
  });

  test('returns the local URL without downloading if already cached', async () => {
    const { cacheCardImage, CACHE_DIR } = require('../utils/imageCache');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'abc123.jpg'), 'fake-image-data');

    const result = await cacheCardImage('abc123', 'http://example.com/abc123.jpg');
    expect(result).toBe('/api/images/abc123');
    expect(axios).not.toHaveBeenCalled();
  });
});
```

NOTE: this test references an `IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS` env var that does not exist in the plan's Step 3 implementation below — before writing that env-var override into `imageCache.js` itself, check whether `backend/server.js`'s existing `CACHE_DIR` is already relative to `__dirname` in a way that's safe to exercise directly in a test (writing/deleting real files under `backend/cached-images/mtg-cards/` during a test run). If a real per-test override mechanism is needed to avoid polluting the real cache directory, add it to `imageCache.js`'s `CACHE_DIR` constant (e.g. `process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS || path.join(__dirname, '..', 'cached-images', 'mtg-cards')`) — this is a reasonable, small addition to the original code (not present in `server.js` today) needed specifically to make this extraction testable in isolation. If you judge it unnecessary because the existing test suite already tolerates writing to the real cache directory elsewhere, adapt the test instead of the source, and note that decision in your report.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 60 npx jest imageCache --runInBand`
Expected: FAIL with "Cannot find module '../utils/imageCache'"

- [ ] **Step 3: Implement**

Read `backend/server.js` lines 49-53 (CACHE_DIR setup) and 598-632 (`cacheCardImage`) first, to confirm verbatim relocation.

```js
// backend/utils/imageCache.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('stream/promises');

const CACHE_DIR = process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS || path.join(__dirname, '..', 'cached-images', 'mtg-cards');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Image cache directory created:', CACHE_DIR);
}

// Download and cache image from Scryfall, return local path or fallback to URL
async function cacheCardImage(scryfallId, imageUrl) {
  if (!scryfallId || !imageUrl) {
    return null;
  }

  const filename = `${scryfallId}.jpg`;
  const filepath = path.join(CACHE_DIR, filename);
  const localUrl = `/api/images/${scryfallId}`;

  // Check if already cached
  if (fs.existsSync(filepath)) {
    console.log(`Image cache hit: ${scryfallId}`);
    return localUrl;
  }

  // Download and cache image
  try {
    console.log(`Downloading image: ${scryfallId}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filepath);
    await pipeline(response.data, writer);

    console.log(`Image cached successfully: ${scryfallId}`);
    return localUrl;
  } catch (error) {
    console.error(`Failed to cache image for ${scryfallId}:`, error.message);
    // Fallback to original Scryfall URL if caching fails
    return imageUrl;
  }
}

module.exports = { CACHE_DIR, cacheCardImage };
```

- [ ] **Step 4: Update server.js to use the extracted module**

In `backend/server.js`:
1. Delete the original `CACHE_DIR` setup (lines 49-53) and the `cacheCardImage` function (lines 598-632).
2. Add near the top with the other requires: `const { CACHE_DIR, cacheCardImage } = require('./utils/imageCache');`
3. All existing call sites of `CACHE_DIR` (in `/api/images/:scryfallId`, and inside the `/api/cards/*` routes moving in Task 6) and `cacheCardImage` (in `/api/scryfall/search`, and inside several `/api/cards/*` routes moving in Task 6) keep working unchanged.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && timeout 60 npx jest imageCache --runInBand`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass, in particular any existing tests touching `/api/images/:scryfallId` or image caching during card search/import.

- [ ] **Step 7: Commit**

```bash
git add backend/utils/imageCache.js backend/server.js backend/__tests__/imageCache.test.js
git commit -m "refactor: extract image cache into backend/utils/imageCache.js"
```

---

## Task 6: Extract the 17 /api/cards routes into backend/routes/cards.js

**Files:**
- Create: `backend/routes/cards.js`
- Modify: `backend/server.js`

This task has no new test file of its own — the existing backend test suite already covers these routes' behavior (they're being relocated, not rewritten), and Task 6's own verification step is running that full suite against the relocated code.

- [ ] **Step 1: Read `backend/priceFlags.js` for the router-file convention to match**

Confirm the shape: `router.use(verifyToken)` at the top, `mongoose.model('Card')` (not a fresh schema) to access the Card model, `buildUserQuery` from `../middleware/multiUser`, `requireAuth`/`requireEditor` per-route.

- [ ] **Step 2: Identify and cut the 17 route handlers from server.js**

Locate each of these handlers in `backend/server.js` by its exact route signature (not by line number — earlier tasks in this plan will have shifted line numbers). For each one, cut its complete handler (from the `app.get\|post\|put\|delete(...)` line through its closing `});`) out of `server.js`:

- `GET /api/cards`
- `GET /api/cards/:id`
- `POST /api/cards/:id/update-price`
- `POST /api/cards/update-all-prices`
- `POST /api/cards/bulk-import`
- `POST /api/cards/bulk-import-full`
- `POST /api/cards/bulk-import-offline`
- `POST /api/cards`
- `PUT /api/cards/:id`
- `DELETE /api/cards/:id`
- `GET /api/cards/:id/price-history`
- `PUT /api/cards/:id/finance`
- `POST /api/cards/:id/tags`
- `DELETE /api/cards/:id/tags/:tag`
- `POST /api/cards/update-all-oracle-text`
- `POST /api/cards/migrate-images-to-cache`
- `POST /api/cards/bulk-update`
- `DELETE /api/cards/bulk-delete`

Do NOT cut `GET /api/cards/:id/similar` or `GET /api/cards/:id/synergies` — those are already in `backend/routes/cardInsights.js`, not inline in `server.js`. Do NOT cut anything under `/api/scryfall/*` (autocomplete, search) or `/api/stats` or `/api/images/:scryfallId` — those stay in `server.js`.

- [ ] **Step 3: Paste the cut handlers into a new router file**

Create `backend/routes/cards.js` with this structure — the handlers themselves are pasted verbatim from Step 2 (change only `app.get(...)`/`app.post(...)`/etc. to `router.get(...)`/`router.post(...)`/etc., and remove the `/api/cards` prefix from each path since the router is mounted at that prefix, e.g. `app.get('/api/cards/:id/price-history', ...)` becomes `router.get('/:id/price-history', ...)`):

```js
// backend/routes/cards.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { verifyToken, requireAuth, requireEditor } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');
const { activityLoggers } = require('../middleware/activityLogger');
const { getPriceWithFallback } = require('../utils/pricing');
const { getFromCache, setInCache, clearCache } = require('../utils/statsCache');
const { CACHE_DIR, cacheCardImage } = require('../utils/imageCache');

router.use(verifyToken);

// ... the 17 pasted, adapted handlers go here, in the same relative order they
// appeared in server.js ...

module.exports = router;
```

Inside each pasted handler, replace bare references to `Card` with `mongoose.model('Card')` at the top of that handler (matching the pattern in `cardInsights.js`/`commanders.js`/`sets.js` — e.g. `const Card = mongoose.model('Card'); ...` as the first line inside the try block, or once per handler as needed). Every other identifier used inside these handlers (`getUserId`, `buildUserQuery`, `getFromCache`, `setInCache`, `clearCache`, `CACHE_DIR`, `cacheCardImage`, `getPriceWithFallback`, `activityLoggers`, `fs`, `path`) is now available via the requires at the top of the new file — no other code changes should be needed inside the handler bodies.

- [ ] **Step 4: Mount the new router in server.js**

Add alongside the existing `/api/cards` mounts:

```js
app.use('/api/cards', require('./routes/cards'));
```

Place it before `app.use('/api/cards', require('./routes/priceFlags'));` and `app.use('/api/cards', require('./routes/cardInsights'));` — Express tries mounted routers in registration order, and this new router handles the more specific/exact paths (`/api/cards`, `/api/cards/:id`, etc.) that should take priority.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass — every existing test exercising card CRUD, bulk import, price updates, tags, or finance fields should behave identically, since no route logic changed, only its file location.

If any test fails, do NOT patch the test to match new (wrong) behavior — this is a pure relocation, so a failure means something was altered during the cut/paste (a missing import, a changed variable reference, a route path prefix mismatch) and must be fixed to match the original behavior exactly.

- [ ] **Step 6: Manually sanity-check server.js line count dropped substantially**

Run: `wc -l backend/server.js` and confirm it's meaningfully smaller than before this task (the 17 handlers totaled roughly 1800 lines in the original file).

- [ ] **Step 7: Commit**

```bash
git add backend/routes/cards.js backend/server.js
git commit -m "refactor: extract remaining /api/cards routes into backend/routes/cards.js"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full backend test suite one more time on the final state**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass, zero "Duplicate schema index" warnings in the output.

- [ ] **Step 2: Manual smoke test**

Restart the backend (however it's currently being run) so it picks up all the changes. Confirm via a browser or `curl`:
- `GET /api/cards` (with a valid session) still returns the card list.
- `GET /api/sets/completion` still works, and a second call completes noticeably faster than the first (cache hit).
- Adding/editing a card via the web app still works end-to-end (exercises the relocated POST/PUT routes and cache invalidation).

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 6) before considering this done.

# Scryfall Query Caching & Image Cache Sharding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache the Scryfall search calls made by `/similar`, `/synergies`, and `/commanders/recommend` using the existing `cachedApiCall` mechanism, and shard the on-disk image cache directory so it stays fast as new sets grow it.

**Architecture:** Two independent tracks. Track A (Tasks 1-3) wraps existing Scryfall calls in three route files with `cachedApiCall`, no query-building logic changes. Track B (Tasks 4-6) adds sharded read/write to `imageCache.js`, updates the one place in `server.js` that reads the cache directly, and adds a one-time migration script for already-cached files.

**Tech Stack:** Node/Express/Mongoose backend, Jest + supertest + mongodb-memory-server tests (existing conventions).

---

## Task 1: Cache Scryfall calls in GET /api/cards/:id/similar

**Files:**
- Modify: `backend/routes/cardInsights.js`
- Modify: `backend/__tests__/card-insights.test.js`

- [ ] **Step 1: Add the ApiCache cleanup and a new caching test**

In `backend/__tests__/card-insights.test.js`, add near the top with the other requires:

```js
const { ApiCache } = require('../utils/apiCache');
```

Add `await ApiCache.deleteMany({});` to the existing `afterEach` block (alongside the existing `User.deleteMany({})`/`Card.deleteMany({})`), so cached entries from one test don't leak into another.

Add this test inside the existing `describe('GET /api/cards/:id/similar', ...)` block:

```js
  test('caches the Scryfall query so a second identical request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'user4', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Grizzly Bears', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['G']
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Runeclaw Bear' }] } });

    const app = buildApp();
    await request(app).get(`/api/cards/${card._id}/similar`).set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    await request(app).get(`/api/cards/${card._id}/similar`).set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 90 npx jest card-insights --runInBand`
Expected: FAIL — `axios.get` called twice, not once.

- [ ] **Step 3: Implement**

In `backend/routes/cardInsights.js`, add the import near the top:

```js
const { cachedApiCall } = require('../utils/apiCache');
```

Replace the `/similar` route's Scryfall-calling section (inside the try block, after `queries.push('-!"${card.name}"')`):

```js
    const searchQuery = queries.join(' ');
    try {
      const data = await cachedApiCall(`scryfall-search:${searchQuery}`, async () => {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
        return response.data;
      });
      return res.json(data.data.slice(0, 20));
    } catch (scryfallError) {
      if (card.types?.length > 0) {
        const fallbackQuery = `t:${card.types[0].toLowerCase()}`;
        const fallbackData = await cachedApiCall(`scryfall-search:${fallbackQuery}`, async () => {
          const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=${fallbackQuery}&order=edhrec&unique=cards`);
          return fallback.data;
        });
        return res.json(fallbackData.data.slice(0, 20));
      }
      return res.json([]);
    }
```

Note the fallback query is NOT wrapped in `encodeURIComponent` — matching the pre-existing behavior exactly (the original fallback call never encoded it either; not something this task should change, since `t:<word>` values never contain characters that need encoding in practice).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && timeout 90 npx jest card-insights --runInBand`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/routes/cardInsights.js backend/__tests__/card-insights.test.js
git commit -m "perf: cache Scryfall query in GET /api/cards/:id/similar"
```

---

## Task 2: Cache Scryfall calls in GET /api/cards/:id/synergies

**Files:**
- Modify: `backend/routes/cardInsights.js`
- Modify: `backend/__tests__/card-insights.test.js`

- [ ] **Step 1: Add a new caching test**

Add this test inside the existing `describe('GET /api/cards/:id/synergies', ...)` block in `backend/__tests__/card-insights.test.js`:

```js
  test('caches each Scryfall query so a second identical request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'user5', passwordHash: 'x', role: 'editor' });
    const card = await Card.create({
      userId: user._id, name: 'Goblin Chieftain', quantity: 1, condition: 'NM',
      price: 0, types: ['Creature'], colors: ['R'],
      oracleText: 'Goblin creatures you control get +1/+1 and have haste.'
    });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Goblin Warchief' }] } });

    const app = buildApp();
    await request(app).get(`/api/cards/${card._id}/synergies`).set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    const callsAfterFirst = axios.get.mock.calls.length;
    await request(app).get(`/api/cards/${card._id}/synergies`).set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get.mock.calls.length).toBe(callsAfterFirst);
  });
```

(This card only triggers the tribal branch — one Scryfall call per request before caching — so `callsAfterFirst` will be 1, and the second request should add zero more.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 90 npx jest card-insights --runInBand`
Expected: FAIL — the second request still calls `axios.get` again.

- [ ] **Step 3: Implement**

Replace the whole `/synergies` route body in `backend/routes/cardInsights.js` with this version (query-building logic and branching structure are unchanged — every call site is now wrapped in `cachedApiCall`, keyed by its own exact query text):

```js
router.get('/:id/synergies', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const results = { tribal: [], keywords: [], mechanics: [] };
    const colorQuery = card.colors?.length > 0 ? `id<=${card.colors.map(c => c[0].toLowerCase()).join('')}` : 'id:c';

    if (card.types?.some(t => t.toLowerCase() === 'creature')) {
      const ot = card.oracleText || '';
      const typeMatch = ot.match(TRIBE_PATTERN);
      const nameTypes = card.name.match(NAME_TRIBE_PATTERN);
      const tribes = [...new Set([...(typeMatch || []), ...(nameTypes || [])])].map(t => t.toLowerCase());
      if (tribes.length > 0) {
        const tribe = tribes[0];
        const tribalQuery = `o:"${tribe}" ${colorQuery} -t:${tribe} -!"${card.name}"`;
        try {
          const data = await cachedApiCall(`scryfall-search:${tribalQuery}`, async () => {
            const r = await axios.get(`https://api.scryfall.com/cards/search?q=${tribalQuery}&order=edhrec&unique=cards`);
            return r.data;
          });
          results.tribal = data.data.slice(0, 12);
        } catch (e) {
          const tribalFallbackQuery = `t:${tribe} ${colorQuery} -!"${card.name}"`;
          try {
            const data2 = await cachedApiCall(`scryfall-search:${tribalFallbackQuery}`, async () => {
              const r2 = await axios.get(`https://api.scryfall.com/cards/search?q=${tribalFallbackQuery}&order=edhrec&unique=cards`);
              return r2.data;
            });
            results.tribal = data2.data.slice(0, 12);
          } catch (e2) { /* no tribal results */ }
        }
      }
    }

    const ot = (card.oracleText || '').toLowerCase();
    const foundKeywords = KEYWORD_PATTERNS.filter(({ keyword }) => ot.includes(keyword));
    if (foundKeywords.length > 0) {
      const keywordsQuery = `(${foundKeywords[0].search}) ${colorQuery} -!"${card.name}"`;
      try {
        const data = await cachedApiCall(`scryfall-search:${keywordsQuery}`, async () => {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=${keywordsQuery}&order=edhrec&unique=cards`);
          return r.data;
        });
        results.keywords = data.data.slice(0, 12);
      } catch (e) { /* no keyword results */ }
    }

    const foundMechanics = MECHANIC_PATTERNS.filter(({ pattern }) => pattern.test(ot));
    if (foundMechanics.length > 0) {
      const mechanicsQuery = `(${foundMechanics[0].search}) ${colorQuery} -!"${card.name}"`;
      try {
        const data = await cachedApiCall(`scryfall-search:${mechanicsQuery}`, async () => {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=${mechanicsQuery}&order=edhrec&unique=cards`);
          return r.data;
        });
        results.mechanics = data.data.slice(0, 12);
      } catch (e) { /* no mechanic results */ }
    }

    if (results.mechanics.length === 0) {
      try {
        let fallbackQuery = null;
        if (card.types?.includes('Instant') || card.types?.includes('Sorcery')) {
          fallbackQuery = `o:"whenever you cast" (o:"instant" OR o:"sorcery") ${colorQuery} -!"${card.name}"`;
        } else if (card.types?.includes('Artifact')) {
          fallbackQuery = `o:"artifact" o:"whenever" ${colorQuery} -!"${card.name}"`;
        } else if (card.types?.includes('Enchantment')) {
          fallbackQuery = `o:"enchantment" o:"whenever" OR o:"constellation" ${colorQuery} -!"${card.name}"`;
        }
        if (fallbackQuery) {
          const data = await cachedApiCall(`scryfall-search:${fallbackQuery}`, async () => {
            const r = await axios.get(`https://api.scryfall.com/cards/search?q=${fallbackQuery}&order=edhrec&unique=cards`);
            return r.data;
          });
          results.mechanics = data.data.slice(0, 12);
        }
      } catch (e) { /* no fallback mechanic results */ }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Every branch's Scryfall query text, ordering, and fallback conditions are identical to the pre-existing code — only the direct `axios.get` calls are now routed through `cachedApiCall`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && timeout 90 npx jest card-insights --runInBand`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/routes/cardInsights.js backend/__tests__/card-insights.test.js
git commit -m "perf: cache Scryfall queries in GET /api/cards/:id/synergies"
```

---

## Task 3: Cache Scryfall calls in GET /api/commanders/recommend

**Files:**
- Modify: `backend/routes/commanders.js`
- Modify: `backend/__tests__/commanders.test.js`

- [ ] **Step 1: Add the ApiCache cleanup and a new caching test**

In `backend/__tests__/commanders.test.js`, add near the top with the other requires:

```js
const { ApiCache } = require('../utils/apiCache');
```

Add `await ApiCache.deleteMany({});` to the existing `afterEach` block.

Add this test inside the existing `describe('GET /api/commanders/recommend', ...)` block:

```js
  test('caches the Scryfall query so a second identical request does not re-call Scryfall', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'user4', passwordHash: 'x', role: 'editor' });
    axios.get.mockResolvedValue({ data: { data: [{ name: 'Krenko, Mob Boss' }] } });

    const app = buildApp();
    await request(app).get('/api/commanders/recommend').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);
    await request(app).get('/api/commanders/recommend').set('Authorization', `Bearer ${makeToken(user)}`).expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 90 npx jest commanders --runInBand`
Expected: FAIL — `axios.get` called twice.

- [ ] **Step 3: Implement**

In `backend/routes/commanders.js`, add the import near the top:

```js
const { cachedApiCall } = require('../utils/apiCache');
```

Replace the route's Scryfall-calling section (the `searchQuery`/try/catch block at the end of `/recommend`):

```js
    const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
    try {
      const data = await cachedApiCall(`scryfall-search:${searchQuery}`, async () => {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
        return response.data;
      });
      return res.json(data.data.slice(0, 20));
    } catch (scryfallError) {
      const fallbackQuery = 't:legendary+t:creature';
      const fallbackData = await cachedApiCall(`scryfall-search:${fallbackQuery}`, async () => {
        const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=${fallbackQuery}&order=edhrec&unique=cards`);
        return fallback.data;
      });
      return res.json(fallbackData.data.slice(0, 20));
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && timeout 90 npx jest commanders --runInBand`
Expected: PASS (all tests in the file, including the existing fallback-on-error test — `axios.get.mockRejectedValueOnce(...).mockResolvedValueOnce(...)` still works unchanged, since `cachedApiCall` re-throws a `fetchFn` rejection rather than swallowing it)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/routes/commanders.js backend/__tests__/commanders.test.js
git commit -m "perf: cache Scryfall query in GET /api/commanders/recommend"
```

---

## Task 4: Shard the image cache directory (read/write logic)

**Files:**
- Modify: `backend/utils/imageCache.js`
- Modify: `backend/__tests__/imageCache.test.js`

- [ ] **Step 1: Write the failing test**

Add these tests to `backend/__tests__/imageCache.test.js` (inside the existing `describe('cacheCardImage', ...)` block):

```js
  test('caches a new image into its sharded subdirectory, not the flat directory', async () => {
    const { cacheCardImage, CACHE_DIR } = require('../utils/imageCache');
    const { Readable } = require('stream');
    axios.mockResolvedValue({ data: Readable.from([Buffer.from('fake-image-bytes')]) });

    const result = await cacheCardImage('newcard123', 'http://example.com/newcard123.jpg');

    expect(result).toBe('/api/images/newcard123');
    expect(fs.existsSync(path.join(CACHE_DIR, 'ne', 'newcard123.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(CACHE_DIR, 'newcard123.jpg'))).toBe(false);
  });

  test('resolveCachedFilepath finds a sharded file', async () => {
    const { cacheCardImage, resolveCachedFilepath, CACHE_DIR } = require('../utils/imageCache');
    const { Readable } = require('stream');
    axios.mockResolvedValue({ data: Readable.from([Buffer.from('fake-image-bytes')]) });
    await cacheCardImage('shardedcard1', 'http://example.com/shardedcard1.jpg');

    expect(resolveCachedFilepath('shardedcard1')).toBe(path.join(CACHE_DIR, 'sh', 'shardedcard1.jpg'));
  });

  test('resolveCachedFilepath falls back to the old flat location for pre-migration files', () => {
    const { resolveCachedFilepath, CACHE_DIR } = require('../utils/imageCache');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'oldflat1.jpg'), 'fake-image-data');

    expect(resolveCachedFilepath('oldflat1')).toBe(path.join(CACHE_DIR, 'oldflat1.jpg'));
  });

  test('resolveCachedFilepath returns null when nothing is cached', () => {
    const { resolveCachedFilepath } = require('../utils/imageCache');
    expect(resolveCachedFilepath('nonexistent')).toBeNull();
  });
```

The existing test `'returns the local URL without downloading if already cached'` (writes a file directly into the flat `CACHE_DIR`) will continue to pass unchanged — it now exercises the flat-fallback path specifically, which is intentional.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd backend && timeout 60 npx jest imageCache --runInBand`
Expected: FAIL — `resolveCachedFilepath` is not exported yet, and images are written to the flat path.

- [ ] **Step 3: Implement**

Replace `backend/utils/imageCache.js` with:

```js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('stream/promises');

const CACHE_DIR = process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS || path.join(__dirname, '..', 'cached-images', 'mtg-cards');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Image cache directory created:', CACHE_DIR);
}

// Sharded image cache: files live under CACHE_DIR/<first 2 chars of scryfallId>/<scryfallId>.jpg
// rather than directly in CACHE_DIR, to keep the directory from becoming one
// enormous flat folder as more sets release. See backend/scripts/shardImageCache.js
// for the one-time migration of pre-existing flat-layout files.
function shardedPath(scryfallId) {
  return path.join(CACHE_DIR, scryfallId.slice(0, 2), `${scryfallId}.jpg`);
}

function flatPath(scryfallId) {
  return path.join(CACHE_DIR, `${scryfallId}.jpg`);
}

// Resolve an existing cached file's path, checking the sharded location first
// and falling back to the old flat location (for files not yet migrated).
// Returns null if the image isn't cached anywhere.
function resolveCachedFilepath(scryfallId) {
  const sharded = shardedPath(scryfallId);
  if (fs.existsSync(sharded)) return sharded;
  const flat = flatPath(scryfallId);
  if (fs.existsSync(flat)) return flat;
  return null;
}

// Download and cache image from Scryfall, return local path or fallback to URL
async function cacheCardImage(scryfallId, imageUrl) {
  if (!scryfallId || !imageUrl) {
    return null;
  }

  const localUrl = `/api/images/${scryfallId}`;

  // Check if already cached (sharded location first, then the old flat location)
  if (resolveCachedFilepath(scryfallId)) {
    console.log(`Image cache hit: ${scryfallId}`);
    return localUrl;
  }

  // Download and cache image into its sharded location
  const filepath = shardedPath(scryfallId);
  try {
    console.log(`Downloading image: ${scryfallId}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
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

module.exports = { CACHE_DIR, cacheCardImage, resolveCachedFilepath };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && timeout 60 npx jest imageCache --runInBand`
Expected: PASS (6 tests total in the file)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/utils/imageCache.js backend/__tests__/imageCache.test.js
git commit -m "perf: shard the image cache directory by scryfallId prefix"
```

---

## Task 5: Update GET /api/images/:scryfallId to use the sharded lookup

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Update the import**

In `backend/server.js`, change:

```js
const { CACHE_DIR, cacheCardImage } = require('./utils/imageCache');
```

to:

```js
const { CACHE_DIR, cacheCardImage, resolveCachedFilepath } = require('./utils/imageCache');
```

- [ ] **Step 2: Update the route**

Find `app.get('/api/images/:scryfallId', ...)` (search for `Serve cached images`). Replace:

```js
app.get('/api/images/:scryfallId', (req, res) => {
  const { scryfallId } = req.params;
  const filepath = path.join(CACHE_DIR, `${scryfallId}.jpg`);

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ message: 'Image not found in cache' });
  }
```

with:

```js
app.get('/api/images/:scryfallId', (req, res) => {
  const { scryfallId } = req.params;
  const filepath = resolveCachedFilepath(scryfallId);

  // Check if file exists
  if (!filepath) {
    return res.status(404).json({ message: 'Image not found in cache' });
  }
```

Leave the rest of the route (ETag/cache-header handling, `res.sendFile` or stream, whatever follows) untouched — it already just uses the `filepath` variable, which now comes from `resolveCachedFilepath` instead of a hardcoded flat join.

- [ ] **Step 3: Check for any other direct `CACHE_DIR` reads that assume the flat layout**

Search `backend/server.js` and `backend/routes/cards.js` for other `path.join(CACHE_DIR, ...)` usages (e.g. the `migrate-images-to-cache` route, or the cache-clearing logic in `update-all-prices`/`bulk-import`). These call `fs.existsSync(CACHE_DIR)` + `fs.readdirSync(CACHE_DIR)` to enumerate/delete cached files in bulk (not to look up one specific image by ID) — leave those as-is; they operate on `CACHE_DIR` as a whole directory tree question ("does the cache dir exist", "list all files in it for a bulk clear"), not a single-file lookup, so they aren't affected by sharding a single file's location. If any of them specifically constructs a per-scryfallId path via `path.join(CACHE_DIR, `${x}.jpg`)` expecting the flat layout, replace that one construction with `resolveCachedFilepath(x)` the same way — but do not change any code that's just doing a directory-wide `readdirSync`/`existsSync(CACHE_DIR)` check.

- [ ] **Step 4: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/server.js
git commit -m "fix: serve /api/images/:scryfallId from the sharded cache location"
```

---

## Task 6: One-time migration script for existing flat-layout images

**Files:**
- Create: `backend/scripts/shardImageCache.js`
- Create: `backend/__tests__/shardImageCache.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/shardImageCache.test.js
const fs = require('fs');
const path = require('path');

describe('shardImageCache migration script', () => {
  const testCacheDir = path.join(__dirname, '__tmp_shard_migration_cache__');

  beforeEach(() => {
    jest.resetModules();
    process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS = testCacheDir;
  });

  afterEach(() => {
    delete process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS;
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  test('moves flat files into their sharded subdirectories', () => {
    fs.mkdirSync(testCacheDir, { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'abc123.jpg'), 'fake-a');
    fs.writeFileSync(path.join(testCacheDir, 'def456.jpg'), 'fake-b');

    const { migrate } = require('../scripts/shardImageCache');
    const result = migrate();

    expect(result.moved).toBe(2);
    expect(fs.existsSync(path.join(testCacheDir, 'ab', 'abc123.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, 'de', 'def456.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, 'abc123.jpg'))).toBe(false);
  });

  test('is idempotent - a second run finds nothing left to move', () => {
    fs.mkdirSync(testCacheDir, { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'abc123.jpg'), 'fake-a');

    const { migrate } = require('../scripts/shardImageCache');
    migrate();
    const secondResult = migrate();

    expect(secondResult.moved).toBe(0);
  });

  test('does not recurse into already-sharded subdirectories looking for more work', () => {
    fs.mkdirSync(path.join(testCacheDir, 'ab'), { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'ab', 'abc999.jpg'), 'already-sharded');

    const { migrate } = require('../scripts/shardImageCache');
    const result = migrate();

    expect(result.moved).toBe(0);
    expect(fs.existsSync(path.join(testCacheDir, 'ab', 'abc999.jpg'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && timeout 60 npx jest shardImageCache --runInBand`
Expected: FAIL with "Cannot find module '../scripts/shardImageCache'"

- [ ] **Step 3: Implement**

```js
// backend/scripts/shardImageCache.js
//
// One-time migration: moves existing flat-layout cached images
// (backend/cached-images/mtg-cards/<scryfallId>.jpg) into their sharded
// subdirectories (backend/cached-images/mtg-cards/<first 2 chars>/<scryfallId>.jpg).
//
// Safe to run more than once - a second run finds no flat files left and does nothing.
//
// Usage: node backend/scripts/shardImageCache.js

const fs = require('fs');
const path = require('path');
const { CACHE_DIR } = require('../utils/imageCache');

function migrate() {
  const entries = fs.readdirSync(CACHE_DIR, { withFileTypes: true });
  const flatFiles = entries.filter(e => e.isFile() && e.name.endsWith('.jpg'));

  let moved = 0;
  let skipped = 0;

  for (const entry of flatFiles) {
    const shard = entry.name.slice(0, 2);
    const shardDir = path.join(CACHE_DIR, shard);
    const destPath = path.join(shardDir, entry.name);
    const srcPath = path.join(CACHE_DIR, entry.name);

    if (fs.existsSync(destPath)) {
      // Already present at destination (e.g. re-run after a partial migration) - remove the stale flat duplicate
      fs.unlinkSync(srcPath);
      skipped++;
      continue;
    }

    fs.mkdirSync(shardDir, { recursive: true });
    fs.renameSync(srcPath, destPath);
    moved++;
  }

  return { moved, skipped };
}

if (require.main === module) {
  const result = migrate();
  console.log(`Image cache migration complete: ${result.moved} files moved, ${result.skipped} already-migrated duplicates removed.`);
}

module.exports = { migrate };
```

Note `fs.readdirSync(CACHE_DIR, { withFileTypes: true })` with the `e.isFile()` filter naturally excludes subdirectories (including already-sharded ones from a prior partial run) — satisfying the "don't recurse into shard subdirectories" test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && timeout 60 npx jest shardImageCache --runInBand`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/shardImageCache.js backend/__tests__/shardImageCache.test.js
git commit -m "feat: add one-time migration script for sharding the image cache"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full backend test suite one more time**

Run: `cd backend && timeout 300 npx jest --runInBand`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke test**

Restart the backend so it picks up all changes. Confirm:
- `/similar`, `/synergies`, `/commanders/recommend` still return sensible results for a real card/collection, and a repeat request for the same card/query is noticeably faster (cache hit).
- A brand-new card image (one not already cached) gets written under its 2-character shard subdirectory in `backend/cached-images/mtg-cards/`, not the top-level flat directory.
- An already-cached (pre-migration, flat-layout) image still loads correctly via `GET /api/images/:scryfallId` (fallback path working).

- [ ] **Step 3: Run the one-time migration against the real cache directory**

Run: `cd backend && node scripts/shardImageCache.js`
Expected: reports the number of files moved (should be close to the current flat file count, e.g. ~37,000+), completes without error. After this, spot-check that a few known images still load correctly via the web app (now served from their sharded location, no longer needing the flat-path fallback).

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 6) before considering this done.

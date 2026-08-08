# Scryfall Query Caching & Image Cache Sharding Design

## Overview

Two independent backend improvements identified during a follow-up performance review:

1. Extend the existing `cachedApiCall` mechanism (already used by `/api/scryfall/search` and, as of the previous wave, `/api/sets/completion`) to the Scryfall search calls made by `/api/cards/:id/similar`, `/api/cards/:id/synergies`, and `/api/commanders/recommend`.
2. Shard the on-disk image cache directory (currently a single flat directory with 37,000+ files and growing as new sets release) into subdirectories, to keep filesystem operations fast as it scales.

A third candidate (sharing one `MongoMemoryServer` instance across the backend's 77 test files) was considered and explicitly dropped — the test-suite slowness observed during the prior wave was traced to orphaned `mongod` processes left behind by manually-killed test runs, not an inherent architectural problem, and a shared-instance refactor would touch all 77 test files for a modest, uncertain gain while introducing new cross-test-contamination risk.

## 1. Scryfall query caching

`backend/routes/cardInsights.js` (`/similar`, `/synergies`) and `backend/routes/commanders.js` (`/recommend`) each build one or more Scryfall search query strings and call `axios.get(...)` directly, uncached, every request. Two different users asking about the same card (or two requests for the same card over time) currently repeat the identical Scryfall call.

**Mechanism reused as-is:** `cachedApiCall(key, fetchFn)` from `backend/utils/apiCache.js` (24-hour TTL, Mongo-backed). No schema changes — the existing fixed 24h TTL is deliberately reused rather than introduced as a shorter, per-route value, since `/api/scryfall/search` already caches full card data (including price) for 24h with this exact mechanism, and `apiCacheSchema`'s TTL is a MongoDB collection-level `expires` setting shared by every entry, not a per-document value. Introducing a different TTL for these three routes would require redesigning the schema to store an explicit per-document expiry — added complexity for a benefit (fresher prices in "recommendation" features) that doesn't matter much: these are exploratory/suggestion features, not the primary collection-value display.

**Cache key convention:** `scryfall-search:<exact query string sent to Scryfall>` (namespaced with a `scryfall-search:` prefix, distinct from the existing `scryfall:name:setCode:collectorNumber` keys used by `/api/scryfall/search` and the `scryfall-set:<code>` keys used by `/api/sets/completion` — no collision risk since all three prefixes are textually distinct). Using the query string itself as the key means the cache is naturally per-distinct-query, not per-user or per-card-id, so identical questions about identical cards share one cache entry across the whole app.

**Per-route changes** (each wraps its existing `axios.get(...)` calls, in place, with no change to the query-building logic itself):

- **`cardInsights.js` `/similar`** (lines 24-33): wrap the primary query and the type-only fallback query, each keyed by its own query string.
- **`cardInsights.js` `/synergies`** (lines 99-141): wrap each of the up-to-4 independent Scryfall calls (tribal primary + tribal fallback, keywords, mechanics + type-based mechanic fallback), each keyed by its own query string. These are structurally independent try/catch blocks already — caching each individually is a direct, mechanical addition.
- **`commanders.js` `/recommend`** (lines 73-79): wrap the primary themed/colored query and the plain-legendary-creature fallback, each keyed by its own query string.

All existing error-handling/fallback structure is preserved exactly — `cachedApiCall` only wraps the "make the actual Scryfall request" step; if the wrapped `fetchFn` throws, `cachedApiCall` re-throws (per its existing implementation), so the surrounding try/catch in each route still triggers its fallback exactly as before.

## 2. Image cache sharding

**Current state:** `backend/utils/imageCache.js`'s `cacheCardImage` writes every downloaded image directly to `CACHE_DIR/​{scryfallId}.jpg` — one flat directory, currently 37,443 files. `GET /api/images/:scryfallId` (in `server.js`) reads from the same flat layout.

**Sharding scheme:** first 2 characters of the Scryfall ID (a UUID, e.g. `0000579f-...` → shard `00`), giving up to 256 subdirectories. At current volume that's ~150 files/directory average, and scales cleanly as new sets add more cards.

**Write path** (`cacheCardImage` in `imageCache.js`): compute `shardedFilepath = path.join(CACHE_DIR, scryfallId.slice(0, 2), filename)`; create the shard subdirectory (`fs.mkdirSync(path.dirname(shardedFilepath), {recursive: true})`) before writing; write there instead of the flat path.

**Read path, in both places that check for an existing cached image:**
- `cacheCardImage`'s own "already cached?" check.
- `GET /api/images/:scryfallId` in `server.js`.

Both check the **sharded path first**, and **fall back to the old flat path** if not found there. This is a deliberate safety net: if the one-time migration (below) hasn't run yet in some environment, or missed a file, the flat-path fallback means that file still serves correctly (just from its old location) instead of incorrectly 404ing or triggering a wasteful re-download. This fallback is cheap (one extra `fs.existsSync` check only on a sharded-path miss) and is not expected to be removed later — it costs nothing once migration is complete, since it only executes on a sharded-path miss.

**One-time migration script:** `backend/scripts/shardImageCache.js`, run manually once (not part of app startup, not part of the test suite). Iterates the top-level files directly in `CACHE_DIR` (not recursing into subdirectories — so already-sharded files, sitting in their shard subdirs from a previous partial run, are never revisited), and for each `<scryfallId>.jpg` file, moves it into its computed shard subdirectory (`fs.renameSync`). Idempotent by construction: a second run finds zero flat files left at the top level (since the first run already moved them all) and does nothing.

## Non-goals

- No change to the `GET /api/images/:scryfallId` URL contract, or anything the frontend/Discord bot calls — this is purely an internal file-layout change.
- No change to the existing `migrate-images-to-cache` route in `backend/routes/cards.js` (that route re-caches images for cards whose records don't yet reference a cached image — an unrelated, pre-existing feature that will keep working unchanged, since it calls `cacheCardImage` the same way and doesn't know or care about the internal file layout).
- Not sharing a single `MongoMemoryServer` instance across the test suite (explicitly dropped, see Overview).
- Not introducing a per-route/per-entry configurable TTL for the Mongo-backed API cache (explicitly dropped in favor of reusing the existing fixed 24h TTL, see section 1).

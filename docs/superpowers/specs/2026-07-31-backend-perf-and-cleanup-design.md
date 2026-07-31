# Backend Performance & Cleanup Design

## Overview

Three small, independent improvements identified during a review of the overall project:

1. Remove two redundant Mongoose index declarations that fire duplicate-index warnings on every server start.
2. Cache Scryfall set metadata (used by `GET /api/sets/completion`) using the app's existing 24-hour Mongo-backed API cache, instead of hitting Scryfall live on every request.
3. Extract the remaining 17 inline `/api/cards/*` route handlers out of `backend/server.js` into `backend/routes/cards.js`, continuing the modularization pattern already established this session (`priceFlags.js`, `cardInsights.js`, `commanders.js`, `sets.js`).

These are independent of each other and of the recently-shipped Discord bot work. No user-facing behavior changes except faster `/sets` responses on repeat requests.

## 1. Duplicate index cleanup

`backend/models/PasswordResetToken.js` and `backend/models/ForumCategory.js` each declare a field with `unique: true` (which Mongoose auto-indexes) *and* a separate `schema.index({...})` call for the same field, producing "Duplicate schema index" warnings on every process start and test run.

Fix: delete the redundant `passwordResetTokenSchema.index({ token: 1 })` (line 29) and `categorySchema.index({ slug: 1 })` (line 58) calls. The `unique: true` index remains and is sufficient.

## 2. Scryfall set-metadata caching

`backend/routes/sets.js`'s `/completion` route calls `axios.get('https://api.scryfall.com/sets/:code')` once per distinct owned set (up to 20), with no caching — every request re-fetches metadata that essentially never changes (a set's `name`, `card_count`, and `released_at` are fixed once printed).

The app already has a general-purpose cache for exactly this kind of external API response: `backend/server.js` defines an `ApiCache` Mongoose model (`{key, data, createdAt}`, TTL-indexed to auto-expire after 24 hours) and a `cachedApiCall(key, fetchFn)` helper, currently used by `/api/scryfall/search`. This design reuses that mechanism rather than inventing a new one.

**Extraction:** Move the `ApiCache` schema/model and `cachedApiCall` function out of `server.js` into a new `backend/utils/apiCache.js`, exporting both. `server.js`'s existing `/api/scryfall/search` route requires `cachedApiCall` from the new module instead of using the module-scope function (its behavior is unchanged — same model, same cache entries, just relocated).

**New usage:** In `routes/sets.js`, wrap the per-set Scryfall call:

```js
const { cachedApiCall } = require('../utils/apiCache');
// ...
const setInfo = await cachedApiCall(`scryfall-set:${code}`, async () => {
  const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
  return setResponse.data;
});
```

Cache key is namespaced (`scryfall-set:` prefix) so it can never collide with `/api/scryfall/search`'s existing `scryfall:name:setCode:collectorNumber` keys in the same `ApiCache` collection. Same 24-hour TTL as the existing cache (acceptable staleness window for data that changes maybe once a year, if ever, when Scryfall corrects a set's card count).

The per-set 100ms rate-limit delay (`await new Promise(resolve => setTimeout(...))`) only needs to apply around the actual Scryfall call, not the cache-hit path — on a fully-cached request, `/sets/completion` should return near-instantly with no artificial delay.

## 3. Extract `/api/cards/*` routes into `routes/cards.js`

**Routes moving** (currently inline in `server.js`, identified by line number as of this writing — exact lines will shift as earlier routes in the file are removed, so the implementer should re-locate each by its route signature, not assume the line numbers below stay accurate mid-extraction):

- `GET /api/cards` — list (uses stats/cards cache)
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

**Shared state these routes depend on, and where it goes:**

- **`Card` model** — stays defined in `server.js` (it's also used by many other already-extracted route files and by `deckRoutes.injectDependencies(...)`). `routes/cards.js` accesses it via `mongoose.model('Card')`, the same pattern `cardInsights.js`/`commanders.js`/`sets.js` already use — no behavior change, just consistent access style.
- **In-memory cards/stats cache** (`cache`, `getFromCache`, `setInCache`, `clearCache`) — extract verbatim into `backend/utils/statsCache.js`, exporting `getFromCache`/`setInCache`/`clearCache`. Both `server.js` (still needs it for `/api/stats`, which is not moving) and `routes/cards.js` import from there. Behavior unchanged (same 5-minute TTL, same in-memory `Map`-per-key structure) — this is a relocation, not a redesign.
- **Image cache** (`CACHE_DIR`, `cacheCardImage`) — extract verbatim into `backend/utils/imageCache.js`, exporting `CACHE_DIR` and `cacheCardImage`. Both `server.js` (still needs it for `/api/scryfall/search` and `/api/images/:scryfallId`, neither of which move) and `routes/cards.js` import from there.
- **`getPriceWithFallback`** — already a separate importable module (`backend/utils/pricing.js`); `routes/cards.js` just requires it directly, no change needed.
- **`activityLoggers`** — already a separate importable middleware module (`backend/middleware/activityLogger.js`); `routes/cards.js` requires it directly, same as other route files already do.

**Mounting:** In `server.js`, replace the 17 inline route definitions with `app.use('/api/cards', require('./routes/cards'));`, placed alongside the existing `/api/cards` mounts (`priceFlags.js`, `cardInsights.js`). Express allows multiple routers mounted on the same path prefix — this is the same pattern already in use.

**Router internals:** `routes/cards.js` follows the established shape: `router.use(verifyToken)` at the top, `requireAuth`/`requireEditor` per-route exactly as each currently has it, same try/catch → `{message: error.message}` error handling as the original inline handlers. This is a pure relocation of working code — no route's logic, validation, or response shape changes.

## Non-goals

- No change to the `/api/scryfall/search` route's own behavior or cache key format — it keeps working exactly as before, just importing `cachedApiCall`/`cacheCardImage`/`CACHE_DIR` from their new locations instead of using module-scope definitions.
- No change to `/api/stats`, `/api/images/:scryfallId`, or any other route staying in `server.js`.
- Not attempting the "full migration" of every remaining inline route (locations, wishlist, etc.) — scoped to `/api/cards` only, per explicit decision.
- Not adding caching to `/similar`, `/synergies`, or `/commanders/recommend` — those return collection-dependent, potentially-stale-sensitive results and were explicitly excluded from this pass.

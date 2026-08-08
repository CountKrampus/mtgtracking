# Price-Source Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track which pricing source (Scryfall / MTGGoldfish backup / not-found) each price fetch resolves to, and surface a rolling 30-day breakdown + trend chart in the admin panel's Pricing tab.

**Architecture:** A new capped (TTL-indexed) `PriceSourceLog` collection, written to fire-and-forget from inside `getPriceWithFallback` (the single chokepoint every price fetch already goes through). A new aggregation route computes totals/percentages/daily trend from the log. A new section in the existing `PricingAdminTab.js` displays it.

**Tech Stack:** Node/Express/Mongoose backend with Jest tests; React frontend with no test infrastructure (verified via `npm run build` + manual click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-price-source-health-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `getPriceWithFallback` (`backend/utils/pricing.js:80-101`) has exactly three `return` statements, each already producing a `source` value: `'Scryfall'`, `'MTGGoldfish (backup)'`, `'None (not found)'`.
- `backend/__tests__/pricing.test.js` already tests this function extensively by mocking `axios` — **with no live database connection** (no `mongodb-memory-server` in that file). The new logging call must not throw or produce unhandled-rejection noise in that test file; catch and swallow any logging error.
- No existing TTL index precedent in this codebase — this is the first use of MongoDB's `expireAfterSeconds`.
- `requirePermission('prices:force-update')` is the existing permission key gating the Pricing tab's other admin route (`POST /admin/force-price-update`, `backend/routes/admin.js:1818`) — reuse it for the new read-only route rather than introducing a new permission key for a single endpoint on the same admin surface.
- `PricingAdminTab.js` has an established two-section pattern (`{/* ── Section 1: ... ── */}` / `{/* ── Section 2: ... ── */}`) — add a third section following the same structure, after "Recent Price Jobs" (ends around line 361).
- Frontend admin tabs in this codebase use `useAuthContext()`'s `authFetch` (not raw `fetch`/`axios`) — matching `PricingAdminTab.js`'s own existing pattern.

---

## Task 1: Backend — model, instrumentation, and aggregation route

**Files:**
- Create: `backend/models/PriceSourceLog.js`
- Modify: `backend/utils/pricing.js`
- Modify: `backend/routes/admin.js`
- Test: `backend/__tests__/priceSourceHealth.test.js` (new)

- [ ] **Step 1: Create the model**

Create `backend/models/PriceSourceLog.js`:
```js
const mongoose = require('mongoose');

const priceSourceLogSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['Scryfall', 'MTGGoldfish (backup)', 'None (not found)'],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// TTL index: MongoDB automatically deletes documents 30 days after createdAt,
// keeping this collection self-pruning with no application-level cleanup job.
priceSourceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('PriceSourceLog', priceSourceLogSchema);
```

- [ ] **Step 2: Instrument `getPriceWithFallback`**

Read `backend/utils/pricing.js` first to find the exact three `return` statements inside `getPriceWithFallback` (around lines 89, 98, 101 per the spec's research). Add `require('../models/PriceSourceLog')` at the top of the file, and before each of the three returns, add a fire-and-forget logging call. For example, the `'Scryfall'` branch:
```js
      logPriceSource('Scryfall');
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall' };
```
the `'MTGGoldfish (backup)'` branch:
```js
      logPriceSource('MTGGoldfish (backup)');
      return { cad: 0, usd: goldfish.usd, source: 'MTGGoldfish (backup)' };
```
and the `'None (not found)'` branch:
```js
    logPriceSource('None (not found)');
    return { cad: 0, usd: 0, source: 'None (not found)' };
```

Add the helper function itself near the top of the file (module scope), after the imports:
```js
function logPriceSource(source) {
  // Fire-and-forget: a logging failure (including "no DB connection", which
  // is the case in this file's own unit tests) must never break an actual
  // price fetch, since this log is purely observational.
  PriceSourceLog.create({ source }).catch(() => {});
}
```

- [ ] **Step 3: Verify the existing pricing tests still pass unmodified**

Run: `cd backend && npm test -- pricing.test`
Expected: PASS, same test count as before this change — confirms the fire-and-forget logging doesn't break or hang the existing mock-only tests.

- [ ] **Step 4: Write the aggregation route + its tests**

Create `backend/__tests__/priceSourceHealth.test.js`, matching this repo's `mongodb-memory-server`/`supertest` convention (see `backend/__tests__/trades-matches.test.js` for the exact boilerplate shape — same `beforeAll`/`afterAll`/`afterEach`/`makeToken`/`buildApp` structure, adapted to mount `../routes/admin` instead of `../routes/trades`, and to create an admin-role user for `makeToken` since this route requires the `prices:force-update` permission):

```js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PriceSourceLog = require('../models/PriceSourceLog');
const Role = require('../models/Role');
const { verifyToken } = require('../middleware/auth');
const { refreshRoleCache } = require('../utils/permissions');

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
  app.use(verifyToken);
  app.use('/api/admin', require('../routes/admin'));
  return app;
}

describe('GET /api/admin/price-source-health', () => {
  let app, admin;

  beforeEach(async () => {
    app = buildApp();
    await Role.seedBuiltInRoles();
    await Role.grantMigrationPermissions();
    await refreshRoleCache();
    admin = await User.create({ email: 'admin@test.com', username: 'admin', passwordHash: 'x', role: 'admin' });
  });

  test('401 without auth', async () => {
    await request(app).get('/api/admin/price-source-health').expect(401);
  });

  test('returns zeroed totals with no logs', async () => {
    const res = await request(app)
      .get('/api/admin/price-source-health')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.totalFetches).toBe(0);
    expect(res.body.bySource.Scryfall.count).toBe(0);
    expect(res.body.dailyTrend).toEqual([]);
  });

  test('computes correct counts and percentages across sources', async () => {
    await PriceSourceLog.create([
      { source: 'Scryfall' }, { source: 'Scryfall' }, { source: 'Scryfall' },
      { source: 'MTGGoldfish (backup)' },
      { source: 'None (not found)' },
    ]);

    const res = await request(app)
      .get('/api/admin/price-source-health')
      .set('Authorization', `Bearer ${makeToken(admin)}`)
      .expect(200);

    expect(res.body.totalFetches).toBe(5);
    expect(res.body.bySource.Scryfall.count).toBe(3);
    expect(res.body.bySource.Scryfall.percentage).toBe(60);
    expect(res.body.bySource['MTGGoldfish (backup)'].count).toBe(1);
    expect(res.body.bySource['None (not found)'].count).toBe(1);
  });
});
```

This import/usage pattern (`Role` as a default export with static `seedBuiltInRoles`/`grantMigrationPermissions` methods, `refreshRoleCache` from `../utils/permissions`) is confirmed directly from `backend/__tests__/admin-badges-permissions.test.js:10-11,43-46` — copy it exactly, don't substitute an assumed shape.

Now add the route itself in `backend/routes/admin.js`, near the other pricing-related routes (after the `force-price-update` job-status route, or wherever pricing-admin routes are grouped in this file):

```js
const PriceSourceLog = require('../models/PriceSourceLog');

/**
 * GET /api/admin/price-source-health - Rolling 30-day price-source breakdown and trend
 */
router.get('/price-source-health', requirePermission('prices:force-update'), async (req, res) => {
  try {
    const logs = await PriceSourceLog.find({});
    const totalFetches = logs.length;

    const sources = ['Scryfall', 'MTGGoldfish (backup)', 'None (not found)'];
    const bySource = {};
    for (const source of sources) {
      const count = logs.filter(l => l.source === source).length;
      bySource[source] = {
        count,
        percentage: totalFetches > 0 ? Math.round((count / totalFetches) * 1000) / 10 : 0,
      };
    }

    const byDay = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, Scryfall: 0, 'MTGGoldfish (backup)': 0, 'None (not found)': 0 };
      byDay[day][log.source]++;
    }
    const dailyTrend = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ totalFetches, bySource, dailyTrend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Note: this loads all matching logs into memory and aggregates in JS rather than a Mongo aggregation pipeline. At realistic volumes (a single-collection-tracker app's 30-day price-fetch count — hundreds to low thousands, not millions), this is simpler to read and test than an aggregation pipeline and is not a performance concern; revisit only if it actually becomes one.

- [ ] **Step 5: Run the new tests**

Run: `cd backend && npm test -- priceSourceHealth`
Expected: PASS, all 3 tests.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`
Expected: all suites pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add backend/models/PriceSourceLog.js backend/utils/pricing.js backend/routes/admin.js backend/__tests__/priceSourceHealth.test.js
git commit -m "feat: track and expose price-source usage for admin health dashboard"
```

---

## Task 2: Frontend — Price Source Health section in `PricingAdminTab.js`

**Files:**
- Modify: `frontend/src/components/admin/data-pricing/PricingAdminTab.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Fetch the health data**

Read `PricingAdminTab.js`'s existing `useState`/`useEffect`/`authFetch` pattern first (it already fetches job status via `authFetch` elsewhere in this file — match that exact style). Add state and a fetch effect:

```js
  const [sourceHealth, setSourceHealth] = useState(null);
  const [sourceHealthLoading, setSourceHealthLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API_URL}/admin/price-source-health`)
      .then(r => r.json())
      .then(setSourceHealth)
      .catch(() => setSourceHealth(null))
      .finally(() => setSourceHealthLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 2: Add the section**

Add module-scope helper components above `PricingAdminTab` (alongside the existing `StatusBadge`/`ProgressBar` helpers), matching this file's established "module-scope helpers, not nested" convention:

```jsx
function SourceStatCard({ label, count, percentage, tone }) {
  const toneClasses = {
    good: 'text-green-400',
    warn: 'text-yellow-400',
    bad: 'text-red-400',
  };
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClasses[tone]}`}>{percentage}%</p>
      <p className="text-gray-500 text-xs">{count} fetches</p>
    </div>
  );
}

function DailyTrendChart({ dailyTrend }) {
  if (dailyTrend.length === 0) return null;
  const maxDaily = Math.max(...dailyTrend.map(d => d.Scryfall + d['MTGGoldfish (backup)'] + d['None (not found)']), 1);
  return (
    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
      {dailyTrend.map(d => {
        const total = d.Scryfall + d['MTGGoldfish (backup)'] + d['None (not found)'];
        const heightPct = (total / maxDaily) * 100;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-shrink-0 w-6" title={`${d.date}: ${total} fetches`}>
            <div className="w-full bg-gray-700 rounded-t flex flex-col-reverse overflow-hidden" style={{ height: `${heightPct}%`, minHeight: total > 0 ? '4px' : '0' }}>
              <div className="w-full bg-green-500" style={{ height: `${(d.Scryfall / total) * 100}%` }} />
              <div className="w-full bg-yellow-500" style={{ height: `${(d['MTGGoldfish (backup)'] / total) * 100}%` }} />
              <div className="w-full bg-red-500" style={{ height: `${(d['None (not found)'] / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Add the section itself right after the "Recent Price Jobs" section (after its closing `</div>`, before the outer container's closing `</div>` and `);`):

```jsx
      {/* ── Section 3: Price Source Health ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-purple-400" />
            Price Source Health
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Which pricing source recent updates actually resolved to, over the last 30 days.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {sourceHealthLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : !sourceHealth || sourceHealth.totalFetches === 0 ? (
            <p className="text-gray-400 text-sm">No price fetches recorded in the last 30 days yet — this fills in as prices are updated.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <SourceStatCard label="Scryfall" count={sourceHealth.bySource.Scryfall.count} percentage={sourceHealth.bySource.Scryfall.percentage} tone="good" />
                <SourceStatCard label="MTGGoldfish Backup" count={sourceHealth.bySource['MTGGoldfish (backup)'].count} percentage={sourceHealth.bySource['MTGGoldfish (backup)'].percentage} tone="warn" />
                <SourceStatCard label="Not Found" count={sourceHealth.bySource['None (not found)'].count} percentage={sourceHealth.bySource['None (not found)'].percentage} tone="bad" />
              </div>
              <DailyTrendChart dailyTrend={sourceHealth.dailyTrend} />
            </>
          )}
        </div>
      </div>
```

Add the `Activity` icon to this file's existing `lucide-react` import line if it's not already imported.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server + backend from Task 1 running:
- Open the admin panel's Pricing tab fresh (before triggering any price updates) — confirm the empty-state message renders, not a broken/blank chart.
- Trigger a price update for a few cards (individual update or a small bulk update) to generate some `PriceSourceLog` entries.
- Reload the Pricing tab — confirm the stat cards now show non-zero counts/percentages summing sensibly, and the daily trend chart shows today's bar.
- At 375px width: confirm the 3-stat-card grid and the trend chart's horizontal scroll (`overflow-x-auto`) behave correctly rather than clipping or forcing page-level horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/data-pricing/PricingAdminTab.js
git commit -m "feat: add price source health section to admin Pricing tab"
```

---

## Task 3: Final verification

- [ ] **Step 1: Full backend test suite**

Run: `cd backend && npm test`
Expected: all pass, no regressions.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 3: End-to-end manual smoke test**

Full click-through at both mobile (375px) and desktop (1280px) widths: trigger a mix of price updates (some that would hit Scryfall successfully, and if feasible one for an obscure/nonexistent card name to exercise the "not found" path), confirm the dashboard reflects the mix correctly, and confirm the existing "Force Price Update" / "Recent Price Jobs" sections are completely unaffected by this change.

- [ ] **Step 4: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

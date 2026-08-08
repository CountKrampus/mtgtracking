# Price-Source Health Dashboard & Price-Flag Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin tab showing pricing pipeline health stats (Scryfall vs MTGGoldfish fallback rates + 30-day daily trend table), and make price-flag resolution notifications tell the user what the price was updated to.

**Architecture:** The backend for both features already exists — `GET /api/admin/price-source-health` returns aggregated `PriceSourceLog` data, and the `PUT /admin/price-flags/:id` route already creates a `Notification` on resolve/dismiss. This plan is frontend-heavy: one new admin tab component, one AdminPanel wiring change, one emoji map entry, and one backend string edit with a test.

**Tech Stack:** React, Tailwind CSS, lucide-react, Express/Mongoose (backend tweak only), Jest/Supertest (backend test)

---

## File Map

| File | Change |
|------|--------|
| `backend/routes/admin.js` | Lift `resolvedPrice` out of the resolve branch so it's available when building the notification string |
| `backend/__tests__/admin-price-flags.test.js` | Add test verifying notification content includes the new price |
| `frontend/src/components/NotificationBell.js` | Add `price_flag_resolved: '🏳️'` to `typeEmojis` |
| `frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js` | **Create** — new tab with stat cards + daily trend table |
| `frontend/src/components/admin/AdminPanel.js` | Import tab, add nav item, add switch case |

---

## Task 1: Backend — include new price in resolution notification

**Files:**
- Modify: `backend/routes/admin.js` (around line 2869, the `PUT /admin/price-flags/:id` handler)
- Test: `backend/__tests__/admin-price-flags.test.js`

- [ ] **Step 1: Write the failing test**

Open `backend/__tests__/admin-price-flags.test.js`. Add `Notification` import near the top with the other model imports:

```js
const Notification = require('../models/Notification');
```

Add `await Notification.deleteMany({})` to the `afterEach` block (it currently clears Card, User, PriceFlag, ModerationHistory):

```js
afterEach(async () => {
  await Card.deleteMany({});
  await User.deleteMany({});
  await PriceFlag.deleteMany({});
  await ModerationHistory.deleteMany({});
  await Notification.deleteMany({});
  jest.clearAllMocks();
});
```

Add this test inside the `describe('PUT /api/admin/price-flags/:id', ...)` block, after the existing `'resolve triggers a forced price refresh...'` test:

```js
it('resolve notification includes the updated price', async () => {
  const admin = await createUser({ role: 'admin' });
  const flagger = await createUser({ reputation: 60 });
  const card = await Card.create({ userId: flagger._id, name: 'Test Card', price: 5 });
  const flag = await PriceFlag.create({ cardId: card._id, flaggedBy: flagger._id, status: 'pending' });
  axios.get.mockResolvedValue({ data: { prices: { usd: '12.34' } } });

  const app = buildApp();
  await request(app)
    .put(`/api/admin/price-flags/${flag._id}`)
    .set('Authorization', `Bearer ${makeToken(admin._id, 'admin')}`)
    .send({ action: 'resolve' })
    .expect(200);

  const notif = await Notification.findOne({ userId: flagger._id, type: 'price_flag_resolved' });
  expect(notif).not.toBeNull();
  expect(notif.content).toContain('$12.34');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```
cd backend
npx jest --testPathPattern=admin-price-flags --no-coverage
```

Expected: FAIL — `expect(notif.content).toContain('$12.34')` fails because the current content string doesn't include the price.

- [ ] **Step 3: Implement the fix in admin.js**

In `backend/routes/admin.js`, find the `PUT /admin/price-flags/:id` handler (around line 2859). Replace this block:

```js
let cardName = 'Unknown Card';
if (action === 'resolve') {
  const Card = mongoose.model('Card');
  const card = await Card.findById(flag.cardId);
  if (card) {
    cardName = card.name;
    const priceData = await getPriceWithFallback(card.name, card.isFoil);
    if (priceData.usd > 0) {
      card.lastPrice = card.price;
      card.price = priceData.usd;
      await card.save();
    }
  }
} else {
  const Card = mongoose.model('Card');
  const card = await Card.findById(flag.cardId).select('name').lean();
  if (card) cardName = card.name;
}
```

With:

```js
let cardName = 'Unknown Card';
let resolvedPrice = 0;
if (action === 'resolve') {
  const Card = mongoose.model('Card');
  const card = await Card.findById(flag.cardId);
  if (card) {
    cardName = card.name;
    const priceData = await getPriceWithFallback(card.name, card.isFoil);
    if (priceData.usd > 0) {
      card.lastPrice = card.price;
      card.price = priceData.usd;
      resolvedPrice = priceData.usd;
      await card.save();
    }
  }
} else {
  const Card = mongoose.model('Card');
  const card = await Card.findById(flag.cardId).select('name').lean();
  if (card) cardName = card.name;
}
```

Then find the notification content block (around line 2900) and replace:

```js
const content = action === 'resolve'
  ? `Your price correction for ${cardName} was accepted and the price has been updated.`
  : `Your price correction for ${cardName} was reviewed and dismissed.`;
```

With:

```js
const priceStr = resolvedPrice > 0 ? ` — updated to $${resolvedPrice.toFixed(2)}` : '';
const content = action === 'resolve'
  ? `Your price flag for ${cardName} was accepted${priceStr}.`
  : `Your price flag for ${cardName} was reviewed and dismissed.`;
```

- [ ] **Step 4: Run the test to verify it passes**

```
cd backend
npx jest --testPathPattern=admin-price-flags --no-coverage
```

Expected: All tests in the file PASS.

- [ ] **Step 5: Commit**

```
git add backend/routes/admin.js backend/__tests__/admin-price-flags.test.js
git commit -m "feat: include resolved price in price-flag notification"
```

---

## Task 2: Frontend — add emoji for price_flag_resolved notifications

**Files:**
- Modify: `frontend/src/components/NotificationBell.js` (line 16, the `typeEmojis` object)

- [ ] **Step 1: Add the emoji entry**

Open `frontend/src/components/NotificationBell.js`. Find the `typeEmojis` object (line 16):

```js
const typeEmojis = {
  mention: '💬',
  reply: '📝',
  upvote: '⬆️',
  dm: '💌',
  price_alert: '📉',
  collection_health_report: '📊'
};
```

Replace with:

```js
const typeEmojis = {
  mention: '💬',
  reply: '📝',
  upvote: '⬆️',
  dm: '💌',
  price_alert: '📉',
  collection_health_report: '📊',
  price_flag_resolved: '🏳️'
};
```

- [ ] **Step 2: Commit**

```
git add frontend/src/components/NotificationBell.js
git commit -m "feat: add emoji for price_flag_resolved notifications"
```

---

## Task 3: Create PriceSourceHealthTab component

**Files:**
- Create: `frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js` with this full content:

```jsx
import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function StatCard({ icon: Icon, label, value, color = 'purple' }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-500/20`}>
          <Icon className={`text-${color}-400`} size={20} />
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function PriceSourceHealthTab() {
  const { authFetch } = useAuthContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/price-source-health`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  const scryfall = data.bySource?.Scryfall ?? { count: 0, percentage: 0 };
  const goldfish = data.bySource?.['MTGGoldfish (backup)'] ?? { count: 0, percentage: 0 };
  const notFound = data.bySource?.['None (not found)'] ?? { count: 0, percentage: 0 };
  const notFoundColor = notFound.percentage > 5 ? 'red' : notFound.percentage > 2 ? 'amber' : 'gray';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Price Source Health (30 days)</h3>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Fetches"
          value={data.totalFetches.toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Scryfall Hit Rate"
          value={`${scryfall.percentage}%`}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="MTGGoldfish Fallback"
          value={`${goldfish.percentage}%`}
          color="yellow"
        />
        <StatCard
          icon={AlertTriangle}
          label="Not Found Rate"
          value={`${notFound.percentage}%`}
          color={notFoundColor}
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">Daily Breakdown</h4>
        {data.dailyTrend.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet — prices have not been fetched.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="py-2 pr-6 text-gray-400">Date</th>
                  <th className="py-2 pr-6 text-green-400">Scryfall</th>
                  <th className="py-2 pr-6 text-yellow-400">MTGGoldfish</th>
                  <th className="py-2 text-red-400">Not Found</th>
                </tr>
              </thead>
              <tbody>
                {[...data.dailyTrend].reverse().map((row, i) => (
                  <tr
                    key={row.date}
                    className={`border-b border-gray-800 ${i % 2 !== 0 ? 'bg-gray-700/20' : ''}`}
                  >
                    <td className="py-1.5 pr-6 text-gray-300 font-mono text-xs">{row.date}</td>
                    <td className="py-1.5 pr-6 text-green-400">{row.Scryfall}</td>
                    <td className="py-1.5 pr-6 text-yellow-400">{row['MTGGoldfish (backup)']}</td>
                    <td className={`py-1.5 ${row['None (not found)'] > 0 ? 'text-amber-400 font-semibold' : 'text-gray-500'}`}>
                      {row['None (not found)']}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PriceSourceHealthTab;
```

- [ ] **Step 2: Commit**

```
git add frontend/src/components/admin/data-pricing/PriceSourceHealthTab.js
git commit -m "feat: add PriceSourceHealthTab admin component"
```

---

## Task 4: Wire PriceSourceHealthTab into AdminPanel

**Files:**
- Modify: `frontend/src/components/admin/AdminPanel.js`

- [ ] **Step 1: Add import**

Open `frontend/src/components/admin/AdminPanel.js`. Find the block of data-pricing imports (lines 11–16):

```js
import SystemHealthTab from './data-pricing/SystemHealthTab';
import PricingAdminTab from './data-pricing/PricingAdminTab';
import CollectionAuditsTab from './data-pricing/CollectionAuditsTab';
import BackupsExportsTab from './data-pricing/BackupsExportsTab';
import DataCleanupTab from './data-pricing/DataCleanupTab';
import PriceCorrectionsTab from './data-pricing/PriceCorrectionsTab';
```

Add one line at the end of that block:

```js
import SystemHealthTab from './data-pricing/SystemHealthTab';
import PricingAdminTab from './data-pricing/PricingAdminTab';
import CollectionAuditsTab from './data-pricing/CollectionAuditsTab';
import BackupsExportsTab from './data-pricing/BackupsExportsTab';
import DataCleanupTab from './data-pricing/DataCleanupTab';
import PriceCorrectionsTab from './data-pricing/PriceCorrectionsTab';
import PriceSourceHealthTab from './data-pricing/PriceSourceHealthTab';
```

- [ ] **Step 2: Add the nav item**

Find the `dataPricing` tabs array (around line 49):

```js
tabs: [
  { id: 'health', label: 'System Health', icon: Server, requiresRole: 'admin' },
  { id: 'pricing', label: 'Pricing', icon: BarChart2, requiresRole: 'content_manager' },
  { id: 'audits', label: 'Collection Audits', icon: FileText, requiresRole: 'content_manager' },
  { id: 'backups', label: 'Backups & Exports', icon: Archive, requiresRole: 'admin' },
  { id: 'cleanup', label: 'Data Cleanup', icon: Trash2, requiresRole: 'admin' },
  { id: 'priceFlags', label: 'Price Flags', icon: Flag, requiresRole: 'moderator' }
]
```

Add the new entry after `priceFlags`:

```js
tabs: [
  { id: 'health', label: 'System Health', icon: Server, requiresRole: 'admin' },
  { id: 'pricing', label: 'Pricing', icon: BarChart2, requiresRole: 'content_manager' },
  { id: 'audits', label: 'Collection Audits', icon: FileText, requiresRole: 'content_manager' },
  { id: 'backups', label: 'Backups & Exports', icon: Archive, requiresRole: 'admin' },
  { id: 'cleanup', label: 'Data Cleanup', icon: Trash2, requiresRole: 'admin' },
  { id: 'priceFlags', label: 'Price Flags', icon: Flag, requiresRole: 'moderator' },
  { id: 'priceSourceHealth', label: 'Price Sources', icon: Activity, requiresRole: 'moderator' }
]
```

`Activity` is already imported in this file (line 1: `import { X, Users, Activity, ... }`).

- [ ] **Step 3: Add the switch case**

Find the `renderTab` function or switch statement. Find this block (around line 104–109):

```js
case 'health':     return <SystemHealthTab />;
case 'pricing':    return <PricingAdminTab />;
case 'audits':     return <CollectionAuditsTab />;
case 'backups':    return <BackupsExportsTab />;
case 'cleanup':    return <DataCleanupTab />;
case 'priceFlags': return <PriceCorrectionsTab />;
```

Add one line:

```js
case 'health':           return <SystemHealthTab />;
case 'pricing':          return <PricingAdminTab />;
case 'audits':           return <CollectionAuditsTab />;
case 'backups':          return <BackupsExportsTab />;
case 'cleanup':          return <DataCleanupTab />;
case 'priceFlags':       return <PriceCorrectionsTab />;
case 'priceSourceHealth': return <PriceSourceHealthTab />;
```

- [ ] **Step 4: Commit**

```
git add frontend/src/components/admin/AdminPanel.js
git commit -m "feat: wire PriceSourceHealthTab into Admin Panel"
```

---

## Manual verification

After all tasks are done:

1. Start the app (`start-both-servers.bat`)
2. Log in as an admin
3. Open Admin Panel → Data & Pricing → "Price Sources"
   - Should see 4 stat cards and a daily trend table (or "No data yet" if prices haven't been fetched)
4. Go to collection, update a card's price — then refresh the tab
   - Total Fetches should increment; the correct source row should appear in the table
5. Log in as a user with reputation ≥ 50, flag a card's price
6. Log in as admin, go to Admin Panel → Price Flags, resolve the flag
7. Log back in as the flagging user, open the notification bell
   - Should see a 🏳️ notification saying "...accepted — updated to $X.XX"

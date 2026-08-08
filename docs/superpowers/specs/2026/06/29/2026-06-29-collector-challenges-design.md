# Collector Challenges — Design Spec

**Goal:** Monthly community challenges covering collection, trading, and social activity. Admins create challenges directly; users propose challenges admins approve. Progress auto-tracked where measurable; manual proof submission for subjective challenges.

---

## Models

### `backend/models/Challenge.js`

```js
{
  title:        { type: String, required: true, maxlength: 100 },
  description:  { type: String, required: true, maxlength: 500 },
  metric:       { type: String, enum: [
    // Collection
    'foils_added', 'cards_added', 'value_added', 'color_added',
    'rarity_added', 'unique_sets', 'set_completion', 'high_value_card',
    // Trading
    'trades_completed', 'wishlist_acquired',
    // Social
    'forum_posts', 'forum_threads', 'forum_upvotes',
    // Manual
    'custom'
  ], required: true },
  params:       { type: Mixed, default: {} },
  // params examples:
  // color_added:    { color: 'blue' }
  // rarity_added:   { rarity: 'mythic' }
  // set_completion: { setCode: 'MOM', targetPercent: 50 }
  // high_value_card:{ minValue: 50 }
  target:       { type: Number, required: true },   // N (count, $, or %)
  month:        { type: String, required: true },   // 'YYYY-MM'
  status:       { type: String, enum: ['draft','active','closed'], default: 'draft' },
  isProposal:   { type: Boolean, default: false },
  proposedBy:   { type: ObjectId, ref: 'User', default: null },
  createdBy:    { type: ObjectId, ref: 'User', default: null },
  approvedBy:   { type: ObjectId, ref: 'User', default: null },
  createdAt:    { type: Date, default: Date.now }
}
```

Index: `{ month: 1, status: 1 }` — list active challenges by month.

### `backend/models/ChallengeParticipation.js`

```js
{
  userId:      { type: ObjectId, ref: 'User', required: true },
  challengeId: { type: ObjectId, ref: 'Challenge', required: true },
  progress:    { type: Number, default: 0 },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  proofNote:   { type: String, default: '', maxlength: 1000 }, // manual challenges only
  verifiedBy:  { type: ObjectId, ref: 'User', default: null }, // admin verify for manual
  updatedAt:   { type: Date, default: Date.now }
}
```

Compound unique index: `{ userId: 1, challengeId: 1 }`.

---

## Progress Computation

Module `backend/utils/challengeProgress.js` — exported function `computeProgress(challenge, userId, monthStart, monthEnd)`.

Returns a number representing current progress toward `challenge.target`.

```js
async function computeProgress(challenge, userId, monthStart, monthEnd) {
  const { metric, params } = challenge;
  
  switch (metric) {
    case 'foils_added':
      return Card.countDocuments(buildUserQuery(userId, {
        isFoil: true, createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'cards_added':
      return Card.countDocuments(buildUserQuery(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'value_added': {
      const cards = await Card.find(buildUserQuery(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }), 'price');
      return cards.reduce((sum, c) => sum + (c.price || 0), 0);
    }

    case 'color_added':
      return Card.countDocuments(buildUserQuery(userId, {
        colors: params.color,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'rarity_added':
      return Card.countDocuments(buildUserQuery(userId, {
        rarity: params.rarity,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));

    case 'unique_sets': {
      const sets = await Card.distinct('set', buildUserQuery(userId, {
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }));
      return sets.length;
    }

    case 'set_completion': {
      const owned = await Card.countDocuments(buildUserQuery(userId, { setCode: params.setCode }));
      const total = await getScryfallSetSize(params.setCode); // fetch+cache from Scryfall /sets/:code
      return total > 0 ? Math.round((owned / total) * 100) : 0;
    }

    case 'high_value_card': {
      const card = await Card.findOne(buildUserQuery(userId, { price: { $gte: params.minValue } }));
      return card ? params.minValue : 0; // binary: 0 or target
    }

    case 'trades_completed':
      return TradeOffer.countDocuments({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        status: 'accepted',
        updatedAt: { $gte: monthStart, $lte: monthEnd }
      });

    case 'wishlist_acquired':
      // WishlistItem has an acquiredAt field set when acquired
      return WishlistItem.countDocuments({
        userId,
        acquiredAt: { $gte: monthStart, $lte: monthEnd }
      });

    case 'forum_posts':
      return ForumPost.countDocuments({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        isHidden: { $ne: true }
      });

    case 'forum_threads':
      return ForumThread.countDocuments({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        isHidden: { $ne: true }
      });

    case 'forum_upvotes': {
      const posts = await ForumPost.find({
        authorId: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }, 'likes');
      return posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    }

    case 'custom':
      // Manual — return stored ChallengeParticipation.progress
      const p = await ChallengeParticipation.findOne({ userId, challengeId: challenge._id });
      return p?.progress || 0;

    default:
      return 0;
  }
}
```

`buildUserQuery` imported from `backend/middleware/multiUser.js`.
`getScryfallSetSize` fetches `https://api.scryfall.com/sets/:code` and caches result in a module-level Map (TTL: 24 hours) — set sizes don't change.

---

## Backend Routes

All challenge routes in a new file `backend/routes/challenges.js`, registered as `app.use('/api/challenges', challengesRouter)` in `server.js`.

### `GET /api/challenges`

Public (no auth required — shows active challenges; participation data requires auth).

- Fetch all `Challenge` docs where `month === currentMonth` and `status === 'active'`.
- If authenticated: for each challenge, call `computeProgress` and return with `{ ...challenge, progress, completed }`.
- If not authenticated: return challenges without participation data.

Response: `{ challenges: [...], month: 'YYYY-MM' }`

### `POST /api/challenges/propose`

Requires `requireAuth`. Any logged-in user.

Body: `{ title, description, metric, params, target, suggestedMonth }`

- Validate metric is a known enum value. Validate params match metric requirements (e.g. `color_added` requires `params.color`).
- Create `Challenge` with `isProposal: true`, `status: 'draft'`, `proposedBy: req.user._id`.
- Return 201.

### `POST /api/challenges/:id/progress`

Requires `requireAuth`. Only valid for `metric === 'custom'`.

Body: `{ proofNote }`

- Upsert `ChallengeParticipation` with `proofNote`, set `progress: 1`.
- Return updated participation.

### `GET /api/challenges/:id/leaderboard`

Public.

- Fetch top 20 `ChallengeParticipation` docs for this challenge sorted by `progress` desc.
- Populate `userId` (username, avatarUrl).
- For auto challenges: progress is computed live per user (expensive — only run on explicit leaderboard fetch, not on challenge list).
- Return `[{ rank, username, avatarUrl, progress, completed, completedAt }]`.

### Admin routes (added to `backend/routes/admin.js`)

`POST /api/admin/challenges` — admin creates challenge directly. Body: full Challenge fields. Sets `status: 'active'`, `createdBy: req.user._id`. Requires `requireAdmin`.

`GET /api/admin/challenges/proposals` — list all `isProposal: true` challenges. Requires `requireAdmin` or `requireModerator`.

`PUT /api/admin/challenges/proposals/:id/approve` — set `status: 'active'`, `isProposal: false`, `approvedBy: req.user._id`, `month` to current month if not set. Requires `requireAdmin`.

`DELETE /api/admin/challenges/proposals/:id` — reject/delete proposal. Requires `requireAdmin`.

`PUT /api/admin/challenges/:id/verify-manual` — for `custom` metric: set `ChallengeParticipation.verifiedBy`, mark `completed: true`. Body: `{ userId }`. Requires `requireAdmin` or `requireModerator`.

---

## Frontend

### `ChallengesView.js`

New file at `frontend/src/components/ChallengesView.js`. Accessible from sidebar nav (trophy icon, amber color).

**Layout:**

- Header: "Monthly Challenges — {Month Name YYYY}" + "Propose a Challenge" button.
- Challenge cards grid (2-col desktop, 1-col mobile).

**ChallengeCard** (defined above `ChallengesView`, not inside it):

Each card shows:
- Title + description
- Metric type badge (Collection / Trading / Social / Manual)
- Progress bar: `progress / target` with percentage. Green when completed.
- For `custom`: "Submit Proof" button → opens `ProofModal`.
- "Leaderboard" button → opens `LeaderboardDrawer` (slide-in panel from right).

**ProofModal** (defined above `ChallengesView`):
- Textarea for proof note (1000 char max).
- Submit button → `POST /api/challenges/:id/progress`.

**LeaderboardDrawer** (defined above `ChallengesView`):
- Fetches `/api/challenges/:id/leaderboard` on open.
- Ranked list with avatars, usernames, progress bars.

**ProposeModal** (defined above `ChallengesView`):
- Title, description, metric dropdown (grouped: Collection / Trading / Social / Custom).
- Conditional param fields appear based on selected metric:
  - `color_added`: color dropdown
  - `rarity_added`: rarity dropdown
  - `set_completion`: set code input + target % slider
  - `high_value_card`: min value input
  - All others: no extra params
- Target number input, suggested month (defaults to next month).
- Submit → `POST /api/challenges/propose`.

### Admin: Challenges tab in AdminPanel

New `ChallengesTab.js` in `frontend/src/components/admin/community/`. Two sub-tabs:

1. **Active Challenges** — list of this month's active challenges with edit/close controls.
2. **Proposals** — pending proposals with Approve / Reject buttons. Shows proposer username.

"Create Challenge" button opens a full create form (same fields as ProposeModal but with direct activation).

Add tab to Community section in `AdminPanel.js`.

---

## File Changes

| File | Action |
|------|--------|
| `backend/models/Challenge.js` | New model |
| `backend/models/ChallengeParticipation.js` | New model |
| `backend/utils/challengeProgress.js` | New utility (computeProgress + getScryfallSetSize cache) |
| `backend/routes/challenges.js` | New route file |
| `backend/routes/admin.js` | Add admin challenge management routes |
| `backend/server.js` | Register challenges router |
| `frontend/src/components/ChallengesView.js` | New view (ChallengeCard, ProofModal, LeaderboardDrawer, ProposeModal defined above it) |
| `frontend/src/components/admin/community/ChallengesTab.js` | New admin tab |
| `frontend/src/components/admin/AdminPanel.js` | Add Challenges tab to Community section |
| Sidebar nav component | Add Challenges link (trophy icon, amber) |

---

## Testing

- `GET /api/challenges` returns only active challenges for current month
- `POST /propose` with invalid metric → 400
- `POST /propose` with `color_added` missing `params.color` → 400
- `GET /leaderboard` returns max 20 entries sorted by progress desc
- Auto-metrics compute correctly from Card/TradeOffer/ForumPost collections
- `PUT /approve` sets status active, sets approvedBy
- Admin `POST /challenges` creates active challenge directly
- `POST /progress` on non-custom metric → 400 (only custom uses manual proof)
- `PUT /verify-manual` marks participation completed

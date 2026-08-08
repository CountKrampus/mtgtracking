# Collection Comparison — Design Spec

**Goal:** Let any logged-in user compare their collection against another user's to find smart trade targets — cards each person has that the other doesn't, with value totals to balance a trade.

**Entry points:** User profiles and Trading Board listing cards.

---

## Backend

### `GET /api/users/:username/compare`

Added to `backend/routes/usersPublic.js`. Middleware: `requireAuth`.

**Privacy check:** Fetch target user by username. If `targetUser.privacySettings?.collectionPublic === false` → 403 "This user's collection is private." If target user not found → 404.

**Data fetch (parallel):**
```js
const [myCards, theirCards] = await Promise.all([
  Card.find(buildUserQuery(req.user._id), 'name set price imageUrl scryfallId condition quantity'),
  Card.find(buildUserQuery(targetUser._id), 'name set price imageUrl scryfallId condition quantity'),
]);
```

`buildUserQuery` imported from `backend/middleware/multiUser.js` (same pattern as other routes).

**Comparison (name-based, case-insensitive):**
```js
const myNames = new Set(myCards.map(c => c.name.toLowerCase()));
const theirNames = new Set(theirCards.map(c => c.name.toLowerCase()));

const theyHaveYouDont = theirCards.filter(c => !myNames.has(c.name.toLowerCase()));
const youHaveTheyDont = myCards.filter(c => !theirNames.has(c.name.toLowerCase()));
```

Each list sorted by `price` descending (most valuable trade targets first).

**Value totals:**
- `theirTotal` = sum of `price` for all cards in `theyHaveYouDont`
- `yourTotal` = sum of `price` for all cards in `youHaveTheyDont`
- `balance` = `theirTotal - yourTotal` (positive = you'd gain value, negative = you'd give more)

**Response shape:**
```json
{
  "targetUser": { "username": "...", "avatarUrl": "...", "reputation": 42 },
  "theyHaveYouDont": [
    { "name": "...", "set": "...", "condition": "NM", "price": 12.50, "imageUrl": "...", "scryfallId": "..." }
  ],
  "youHaveTheyDont": [
    { "name": "...", "set": "...", "condition": "LP", "price": 8.00, "imageUrl": "...", "scryfallId": "..." }
  ],
  "theirTotal": 245.50,
  "yourTotal": 312.00,
  "balance": -66.50
}
```

Cap each list at 200 cards (take first 200 after price sort) — collections can be large and the UI doesn't need an infinite list.

---

## Frontend

### `CollectionComparison.js`

New file at `frontend/src/components/CollectionComparison.js`.

Props: `{ targetUsername, onClose }`

- Fetches `GET /api/users/${targetUsername}/compare` on mount.
- Renders as a fixed full-screen overlay (z-50) with a centered modal panel (max-w-5xl, scrollable).

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  [Your avatar] You       vs       Them [Their avatar]│
│  $312.00                              $245.50         │
│  Balance: -$66.50 (you give more)                    │
├──────────────────────┬──────────────────────────────┤
│  They have, you don't│  You have, they don't         │
│  (N cards, $245.50)  │  (M cards, $312.00)           │
│  ┌──────────────────┐│  ┌──────────────────────────┐ │
│  │ Card row...      ││  │ Card row...               │ │
│  │ Card row...      ││  │ Card row...               │ │
│  └──────────────────┘│  └──────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  [Create Trade Listing]              [Close]         │
└─────────────────────────────────────────────────────┘
```

**Balance badge:** 
- Positive (`balance > 0`): green — "You'd gain ${balance}"
- Negative: red — "You'd give $${Math.abs(balance)} more"
- Zero: gray — "Even trade"

**Card row** (same in both columns): card name (with hover image preview using existing `HoverPreview` pattern), set, condition badge, price. No images inline — keep it compact.

**"Create Trade Listing" button:** Opens the existing `TradingBoard` create listing modal pre-filled with the viewing user's username. Implemented by storing a `pendingListing` in a shared context or by navigating to the Trading Board tab with a query param.

**Loading state:** Two skeleton columns while fetching.
**Error state:** If 403, show "This user's collection is private." If 404, show "User not found."

### Entry point: `UserProfile.js`

Add a "Compare Collections" button (blue, layers icon) next to existing action buttons. Only rendered when `currentUser` is logged in and `currentUser.username !== profile.username`.

On click: renders `<CollectionComparison targetUsername={profile.username} onClose={...} />` as an overlay.

### Entry point: `TradingBoard.js`

On each `ListingCard`, add a small "Compare" text link below the "Make Offer" button. Same behavior — renders `<CollectionComparison targetUsername={listing.username} onClose={...} />`.

---

## Privacy

The `User` model has a `privacySettings` field. If `privacySettings.collectionPublic` is `undefined` (not set), treat as **public** (opt-out model — users are public by default, can opt out in settings). This matches the existing trading board behavior where any user can browse listings.

---

## File Changes

| File | Action |
|------|--------|
| `backend/routes/usersPublic.js` | Add `GET /:username/compare` |
| `frontend/src/components/CollectionComparison.js` | New component |
| `frontend/src/components/UserProfile.js` | Add "Compare Collections" button |
| `frontend/src/components/TradingBoard.js` | Add "Compare" link on listing cards |

---

## Testing

- `GET /compare` unauthenticated → 401
- `GET /compare` for private collection → 403
- `GET /compare` for unknown user → 404
- `GET /compare` for self → valid response (both lists may be empty)
- `theyHaveYouDont` excludes cards whose name appears in requester's collection
- `youHaveTheyDont` excludes cards whose name appears in target's collection
- Lists capped at 200 cards each
- Balance = theirTotal - yourTotal

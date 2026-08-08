# Deck of the Week — Design Spec

**Feature #54** — Admin-curated weekly deck spotlight that pins a featured deck on the CommunityDecks page and auto-posts a forum thread in a dedicated "Community Spotlights" category.

---

## Problem

The CommunityDecks page has no way to highlight standout decks. Trending content goes unnoticed and there's no editorial voice to surface quality builds to the community.

---

## Goals

- Admins pick any public deck to spotlight for 7 days
- A "⭐ Deck of the Week" banner appears on CommunityDecks while the spotlight is active
- A forum thread is auto-created in a "Community Spotlights" category with content generated from deck data (commander, power level, budget tier, value, salt score, tags)
- Spotlight expires automatically after 7 days (no cron — time-based query)
- Feature is accessible from both the CommunityDecks page and the Admin Panel
- The existing "Most Imported" sort option is renamed to "Most Popular" and made the default sort so popular decks surface immediately on page load

---

## Non-Goals

- Algorithmic/automatic winner selection — admin always picks manually
- Voting or nomination system
- Email or push notifications to the featured deck's owner (can be added later)

---

## Build Label & Budget Tier

Both are derived from existing deck data at spotlight creation time and stored in the `DeckSpotlight` document.

**Build label** — from `globalScore` (Smart Deck Score, 1–10):

| Score | Label |
|-------|-------|
| 1–2 | Jank Build |
| 3–4 | Casual Build |
| 5–6 | Optimized Build |
| 7–8 | High Power Build |
| 9–10 | cEDH Build |

If `globalScore` is unavailable (deck stats not yet computed), label defaults to "Community Build".

**Budget tier** — from sum of `price * quantity` across all cards in the deck's `mainDeck` array (using stored card prices, not a live fetch):

| Total Value | Tier |
|-------------|------|
| < $50 | Budget |
| $50–$200 | Mid-range |
| $200–$500 | Tuned |
| > $500 | Premium |

---

## Data Model

### `DeckSpotlight` — new model (`backend/models/DeckSpotlight.js`)

```js
{
  deckId:      ObjectId → Deck     (required)
  featuredBy:  ObjectId → User     (required — admin who triggered it)
  featuredAt:  Date                (default: now)
  expiresAt:   Date                (required — featuredAt + 7 days)
  threadId:    ObjectId → ForumThread
  buildLabel:  String              (computed at creation, stored)
  budgetTier:  String              (computed at creation, stored)
  totalValue:  Number              (computed at creation, stored)
}
```

- No unique constraint — history is preserved; past spotlights remain in the collection
- Active spotlight = `expiresAt > now`, sorted `featuredAt: -1`, limit 1
- Index on `expiresAt` for efficient active queries

---

## Backend

### New file: `backend/routes/deckSpotlight.js`

Mounted at `/api/deck-spotlight` in `server.js`.

---

#### `POST /api/deck-spotlight` — feature a deck (admin only)

Body: `{ deckId: string }`

1. Validate `deckId` — deck must exist and `isPublic: true`
2. Fetch deck stats (`GET /api/decks/:id/stats` logic, or call the stats helper directly) to get `globalScore`, `saltScore`, `cardCount`
3. Compute `buildLabel` from `globalScore`, `budgetTier` and `totalValue` from deck's `mainDeck` prices
4. Ensure "Community Spotlights" forum category exists:
   ```js
   let category = await ForumCategory.findOne({ slug: 'community-spotlights' });
   if (!category) {
     category = await ForumCategory.create({
       name: 'Community Spotlights',
       slug: 'community-spotlights',
       description: 'Weekly featured decks and community highlights',
     });
   }
   ```
5. Create forum thread (authored by the acting admin):
   - Title: `🌟 Deck of the Week: [Deck Name] — [budgetTier] [buildLabel]`
   - Content: see Thread Content section below
   - Tags: `['deck-spotlight', format]`
6. Create `DeckSpotlight` record with `expiresAt = now + 7 days`
7. Return the created spotlight (populated with deck and thread)

---

#### `GET /api/deck-spotlight/active` — public

Returns the current active spotlight: `{ expiresAt: { $gt: now } }`, sorted `featuredAt: -1`, limit 1, with `deckId` populated (name, commander, format, tags, shareCode, userId.username).

Returns `{ spotlight: null }` if none active.

---

#### `DELETE /api/deck-spotlight/:id` — expire early (admin only)

Sets `expiresAt = now` on the specified spotlight. Does not delete the record or the forum thread.

---

### Thread Content (auto-generated)

```markdown
This week's spotlight deck is **[Deck Name]** by **@[username]** — 
a [budgetTier] [buildLabel] in the [Format] format.

**Commander:** [Commander Name] ([Color Identity joined as letters])
**Power Level:** [globalScore]/10 — [buildLabel]
**Salt Score:** [saltScore]
**Total Value:** $[totalValue]
**Card Count:** [cardCount] cards
[**Tags:** [tag1], [tag2], ...]

[View this deck →](/decks/share/[shareCode])

---
*Think a deck deserves a spotlight? Share your deck publicly in the Community Decks section!*
```

Tags line is omitted if the deck has no tags. Color identity letters are joined without separator (e.g. `WUBRG`). `shareCode` links to the existing shared deck view route.

---

## Frontend

### Sort default change

- Rename `<option value="imported">Most Imported</option>` → `Most Popular`
- Change default sort state from `'newest'` to `'imported'` so the most popular decks show first on page load

### CommunityDecks page (`frontend/src/components/CommunityDecks/CommunityDecks.js`)

**On mount:** fetch `GET /api/deck-spotlight/active` alongside the existing deck list fetch.

**Spotlight banner** (rendered above the deck grid when `spotlight !== null`):
- Heading: "⭐ Deck of the Week"
- Deck name, commander, build label, budget tier, owner username
- "View Deck" button → opens existing `SharedDeckView` with the deck's `shareCode`
- Link to the forum thread ("Discussion →")
- Admins only: "✕ Remove Spotlight" button → calls `DELETE /api/deck-spotlight/:id`, clears banner on success

**"Feature this deck" button** on each deck card (admins only):
- Small star icon button, visible only when `req.user` has admin role
- Calls `POST /api/deck-spotlight` with the deck's `_id`
- On success: re-fetches the active spotlight to show the banner
- On conflict (another deck already active): prompts "Replace current spotlight?" — confirm replaces by expiring the old one first, then posting the new one

### Admin Panel — new "Deck Spotlight" tab

Location: Community section of the Admin Panel (alongside existing community tabs).

**Contents:**
- **Current spotlight card**: deck name, commander, build label, budget tier, expiry countdown (`Expires in X days`), link to deck, link to forum thread. "Remove" button to expire early.
- "No active spotlight" state if none.
- **Feature a deck**: searchable dropdown listing all public decks (name + commander). "Feature this deck" button → calls `POST /api/deck-spotlight`. If one is already active, shows a warning and confirm dialog before replacing.

---

## Error Handling

- `POST` with a non-public or non-existent deck → `400 Bad Request`
- `POST` by a non-admin → `403 Forbidden`
- Forum thread creation failure → log the error, do not create the `DeckSpotlight` record (atomic: thread first, then spotlight)
- "Community Spotlights" category creation failure → same: abort and return `500`
- Stats fetch failure (globalScore unavailable) → fall back to `buildLabel = "Community Build"`, `totalValue = 0`, `budgetTier = "Unknown"`

---

## Files Changed

| File | Change |
|------|--------|
| `backend/models/DeckSpotlight.js` | New model |
| `backend/routes/deckSpotlight.js` | New routes (POST, GET active, DELETE) |
| `backend/server.js` | Mount `/api/deck-spotlight` router |
| `frontend/src/components/CommunityDecks/CommunityDecks.js` | Spotlight banner + "Feature" button |
| `frontend/src/components/admin/AdminPanel.js` or community tab | New Deck Spotlight admin tab |

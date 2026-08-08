# Community Deck Sharing & Discovery Design

## Goal

Let users share their decks publicly and browse/import decks from the community. Sharing generates a private link; a separate toggle opts the deck into the public community browser.

## Architecture

Extend the existing `Deck` model with `shareCode` and `isPublic` fields. The community browser queries Deck documents directly — no separate snapshot collection. Published decks show live data; when the owner updates their deck, the community view reflects it immediately. A new `CommunityDecks` sidebar section provides the discovery UI; `SharedDeckView` handles public permalink rendering at `/shared/deck/:shareCode`.

**Tech Stack:** Node.js/Express/Mongoose (backend), React + Tailwind CSS (frontend), existing `requireAuth` middleware for protected routes.

---

## Backend

### Schema changes (`backend/models/Deck.js`)

Add two fields to the existing `deckSchema`:

```js
shareCode: { type: String, default: null, index: true, sparse: true },
isPublic:  { type: Boolean, default: false },
importCount: { type: Number, default: 0 },
```

- `shareCode` — `null` means not yet shared; `sparse: true` so the unique index ignores nulls
- `isPublic` — `false` = link-only, `true` = listed in community browser
- `importCount` — incremented each time another user imports this deck; drives "most imported" sort

---

### Routes (`backend/routes/decks.js`)

#### Fixed: `POST /api/decks/:id/share`

Already exists but didn't save `shareCode` to the schema (field was missing). Now properly saves:

```js
const isFirstShare = !deck.shareCode;
deck.shareCode = deck.shareCode || require('crypto').randomBytes(8).toString('hex');
await deck.save();
// existing rep/badge side effects remain unchanged
res.json({ shareCode: deck.shareCode, shareUrl: `/shared/deck/${deck.shareCode}` });
```

#### New: `PATCH /api/decks/:id/visibility`

Toggle `isPublic`. Requires auth + deck ownership. Returns 400 if deck has no `shareCode` (must share first).

```
PATCH /api/decks/:id/visibility
Body: { isPublic: boolean }
Response: { isPublic, shareCode }
```

#### New: `GET /api/decks/shared/:shareCode`

Public (no auth). Returns full deck including `mainDeck` array and owner info.

```
GET /api/decks/shared/:shareCode
Response: {
  deck: { ...all fields, mainDeck: [...] },
  owner: { username, displayName }
}
```

404 if shareCode not found.

#### New: `GET /api/decks/community`

Public (no auth). Returns paginated list of `isPublic: true` decks. Does NOT include full `mainDeck` — only card count.

Query params:
| Param | Type | Behaviour |
|-------|------|-----------|
| `format` | string | Exact match on `format` field |
| `colors` | comma-separated | Commander `colorIdentity` must contain ALL specified colors |
| `commander` | string | Case-insensitive regex on `commander.name` |
| `tags` | comma-separated | Deck `tags` array contains ANY of the specified tags |
| `sort` | `newest`\|`imported`\|`name` | `updatedAt desc` / `importCount desc` / `name asc` |
| `page` | number | 1-based, default 1 |

Page size: 20. Response:

```
{
  decks: [{
    _id, shareCode, name, format, commander, tags, description,
    totalValue, cardCount, importCount, isPublic,
    owner: { username, displayName },
    createdAt, updatedAt
  }],
  total, page, pages
}
```

#### New: `POST /api/decks/community/:shareCode/import`

Auth required. Clones the deck into the requesting user's collection.

- Server finds deck by `shareCode`; 404 if not found
- Creates new Deck document: all fields copied except `_id`, `userId` (set to `req.user._id`), `shareCode` (set to `null`), `isPublic` (set to `false`), `importCount` (set to `0`)
- Increments original deck's `importCount` by 1 (`$inc`)
- Returns `{ deckId }` of the newly created deck

```
POST /api/decks/community/:shareCode/import
Auth: Bearer token required → 401 if missing
Response: { deckId }
```

---

## Frontend

### New files

#### `frontend/src/components/CommunityDecks/CommunityDecks.js`

Top-level community browser page. Rendered when `currentView === 'community-decks'`.

**State:** `decks`, `loading`, `error`, `page`, `total`, filters (`format`, `colors`, `commander`, `tags`, `sort`)

**Filter bar:**
- Format dropdown (All Formats + enum values)
- Color identity toggles — 5 pip buttons (W/U/B/R/G), multi-select, clicking toggles inclusion
- Commander name text input (debounced 300ms)
- Tags text input (comma-separated, debounced 300ms)
- Sort dropdown (Newest, Most Imported, Name A–Z)

**Deck card grid** (responsive, 2–4 columns):
Each card shows:
- Commander art image (top, cropped header style) — falls back to a placeholder if no commander
- Deck name (bold)
- Owner: `@username` (links to `/forum/users/:username/profile` if exists)
- Format badge (colored, matches existing DeckList format badge colors)
- Color identity pips (W/U/B/R/G)
- Tags (pill badges)
- Total value (`$N.NN`)
- Card count + import count (`100 cards · imported 42×`)
- "View Deck" button → opens `SharedDeckView`
- "Import to My Decks" button → calls import endpoint; on success navigates to deck builder with new deck open. If not logged in, shows inline prompt "Log in to import."

**Pagination:** Previous / Next buttons, `Page N of M` label.

---

#### `frontend/src/components/CommunityDecks/SharedDeckView.js`

Full deck detail view. Rendered at `/shared/deck/:shareCode` (public URL, matched in `App.js` before main app renders — same pattern as other public routes).

**Sections:**
1. **Header** — commander art (large, blurred background), deck name, format badge, owner credit (`by @username`), import count, "Import to My Decks" button
2. **Decklist** — cards grouped by type (Commander, Creatures, Instants, Sorceries, Artifacts, Enchantments, Planeswalkers, Lands, Other). Each entry: quantity + name. Card name hover shows Scryfall image preview.
3. **Stats sidebar** — mana curve bar chart (reuse existing component), color distribution, total value, card count

No auth required to view. Import button shows "Log in to import" if unauthenticated.

---

### Modified files

#### `frontend/src/App.js`

1. Add `/shared/deck/:shareCode` route match before main app render:
```js
const sharedDeckMatch = window.location.pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
if (sharedDeckMatch) return <SharedDeckView shareCode={sharedDeckMatch[1]} />;
```

2. Add `'community-decks'` to `currentView` handling — renders `<CommunityDecks />`.

#### `frontend/src/components/Sidebar.js` (or equivalent)

Add "Community Decks" sidebar entry with a globe icon (`Globe` from lucide-react), placed in the Community section alongside Forum.

#### `frontend/src/components/DeckBuilder/DeckDetail.js`

Add share controls to the deck header action row:

- **"🔗 Share" button** — calls `POST /api/decks/:id/share`; on success shows the share URL with a copy-to-clipboard button. Button label changes to "🔗 Shared" once a shareCode exists.
- **"🌐 List in Community" toggle** — only enabled once deck is shared. Calls `PATCH /api/decks/:id/visibility`. Active state (purple) = public; inactive = link-only. Shows tooltip "Share this deck first" if not yet shared.

Both controls appear only when the user is the deck owner (not on other users' shared views).

---

## Data Flow

### Sharing a deck
1. Owner clicks "Share" in DeckDetail → `POST /api/decks/:id/share`
2. `shareCode` generated and saved; +3 rep + Deck Builder badge awarded (fire-and-forget, already implemented)
3. Share URL displayed with copy button

### Making a deck public
1. Owner toggles "List in Community" → `PATCH /api/decks/:id/visibility { isPublic: true }`
2. Server validates `shareCode` exists (400 if not); sets `isPublic = true`
3. Deck appears in community browser immediately

### Un-listing a deck
1. Owner toggles off → `PATCH /api/decks/:id/visibility { isPublic: false }`
2. Deck disappears from community browser; share link still works (link-only)

### Importing a community deck
1. User clicks "Import to My Decks" → `POST /api/decks/community/:shareCode/import`
2. Server clones deck: new `_id`, `userId = req.user._id`, `shareCode = null`, `isPublic = false`, `importCount = 0`
3. Original deck's `importCount` incremented by 1
4. Frontend receives `{ deckId }` → navigates to Deck Builder with new deck open

### Auth on public routes
- `GET /shared/:shareCode` and `GET /community` — no auth required
- `POST /community/:shareCode/import` — 401 with `{ message: 'Log in to import decks' }` if unauthenticated

---

## Edge Cases

- **Owner deletes a shared deck** — `GET /shared/:shareCode` returns 404; import endpoint returns 404
- **isPublic without shareCode** — `PATCH /visibility` returns 400 `{ message: 'Generate a share link first' }`
- **Importing your own deck** — allowed (creates a copy); no self-import restriction needed
- **Commander color filter** — `colors=W,U` matches decks where `commander.colorIdentity` contains both W and U (subset match, not exact). Decks with no commander are excluded from color-filtered results.
- **Empty community** — community browser shows "No decks found" with a prompt to share one

---

## Files to Create / Modify

| Action | File |
|--------|------|
| Modify | `backend/models/Deck.js` — add `shareCode`, `isPublic`, `importCount` |
| Modify | `backend/routes/decks.js` — fix share route, add visibility/community/import routes |
| Create | `frontend/src/components/CommunityDecks/CommunityDecks.js` |
| Create | `frontend/src/components/CommunityDecks/SharedDeckView.js` |
| Modify | `frontend/src/App.js` — add `/shared/deck/:code` route + community-decks view |
| Modify | `frontend/src/components/Sidebar.js` — add Community Decks entry |
| Modify | `frontend/src/components/DeckBuilder/DeckDetail.js` — add share controls |

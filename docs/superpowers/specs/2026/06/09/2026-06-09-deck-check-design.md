# Deck Check — Pre-Game Packing Checklist Design

## Goal

A standalone full-screen checklist for physically packing a deck before a game night. Tap cards as you pull them from your binders/boxes. Progress persists in localStorage if you close the browser mid-packing.

## Architecture

Reuses the existing ownership API (`GET /api/decks/:id/ownership`) — no new backend routes. A new `DeckCheck.js` component renders at `/deck/:id/check`. `DeckDetail.js` gets a "📦 Pack This Deck" button that navigates there. `App.js` gets the new route.

## Route

```
/deck/:id/check
```

Matched in `App.js` before the main app renders (same pattern used for `/room/:code` and `/shared/deck/:code`). Renders `DeckCheck` full-screen with no sidebar.

## DeckCheck Component

```
frontend/src/components/DeckCheck.js
```

### Data

On mount:
1. `GET /api/decks/:id` — fetch deck name, mainDeck list
2. `GET /api/decks/:id/ownership` — fetch `ownedCards` and `missingCards`
3. Read `localStorage.getItem('deckcheck_${deckId}')` — restore checked card IDs (array of scryfallIds or card names)

### Layout

Full-screen dark background matching app theme. No sidebar. Fixed header with:
- Back arrow → `window.history.back()`
- Deck name
- Progress bar: `X / Y packed` (Y = ownedCards.length)
- "Reset" button (clears localStorage entry + unchecks all)

### Owned Cards Section

Header: `Cards You Own (X)` — sorted alphabetically.

Each card row:
- Large tap target (full-width, `py-3`)
- Checkbox (left) — tap anywhere on the row toggles it
- Card name (bold)
- Quantity badge if qty > 1
- Location tag if card has a location assigned (helps you find it)
- When checked: row fades to 50% opacity, name gets strikethrough, checkbox turns green

Checking/unchecking a card immediately writes the updated checked-IDs array to `localStorage.setItem('deckcheck_${deckId}', JSON.stringify([...checkedIds]))`.

### Missing Cards Section

Header: `Missing Cards (X)` — shown only if `ownership.missingCards.length > 0`.

Collapsed by default (tap to expand). Each row shows card name + price. Non-interactive (greyed out). Footer note: "You'll need to proxy or borrow these."

### Completion State

When all owned cards are checked: progress bar turns green, a "✅ All packed — you're ready!" message appears at the top. Missing cards section stays visible.

## DeckDetail Changes

Add a "📦 Pack This Deck" button in the DeckDetail header row (near the existing Share/Export buttons). `onClick={() => window.location.href = /deck/${deck._id}/check }`. Only shown when ownership data is loaded.

## localStorage Schema

Key: `deckcheck_${deckId}`
Value: JSON array of card identifiers that have been checked off.

```json
["Lightning Bolt", "Sol Ring", "Command Tower"]
```

Keyed by card name (not scryfallId) to survive deck edits that don't change card names.

## Files to Create / Modify

| File | Change |
|------|--------|
| `frontend/src/components/DeckCheck.js` | Create — full checklist component |
| `frontend/src/App.js` | Add `/deck/:id/check` route |
| `frontend/src/components/DeckDetail.js` | Add "Pack This Deck" button |

## Verification

1. Open a deck in DeckDetail → "Pack This Deck" button appears → click → navigates to `/deck/:id/check`
2. Owned cards list shows with checkboxes → tap a card → fades + strikethrough + localStorage updated
3. Close browser → reopen `/deck/:id/check` → previously checked cards still checked
4. "Reset" button → all unchecked, localStorage cleared
5. Check all owned cards → green progress bar + "All packed" message
6. Deck with missing cards → "Missing Cards" section shows collapsed, expands on tap

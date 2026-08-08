# Feature Bundle Design — 2026-06-08

## Overview

Seven features spanning collection management, deck analysis, social comparison, and inline UX improvements.

---

## 1. Collection Value History

### Goal
Track collection total value over time and display it as a chart in the account area.

### Backend
- **New model** `backend/models/CollectionSnapshot.js`:
  ```js
  { userId: ObjectId, totalValue: Number, totalCards: Number, date: Date (indexed) }
  ```
  Compound unique index on `{ userId, date }` (one snapshot per user per day).

- **Cron job** in `backend/server.js` (alongside existing price-update cron): fires daily at midnight, iterates all active users, sums their card collection values, upserts a `CollectionSnapshot` for today.

- **New route** `GET /api/collection/value-history?days=30` (requireAuth): returns array of `{ date, totalValue, totalCards }` sorted ascending. Default 30 days; accepts `days=7`, `90`, `365`, `all`.

### Frontend
- New **"Portfolio"** tab in the account/settings modal (wherever the profile button opens).
- Line chart via **recharts** `<LineChart>` showing `totalValue` on Y axis, `date` on X axis.
- Date range selector pills: **7d · 30d · 90d · All**.
- Summary row above chart: current value, change since range start (absolute + %).
- If fewer than 2 snapshots exist, show a friendly "Check back tomorrow — your first snapshot is being recorded" message.

---

## 2. Inline Cell Editing

### Goal
Click any editable cell in the card table to edit it without opening a modal.

### Frontend only — no new backend routes
Editable fields: **Quantity** (number input), **Condition** (select), **Location** (select from existing locations), **Tags** (chip-style multi-input), **Notes** (text input).

**Behaviour:**
- Table cells for these fields show a subtle underline/highlight on hover to signal editability.
- Click → cell becomes the appropriate input control, pre-filled with current value.
- **Enter** or **click away** (onBlur) → save via `PUT /api/cards/:id` (existing endpoint), optimistic update.
- **ESC** → cancel, revert to original value.
- Show a brief spinner/checkmark on the cell while the save request is in flight.

**Tags field:** clicking opens a small inline chip editor — existing tags shown as removable chips, type to add new.

---

## 3. Cards Used Across Decks (Hidden Column)

### Goal
Show which of the user's decks each card appears in, as an optional hidden column.

### Backend
- **New route** `GET /api/decks/card-usage` (requireAuth): queries all decks belonging to the user, builds a map of `cardName.toLowerCase() → [deckName, ...]`. Returns this map as a plain object. Called once when the collection loads (alongside existing `/api/cards` fetch).

### Frontend
- **"In Decks"** column added to the card table, hidden by default.
- Toggle visibility via the existing column-toggle mechanism.
- Cell content: if 1 deck → show deck name as a small pill; if 2 → two pills; if 3+ → `"X decks"` pill that expands to a tooltip/popover listing all deck names on hover.
- No deck name → empty cell.

---

## 4. Color Pie by Role (DeckAnalysisPanel)

### Goal
Categorise each card in a deck by its gameplay role and show a breakdown chart.

### Frontend only — oracle text already stored on cards

**Role detection** (applied to `card.oracleText`, case-insensitive):
| Role | Keywords / Patterns |
|------|-------------------|
| Removal | destroy, exile, deal.*damage, -X/-X, return.*to.*hand |
| Ramp | `add {`, search.*library.*land, land.*into play, tapped.*your library |
| Draw | draw a card, draw X card, look at the top |
| Threat | card has `power` + `toughness` fields (creature), or "whenever.*deals combat damage" |
| Other | anything not matched above |

A card can match multiple roles; assign the **first** match in priority order: Removal → Draw → Ramp → Threat → Other.

**UI:** New "Role Breakdown" section in `DeckAnalysisPanel.js` below the existing type distribution section. Horizontal segmented bar with colour-coded segments (red = removal, blue = draw, green = ramp, orange = threat, grey = other). Below the bar, a legend row with count and percentage per role.

---

## 5. Mana Base Calculator (DeckAnalysisPanel)

### Goal
Show per-colour whether the deck has enough mana sources relative to its casting cost demands.

### Frontend only — uses existing card data

**Logic:**
1. Count coloured pips in `card.manaCost` for all non-land cards (e.g. `{W}{W}{U}` = 2W + 1U).
2. Count colour sources: basic lands by subtype + non-basics/rocks that produce that colour (derived from `card.oracleText` containing `add {W}` etc., or `card.colors` for lands).
3. Frank Karsten threshold: **14 sources** needed per colour that appears as a 2-pip requirement at a 99-card deck size. Scale proportionally for more/fewer pips.
4. Status per colour: **green** (sources ≥ threshold), **yellow** (within 2 of threshold), **red** (under threshold).

**UI:** New "Mana Sources" section in `DeckAnalysisPanel.js`. Table with columns: Colour symbol · Pips Required · Sources Found · Status dot. Only show colours that appear in the deck's cost requirements.

---

## 6. Playgroup Metagame

### Goal
Show which commanders are most played in a playgroup and how power levels trend over sessions.

### Backend
- **New route** `GET /api/playgroups/:id/metagame` (requireAuth, must be group member): aggregates `DeckGameLog` for all games in the playgroup.
  - `commanderFrequency`: `[{ commanderName, gamesPlayed, wins, winRate }]` sorted by `gamesPlayed` desc.
  - `powerLevelTrends`: `[{ date, avgPowerLevel }]` one entry per game session date, sorted ascending. Derived from deck power levels at time of game log entry.

### Frontend
- New **"Metagame"** tab in `PlaygroupDetail.js` (alongside existing tabs).
- **Top section:** Commander Frequency table — columns: Commander · Games Played · Wins · Win Rate. Sortable.
- **Bottom section:** Power Level Trends — recharts `<LineChart>` with average power level per session date. If fewer than 3 sessions, show "Play more games to see trends."

---

## 7. Friend Collection Diff

### Goal
Compare your collection against a friend's to identify trade opportunities.

### Backend
- **New route** `GET /api/users/:username/collection-diff` (requireAuth):
  1. Find user by username (case-insensitive).
  2. If `!user.privacy.showCollection` → 404 `{ message: "This user's collection is private." }`.
  3. Fetch both users' cards. Compute:
     - `theyHaveYouDont`: cards the friend owns (by name) that the current user has 0 of.
     - `youHaveTheyDont`: cards the current user owns that the friend has 0 of.
  4. Return `{ username, displayName, theyHaveYouDont, youHaveTheyDont }`.

### Frontend
- New **"Compare"** section at the bottom of `TradeBinder.js` (or a new tab within it).
- Username input field + "Compare" button.
- On success: two-column layout:
  - **Left — "They have, you don't"**: card list with price and "Add to Wishlist" button per card + "Add All to Wishlist" header button.
  - **Right — "You have, they don't"**: card list with quantity — your potential trade offers.
- Error states: private profile message, user not found, own username.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/CollectionSnapshot.js` | New model |
| `backend/server.js` | Add cron job + value-history route |
| `backend/routes/decks.js` | Add `GET /card-usage` route |
| `backend/server.js` | Add `GET /api/users/:username/collection-diff` route |
| `backend/routes/playgroups.js` | Add `GET /:id/metagame` route |
| `frontend/src/App.js` | Fetch card-usage map on load; wire Portfolio tab; pass data down |
| `frontend/src/components/` (account modal) | Add Portfolio tab with recharts chart |
| `frontend/src/components/DeckAnalysisPanel.js` | Add Role Breakdown + Mana Sources sections |
| `frontend/src/components/PlaygroupDetail.js` | Add Metagame tab |
| `frontend/src/components/TradeBinder.js` | Add Compare section |
| Card table in `frontend/src/App.js` | Inline cell editing + In Decks hidden column |

---

## Verification

1. **Collection Value History:** Trigger cron manually → check DB for snapshot → visit Portfolio tab → see chart populate.
2. **Inline Editing:** Click a condition cell → dropdown appears → change → click away → row updates without modal.
3. **In Decks Column:** Toggle column on → cards in decks show pill(s) → cards not in any deck show empty.
4. **Role Breakdown:** Open a deck with mixed card types → Role Breakdown shows non-zero segments for removal/ramp/draw/threat.
5. **Mana Sources:** Open a deck with colour-intensive cards but few sources → red indicators appear for under-sourced colours.
6. **Metagame:** Play several games in a playgroup → open Metagame tab → see commander table and power level chart.
7. **Friend Diff:** Set a second account's collection to public → compare from first account → both columns populate correctly.

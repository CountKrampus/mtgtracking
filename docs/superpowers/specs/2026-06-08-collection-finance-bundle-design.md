# Collection & Finance Bundle Design — 2026-06-08

## Overview

Five features focused on collection value, price monitoring, physical card tracking, and proxy printing enhancements.

---

## 1. Buylist / Sell Value

### Goal
Show the estimated sell value of the collection (what stores would pay), using a user-configurable percentage of market price.

### Backend
- `PUT /api/users/me` already accepts arbitrary settings — add `buystPercentage: Number` to the User model (default 50, range 10–90).

### Frontend
- **Settings → Pricing tab:** Add a "Buylist %" number input (10–90, default 50). Saves via existing `PUT /api/users/me`.
- **Collection table:** New hidden "Sell Value" column, togglable alongside "In Decks". Value = `card.price × (buystPercentage / 100)`. Pure client-side calculation.
- **Stats panel:** New "Est. Sell Value" stat card showing sum of all sell values (excludes proxies).

---

## 2. Price Alerts

### Goal
Let users set a target price on any card they own. When the card's price drops to or below the target, notify them in-app and by email.

### Backend
- **Card model:** Add `alertPrice: Number (default null)`, `alertTriggered: Boolean (default false)`.
- **Price update logic** (in individual and bulk update routes): After updating a card's price, check: if `alertPrice != null && price <= alertPrice && !alertTriggered` → send email via nodemailer + set `alertTriggered = true`. If `price > alertPrice` → reset `alertTriggered = false`.
- **New route** `PUT /api/cards/:id/alert` (requireAuth): sets or clears `alertPrice` on a card.
- **Email:** nodemailer (add if not present). Email body: card name, current price, alert price, link to app.

### Frontend
- **Collection table:** Bell icon button in the Actions column. Click → small inline popover with a number input to set alert price. Active alert shows filled orange bell; no alert shows outline bell.
- **Special filter:** Two new options — "Price Alerts Active" (cards with `alertPrice` set) and "Alerts Triggered" (cards where `price <= alertPrice`).
- **In-app indicator:** Triggered alerts show an orange bell badge on the card row.

---

## 3. Art Variant Tracker

### Goal
Global view showing all cards in the user's collection that have printings/art treatments they don't own yet.

### Backend
- **New route** `GET /api/collection/variants` (requireAuth): returns array of unique card names in the user's collection. The frontend uses these names to query Scryfall directly.

### Frontend
- **New component** `ArtVariantTracker.js` — accessible from Sidebar under Tools.
- On load, fetches unique card names from `/api/collection/variants`, then queries Scryfall per card: `GET https://api.scryfall.com/cards/search?q=!"<name>"&unique=prints`.
- Loads on-demand: card names listed, user clicks to expand a card and see its printings.
- Each printing shown as a thumbnail with set name, set code, rarity, and price.
- Printings the user already owns (matched by `scryfallId` or set+collectorNumber) are highlighted with a "Owned" badge.
- Missing printings have an "Add to Wishlist" button.
- Results cached in component state for the session to avoid redundant Scryfall calls.

---

## 4. Proxy / Alter Tracker

### Goal
Mark cards as proxies or alters. Proxies are excluded from value calculations. Alters track artist and style.

### Backend
- **Card model additions:**
  - `isProxy: Boolean (default false)`
  - `isAlter: Boolean (default false)`
  - `alterArtist: String (default '')`
  - `alterType: String (enum: ['painted', 'extended-art', 'altered-frame', 'full-art', 'other'], default null)`
- Existing `PUT /api/cards/:id` already handles arbitrary field updates — no new routes needed.

### Frontend
- **Extra Columns:** "Proxy" and "Alter" columns added under the Extra Columns toggle. Each cell shows a checkbox; toggling saves inline via `PUT /api/cards/:id`.
- **Card edit form:** Proxy checkbox, Alter checkbox. When alter is checked, show `alterArtist` text input and `alterType` select.
- **Special filter:** "Proxies Only" and "Alters Only" options added.
- **Value calculations:** All value totals (collection value, stats panel, Portfolio chart, sell value) exclude cards where `isProxy: true`. Stats show "excluding X proxies" note.
- **CSV export:** `isProxy`, `isAlter`, `alterArtist`, `alterType` columns added.

---

## 5. Proxy Art Generator

### Goal
When printing proxies, let users choose official alt art (from Scryfall) or upload custom art per card. Custom art is stored permanently and used in hover previews.

### Backend
- **Card model:** Add `customArtUrl: String (default null)`.
- **New directory:** `backend/custom-arts/` (gitignored).
- **New route** `POST /api/cards/:id/custom-art` (requireAuth): accepts `multipart/form-data` with an image file. Saves to `backend/custom-arts/<cardId>.<ext>`. Updates `card.customArtUrl`. Returns updated card.
- **New route** `DELETE /api/cards/:id/custom-art` (requireAuth): deletes file, sets `customArtUrl = null`.
- **New route** `GET /api/custom-arts/:cardId` (public): serves the image file from `backend/custom-arts/`.

### Frontend
- **Hover preview:** If `card.customArtUrl` is set, use it instead of the Scryfall image.
- **Card edit form:** "Upload Custom Art" button opens a file picker (JPG/PNG). On select, POSTs to `/api/cards/:id/custom-art`. Shows current custom art thumbnail with a "Remove" button.
- **Collection table:** Small "🎨" badge on cards that have custom art.
- **Proxy print flow (existing `PrintProxiesModal` or equivalent):**
  - Per card: "Change Art" button → fetches Scryfall printings (`unique=prints`) → thumbnail grid picker → selected image URL used for this print job.
  - If card has `customArtUrl`, it is pre-selected automatically.
  - Custom card frame rendered via styled HTML/CSS div: card name, art image, type line, oracle text, mana cost, P/T if creature. This div is used instead of the cached image in the 3×3 print grid.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/User.js` | Add `buystPercentage` field |
| `backend/models/Card.js` | Add `alertPrice`, `alertTriggered`, `isProxy`, `isAlter`, `alterArtist`, `alterType`, `customArtUrl` |
| `backend/server.js` | Add price alert check in update routes; add `GET /api/collection/variants`; serve `custom-arts/` static dir |
| `backend/routes/cards.js` (or server.js) | Add `PUT /api/cards/:id/alert`; add `POST/DELETE /api/cards/:id/custom-art`; add `GET /api/custom-arts/:cardId` |
| `frontend/src/App.js` | Sell value column + toggle; bell icon in actions; proxy/alter columns; value exclusion logic; buylist % setting |
| `frontend/src/components/ArtVariantTracker.js` | New component |
| `frontend/src/components/Sidebar.js` | Add Art Variant Tracker link under Tools |

---

## Verification

1. **Buylist:** Set buylist % to 60% in Pricing settings → toggle Sell Value column → verify values are 60% of price column.
2. **Price Alerts:** Set alert on a card below its current price → trigger a price update → verify orange bell appears + email arrives.
3. **Art Variants:** Open Art Variant Tracker → expand a card with many printings (e.g. Lightning Bolt) → see all printings, owned ones highlighted.
4. **Proxy/Alter:** Mark a card as proxy → verify it disappears from total value calculation with "excluding 1 proxy" note.
5. **Custom Art:** Upload a custom image to a card → hover over it in collection → custom art appears. Open proxy print flow → card uses custom art automatically.

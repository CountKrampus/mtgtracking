# Mobile Responsive Design Spec

**Date:** 2026-06-25  
**Goal:** Make the MTG Tracker fully usable on phones via a comprehensive responsive redesign — bottom nav bar, collection card grid, collapsible filters, and full-screen modals on mobile. Desktop experience unchanged.

---

## Approach

Tailwind CSS breakpoint classes throughout (`sm:` = 640px+ = desktop, default = mobile). No separate routes or codebases. New components: `BottomNav`, `MobileFilterSheet`, and a mobile card-grid view inside `CollectionView`. Modals get a `w-full sm:max-w-2xl sm:mx-auto` treatment to become full-screen sheets on mobile.

---

## 1. Navigation — BottomNav

**New file:** `frontend/src/components/BottomNav.js`

Fixed bar at bottom of screen, visible only on mobile (`sm:hidden`). Five slots:

| Slot | Icon | Action |
|------|------|--------|
| Dashboard | Home | `navigate('/dashboard')` |
| Collection | BookOpen | `navigate('/collection')` |
| Forum | MessageSquare | `navigate('/forum')` |
| Decks | Layers | `navigate('/decks')` |
| More | Grid3x3 | open More sheet |

**More sheet:** slides up from bottom, contains: Wishlist (Heart), Life Counter (Users), Settings (Settings), Community Decks (Globe), Tools submenu. Tap outside to dismiss.

Active route highlighted in purple. Uses `useLocation` to detect current path.

**App.js changes:**
- Add `<BottomNav />` inside the layout div, after `<main>`.
- Add `pb-16 sm:pb-0` to `<main>` so content isn't hidden behind the nav bar.
- The existing hamburger button (`sm:hidden fixed top-4 left-4`) stays for accessing the full sidebar drawer from mobile (secondary nav, settings link, etc.).

---

## 2. Layout Shell (App.js)

Current `<main>` class: `flex-1 overflow-y-auto p-4 sm:p-6 mobile-content-offset sm:pt-6`

Changes:
- Add `pb-16 sm:pb-0` to avoid bottom nav overlap.
- The top header bar (`px-6 py-3`) gets `px-3 sm:px-6` for tighter mobile padding.
- `mobile-content-offset` in App.css already handles top padding for hamburger — keep it.

---

## 3. Collection View

### 3a. Header Action Buttons

Current: Import, JSON, CSV, Update Prices, Fetch Card Text, Wishlist, Deck Builder, Commanders, Sets, Gear — all inline, overflows on mobile.

Mobile treatment:
- Show only: **Import** and **⋯ More** button on mobile.
- "⋯ More" opens a bottom sheet listing: Export JSON, Export CSV, Update Prices, Fetch Card Text, Wishlist, Deck Builder, Commanders, Sets, Settings.
- Desktop: unchanged (all buttons visible).

Implementation: wrap the buttons section in a conditional — `hidden sm:flex` for the full bar, plus a mobile-only `flex sm:hidden` row with just the two buttons.

### 3b. Filter Bar

Current: 8-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-8`).

Mobile treatment:
- Show only the **search bar** and a **"Filters" button** on mobile.
- Filters button opens `MobileFilterSheet` — a full-screen bottom sheet with all 8 filters stacked vertically.
- Active filter count shown as a badge on the Filters button (e.g. "Filters (2)").
- Desktop: unchanged (full grid stays).

**New file:** `frontend/src/components/MobileFilterSheet.js`  
A sliding bottom sheet that receives the same filter props CollectionView already has. Renders them in a single-column stacked layout with a "Apply" / "Clear All" footer.

### 3c. Card Table → Card Grid on Mobile

Current: `<table>` with `overflow-x-auto`. 

Mobile: replace with a **card grid** (`grid grid-cols-1 gap-3`). Each card renders as a rounded panel showing:
- Card name (large, with hover preview kept)
- Set · Condition · Rarity badges
- Mana cost symbols
- Price (prominent)
- Quantity stepper (- / count / +)
- Action icons: Edit, Delete, Update Price (3 icons max)

Desktop: unchanged (`<table>` stays, just add `hidden sm:block` / `sm:hidden` wrapper pair).

**Implementation:** inside CollectionView's card list section, render two versions of the list:
```jsx
{/* Desktop table */}
<div className="hidden sm:block">
  <table>...</table>
</div>

{/* Mobile card grid */}
<div className="sm:hidden grid grid-cols-1 gap-3">
  {filteredCards.map(card => <MobileCardRow key={card._id} card={card} ... />)}
</div>
```

`MobileCardRow` is a sub-component defined at the top of CollectionView.js (not inline in render — avoids remount bug).

### 3d. Add/Edit Card Form

Current form already uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`. Minor tweak: button row uses `flex-col sm:flex-row` on mobile.

### 3e. Pagination

Current: shows page numbers. On mobile: simplify to `← Prev  Page X of Y  Next →` with larger tap targets (`py-2 px-4`).

---

## 4. Wishlist View

Current: `<table>` with no mobile classes.

Mobile treatment: same pattern as Collection — hide table on mobile, show card-list view instead. Each wishlist card shows name, target price, current price, diff, priority badge, and Acquire/Edit/Delete buttons stacked.

---

## 5. Forum View

ForumView has 0 responsive classes. Issues on mobile:
- Thread list rows: avatar + username + title + metadata — needs wrapping text and tighter layout.
- Thread view (reading): should be full-width, comfortable reading font size.
- Post compose box: textarea must be full-width.

Treatment: add `px-3 sm:px-6`, `text-sm sm:text-base`, `flex-col sm:flex-row` wrapping where needed. No structural redesign — just spacing/text fixes throughout ForumHome, CategoryView, and ThreadView.

---

## 6. Dashboard

Dashboard stats grid: already `grid-cols-2 sm:grid-cols-4` in Dashboard.js. Minor fixes:
- Action buttons (`Add Card`, `Import`, `Update Prices`): `flex-col sm:flex-row` on mobile, full-width buttons.
- Charts/sparklines: `w-full` on mobile.

---

## 7. Settings View

Tab bar at top of SettingsView: on mobile, make it horizontally scrollable (`overflow-x-auto whitespace-nowrap flex gap-1`). Content sections already mostly stack naturally.

---

## 8. Modals → Full-screen sheets on mobile

Pattern applied to all modals in CollectionView and App.js:

**Before:**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
  <div className="bg-gray-900 rounded-xl max-w-2xl w-full ...">
```

**After:**
```jsx
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4">
  <div className="bg-gray-900 rounded-t-xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto ...">
```

This turns every modal into a bottom sheet on mobile (slides up from bottom) and keeps the centered card on desktop. Apply to:
- Price Update modal
- Import Results modal
- Commander Recommendations panel
- Set Completion panel
- Combo Finder panel
- Finance panel
- QR Preview modal
- Print Labels modal
- Location/Tags manager modal
- Similar Cards panel
- Synergies panel

---

## 9. Touch & Tap Improvements

- All interactive buttons: minimum `min-h-[44px] min-w-[44px]` (Apple's 44pt tap target guideline). Add where missing.
- Table action icon buttons: currently `p-1` — change to `p-2` on mobile: `p-1 sm:p-1`.
- Form inputs: ensure `text-base` on mobile (prevents iOS zoom-on-focus when font < 16px). Add `text-base sm:text-sm` to all inputs.

---

## File Map

| File | Action |
|------|--------|
| `frontend/src/components/BottomNav.js` | **Create** |
| `frontend/src/components/MobileFilterSheet.js` | **Create** |
| `frontend/src/App.js` | Modify — add BottomNav, pb-16, header padding |
| `frontend/src/components/CollectionView.js` | Modify — mobile card grid, mobile header, filter button |
| `frontend/src/components/WishlistView.js` | Modify — mobile card list |
| `frontend/src/components/ForumView.js` | Modify — spacing/text responsive fixes |
| `frontend/src/components/Forum/ForumHome.js` | Modify — responsive fixes |
| `frontend/src/components/Forum/ThreadView.js` | Modify — responsive fixes |
| `frontend/src/components/Dashboard.js` | Modify — action buttons responsive |
| `frontend/src/components/SettingsView.js` | Modify — tab bar scroll |
| `frontend/src/App.css` | Modify — mobile-content-offset, safe-area insets |

---

## Constraints

- Desktop layout must be pixel-identical before and after.
- All changes use Tailwind breakpoints only — no new CSS files.
- `MobileCardRow` and any other sub-components must be defined at module scope (not inside render functions) to avoid the remount bug.
- iOS safe area: add `pb-[env(safe-area-inset-bottom)]` to BottomNav so it respects the home indicator on notched iPhones.

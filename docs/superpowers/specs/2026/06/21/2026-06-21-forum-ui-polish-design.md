# Forum UI Polish — Admin Panel & Shop Design Spec
**Date:** 2026-06-21

## Overview

Full polish pass on two areas: the admin panel's Community section and the user-facing Forum Shop. All changes are frontend-only — no new API endpoints, no backend changes, no new data models.

---

## Part 1: Admin Panel — Community Section

### 1.1 Shared: ConfirmModal Component

**File:** `frontend/src/components/shared/ConfirmModal.js` (new)

A single reusable modal that replaces all `window.confirm` calls across the admin community section. Props:

```js
{
  title: string,        // e.g. "Delete post?"
  message: string,      // e.g. "By alice_wonder · \"How do I...\""
  onConfirm: () => void,
  onCancel: () => void,
  danger?: boolean      // true = red confirm button, false = blue (default true)
}
```

Visual: dark overlay (`bg-black/60`), centered card (`max-w-sm`), trash icon in a red circle, title, message, two buttons (Cancel = gray, Confirm = red when danger). Renders via `ReactDOM.createPortal` into `document.body` to avoid z-index stacking issues inside scrollable admin tabs.

Used by: `BadgesTab`, `ContentModerationTab`, `CosmeticsManager`.

Import path from admin/community files: `import ConfirmModal from '../../shared/ConfirmModal';`
Import path from Forum files: `import ConfirmModal from '../shared/ConfirmModal';`

---

### 1.2 ContentModerationTab

**File:** `frontend/src/components/admin/community/ContentModerationTab.js`

**Changes:**

**All delete actions → ConfirmModal:**
- `RecentPostsTab`: individual row delete and bulk delete — replace `window.confirm` with `ConfirmModal`
  - Single: title "Delete post?", message shows author + content preview (first 60 chars)
  - Bulk: title "Delete N posts?", message "This will permanently remove N posts."
- `RecentThreadsTab`: individual row delete — replace `window.confirm` with `ConfirmModal`
  - title "Delete thread?", message shows thread title + "All replies will also be deleted."

**Add bulk delete to RecentThreadsTab:**
- Add checkbox column (matches existing RecentPostsTab pattern)
- Add "Delete Selected (N)" red button in toolbar when selection > 0
- Bulk delete iterates serially (same pattern as posts tab)

**Cleaner table rows:**
- Increase row padding from implied default to `py-3 px-4`
- Author column: avatar circle (initials, colored by first char) + username + role badge if moderator/admin
- Content preview: max 80 chars, full text on `title` tooltip (already exists, keep)
- Date column: relative time ("2h ago") with full date on `title` tooltip

**Empty states:**
- Each tab shows a centered icon + message when results are empty:
  - Recent Posts: envelope icon + "No posts yet"
  - Recent Threads: message-square icon + "No threads yet"
  - Flagged Content: shield icon + "No flagged content"

---

### 1.3 BadgesTab

**File:** `frontend/src/components/admin/community/BadgesTab.js`

**Changes:**

**Search input above badge list:**
```jsx
<input
  type="text"
  placeholder="Search badges..."
  value={search}
  onChange={e => setSearch(e.target.value)}
  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
/>
```
Filters the badge list client-side by `badge.name.toLowerCase().includes(search.toLowerCase())`.

**Badge count in header:**
- Header shows "Badges (12)" where 12 = total badge count from API (not filtered count)

**Delete → ConfirmModal:**
- Replace existing inline "Delete 'X'?" row expansion with `ConfirmModal`
- title: `Delete "${badge.name}"?`, message: "This badge will be removed permanently."

---

### 1.4 CosmeticsManager

**File:** `frontend/src/components/Forum/CosmeticsManager.js`

**Changes:**

**Search + category filter toolbar:**
```jsx
<div className="flex gap-3 mb-4">
  <input
    type="text"
    placeholder="Search cosmetics..."
    value={search}
    onChange={e => setSearch(e.target.value)}
    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
  />
  <select
    value={categoryFilter}
    onChange={e => setCategoryFilter(e.target.value)}
    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
  >
    <option value="">All Categories</option>
    <optgroup label="Post Appearance">
      <option value="titleColor">Title Colors</option>
      <option value="avatarBorder">Avatar Borders</option>
      <option value="flairIcon">Flair Icons</option>
      <option value="postBackground">Post Tints</option>
      <option value="postFrame">Post Frames</option>
      <option value="threadHighlight">Thread Highlight</option>
      <option value="nameplateBackground">Nameplate Background</option>
      <option value="formatBadge">Format Badges</option>
      <option value="setSymbolFlair">Set Symbol Flair</option>
    </optgroup>
    <optgroup label="Forum Profile">
      <option value="profileBorderColor">Profile Borders</option>
      <option value="profileBackground">Profile Background</option>
      <option value="profileBanner">Profile Banners</option>
      <option value="profileTheme">Profile Themes</option>
    </optgroup>
    <optgroup label="Unlocks">
      <option value="memberTitle">Member Title</option>
      <option value="signature">Signature</option>
      <option value="achievementShowcase">Achievement Showcase</option>
      <option value="favoriteCardsShowcase">Card Showcase</option>
      <option value="deckShowcase">Deck Showcase</option>
      <option value="collectionStatsWidget">Stats Widget</option>
      <option value="wishlistPreview">Wishlist Preview</option>
      <option value="aboutMe">About Me</option>
      <option value="personalLinks">Personal Links</option>
    </optgroup>
  </select>
</div>
```

Filters client-side: name match AND (categoryFilter === "" OR cosmetic.category === categoryFilter).

**Item count in header:**
- Header: "Cosmetics Shop (24)" where 24 = total from API

**Delete → ConfirmModal:**
- Replace existing delete flow with `ConfirmModal`
- title: `Delete "${cosmetic.name}"?`, message: "This cosmetic will be removed from the shop permanently."

---

## Part 2: Forum Shop — User-facing

**File:** `frontend/src/components/Forum/ForumShop.js`

### 2.1 Item Card Redesign

Switch from 2-column grid to single-column horizontal cards:

```
┌────────────────────────────────────────────────────────┐
│ [56x56 preview] │ Name  [RARITY PILL]                  │
│                 │ Category · description or animation  │
│                 │ ⏱ Expires in 3 days  (if limited)   │
│                 │                     🪙 500  [Buy ▶]  │
└────────────────────────────────────────────────────────┘
```

**Card structure:**
```jsx
<div className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${stateClasses}`}>
  {/* Preview swatch: 56x56, rounded-xl */}
  <div className="w-14 h-14 rounded-xl flex-shrink-0" style={previewStyle} />

  {/* Info */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-0.5">
      <span className="text-white font-semibold text-sm truncate">{cosmetic.name}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${rarityClasses}`}>
        {cosmetic.rarity?.toUpperCase()}
      </span>
      {cosmetic.availableUntil && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 flex-shrink-0">LIMITED</span>
      )}
    </div>
    <p className="text-gray-400 text-xs truncate">{cosmetic.description || cosmetic.category}</p>
    {cosmetic.availableUntil && (
      <p className="text-amber-400 text-xs mt-0.5">⏱ {daysRemaining(cosmetic.availableUntil)}</p>
    )}
  </div>

  {/* Price + Action */}
  <div className="flex-shrink-0 text-right">
    {!isOwned && <div className="text-amber-400 font-semibold text-sm mb-1.5">🪙 {cosmetic.cost}</div>}
    <ActionButton cosmetic={cosmetic} />
  </div>
</div>
```

**State border colors (unchanged logic, cleaner implementation):**
- Equipped: `border-green-500`
- Owned (not equipped): `border-blue-500`
- Unaffordable: `border-gray-700 opacity-60`
- Default unowned: `border-gray-700`
- Limited (unowned): `border-amber-500`

**Rarity pill colors:**
- Common: `bg-gray-700 text-gray-300`
- Uncommon: `bg-green-900 text-green-300`
- Rare: `bg-blue-900 text-blue-300`
- Epic: `bg-purple-900 text-purple-300`
- Legendary: `bg-amber-900 text-amber-300`

### 2.2 Category Tabs with Counts

Current tabs: All | Post Appearance | Forum Profile | Unlocks

Add item count per tab derived from the `catalogItems` array already in state (use total, not filtered count — counts should be stable while user types in search):
```jsx
const POST_CATS = ['titleColor','avatarBorder','flairIcon','postBackground','postFrame','threadHighlight','nameplateBackground','formatBadge','setSymbolFlair'];
const PROFILE_CATS = ['profileBorderColor','profileBackground','profileBanner','profileTheme'];
const UNLOCK_CATS = ['memberTitle','signature','achievementShowcase','favoriteCardsShowcase','deckShowcase','collectionStatsWidget','wishlistPreview','aboutMe','personalLinks'];

const tabCounts = {
  all: catalogItems.length,
  post: catalogItems.filter(c => POST_CATS.includes(c.category)).length,
  profile: catalogItems.filter(c => PROFILE_CATS.includes(c.category)).length,
  unlocks: catalogItems.filter(c => UNLOCK_CATS.includes(c.category)).length,
};
```

Tab label: `Post Appearance (9)` — count in parentheses next to the label. The existing `GROUP_TABS` array is extended to inject the count: render `{tab.label} ({tabCounts[tab.id]})` inside the button.

### 2.3 Coin Balance Header

Current: small yellow coin icon + number. Make more prominent:
- Increase coin display to `text-lg font-bold`
- Add `bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1` container around it
- Keep same position (top-right of modal header)

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/shared/ConfirmModal.js` | **New** — shared delete confirmation modal |
| `frontend/src/components/admin/community/ContentModerationTab.js` | Replace window.confirm, add bulk delete to threads, cleaner tables, empty states |
| `frontend/src/components/admin/community/BadgesTab.js` | Add search, badge count, use ConfirmModal |
| `frontend/src/components/Forum/CosmeticsManager.js` | Add search + category filter, item count, use ConfirmModal |
| `frontend/src/components/Forum/ForumShop.js` | Horizontal card layout, rarity pills, limited-time prominence, tab counts, coin balance polish |

## Out of Scope

- FeedbackTab (no changes)
- Backend changes of any kind
- New API endpoints
- Badge assignment UI (award badges to users)
- Cosmetic preview/try-on before purchase

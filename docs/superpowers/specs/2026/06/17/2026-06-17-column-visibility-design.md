---
name: collection-column-visibility
description: Right-click context menu to toggle column visibility with per-user database persistence
metadata:
  type: design
  created: 2026-06-17
---

# Collection Column Visibility System Design

## Overview

Users can right-click on the card collection table headers to access a context menu that lets them toggle which columns are visible. Column visibility preferences are saved per user in the database and persist across sessions and devices.

## Current State

The collection table currently has 16 columns with mixed responsive visibility:

**Always Visible:**
- Card Name
- Qty
- Condition
- Price

**Responsive (hidden on smaller screens):**
- Set, Set Code, Collector #, Rarity, Mana Cost, Colors, Types, Location, Foil, Token, Tags

## Design Goals

1. **Reduce visual clutter** — default to essential columns only (Name, Qty, Condition, Price)
2. **User control** — right-click to show/hide any column on demand
3. **Persistent preferences** — save choices per user in database
4. **Cross-device sync** — preferences restore when user logs in elsewhere
5. **Future-proof** — system works with new columns added by the 7 improvement plans

## Architecture

### Backend

**New Model: UserColumnPreferences**
```
userId: ObjectId (ref User)
visibleColumns: [String] (array of column names)
createdAt: Date
updatedAt: Date
```

**New Endpoints:**
- `GET /api/user/column-preferences` — fetch user's visible columns
- `PUT /api/user/column-preferences` — update visible columns (body: `{ visibleColumns: [...] }`)

Both endpoints require authentication (`verifyToken`, `requireAuth`).

### Frontend

**useColumnVisibility Hook**
- Fetches user's visible columns on component mount
- Provides `visibleColumns` state and `toggleColumn(columnName)` function
- Auto-saves changes to backend
- Provides default columns if user has no preferences

**ColumnContextMenu Component**
- Right-click handler that shows context menu near cursor
- Displays all ~14 available columns with checkboxes
- Shows checked columns as visible, unchecked as hidden
- Click checkbox to toggle, saves automatically
- Closes menu after interaction

**Integration with Table**
- Add right-click event handler to table header
- Import and render `<ColumnContextMenu>` when right-click occurs
- Conditionally render table cells based on `visibleColumns`

## Available Columns (in order)

1. Card Name (always visible, essential)
2. Set
3. Set Code
4. Collector # (Number)
5. Rarity
6. Mana Cost
7. Colors
8. Types
9. Location
10. Foil
11. Token
12. Tags
13. Qty (always visible, essential)
14. Condition (always visible, essential)
15. Price (always visible, essential)
16. Total (hidden by default)
17. Actions (hidden by default)

## Default Visible Columns

On first login or if user has no preferences:
- Card Name
- Qty
- Condition
- Price

## Implementation Phases

1. **Backend:** Model + endpoints (user auth required)
2. **Frontend Hooks:** useColumnVisibility with local state and API integration
3. **Frontend UI:** ColumnContextMenu component with checkbox list
4. **Table Integration:** Wire right-click handler and conditional rendering
5. **Testing:** Verify persistence, cross-session sync, new columns work

## Error Handling

- If fetch fails, use default columns (don't break table)
- If save fails, show toast notification but keep UI state in sync
- Graceful fallback if user has corrupted preferences

## Testing Checklist

- [ ] Right-click on header shows context menu
- [ ] Clicking checkbox toggles column visibility
- [ ] Menu closes after interaction
- [ ] Preferences save to database
- [ ] Preferences load on app restart
- [ ] New columns added by improvement plans are auto-included in menu
- [ ] Essential columns (Name, Qty, Condition, Price) work in any visibility state
- [ ] Works on different devices (preferences sync via database)
- [ ] Works on mobile (context menu positioning)

## Scope Notes

- This feature does NOT include column reordering (future enhancement)
- Does NOT include column width customization (future enhancement)
- Focuses on visibility toggles only
- Works alongside existing responsive design (responsive classes remain but honored by user preferences)

## Integration with 7 Improvement Plans

All new columns from these plans are automatically available for toggling:
1. **Performance & Quality Improvements** — no new columns
2. **Collection & Finance Bundle** — adds: Buylist Value, Sell Value, Price Alert Flag
3. **Feature Bundle** — adds: Collection Value History (via tooltip/modal, not column)
4. **Deck Folders** — no new columns
5. **Price History Sparklines** — adds: Price Trend (via hover sparkline, not column)
6. **Admin Expansion** — no collection columns
7. **SpellTable-Lite** — no collection columns

New columns are added to the available columns list and can be toggled like existing ones.

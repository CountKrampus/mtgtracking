# Deck Analysis & Bulk Operations — Design Spec

**Date:** June 3, 2026  
**Status:** Approved for implementation  
**Features:** Mana curve analysis expansion + bulk operations UX improvement

---

## Feature 1: Deck Analysis Panel (Expandable)

### Goal
Provide deck builders with detailed analysis of their deck composition, color balance, curve distribution, and tailored improvement suggestions based on their specific deck and available cards.

### Current State
DeckDetail shows a basic mana curve chart with average CMC. Limited insight into deck composition.

### Proposed Changes

#### Component: Enhanced Deck Statistics Section
**Location:** `frontend/src/components/DeckDetail.js`, stats area below mana curve chart

**Current UI:**
- Mana curve bar chart
- Avg CMC display
- Collapse/expand button

**New UI:**
- Mana curve chart (unchanged)
- "View Full Analysis" button (collapsed by default)
- Expandable analysis panel with sections:

#### Analysis Sections (in expanded panel):

**1. Lands Summary**
- Total lands (count)
- Basic vs non-basic breakdown
- Status indicator (e.g., "Good", "Consider adding more")

**2. Color Balance**
- Pie chart or bar breakdown of color distribution (%)
- Primary color identification (e.g., "Blue (40%)")
- Secondary colors

**3. Curve Analysis**
- Early game (CMC 0-2): % and assessment
- Mid game (CMC 3-5): % and assessment  
- Late game (CMC 6+): % and assessment
- Recommendation per tier if imbalanced

**4. Card Type Distribution**
- Breakdown by type: Creatures, Instants, Sorceries, Enchantments, Artifacts, Other
- Show percentages

**5. Tailored Recommendations**
- 2-3 actionable suggestions based on deck analysis
- **Color-aware:** Recommendations consider color identity
  - Example: "Blue is light on removal. Consider [nonblue removal card]"
  - Example: "White is strong at board wipes. Consider [white wipe in collection]"
- **Specific card suggestions:** Highlight cards from user's collection that fit the recommendation
  - Show with ✓ checkmark if in collection
  - Show as "Not in collection" if not available
- **What to cut:** Suggest which cards/types to remove to make space

### Data Sources
- Deck.mainDeck array (cards and quantities)
- Card data (CMC, type, colors, mana cost breakdown)
- User's card collection (for "in collection" indicators)

### Calculation Logic

**Land count:** Sum cards with type containing "Land"

**Color balance:** For each color (WUBRG):
- Count cards that require that color in mana cost
- Calculate percentage of total nonland cards
- Identify primary (>40%), secondary (20-40%), minor (<20%)

**Curve tiers:**
- Early (0-2 CMC): % of nonland cards
- Mid (3-5 CMC): % of nonland cards
- Late (6+ CMC): % of nonland cards

**Card type distribution:** Count by type using card.type field

**Recommendations:**
- If early game < 15%: "Add early game interaction/ramp"
- If mid game < 30%: "Deck is skewed high; consider lower CMC cards"
- If late game < 20% for control/combo: "Add win conditions"
- Color-specific analysis based on established strengths:
  - Blue: Card draw, counterspells
  - White: Removal, board wipes, life gain
  - Black: Tutors, discard, removal
  - Red: Burn, direct damage, haste creatures
  - Green: Ramp, big creatures, land ramp

### UI/UX Details

**Collapsed state:**
```
┌─────────────────────────────┐
│  [Bar chart]                │
│  Avg CMC: 3.5               │
│  [▼] View Full Analysis     │
└─────────────────────────────┘
```

**Expanded state:**
- Analysis panel slides open below mana curve
- Uses existing dark glassmorphism styling
- Sections use cards/boxes for visual separation
- Color indicators for recommendations (green = healthy, orange = needs attention)

**Interaction:**
- Click "View Full Analysis" → panel expands (smooth animation)
- Click again (or ▲ button) → collapses
- State persists during session (not across refresh)

---

## Feature 2: Bulk Operations Floating Action Bar

### Goal
Improve discoverability and usability of bulk operations (condition, location, tags, delete) with a modern floating action bar that guides users through the workflow.

### Current State
Bulk operations exist but are hidden in a menu or require multiple modal steps. Users may not discover the feature.

### Proposed Changes

#### Component: Selection Checkboxes + Floating Action Bar

**Location:** Collection/deck card table, sticky at bottom of viewport

#### Selection UI

**Checkbox placement:** Left of each card row (before card name)
- Clicking checkbox toggles row highlight (subtle background color change)
- Visual feedback: row highlights with background color

**Interaction:**
- Single click toggles checkbox state
- Shift-click to select range
- No confirmation needed

#### Floating Action Bar

**Position:** Sticky at bottom of viewport (above browser bottom bar)  
**Visibility:** Only appears when 1+ cards selected

**Content:**
```
┌──────────────────────────────────────────────────────────┐
│ ✓ 3 cards selected | [Select All] [Clear Selection]     │
│                                                           │
│ [Update Condition ▼] [Update Location ▼] [Manage Tags ▼]│
│ [Delete]                                                  │
└──────────────────────────────────────────────────────────┘
```

**Sections:**
1. **Status section:** Shows "N cards selected" + quick actions
   - "Select All" button: Select all visible cards on page
   - "Clear Selection" button: Deselect all

2. **Action buttons:** Dropdown menus for each operation
   - **Update Condition:** Dropdown shows NM, LP, MP, HP, DMG
   - **Update Location:** Dropdown shows available locations
   - **Manage Tags:** Opens modal for add/remove tags
   - **Delete:** Direct action with confirmation modal

**Workflow:**
1. User checks 3 cards
2. Floating bar appears showing count
3. User clicks "Update Condition" → dropdown shows options
4. User selects "LP"
5. All 3 cards updated instantly with success toast
6. Bar stays visible; user can perform another action
7. User clicks "Clear Selection" → bar disappears

#### Styling

**Dark glassmorphism theme** (matching app):
- Semi-transparent dark background (bg-indigo-950/90)
- Border top for separation (border-white/20)
- White text and buttons
- Compact spacing (py-3, px-4)

**Button styling:**
- Secondary buttons: bg-white/10 hover:bg-white/20
- Danger buttons (Delete): bg-red-600/50 hover:bg-red-600
- Active state: highlighted/selected

#### Feedback & Confirmation

**Success feedback:**
- Toast message: "Updated 3 cards"
- Message auto-dismisses after 3 seconds
- Floating bar stays visible for next action

**Delete confirmation:**
- Modal appears: "Delete 3 cards? This cannot be undone."
- Requires "Confirm" click
- After delete: "Deleted 3 cards" toast

**Error handling:**
- If operation fails: "Failed to update cards: [reason]"
- User can retry

#### Multiple Operations in Sequence

Users can:
1. Select cards
2. Update condition
3. Update location (same selection still active)
4. Add tags
5. Clear and select new batch

No need to close modal and reselect each time.

---

## Technical Notes

### Backend
- Existing bulk update endpoints used: `/api/cards/bulk-update`
- Existing delete endpoint: `/api/cards/bulk-delete`
- No backend changes needed

### Frontend
- Add selection checkboxes to card rows (if not present)
- Create FloatingActionBar component (or integrate into collection view)
- Add floating bar to collection table
- Use existing bulk operation handlers
- Update UI feedback/toast system if needed

### State Management
- selectedCards: Set of card IDs
- showFloatingBar: boolean (shows when selectedCards.size > 0)
- Toast notifications for feedback

---

## Testing & Verification

### Deck Analysis
1. Open DeckDetail for a deck with mixed colors
2. Click "View Full Analysis"
3. Verify all sections populate:
   - Land count correct
   - Color balance percentages sum to ~100%
   - Curve tiers show distribution
   - Recommendations appear and mention colors
   - Cards from collection marked with ✓
4. Collapse and re-expand → state persists

### Bulk Operations
1. Navigate to collection table
2. Check 1 card → floating bar appears
3. Check 5 more cards → count updates to 6
4. Click "Select All" → all visible cards selected
5. Click "Update Condition" → dropdown appears
6. Select "LP" → all 6 cards update instantly
7. Verify cards show new condition
8. Click "Clear Selection" → bar disappears
9. Test Delete → confirmation modal, then delete works
10. Test with location and tags

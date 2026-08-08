# Mobile Admin Panel Layout — Design

**Status:** Approved, ready for implementation planning
**Date:** 2026-08-07

## Problem

On mobile, the Admin Panel (`frontend/src/components/admin/AdminPanel.js`) squeezes its navigation sidebar into a 256px-tall scrollable accordion stacked above the tab content (`max-h-64 sm:max-h-none`), which can bleed/clip past the modal's edge — confirmed via a screenshot showing a sliver of the purple-highlighted sidebar peeking out from behind the modal, only partially visible. Separately, content inside individual tabs (data tables, filter rows, the floating bulk-action bar in `UsersTab.js`) gets cramped or cut off on narrow screens — e.g. `UsersTab.js`'s bulk-action bar (`fixed bottom-6 left-1/2 -translate-x-1/2`, no `flex-wrap`, multiple buttons) has no defense against overflowing past the screen edge with several buttons visible.

## Goal

A working mobile admin panel: navigation you can actually reach every tab through without fighting a tiny scroll box, and tab content (tables, filters, action bars) that doesn't get cut off on a phone-width screen. Desktop (`sm:` breakpoint and up) is unchanged.

## Part 1: Navigation — Mobile Drill-Down

Below the `sm:` breakpoint, replace the stacked-accordion-above-content layout with a 3-screen drill-down: **Groups → Tabs → Content**, each full-width and single-scroll-region, navigated with a "← Back" button. Desktop keeps today's sidebar+content two-pane layout, completely unchanged — both layouts render in the DOM simultaneously and are toggled via Tailwind `sm:` visibility classes, matching this codebase's existing convention (no JS media-query/resize-listener; the current sidebar already does this with `w-full sm:w-56`).

**New state in `AdminPanel.js`:**
```js
const [mobileScreen, setMobileScreen] = useState('groups'); // 'groups' | 'tabs' | 'content'
const [mobileActiveGroup, setMobileActiveGroup] = useState(null);
```

**Screen 1 — Groups:** full-width list of the 4 group buttons (User Management, Data & Pricing, Community, System), filtered by `group.tabs.some(tab => canSeeTab(tab, user))` exactly as today's sidebar already does. Tapping a group sets `mobileScreen: 'tabs'` and `mobileActiveGroup: group`.

**Screen 2 — Tabs:** full-width list of the selected group's tabs (filtered by `canSeeTab`), with a "← Back" button at the top returning to Screen 1 (`mobileScreen: 'groups'`). Tapping a tab calls the existing `setActiveTab(tab.id)` and sets `mobileScreen: 'content'`.

**Screen 3 — Content:** the existing `renderContent(activeTab)` output, full-width, with a "← Back" button at the top returning to Screen 2 (`mobileScreen: 'tabs'`).

The existing top-right "X" close button always closes the entire Admin Panel modal, regardless of which of the 3 screens is showing — unchanged behavior, not reset by `mobileScreen`.

**Edge case:** if `activeTab` changes via the `useEffect` that auto-selects the first visible tab on `user` change (existing logic, lines 133-138), and the panel is currently on mobile Screen 3, it should stay on Screen 3 showing the newly-selected tab's content (no forced navigation back to Screen 1) — this only matters if `user`'s visible tabs change while the panel is already open, an unlikely but possible case (e.g. a permission change).

## Part 2: Content Area — Systemic Mobile Fixes

Applied uniformly across all 16 tab components (`UsersTab`, `RoleManagement`, `PermissionsManagement`, `BansTab`, `WarningsTab`, `AppealsTab`, `SystemHealthTab`, `PricingAdminTab`, `CollectionAuditsTab`, `BackupsExportsTab`, `DataCleanupTab`, `PriceCorrectionsTab`, `ContentModerationTab`, `FeedbackTab`, `BadgesTab`, `ChallengesTab`, `ActivityLogTab`, `SettingsTab`, `SessionsTab`, `PerformanceTab`) — no per-table redesign, no card-layout conversion, just closing the actual causes of cramping:

1. **Content padding:** `AdminPanel.js`'s main content wrapper (`p-6`, line 194) becomes `p-3 sm:p-6` — 12px on mobile instead of 24px, giving tables/forms more usable width without touching desktop.
2. **Table horizontal scroll audit:** every `<table>` in every tab component must be wrapped in a `overflow-x-auto` container (several already are, per the established `bg-gray-700/50 rounded-lg overflow-x-auto` pattern seen in `FeedbackTab.js`/`UsersTab.js` — this is an audit-and-fix-the-gaps pass, not a rewrite of tables that already do this correctly).
3. **Button/filter row wrapping:** any `flex items-center gap-*` row holding multiple buttons or filter controls (search boxes, dropdowns, action buttons) that currently has no wrap behavior gets `flex-wrap` added, so controls stack onto additional lines instead of overflowing horizontally.
4. **Floating/fixed-position bars:** `UsersTab.js`'s bulk-action bar (`fixed bottom-6 left-1/2 -translate-x-1/2`, multiple buttons, no wrap) specifically needs `flex-wrap` AND a `max-w-[calc(100vw-2rem)]` cap (leaving 1rem breathing room on each side) so it can never render wider than the viewport regardless of how many buttons are active — this is the clearest concrete instance of "getting cut off" and should be treated as the reference example for any other fixed-position bar found during the audit.

## Testing

No frontend test infrastructure in this repo (established convention) — verified via `npm run build` plus manual click-through, including actual mobile-width testing (browser devtools responsive mode or an actual phone, not just resizing a desktop window past the breakpoint):
- Open Admin Panel on a mobile-width viewport, confirm no horizontal overflow/clipping on the initial Groups screen.
- Drill into a group, then a tab, confirm each screen is full-width with no residual sidebar sliver, and "← Back" navigates correctly at each level.
- Confirm the top-right "X" closes the panel from any drill-down depth.
- Open a data-heavy tab (Users, Feedback) on mobile, confirm the table scrolls horizontally within its own container rather than the whole page/modal overflowing.
- Select multiple users in `UsersTab` to trigger the floating bulk-action bar, confirm it wraps and stays within the viewport width rather than extending off-screen.
- Spot-check 2-3 other tabs (e.g. `SettingsTab`, `BadgesTab`) for the reduced padding taking effect and no newly-introduced layout breakage.
- Confirm desktop admin panel (`sm:` and above) is visually unchanged from before this work.

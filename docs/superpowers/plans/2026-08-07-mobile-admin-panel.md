# Mobile Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A usable mobile Admin Panel — a 3-screen drill-down navigation (Groups → Tabs → Content) replacing the current clipped accordion sidebar, plus systemic content-area fixes (padding, table overflow, button-row wrapping) so tab content stops getting cut off on narrow screens. Desktop is unchanged.

**Architecture:** Both changes are pure Tailwind `sm:`-breakpoint CSS/JSX changes to existing components — no new backend work, no new dependencies. `AdminPanel.js` gains `mobileScreen`/`mobileActiveGroup` state and renders a mobile-only 3-screen structure (hidden at `sm:` and up) alongside the existing desktop sidebar+content structure (hidden below `sm:`). Content-area fixes are a mix of two confirmed concrete fixes (found during a full audit of all 20 admin tab components) plus a generic wrap/overflow pass applied uniformly.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual mobile-width click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-mobile-admin-panel-design.md`

**Audit findings referenced by this plan** (already confirmed by grepping all 20 tab components under `frontend/src/components/admin/`, per the group list in `AdminPanel.js`):
- Of 11 tabs rendering a `<table>`, only `data-pricing/CollectionAuditsTab.js` is missing an `overflow-x-auto` wrapper — every other table-rendering tab already has one.
- Of all 20 tabs, only `user-management/UsersTab.js` has a `fixed`-positioned floating bar (the bulk-action bar at the bottom, `fixed bottom-6 left-1/2 -translate-x-1/2`) — no other tab has this pattern.

---

## Task 1: Mobile drill-down navigation in `AdminPanel.js`

**Files:**
- Modify: `frontend/src/components/admin/AdminPanel.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through at a mobile viewport width.

- [ ] **Step 1: Add the mobile navigation state**

Add alongside the existing `activeTab`/`expandedGroups` state (~line 121):
```js
  const [mobileScreen, setMobileScreen] = useState('groups'); // 'groups' | 'tabs' | 'content'
  const [mobileActiveGroup, setMobileActiveGroup] = useState(null);
```

- [ ] **Step 2: Restructure the body into mobile (drill-down) + desktop (existing sidebar+content) branches**

Replace the current "Body: sidebar + content" block (~lines 151-197) with:

```jsx
        {/* Body: sidebar + content */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">

          {/* ── Mobile: 3-screen drill-down (hidden at sm: and up) ── */}
          <div className="sm:hidden flex-1 overflow-y-auto">
            {mobileScreen === 'groups' && (
              <div>
                {groups.filter(group => group.tabs.some(tab => canSeeTab(tab, user))).map(group => {
                  const GroupIcon = group.icon;
                  return (
                    <button
                      key={group.id}
                      onClick={() => { setMobileActiveGroup(group); setMobileScreen('tabs'); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800 transition border-b border-gray-700"
                    >
                      <GroupIcon size={16} className={group.color} />
                      <span className="text-sm font-semibold text-gray-300 flex-1">{group.label}</span>
                      <ChevronRight size={14} className="text-gray-500" />
                    </button>
                  );
                })}
              </div>
            )}

            {mobileScreen === 'tabs' && mobileActiveGroup && (
              <div>
                <button
                  onClick={() => setMobileScreen('groups')}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-300 hover:bg-gray-800 transition border-b border-gray-700"
                >
                  <ChevronRight size={14} className="rotate-180" />
                  <span className="text-sm font-semibold">{mobileActiveGroup.label}</span>
                </button>
                {mobileActiveGroup.tabs.filter(tab => canSeeTab(tab, user)).map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMobileScreen('content'); }}
                      className="w-full flex items-center gap-2 pl-8 pr-4 py-3 text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
                    >
                      <TabIcon size={14} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {mobileScreen === 'content' && (
              <div>
                <button
                  onClick={() => setMobileScreen('tabs')}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-300 hover:bg-gray-800 transition border-b border-gray-700"
                >
                  <ChevronRight size={14} className="rotate-180" />
                  <span className="text-sm font-semibold">Back</span>
                </button>
                <div className="p-3">
                  {renderContent(activeTab)}
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop: existing sidebar + content (hidden below sm:) ── */}
          <div className="hidden sm:block sm:w-56 bg-gray-900 sm:border-r border-gray-700 overflow-y-auto flex-shrink-0">
            {groups.filter(group => group.tabs.some(tab => canSeeTab(tab, user))).map(group => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups[group.id];
              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800 transition"
                  >
                    <GroupIcon size={16} className={group.color} />
                    <span className="text-sm font-semibold text-gray-300 flex-1">{group.label}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-gray-500" />
                      : <ChevronRight size={14} className="text-gray-500" />}
                  </button>

                  {isExpanded && group.tabs.filter(tab => canSeeTab(tab, user)).map(tab => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-left text-sm transition ${
                          activeTab === tab.id
                            ? 'bg-purple-600/30 text-purple-300 border-r-2 border-purple-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        <TabIcon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="hidden sm:block flex-1 min-w-0 overflow-y-auto p-3 sm:p-6">
            {renderContent(activeTab)}
          </div>
        </div>
```

Notes on this rewrite:
- The desktop branch is functionally identical to the pre-existing code, just wrapped in `hidden sm:block` instead of relying on `w-full sm:w-56`/`max-h-64 sm:max-h-none` sizing tricks — this fully separates the two layouts instead of trying to make one structure serve both, which is what caused the clipping bug in the first place.
- The mobile content screen (`mobileScreen === 'content'`) reuses the same `renderContent(activeTab)` call as desktop — no duplicated tab-content logic.
- `p-3 sm:p-6` on the desktop content div is this task's share of the Task 2 padding fix (mobile's own content wrapper above already uses `p-3` directly, since it's a mobile-only element with no desktop equivalent to make responsive).

- [ ] **Step 3: Handle the `activeTab` auto-select edge case**

The existing `useEffect` (~lines 133-138) auto-selects the first visible tab when `user` changes. No change needed to this effect itself, but confirm behavior: if this fires while `mobileScreen === 'content'` is already showing a different tab, the content screen will simply re-render with the newly auto-selected tab's content (via the same `renderContent(activeTab)` call) without forcing navigation back to Screen 1 — this matches the spec's documented edge-case handling. Verify this manually in Step 5 if you can reproduce a `user` prop change while the panel is open (likely not easily reproducible in normal manual testing — note in your self-review if you couldn't verify it directly, that's acceptable given how narrow this edge case is).

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke test at mobile width**

With the dev server running, open the Admin Panel in browser devtools' responsive mode (or an actual phone) at a width below 640px:
- Confirm the Groups screen shows full-width with no sidebar sliver bleeding from behind the modal.
- Drill into a group, confirm the Tabs screen shows correctly with a working "← Back".
- Tap a tab, confirm the Content screen shows that tab's content full-width, with a working "← Back" returning to the Tabs screen.
- Confirm the top-right "X" closes the whole panel from any of the 3 screens.
- Resize back above 640px (or reload at a desktop width) and confirm the original sidebar+content layout still looks and behaves exactly as before this change.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AdminPanel.js
git commit -m "feat: replace mobile admin panel accordion sidebar with 3-screen drill-down navigation"
```

---

## Task 2: Content-area systemic fixes

**Files:**
- Modify: `frontend/src/components/admin/data-pricing/CollectionAuditsTab.js`
- Modify: `frontend/src/components/admin/user-management/UsersTab.js`
- Modify (audit pass, fix only where the criteria below are met): all other files under `frontend/src/components/admin/`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through at a mobile viewport width.

- [ ] **Step 1: Fix `CollectionAuditsTab.js`'s missing table overflow wrapper**

Find the table (around line 269: `<table className="w-full text-sm">`) and wrap it in an `overflow-x-auto` container, matching the pattern already used everywhere else in this codebase (e.g. `RoleManagement.js`: `<div className="overflow-x-auto rounded-lg border border-gray-700">`):
```jsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    {/* ...unchanged table contents... */}
  </table>
</div>
```
Read the file first to find the table's exact closing `</table>` tag so the wrapping `<div>` closes in the right place.

- [ ] **Step 2: Fix `UsersTab.js`'s floating bulk-action bar**

Find the bulk-action bar (around line 418: `<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">`). Add `flex-wrap` and a viewport-width cap:
```jsx
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl px-5 py-3 flex flex-wrap items-center gap-4 max-w-[calc(100vw-2rem)]">
```
(Only the `className` changes — `flex` → `flex flex-wrap`, and `max-w-[calc(100vw-2rem)]` appended. No other changes to this block.)

Also check the filter row above the table (around line 226: `<div className="flex items-center gap-4">`) — read the surrounding context to see how many controls it holds and whether they'd realistically overflow on a ~360px-wide screen; if so, add `flex-wrap` there too.

- [ ] **Step 3: Audit pass across the remaining admin tab components**

For each file under `frontend/src/components/admin/` that's actually wired into one of `AdminPanel.js`'s 20 tabs (the `groups` array at the top of that file lists exactly which components are in scope — do not touch unrelated files like `UserManagement.js` or `ActivityLogViewer.js`, which are not part of the current Admin Panel tab list despite living in the same directory tree), check for:
- Any `flex items-center gap-*` (or similar) row holding 3+ inline controls (buttons, selects, inputs) with no `flex-wrap` — add `flex-wrap` if missing.
- Any other `<table>` without an `overflow-x-auto` ancestor (Step 1 already covered the one confirmed instance; this is a final sanity pass in case something was missed).
- Any other `fixed`-positioned bar (Step 2 already covered the one confirmed instance; sanity pass).

Do not redesign tables into cards, do not touch tabs that already look fine at mobile width, do not change desktop-only styling (nothing prefixed `sm:` or higher needs review here).

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke test at mobile width**

With the dev server running, at a viewport width below 640px:
- Open the Collection Audits tab (via Task 1's drill-down), confirm its table scrolls horizontally within its own container instead of the page/modal overflowing.
- Open the Users tab, select 2+ users to trigger the bulk-action bar, confirm it wraps and never extends past the screen edges (check both portrait orientations if testing on a real device, or resize devtools' responsive width down to ~320px to stress-test).
- Spot-check 2-3 other tabs you touched during the Step 3 audit for correct wrapping and no visual regressions.
- Confirm desktop (above 640px) is visually unchanged for every file touched in this task.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/
git commit -m "fix: mobile content-area overflow in admin panel (table scroll, button-row wrapping)"
```

---

## Task 3: Final verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 2: End-to-end manual smoke test**

At a mobile viewport width, open the Admin Panel from scratch: navigate through all 4 groups via the drill-down, open at least one tab per group, confirm nothing is visually cut off or requires horizontal scrolling of the whole page (only individual tables/bars scrolling within their own containers is expected). Then confirm desktop is completely unaffected — open the Admin Panel at a desktop width and confirm it looks and behaves exactly as it did before this branch.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

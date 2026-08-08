# Admin Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive admin command center with user discipline (bans, warnings, appeals), pricing management, collection audits, and data management tools organized in 4 grouped super-tabs.

**Architecture:** Split into backend models/routes (foundation), then frontend components organized by feature group. Each feature is independent so components can be built in parallel. Permission middleware prepared for future tiering.

**Tech Stack:** Node.js/Express (backend), MongoDB/Mongoose (models), React (frontend), existing Tailwind + Lucide icons

**Affected Directories:**
- `backend/models/` — 5 new models
- `backend/routes/admin.js` — extend with new routes
- `backend/server.js` — User login validation (ban check), background job handler
- `frontend/src/components/admin/` — reorganize into 4 folders, add 11 new components

---

## File Structure

### Backend
```
backend/
├── models/
│   ├── UserBan.js (NEW)
│   ├── UserWarning.js (NEW)
│   ├── BanAppeal.js (NEW)
│   ├── ModerationHistory.js (NEW)
│   └── CollectionAudit.js (NEW)
├── routes/
│   └── admin.js (MODIFY - add new endpoints)
└── server.js (MODIFY - Session validation for bans, async job handler)
```

### Frontend
```
frontend/src/components/admin/
├── AdminPanel.js (MODIFY - 4 grouped tabs)
├── user-management/ (NEW folder)
│   ├── UsersTab.js (refactored)
│   ├── BansTab.js (NEW)
│   ├── WarningsTab.js (NEW)
│   └── AppealsTab.js (NEW)
├── data-pricing/ (NEW folder)
│   ├── SystemHealthTab.js (refactored)
│   ├── PricingAdminTab.js (NEW)
│   ├── CollectionAuditsTab.js (NEW)
│   ├── BackupsExportsTab.js (NEW)
│   └── DataCleanupTab.js (NEW)
├── community/ (NEW folder)
│   ├── ContentModerationTab.js (existing, enhanced)
│   └── FeedbackTab.js (existing, moved)
└── system/ (NEW folder)
    ├── ActivityLogTab.js (existing, moved)
    ├── SettingsTab.js (existing, moved)
    └── SessionsTab.js (existing, moved)
```

---

## Phase 1: Backend Models & Routes (12 tasks)

### Task 1: Create UserBan Model
- Create: `backend/models/UserBan.js`
- Implement Mongoose schema with userId, banType (suspension|permanent), reason, bannedBy, bannedAt, expiresAt, isActive
- Add indexes on (userId, isActive) and expiresAt
- Test import and verify schema loads
- Commit: "feat: add UserBan model for ban/suspension tracking"

### Task 2: Create UserWarning Model
- Create: `backend/models/UserWarning.js`
- Implement schema with userId, reason, warnedBy, warnedAt, escalationLevel
- Add index on (userId, warnedAt)
- Test import, commit: "feat: add UserWarning model for warning/strike tracking"

### Task 3: Create BanAppeal Model
- Create: `backend/models/BanAppeal.js`
- Implement schema with userId, banId (ref UserBan), appealText, submittedAt, status (pending|approved|denied), reviewedBy, reviewedAt, decisionReason
- Add indexes on (userId, status) and (status, submittedAt)
- Test import, commit: "feat: add BanAppeal model for ban appeal requests"

### Task 4: Create ModerationHistory Model
- Create: `backend/models/ModerationHistory.js`
- Implement schema with userId, actionType (ban|suspend|warn|appeal_approved|appeal_denied|override|ban_revoked), actionDetails (Mixed), performedBy, createdAt
- Add index on (userId, actionType, createdAt) and createdAt
- Test import, commit: "feat: add ModerationHistory model for audit trail"

### Task 5: Create CollectionAudit Model
- Create: `backend/models/CollectionAudit.js`
- Implement schema with auditName, status (running|complete|failed), ranAt, completedAt, issues (array), createdBy
- Each issue has: cardId, userId, cardName, setName, issueType, issueValue, flagged, resolved
- Add indexes on (status, ranAt desc) and createdAt desc
- Test import, commit: "feat: add CollectionAudit model for data quality tracking"

### Task 6: Add Ban Routes to Admin API
- Modify: `backend/routes/admin.js`
- Add POST /api/admin/bans (create ban with 7-day default for suspensions)
- Add GET /api/admin/bans (list active bans with filters)
- Add PUT /api/admin/bans/:id (update expiration, reason)
- Add DELETE /api/admin/bans/:id (revoke ban)
- Each action creates ModerationHistory entry
- Test with curl, commit: "feat: add ban management routes (POST, GET, PUT, DELETE /bans)"

### Task 7: Add Warning Routes to Admin API
- Modify: `backend/routes/admin.js`
- Add POST /api/admin/warnings (issue warning, auto-escalate if 3+ warnings in 90 days)
- Add GET /api/admin/warnings/:userId (list user warnings with escalation level)
- Auto-escalation creates 7-day suspension when threshold crossed
- Test with curl, commit: "feat: add warning management routes with auto-escalation"

### Task 8: Add Appeal Routes to Admin API
- Modify: `backend/routes/admin.js`
- Add GET /api/admin/appeals (list pending appeals)
- Add PUT /api/admin/appeals/:id (approve/deny with reasoning)
- Add POST /api/admin/appeals (user submission, requires auth)
- Add GET /api/admin/moderation-history/:userId (full audit trail)
- Approved appeals revoke associated ban
- Test with curl, commit: "feat: add ban appeal management routes (POST, GET, PUT)"

### Task 9: Add Pricing Admin Routes
- Modify: `backend/routes/admin.js`
- Add POST /api/admin/force-price-update (start async background job, return jobId)
- Add GET /api/admin/force-price-update/:jobId (poll job status)
- Job rate-limits at 500ms per card
- Log to ModerationHistory on completion
- Test with curl, commit: "feat: add force price update routes with async job handling"

### Task 10: Add Collection Audit Routes
- Modify: `backend/routes/admin.js`
- Add POST /api/admin/audits/run (start async audit scan)
- Add GET /api/admin/audits/:id (fetch audit results)
- Add PUT /api/admin/audits/:id/action (resolve/flag/delete issue)
- Add GET /api/admin/audits (list all audits)
- Test with curl, commit: "feat: add collection audit routes for data quality checks"

### Task 11: Add Data Management Routes
- Modify: `backend/routes/admin.js`
- Add POST /api/admin/backup (create in-memory backup)
- Add GET /api/admin/backup/:id/download (download backup as JSON)
- Add POST /api/admin/restore (restore from backup)
- Add POST /api/admin/export (export cards/users/activity/moderation)
- Add POST /api/admin/cleanup (delete orphaned/expired, archive old logs)
- Test with curl, commit: "feat: add backup, export, and cleanup routes for data management"

### Task 12: Add Ban Validation to User Login
- Modify: `backend/server.js` (login route)
- Check for active bans before creating session
- Deactivate expired suspensions automatically
- Return 403 with ban details if banned
- Test login with banned user, commit: "feat: add ban validation to login flow"

---

## Phase 2: Frontend Infrastructure (3 tasks)

### Task 13: Refactor AdminPanel for Grouped Tabs
- Modify: `frontend/src/components/admin/AdminPanel.js`
- Replace entire component with 4-group sidebar navigation
- Groups: User Management, Data & Pricing, Community, System
- Each group expands/collapses, shows nested tabs
- Main area renders active tab component (no inline components)
- Test UI loads, tabs switch, commit: "refactor: reorganize AdminPanel into 4 grouped super-tabs with sidebar navigation"

### Task 14: Create user-management/ Folder & Move Components
- Create folder: `frontend/src/components/admin/user-management/`
- Move existing UserManagement.js → UsersTab.js (refactor to export default)
- Adjust AdminPanel import paths
- Test existing Users tab still works, commit: "refactor: move UserManagement to user-management folder as UsersTab"

### Task 15: Create data-pricing/ and system/ Folders & Move Components
- Create folders: `frontend/src/components/admin/data-pricing/`, `frontend/src/components/admin/community/`, `frontend/src/components/admin/system/`
- Move existing components to appropriate folders (SystemHealth→SystemHealthTab, etc.)
- Rename to match Tab convention
- Update AdminPanel imports
- Test all existing tabs still work, commit: "refactor: reorganize admin components into feature-grouped folders"

---

## Phase 3: User Management Components (4 tasks)

### Task 16: Create BansTab Component
- Create: `frontend/src/components/admin/user-management/BansTab.js`
- List active bans with pagination (50 per page)
- Filter by user, ban type, date range
- Create ban button → modal (select user, choose type, reason)
- Edit/revoke buttons for each ban
- Show ban details (who banned, reason, expiration)
- Fetch from GET /api/admin/bans, POST to create, PUT/DELETE to modify
- Test CRUD operations, commit: "feat: add BansTab component for ban management"

### Task 17: Create WarningsTab Component
- Create: `frontend/src/components/admin/user-management/WarningsTab.js`
- List warnings by user or chronologically
- Show escalation level (1/2/3) for each warning
- Issue warning button → modal (select user, reason)
- Display escalation rules (configurable in Settings)
- Manual override checkbox to bypass auto-escalation
- Fetch from GET /api/admin/warnings/:userId, POST to create
- Test warning creation and escalation, commit: "feat: add WarningsTab component with auto-escalation display"

### Task 18: Create AppealsTab Component
- Create: `frontend/src/components/admin/user-management/AppealsTab.js`
- List pending appeals with pagination
- Show user, original ban reason, appeal text, submission date
- Approve button → confirm
- Deny button → modal (reason text field)
- Display decision history (approved/denied with admin name and reason)
- Fetch from GET /api/admin/appeals, PUT to decide
- Test approve/deny workflow, commit: "feat: add AppealsTab component for ban appeal review"

### Task 19: Create ModerationHistoryPanel (Optional Detail Panel)
- Add reusable component for viewing user's full moderation history
- Show all actions: ban, warn, appeal decisions, overrides
- Link from Users tab (click user → see history)
- Fetch from GET /api/admin/moderation-history/:userId
- Commit: "feat: add moderation history viewer component"

---

## Phase 4: Data & Pricing Components (5 tasks)

### Task 20: Create PricingAdminTab Component
- Create: `frontend/src/components/admin/data-pricing/PricingAdminTab.js`
- Single button: "Force Update All Card Prices"
- Confirmation dialog (warns of ~5+ min duration)
- After click, show job status polling
- Progress bar with X/Y cards updated
- Poll every 2 seconds from GET /api/admin/force-price-update/:jobId
- Show final results (updated count, skipped, failed)
- Test job submission and polling, commit: "feat: add PricingAdminTab for bulk price updates"

### Task 21: Create CollectionAuditsTab Component
- Create: `frontend/src/components/admin/data-pricing/CollectionAuditsTab.js`
- Button: "Start Audit Scan"
- Show running/complete audits with progress
- Results table: User | Card Name | Set | Issue Type | Details | Actions
- Per-issue actions: Review & Resolve, Flag for Review, Delete
- Show audit history (previous audits for comparison)
- Export results as CSV button
- Fetch from POST /api/admin/audits/run, GET /api/admin/audits/:id, PUT for actions
- Test audit creation and issue resolution, commit: "feat: add CollectionAuditsTab for data quality checks"

### Task 22: Create BackupsExportsTab Component
- Create: `frontend/src/components/admin/data-pricing/BackupsExportsTab.js`
- Two sections: Backups and Exports
- Backups: Create button, list previous with size/date/admin, download/restore buttons
- Exports: Dropdown with options (Cards, Users, Activity Log, Moderation)
- Click export → async job → download link when complete
- Fetch from POST /api/admin/backup, GET backup/:id/download, POST /api/admin/export
- Test backup/restore and exports, commit: "feat: add BackupsExportsTab for data management"

### Task 23: Create DataCleanupTab Component
- Create: `frontend/src/components/admin/data-pricing/DataCleanupTab.js`
- Three cleanup tools: Orphaned Data, Expired Sessions, Old Activity Logs
- Each tool shows: Preview button → "X items will be deleted" → Confirm button
- After cleanup: "Cleanup complete: X items deleted"
- Optional date/threshold input (days to keep)
- Fetch from POST /api/admin/cleanup
- Test cleanup operations, commit: "feat: add DataCleanupTab for system maintenance"

### Task 24: Refactor SystemHealthTab
- Modify: `frontend/src/components/admin/data-pricing/SystemHealthTab.js`
- Extract Settings section (move to SettingsTab)
- Keep health statistics and monitoring
- Update AdminPanel import path
- Test SystemHealth display, commit: "refactor: move SystemHealthTab to data-pricing folder, extract settings"

---

## Phase 5: Community & System Components (3 tasks)

### Task 25: Enhance & Move ContentModerationTab
- Modify: `frontend/src/components/admin/community/ContentModerationTab.js`
- Existing functionality preserved
- Add bulk delete capability (select multiple messages/comments)
- Add moderation reason logging
- Update path and imports
- Test existing moderation features, commit: "refactor: move ContentModerationTab to community folder, add bulk delete"

### Task 26: Create SettingsTab
- Create: `frontend/src/components/admin/system/SettingsTab.js`
- Extract from SystemHealth or create new
- Configurable escalation rules (warnings threshold, ban duration)
- Data retention settings (days to keep activity logs, sessions)
- Display current settings with edit modals
- Fetch from GET/PUT /api/admin/settings
- Test settings updates, commit: "feat: add SettingsTab for admin configuration"

### Task 27: Move Remaining System Components
- Move ActivityLogTab, FeedbackTab, SessionsTab to system/ and community/ folders
- Update imports in AdminPanel
- Test all tabs still render, commit: "refactor: move remaining admin components to organized folders"

---

## Phase 6: Testing & Integration (2 tasks)

### Task 28: Integration Testing
- Test complete user discipline workflow: ban user → verify can't login → issue warning → escalate → appeal → approve → verify can login
- Test pricing workflow: trigger force update → monitor progress → verify cards updated
- Test audit workflow: run audit → review issues → resolve some → mark flagged
- Test data management: create backup → export data → cleanup orphaned → verify restored
- Create/run test script, document results

### Task 29: Final Review & Documentation
- Review all components for consistency (styling, naming, patterns)
- Update admin documentation in CLAUDE.md
- Verify all routes have permission comments for future tiering
- Do final git log check, prepare for code review
- Create PR/merge documentation

---

## Testing Commands

```bash
# Backend model imports
node -e "require('./models/UserBan'); console.log('✓ UserBan')"
node -e "require('./models/UserWarning'); console.log('✓ UserWarning')"
node -e "require('./models/BanAppeal'); console.log('✓ BanAppeal')"
node -e "require('./models/ModerationHistory'); console.log('✓ ModerationHistory')"
node -e "require('./models/CollectionAudit'); console.log('✓ CollectionAudit')"

# Frontend
npm test --  --testMatch="**/*admin*" --watchAll=false
npm start  # Run app, navigate to admin panel
```

---

## Commit Strategy

- One commit per task (small, focused)
- Use conventional commits (feat:, refactor:, fix:)
- Include task number in message: "feat(admin): Task N - add BansTab component"
- After Phase 1 (backend): Main branch is stable for frontend work
- After Phase 2 (infrastructure): All folders set up, import paths ready
- After Phase 3-5 (components): Each feature group complete and independently testable

---

## Success Criteria

1. ✅ All 5 backend models created and imported
2. ✅ All backend routes implemented and tested with curl
3. ✅ Ban validation working in login flow
4. ✅ AdminPanel reorganized into 4 grouped tabs
5. ✅ All 11 new components created and rendering
6. ✅ User discipline workflow complete (ban → appeal → resolve)
7. ✅ Pricing update workflow complete (trigger → monitor → verify)
8. ✅ Audit workflow complete (run → review → resolve)
9. ✅ Data management workflow complete (backup → export → cleanup)
10. ✅ All new routes tested and documented

# Bug Report / Feature Request Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `ThreadComposer.js` is opened already scoped to the `Bug Reports` or `Feature Requests` category, pre-fill the content textarea with a markdown template and show a "where does this apply" area selector (Main Site + site section, or Discord Bot), whose selection gets prepended to the post content and added as searchable tags on submit.

**Architecture:** All changes live in one file, `frontend/src/components/Forum/ThreadComposer.js`. No backend/schema changes — the area selection rides on the existing `content` and `tags` fields already accepted by `POST /forum/threads`. No test infrastructure exists for frontend code in this repo — verified via `cd frontend && npm run build` and a manual smoke test, matching established convention.

**Tech Stack:** React (Create React App), no new dependencies.

---

## Task 1: Category detection + one-time template prefill

**Files:**
- Modify: `frontend/src/components/Forum/ThreadComposer.js`

- [ ] **Step 1: Add template constants and a category-slug lookup helper**

Add near the top of the file, after the imports:

```js
const BUG_REPORT_TEMPLATE = `**What happened?**


**Steps to reproduce:**
1. 
2. 
3. 

**Expected behavior:**


**Actual behavior:**


**Screenshots or error messages (if any):**
`;

const FEATURE_REQUEST_TEMPLATE = `**What would you like to see added?**


**What problem would this solve, or what's the use case?**


**Any additional context or examples?**
`;

function findCategorySlug(categoryTree, categoryId) {
  if (!categoryId) return null;
  const idStr = categoryId.toString();
  for (const node of categoryTree) {
    if (node._id === idStr) return node.slug;
    if (node.children) {
      for (const child of node.children) {
        if (child._id === idStr) return child.slug;
      }
    }
  }
  return null;
}
```

(`findCategorySlug` mirrors the identical helper already added to `frontend/src/components/Forum/ThreadView.js` for the same purpose — kept as a separate local copy rather than extracted to a shared module, matching this codebase's existing preference for small per-file duplication over introducing a new shared utility for a 10-line function.)

- [ ] **Step 2: Add state for the one-time category-type detection**

In the `ThreadComposer` component, add alongside the existing `useState` declarations:

```js
  const [templateCategoryType, setTemplateCategoryType] = useState(null); // 'bug' | 'feature' | null, frozen once determined per open
  const [reportArea, setReportArea] = useState(''); // '' | 'main-site' | 'discord-bot'
  const [reportSiteSection, setReportSiteSection] = useState('');
```

Also add `useRef` to the React import at the top:
```js
import React, { useState, useEffect, useRef } from 'react';
```

Add a ref to guard the one-time check, alongside the other state:
```js
  const templateCheckedRef = useRef(false);
```

- [ ] **Step 3: Add the one-time detection/prefill effect**

Add this effect after the existing `useEffect(() => { setIsQA(categoryIsQA); }, [categoryIsQA]);` block:

```js
  useEffect(() => {
    if (!isOpen) {
      templateCheckedRef.current = false;
      setTemplateCategoryType(null);
      setReportArea('');
      setReportSiteSection('');
      return;
    }
    if (templateCheckedRef.current) return;
    if (categories.length === 0) return; // wait for categories to finish loading

    const slug = findCategorySlug(categories, categoryId);
    templateCheckedRef.current = true;

    if (slug === 'bug-reports') {
      setTemplateCategoryType('bug');
      setContent(prev => (prev.trim() ? prev : BUG_REPORT_TEMPLATE));
    } else if (slug === 'feature-requests') {
      setTemplateCategoryType('feature');
      setContent(prev => (prev.trim() ? prev : FEATURE_REQUEST_TEMPLATE));
    }
  }, [isOpen, categories, categoryId]);
```

This runs once per "open" (guarded by `templateCheckedRef`), only after `categories` has finished loading, checks the **original `categoryId` prop** (not the in-form `selectedCategoryId`, which the user can change afterward via the dropdown without affecting this), and resets itself when the modal closes so the next open re-evaluates fresh. The `setContent(prev => ...)` functional form means it only fills in the template if the textarea is still empty — it will never clobber something the user already typed.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors. (No visible behavior change yet from a user's perspective beyond the content prefill — the area dropdowns are added in Task 2.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Forum/ThreadComposer.js
git commit -m "feat: pre-fill a bug-report/feature-request template when the composer opens scoped to that category"
```

---

## Task 2: Area selector UI + submission wiring

**Files:**
- Modify: `frontend/src/components/Forum/ThreadComposer.js`

- [ ] **Step 1: Add the site-areas list constant**

Add near the two template constants from Task 1:

```js
const SITE_AREAS = [
  'Collection', 'Deck Builder', 'Wishlist', 'Trading Board', 'Forum',
  'Life Counter', 'Commanders', 'Sets', 'Combos', 'Finance', 'Scan Card',
  'Admin Panel', 'Other'
];
```

- [ ] **Step 2: Render the area dropdown(s)**

Insert this block right after the closing `</div>` of the existing "Category Selection" block (before the "Title" block):

```jsx
          {/* Bug report / feature request area selector */}
          {templateCategoryType && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Where does this apply?</label>
              <select
                value={reportArea}
                onChange={(e) => { setReportArea(e.target.value); setReportSiteSection(''); }}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select...</option>
                <option value="main-site">Main Site</option>
                <option value="discord-bot">Discord Bot</option>
              </select>
              {reportArea === 'main-site' && (
                <select
                  value={reportSiteSection}
                  onChange={(e) => setReportSiteSection(e.target.value)}
                  className="w-full p-3 mt-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Which part of the site?</option>
                  {SITE_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              )}
            </div>
          )}
```

- [ ] **Step 3: Wire the selection into submission (content prepend + tags)**

Add two small helper functions above `handleCreateThread`:

```js
  const buildAreaLine = () => {
    if (reportArea === 'discord-bot') return '**Area:** Discord Bot';
    if (reportArea === 'main-site' && reportSiteSection) return `**Area:** Main Site — ${reportSiteSection}`;
    if (reportArea === 'main-site') return '**Area:** Main Site';
    return null;
  };

  const buildAreaTags = () => {
    if (reportArea === 'discord-bot') return ['discord-bot'];
    if (reportArea === 'main-site') {
      const areaTags = ['main-site'];
      if (reportSiteSection) {
        areaTags.push(reportSiteSection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      }
      return areaTags;
    }
    return [];
  };
```

Then update `handleCreateThread` to use them. Change:
```js
      const response = await axios.post(`${apiUrl}/forum/threads`, {
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: content.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        contentFormat: 'markdown',
        isQA
      });
```
to:
```js
      const areaLine = buildAreaLine();
      const finalContent = areaLine ? `${areaLine}\n\n${content.trim()}` : content.trim();
      const userTags = tags.split(',').map(t => t.trim()).filter(t => t);
      const finalTags = [...new Set([...userTags, ...buildAreaTags()])];

      const response = await axios.post(`${apiUrl}/forum/threads`, {
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: finalContent,
        tags: finalTags,
        contentFormat: 'markdown',
        isQA
      });
```

- [ ] **Step 4: Reset the new state on cancel/close paths, matching existing reset conventions**

Update `handleCreateThread`'s success branch, `handleDuplicateModalClose`, `handleMergeRequest`, and `handleCancel` — each currently resets `title`/`content`/`tags` (and `error` in `handleCancel`). Add `setReportArea('')` and `setReportSiteSection('')` alongside those existing resets in all four places. (This is a small redundancy with the Task 1 effect's own reset-on-close behavior, but keeps this file's existing "reset everything on every exit path" convention consistent and explicit.)

For example, `handleCancel` becomes:
```js
  const handleCancel = () => {
    setTitle('');
    setContent('');
    setTags('');
    setReportArea('');
    setReportSiteSection('');
    setError('');
    onClose();
  };
```

Apply the same two added lines to the other three reset locations (the `else` branch inside `handleCreateThread`, `handleDuplicateModalClose`, and `handleMergeRequest`).

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Forum/ThreadComposer.js
git commit -m "feat: add Main Site/Discord Bot area selector to bug report and feature request threads"
```

---

## Task 3: Final verification

- [ ] **Step 1: Run the frontend build one more time**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 2: Manual smoke test**

Start the app. In the forum:
- Navigate into the **Bug Reports** category and click "Post Listing"/whatever opens the composer from within that category page — confirm the content textarea is pre-filled with the bug template, and the "Where does this apply?" dropdown appears.
- Select **Main Site**, confirm the second "which part of the site?" dropdown appears; pick an area (e.g. "Deck Builder").
- Submit the thread — confirm the created thread's content starts with `**Area:** Main Site — Deck Builder` followed by the template text, and confirm the thread has `main-site` and `deck-builder` tags (check via the thread's displayed tags or `GET /forum/threads/:threadId`).
- Repeat, selecting **Discord Bot** instead — confirm content starts with `**Area:** Discord Bot` and the thread is tagged `discord-bot` (no site-section tag).
- Navigate into **Feature Requests** and confirm the feature-request template pre-fills instead, with the same area selector behavior.
- Open the composer from **General Discussion** (or any other category) — confirm neither the template nor the area selector appear, and behavior is completely unchanged from before this feature.
- Open the composer generically (not scoped to any category, e.g. from the main forum home "New Thread" button if one exists outside a category page) and manually pick Bug Reports from the in-form category dropdown — confirm the template/selector do NOT appear, since the trigger is based on how the composer was opened, not on the dropdown selection.
- Confirm typing your own content BEFORE the template would have applied (unlikely given the timing, but worth a quick check) never gets overwritten — the template only fills a genuinely empty textarea.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full diff (base: commit before Task 1, head: commit after Task 2) before considering this done.

# Bug Report / Feature Request Template Design

## Overview

Adds a lightweight template + structured "where does this apply" selector to the thread composer, active only when it's opened already scoped to the `Bug Reports` or `Feature Requests` category (slugs `bug-reports`/`feature-requests`, both children of `Getting Started`). No schema changes — the area selection is embedded in the post content and added to the existing free-form `tags` array.

## Trigger

`ThreadComposer.js` currently accepts a `categoryId` prop, set when opened from `CategoryView.js` (already scoped to one category) and left unset when opened generically from `ForumHome.js`. This feature keys off that same prop **at mount time only**:

- If the incoming `categoryId` prop resolves (by slug) to `bug-reports` or `feature-requests`, the template/area-selector UI activates.
- Picking a different category from the in-form category `<select>` afterward does **not** retroactively activate or deactivate the template — it's a one-time initial-mount check, not a reactive one. Opening the composer generically (no `categoryId` prop) and then picking Bug Reports from the dropdown does not trigger it either, per the same one-time-at-mount rule.

## UI additions (rendered only when triggered)

Two new dropdowns appear above the existing title/content/tags fields:

1. **"Where does this apply?"** — `Main Site` / `Discord Bot`.
2. **Conditional second dropdown**, shown only when `Main Site` is selected — a list of site areas: `Collection`, `Deck Builder`, `Wishlist`, `Trading Board`, `Forum`, `Life Counter`, `Commanders`, `Sets`, `Combos`, `Finance`, `Scan Card`, `Admin Panel`, `Other`.

If `Discord Bot` is selected, no second dropdown appears (the markdown template itself asks "(which command?)" as a fill-in-the-blank line).

## Content template (pre-fills the content textarea on mount, once, if not already non-empty)

**Bug Reports:**
```
**What happened?**


**Steps to reproduce:**
1. 
2. 
3. 

**Expected behavior:**


**Actual behavior:**


**Screenshots or error messages (if any):**

```

**Feature Requests:**
```
**What would you like to see added?**


**What problem would this solve, or what's the use case?**


**Any additional context or examples?**

```

(Neither template includes an area checklist — the two dropdowns above cover that instead.)

## Submission behavior

On `handleCreateThread`:
- The selected area is prepended to `content` as a line, e.g. `**Area:** Main Site — Deck Builder` or `**Area:** Discord Bot`.
- The selection is also added to the `tags` array sent to `POST /forum/threads`:
  - `Discord Bot` → adds tag `discord-bot`.
  - `Main Site` + an area → adds both `main-site` and a slugified area tag (e.g. `deck-builder`, `trading-board`), so either dimension is independently filterable later using the existing tag search/filter.
- These are additive to whatever the user already typed/selected in the existing tags input — no existing tag behavior changes.

## Non-goals

- No `ForumThread`/`ForumCategory` schema changes — everything rides on the existing `content` and `tags` fields.
- No structured multi-field form beyond the two area dropdowns — the rest of the report (what happened, steps, etc.) stays as free-form markdown in one textarea, per the earlier confirmed approach.
- No change to any other category's composer behavior, no change to the `isQA` toggle, no change to duplicate-detection.
- No required-field enforcement — a user can still submit with the area dropdown left at its default/empty state, or after deleting the template text entirely.

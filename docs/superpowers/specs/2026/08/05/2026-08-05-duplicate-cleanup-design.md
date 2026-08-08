# Duplicate Cleanup & Merge Suggestions Design

## Problem

The collection can contain duplicate rows that the auto-merge logic didn't catch:

- **Exact duplicates**: rows identical on `name + set + condition + isFoil + collectorNumber`, created before auto-merge existed or via races. Merging these is provably safe.
- **Offline-import near-dupes**: offline bulk imports create rows with `set: 'Unknown'` and `price: 0`. When the same card also exists with its real set, the collection double-counts it. Merging requires user confirmation because the Unknown row's printing is a guess.

These duplicates also block adding a database-level unique index, which would make exact duplicates impossible going forward.

## Backend

### `GET /api/cards/duplicates` (requireAuth)

Returns duplicate groups for the current user:

```json
{
  "exactGroups": [
    { "cards": [ ...full card docs... ] }
  ],
  "suggestedGroups": [
    { "unknownCard": { ...card doc... }, "candidates": [ ...card docs... ] }
  ]
}
```

- **Exact groups**: all rows sharing `userId + name + set + condition + isFoil + collectorNumber` where the group has 2+ rows. Collector number is part of the key so alt-art printings within one set (distinct collector numbers) are never flagged — the auto-merge treats those as distinct on purpose. Rows where `collectorNumber` is missing/null group together (null == null).
- **Suggested groups**: each row with `set: 'Unknown'` is paired with all rows of the same `name + condition + isFoil` whose set is not `'Unknown'`. Groups with zero candidates are omitted. An Unknown row that is also part of an exact group (a second Unknown row of the same card) appears in the exact list, not twice.
- Grouping is computed in application code from a single `Card.find(buildUserQuery({}, req))` — the collection is already fully loaded elsewhere, so no aggregation pipeline is needed.

### `POST /api/cards/merge-duplicates` (requireAuth + requireEditor)

Body: `{ "targetId": "...", "sourceIds": ["...", ...] }`.

Validations (400 on failure):
- `targetId` present, `sourceIds` non-empty array, target not in `sourceIds`.
- All referenced cards exist and belong to the current user (via `buildUserQuery`); 404 otherwise.
- Every source shares `name`, `condition`, and `isFoil` with the target (case-sensitive on name, matching auto-merge semantics). Sets may differ — that is the near-dupe case.

Merge semantics:
- `target.quantity += sum(source.quantity)`.
- `target.tags` = union of target and source tags (deduplicated, preserving target order first).
- Empty/missing target fields are filled from the first source that has them: `location`, `oracleText`, `manaCost`, `colors` (empty array counts as missing), `types` (same), `imageUrl`, `scryfallId`, `rarity`, `collectorNumber`, `setCode`. `set`, `price`, `condition`, `isFoil`, `priceAlert`, and purchase/finance fields always stay the target's.
- Sources are deleted after the target saves.
- Cards cache (`statsCache`) is invalidated for the user.
- Response: `{ merged: true, target: <updated card>, removedCount: N }`.
- Activity-logged like other card mutations (uses the existing `activityLoggers` middleware family).

## Frontend

A **"Find Duplicates"** button in the Collection view toolbar (alongside the existing tool buttons) opens a `DuplicateCleanup` modal component (`frontend/src/components/DuplicateCleanup.js`):

- On open, fetches `GET /api/cards/duplicates`.
- **Exact duplicates section**: lists each group (name, set, condition, foil, per-row quantity). A **"Merge All Exact Duplicates"** button merges every exact group in sequence (target = oldest row by `createdAt`), plus a per-group Merge button. Shows a "no exact duplicates" empty state.
- **Suggestions section**: each group shows the Unknown row and its candidate rows. Exactly one candidate → preselected as target; multiple → radio selection required before Merge enables. Merge sends `{ targetId: <chosen real row>, sourceIds: [<unknown row id>] }`. No dismiss/skip persistence — unmerged groups simply reappear next open.
- After any merge, the modal refreshes its lists and the collection refetches (`fetchCards`).
- Empty state for both sections: "No duplicates found 🎉".

## Database unique index

Add to `backend/models/Card.js`:

```js
cardSchema.index(
  { userId: 1, name: 1, set: 1, condition: 1, isFoil: 1, collectorNumber: 1 },
  { unique: true }
);
```

- In single-user mode `userId` is null for all rows; the constraint still applies per-collection correctly.
- Rows without `collectorNumber` store null and conflict with each other (desired — those are exact dupes), while distinct collector numbers coexist (alt arts).
- **Ordering/safety**: if conflicting rows still exist when the app starts, Mongoose logs a failed index build and continues — the app does not crash, the index just isn't created yet. Once the user runs the cleanup tool to zero exact duplicates, the next restart builds the index successfully.
- A read-only script `backend/scripts/checkDuplicateConflicts.js` prints any groups that would violate the index, so index state can be verified from the terminal.

## Non-goals

- No fuzzy name matching (case/punctuation variants are out of scope).
- No dismissal persistence for suggestion groups.
- No automatic merging of near-dupes — every Unknown-set merge is user-confirmed.
- No change to the existing auto-merge behavior on card add/import.

## Testing

- Backend (jest, TDD): grouping logic (exact vs. suggested, collector-number handling, Unknown pairing), merge endpoint (quantity summing, tag union, field backfill, source deletion, ownership rejection, mismatched name/condition/foil rejection), conflict-checker script.
- Frontend: `npm run build` + manual verification (no frontend test infra).

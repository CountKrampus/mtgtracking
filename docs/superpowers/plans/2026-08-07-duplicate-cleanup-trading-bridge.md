# Duplicate Cleanup → Trading Board Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After merging duplicate card rows in `DuplicateCleanup.js`, if the merge results in a card with `quantity > 1`, offer a one-click path to list the excess copies for trade — no manual re-entry on the Trading Board.

**Architecture:** `DuplicateCleanup.js`'s `merge()` helper is changed to return the merged card the backend already sends back. The three merge handlers accumulate any resulting `quantity > 1` cards into an `excessCandidates` array. A banner offers to review them in a new `ExcessCopiesModal`, which loops the existing `useTrades().createListing()` call once per selected card. No new backend routes.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual mobile-width click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-duplicate-cleanup-trading-bridge-design.md`

**Key facts confirmed during spec research (do not re-derive):**
- `backend/routes/cards.js:72-121`'s `POST /cards/merge-duplicates` already returns `{ merged: true, target, removedCount }`, where `target` is the fully-saved merged Card document including its new `quantity`. `DuplicateCleanup.js`'s current `merge()` (line 67-69) discards this response — change it to return `res.data.target`.
- `useTrades()` (`frontend/src/contexts/TradesContext.js`) is available anywhere via `TradesProvider` (`frontend/src/App.js:474`). Its `createListing(data)` (line 82) does `POST /api/trades` and refreshes listing state.
- `POST /api/trades` (`backend/routes/trades.js:115-139`) expects exactly these fields: `type, cardName, cardSet, cardSetCode, scryfallId, imageUrl, condition, quantity, estimatedValue, notes`. `type` and `cardName` are required; everything else defaults safely if omitted.
- The `Card` model (`backend/models/Card.js`) fields to map from: `name` → `cardName`, `set` → `cardSet`, `setCode` → `cardSetCode`, `scryfallId` → `scryfallId`, `imageUrl` → `imageUrl`, `condition` → `condition`, `price` → `estimatedValue`.
- Mobile bottom-sheet modal shape used everywhere in this codebase: `fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0`. `DuplicateCleanup.js` currently uses `items-center justify-center z-50 p-4` (no `items-end`/mobile bottom-sheet treatment, no `pb-16` clearance) — this plan does NOT change that (out of scope, not reported broken), but the new `ExcessCopiesModal` must stack above it at `z-[60]` (same convention as `CollectionComparison.js`'s hover-preview, `DeckComparisonModal.js`'s tap-to-preview, and `SetMissingCardsModal.js` from the Set Completion bridge plan) and should use the standard mobile bottom-sheet shape itself since it's a new component with no existing convention to preserve.
- Filter-toggle/multi-control rows must use `flex flex-wrap`, never horizontal scroll — repeated finding across this session's mobile audit.

---

## Task 1: Capture merge response + accumulate excess candidates + banner

**Files:**
- Modify: `frontend/src/components/DuplicateCleanup.js`

This is a frontend-only task (no test infra) — verify via `npm run build` plus manual click-through.

- [ ] **Step 1: Change `merge()` to return the merged target**

Replace:
```js
  const merge = async (targetId, sourceIds) => {
    await axios.post(`${API_URL}/cards/merge-duplicates`, { targetId, sourceIds });
  };
```
with:
```js
  const merge = async (targetId, sourceIds) => {
    const res = await axios.post(`${API_URL}/cards/merge-duplicates`, { targetId, sourceIds });
    return res.data.target;
  };
```

- [ ] **Step 2: Add `excessCandidates` state**

Add alongside the existing state declarations (~line 40):
```js
  const [excessCandidates, setExcessCandidates] = useState([]);
  const [showExcessModal, setShowExcessModal] = useState(false);
```

- [ ] **Step 3: Record excess candidates in each merge handler**

Add this helper right after `afterMerge`:
```js
  const recordIfExcess = (mergedCard) => {
    if (mergedCard && mergedCard.quantity > 1) {
      setExcessCandidates(prev => [...prev, {
        _id: mergedCard._id,
        name: mergedCard.name,
        set: mergedCard.set,
        setCode: mergedCard.setCode,
        condition: mergedCard.condition,
        quantity: mergedCard.quantity,
        price: mergedCard.price,
        scryfallId: mergedCard.scryfallId,
        imageUrl: mergedCard.imageUrl,
      }]);
    }
  };
```

Update `handleMergeExactGroup`:
```js
  const handleMergeExactGroup = async (group) => {
    setMerging(true);
    setError('');
    try {
      const [target, ...sources] = group.cards; // oldest first (sorted by createdAt server-side)
      const mergedCard = await merge(target._id, sources.map(c => c._id));
      recordIfExcess(mergedCard);
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };
```

Update `handleMergeAllExact`:
```js
  const handleMergeAllExact = async () => {
    setMerging(true);
    setError('');
    let mergedCount = 0;
    let failureMessage = null;
    try {
      for (const group of exactGroups) {
        const [target, ...sources] = group.cards;
        const mergedCard = await merge(target._id, sources.map(c => c._id));
        recordIfExcess(mergedCard);
        mergedCount++;
      }
    } catch (err) {
      const remaining = exactGroups.length - mergedCount;
      failureMessage = `${err.response?.data?.message || 'Merge failed'} (merged ${mergedCount} of ${exactGroups.length} groups before this happened; the list below has been refreshed to reflect that — ${remaining} group(s) still need attention.)`;
    } finally {
      await afterMerge();
      if (failureMessage) setError(failureMessage);
      setMerging(false);
    }
  };
```

Update `handleMergeSuggestion`:
```js
  const handleMergeSuggestion = async (group) => {
    const targetId = selectedTargets[group.unknownCard._id];
    if (!targetId) return;
    setMerging(true);
    setError('');
    try {
      const mergedCard = await merge(targetId, [group.unknownCard._id]);
      recordIfExcess(mergedCard);
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };
```

- [ ] **Step 4: Add the banner**

Add right after the `{error && (...)}` block, before the `{empty && (...)}` block:
```jsx
          {excessCandidates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-teal-600/10 border border-teal-600/30 rounded-lg">
              <span className="text-teal-300 text-sm">
                {excessCandidates.length} card{excessCandidates.length !== 1 ? 's' : ''} now have excess copies — list for trade?
              </span>
              <button
                onClick={() => setShowExcessModal(true)}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition"
              >
                Review
              </button>
            </div>
          )}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds. (The `ExcessCopiesModal` render is added in Task 2 — at the end of this task, `showExcessModal` is set but nothing consumes it yet; that's expected, not a bug, since Task 2 wires the modal itself.)

- [ ] **Step 6: Manual smoke test**

With the dev server running:
- Open Duplicate Cleanup (via the collection tools entry point where it's already wired), merge an exact-duplicate group whose combined quantity is 2+.
- Confirm the banner appears with count 1 after that merge.
- Merge a second group — confirm the count increments to 2 (accumulates, doesn't replace).
- Confirm clicking "Review" doesn't yet do anything meaningful (no modal exists until Task 2) — just confirm it doesn't error.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DuplicateCleanup.js
git commit -m "feat: track merges resulting in excess card copies"
```

---

## Task 2: `ExcessCopiesModal.js` — review checklist + bulk listing

**Files:**
- Create: `frontend/src/components/ExcessCopiesModal.js`
- Modify: `frontend/src/components/DuplicateCleanup.js`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ExcessCopiesModal.js`:

```jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTrades } from '../contexts/TradesContext';

function ExcessCopyRow({ card, checked, onToggle, listQuantity, onQuantityChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 px-2 rounded hover:bg-white/5 transition-colors">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm truncate">{card.name}</div>
        <div className="text-white/40 text-xs truncate">{card.set} · {card.condition} · own {card.quantity}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-white/50 text-xs">List:</span>
        <input
          type="number"
          min="1"
          max={card.quantity}
          value={listQuantity}
          onChange={(e) => onQuantityChange(Math.max(1, Math.min(card.quantity, parseInt(e.target.value) || 1)))}
          className="w-14 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-center focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function ExcessCopiesModal({ candidates, onClose }) {
  const { createListing } = useTrades();
  const [checkedIds, setCheckedIds] = useState(new Set(candidates.map(c => c._id)));
  const [quantities, setQuantities] = useState(
    Object.fromEntries(candidates.map(c => [c._id, Math.max(1, c.quantity - 1)]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const toggleCard = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setQuantity = (id, value) => {
    setQuantities(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const selected = candidates.filter(c => checkedIds.has(c._id));
    let listed = 0;
    let failed = 0;

    for (const card of selected) {
      try {
        await createListing({
          type: 'have',
          cardName: card.name,
          cardSet: card.set,
          cardSetCode: card.setCode,
          condition: card.condition,
          quantity: quantities[card._id],
          estimatedValue: card.price || 0,
          scryfallId: card.scryfallId,
          imageUrl: card.imageUrl,
          notes: '',
        });
        listed++;
      } catch {
        failed++;
      }
    }

    setSubmitting(false);
    setResult({ listed, failed });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">List Excess Copies for Trade</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {result ? (
            <div className="text-center py-8">
              <p className="text-white text-sm">
                Listed {result.listed} card{result.listed !== 1 ? 's' : ''} for trade
                {result.failed > 0 && ` — ${result.failed} failed, please try again`}.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-white/60 text-sm">{checkedIds.size} of {candidates.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCheckedIds(new Set(candidates.map(c => c._id)))} className="text-xs text-purple-400 hover:text-purple-300 transition">Select All</button>
                  <button onClick={() => setCheckedIds(new Set())} className="text-xs text-purple-400 hover:text-purple-300 transition">Select None</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-0.5 mb-4">
                {candidates.map(card => (
                  <ExcessCopyRow
                    key={card._id}
                    card={card}
                    checked={checkedIds.has(card._id)}
                    onToggle={() => toggleCard(card._id)}
                    listQuantity={quantities[card._id]}
                    onQuantityChange={(v) => setQuantity(card._id, v)}
                  />
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || checkedIds.size === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
              >
                {submitting ? 'Listing…' : `List Selected for Trade (${checkedIds.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: `CardListRow`-style components in this codebase are consistently defined at module scope, not nested inside the exporting component's body — `ExcessCopyRow` follows that same convention here.

- [ ] **Step 2: Wire into `DuplicateCleanup.js`**

Add the import near the top:
```js
import ExcessCopiesModal from './ExcessCopiesModal';
```

Add the modal render at the end of the component's JSX, right before the closing `</div>` of the outermost `fixed inset-0` wrapper:
```jsx
      {showExcessModal && (
        <ExcessCopiesModal
          candidates={excessCandidates}
          onClose={() => { setShowExcessModal(false); setExcessCandidates([]); }}
        />
      )}
```

This closes the modal AND clears `excessCandidates` together, matching the spec's "one-shot-per-session prompt, not a nagging reminder" requirement — closing the review (whether or not anything was listed) resets the banner too.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running:
- Merge duplicates until the banner shows a count, click "Review" — confirm the checklist opens with all candidates checked, quantities pre-filled at `quantity - 1`.
- Uncheck one card, change another's list-quantity to something other than the default, click "List Selected for Trade" — confirm only the checked cards get listed, with the edited quantity respected.
- Open Trading Board's "My Listings" tab afterward — confirm the newly-created listings appear with the correct card name/set/condition/quantity.
- Close the review modal (via X or after listing) — confirm the banner disappears (since `excessCandidates` is cleared) and doesn't reappear until a new merge happens.
- At 375px width: confirm each `ExcessCopyRow`'s checkbox/name/quantity-input row wraps via `flex-wrap` rather than clipping, and the `z-[60]` modal stacks correctly on top of `DuplicateCleanup.js`'s `z-50`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExcessCopiesModal.js frontend/src/components/DuplicateCleanup.js
git commit -m "feat: add bulk trade-listing checklist for excess card copies"
```

---

## Task 3: Final verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 2: End-to-end manual smoke test**

Full click-through at both mobile (375px) and desktop (1280px) widths:
- Full flow: open Duplicate Cleanup, merge several groups (mix of exact-group merges, "Merge All", and a suggestion merge if any offline-imported test data is available) resulting in multiple excess-quantity cards, review and list a subset, confirm they show up correctly on the Trading Board.
- Confirm a merge that does NOT result in `quantity > 1` (shouldn't be possible per the spec's analysis, but if a test scenario somehow produces one, confirm it correctly does NOT add to `excessCandidates`).
- Confirm the existing Duplicate Cleanup behavior (exact groups, suggested merges, error handling) is completely unchanged from before this feature.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

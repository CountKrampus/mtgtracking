# Life Counter → Deck Win-Rate Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each deck's Life Counter games-played/win-rate on its card in the Deck Builder list — closing the one missing link in an already-built data pipeline.

**Architecture:** `deckPlayCounts` is already fetched, computed, and passed as a prop from `DeckBuilder.js` to `DeckList.js`; `DeckList.js` just needs to actually read it and render a badge on `DeckCard`. No backend or data-flow changes.

**Tech Stack:** React (frontend only, no test infra in this repo — verified via `npm run build` + manual click-through).

**Spec:** `docs/superpowers/specs/2026-08-07-lifecounter-deck-winrate-design.md`

---

## Task 1: Wire `deckPlayCounts` through to `DeckCard` and render the badge

**Files:**
- Modify: `frontend/src/components/DeckList.js`

- [ ] **Step 1: Destructure the prop**

Change:
```js
function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck, folders = [], onFolderCreate, onDeckMoveToFolder }) {
```
to:
```js
function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck, folders = [], onFolderCreate, onDeckMoveToFolder, deckPlayCounts = {} }) {
```

- [ ] **Step 2: Pass it to `DeckCard` and render the badge**

`DeckCard` is currently defined inline as `const DeckCard = ({ deck }) => {` (line 154) — since it's a closure inside `DeckList`, it already has access to `deckPlayCounts` from the enclosing scope without needing an explicit prop, but pass it explicitly anyway for clarity and to match this component's existing style of not relying on closures for data it directly uses. Change:
```js
  const DeckCard = ({ deck }) => {
```
to:
```js
  const DeckCard = ({ deck, playStats }) => {
```

Insert the badge into the existing cards/value row. Change:
```jsx
        <div className="flex justify-between text-white/60 text-sm mb-2">
          <span>{deck.statistics?.totalCards || 100} cards</span>
          <span>${deck.totalValue?.toFixed(2) || '0.00'}</span>
        </div>
```
to:
```jsx
        <div className="flex justify-between text-white/60 text-sm mb-2">
          <span>{deck.statistics?.totalCards || 100} cards</span>
          <span>${deck.totalValue?.toFixed(2) || '0.00'}</span>
        </div>
        {playStats && (
          <div className="text-sm mb-2">
            <span className="text-white/60">🎮 {playStats.gamesPlayed} game{playStats.gamesPlayed !== 1 ? 's' : ''}</span>
            <span className={`ml-2 ${playStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {playStats.winRate}% WR
            </span>
          </div>
        )}
```

Update the call site to pass the looked-up stats:
```jsx
          <DeckCard key={deck._id} deck={deck} />
```
to:
```jsx
          <DeckCard key={deck._id} deck={deck} playStats={deckPlayCounts[deck._id]} />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

With the dev server running:
- If a test account already has Life Counter game history with a deck assigned (check `Dashboard.js`'s "Most Played Decks" widget — if it's showing data, at least one deck already qualifies), open Deck Builder and confirm that deck's card now shows the "🎮 N games · X% WR" badge, color-coded green at ≥50% and red below.
- Confirm a deck with no Life Counter history shows no badge (not "0 games").
- If no existing game history is available, play one full Life Counter game start-to-finish with a deck selected for at least one seat, then confirm the badge appears on that deck afterward.
- Confirm no other part of the deck card (image, name, format badge, commander line, tags, delete button) changed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DeckList.js
git commit -m "feat: surface Life Counter win-rate stats on deck cards"
```

---

## Task 2: Final verification

- [ ] **Step 1: Frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds, no new warnings.

- [ ] **Step 2: Manual smoke test**

Confirm the badge renders correctly at both mobile (375px) and desktop (1280px) widths, and that `Dashboard.js`'s existing "Most Played Decks" widget (which reads the same underlying data via a separate fetch) still works unchanged — confirming this task didn't touch anything it shares data with.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` across the full branch diff before merging.

# Deck Check — Pre-Game Packing Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/deck/:id/check` page that shows a physical packing checklist for a deck, with tap-to-check cards, localStorage persistence, and a "Pack This Deck" button in DeckDetail.

**Architecture:** New standalone route in `App.js` (same pattern as `/shared/deck/:code` and `/room/:code`). New `DeckCheck.js` component reuses the existing `GET /api/decks/:id` and `GET /api/decks/:id/ownership` endpoints — no new backend. DeckDetail gets a single navigation button.

**Tech Stack:** React (useState, useEffect, useMemo), axios, Tailwind CSS, localStorage, existing ownership API

---

## File Map

| File | Action |
|------|--------|
| `frontend/src/components/DeckCheck.js` | Create — full checklist component |
| `frontend/src/App.js` | Modify — add `/deck/:id/check` route before auth check |
| `frontend/src/components/DeckDetail.js` | Modify — add "Pack This Deck" button |

---

### Task 1: Create DeckCheck component

**Files:**
- Create: `frontend/src/components/DeckCheck.js`

- [ ] **Step 1: Create the component file**

```js
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ArrowLeft, RotateCcw, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

function getStorageKey(deckId) {
  return `deckcheck_${deckId}`;
}

export default function DeckCheck() {
  const deckId = window.location.pathname.split('/')[2];

  const [deck, setDeck] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [checkedNames, setCheckedNames] = useState(new Set());
  const [missingExpanded, setMissingExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load deck + ownership data on mount
  useEffect(() => {
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      axios.get(`${API_URL}/decks/${deckId}`, { headers }),
      axios.get(`${API_URL}/decks/${deckId}/ownership`, { headers }),
    ])
      .then(([deckRes, ownershipRes]) => {
        setDeck(deckRes.data);
        setOwnership(ownershipRes.data);

        // Restore checked state from localStorage
        try {
          const stored = localStorage.getItem(getStorageKey(deckId));
          if (stored) {
            setCheckedNames(new Set(JSON.parse(stored)));
          }
        } catch (_) {}
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load deck');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  const ownedCards = useMemo(() => {
    if (!ownership?.ownedCards) return [];
    return [...ownership.ownedCards].sort((a, b) => a.name.localeCompare(b.name));
  }, [ownership]);

  const missingCards = useMemo(() => {
    if (!ownership?.missingCards) return [];
    return [...ownership.missingCards].sort((a, b) => a.name.localeCompare(b.name));
  }, [ownership]);

  function toggleCard(name) {
    setCheckedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      localStorage.setItem(getStorageKey(deckId), JSON.stringify([...next]));
      return next;
    });
  }

  function handleReset() {
    setCheckedNames(new Set());
    localStorage.removeItem(getStorageKey(deckId));
  }

  const packedCount = ownedCards.filter((c) => checkedNames.has(c.name)).length;
  const totalOwned = ownedCards.length;
  const allPacked = totalOwned > 0 && packedCount === totalOwned;
  const progressPct = totalOwned > 0 ? (packedCount / totalOwned) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading deck...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Fixed header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => window.history.back()}
              className="text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-white font-bold text-lg flex-1 truncate">
              {deck?.name || 'Deck Check'}
            </h1>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  allPacked ? 'bg-green-500' : 'bg-purple-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-white/60 whitespace-nowrap">
              {packedCount} / {totalOwned} packed
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* All packed banner */}
        {allPacked && (
          <div className="mb-4 bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3 text-green-400 font-medium text-center">
            ✅ All packed — you're ready to play!
          </div>
        )}

        {/* Owned cards section */}
        <div className="mb-6">
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Cards You Own ({totalOwned})
          </h2>
          <div className="space-y-1">
            {ownedCards.map((card) => {
              const checked = checkedNames.has(card.name);
              return (
                <button
                  key={card.name}
                  onClick={() => toggleCard(card.name)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left ${
                    checked
                      ? 'bg-white/5 opacity-50'
                      : 'bg-white/8 hover:bg-white/12'
                  }`}
                >
                  {checked ? (
                    <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle size={20} className="text-white/30 flex-shrink-0" />
                  )}
                  <span
                    className={`flex-1 text-sm font-medium ${
                      checked ? 'line-through text-white/40' : 'text-white'
                    }`}
                  >
                    {card.name}
                  </span>
                  {card.quantity > 1 && (
                    <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                      ×{card.quantity}
                    </span>
                  )}
                  {card.location && (
                    <span className="text-xs text-purple-300/70 truncate max-w-24">
                      📍 {card.location}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Missing cards section */}
        {missingCards.length > 0 && (
          <div>
            <button
              onClick={() => setMissingExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-1 mb-2 text-white/40 hover:text-white/60 transition-colors"
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                Missing Cards ({missingCards.length})
              </h2>
              {missingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {missingExpanded && (
              <div className="space-y-1 mb-4">
                {missingCards.map((card) => (
                  <div
                    key={card.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 opacity-50"
                  >
                    <Circle size={18} className="text-white/20 flex-shrink-0" />
                    <span className="flex-1 text-sm text-white/40">{card.name}</span>
                    {card.price > 0 && (
                      <span className="text-xs text-white/30">${card.price.toFixed(2)}</span>
                    )}
                  </div>
                ))}
                <p className="text-xs text-white/30 text-center pt-2">
                  You'll need to proxy or borrow these.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls frontend/src/components/DeckCheck.js`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DeckCheck.js
git commit -m "feat: add DeckCheck pre-game packing checklist component"
```

---

### Task 2: Add route in App.js

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add import**

In `frontend/src/App.js`, find the block of direct (non-lazy) imports near the top (lines 1–35). Add this import after `import GameRoom from './components/GameRoom';`:

```js
import DeckCheck from './components/DeckCheck';
```

- [ ] **Step 2: Add route match**

In `App.js`, find the public route matching block (around line 3878–3903):

```js
const pathname = window.location.pathname;
const sharedDeckMatch = pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
const userProfileMatch = pathname.match(/^\/u\/([a-zA-Z0-9_-]+)$/i);
```

After the `roomMatch` block (around line 3903), add:

```js
// Render deck check view if URL matches
const deckCheckMatch = pathname.match(/^\/deck\/([a-f0-9]+)\/check$/);
if (deckCheckMatch) {
  return <DeckCheck />;
}
```

- [ ] **Step 3: Verify routing works**

Start the dev server: `cd frontend && npm start`

Navigate in the browser to `http://localhost:3000/deck/SOME_INVALID_ID/check`. The DeckCheck component should render (it will show an error since the ID is invalid, but it should NOT show the main app UI).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add /deck/:id/check route for packing checklist"
```

---

### Task 3: Add "Pack This Deck" button in DeckDetail

**Files:**
- Modify: `frontend/src/components/DeckDetail.js`

- [ ] **Step 1: Find the header button row**

In `frontend/src/components/DeckDetail.js`, search for the existing Share, Export, and Playtest buttons in the header area. They are near the top of the returned JSX, around the deck title row.

Look for something like `<Share2` or `onShareDeck` or the line that renders the "Export" / "Share" / "Play" type buttons in the deck header.

- [ ] **Step 2: Add "Pack This Deck" button**

In the same button row where Share/Export/Playtest buttons appear, add after the last existing header action button:

```jsx
<button
  onClick={() => { window.location.href = `/deck/${deck._id}/check`; }}
  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded-lg transition-colors"
  title="Pre-game packing checklist"
>
  📦 Pack This Deck
</button>
```

- [ ] **Step 3: Test the full flow**

1. Open the app, navigate to the Deck Builder
2. Open any deck
3. Confirm "Pack This Deck" button appears in the header row
4. Click it — navigates to `/deck/<deckId>/check`
5. The checklist shows owned cards with checkboxes
6. Tap a card — it fades and gets a strikethrough
7. Close the browser, reopen `/deck/<deckId>/check` — checked cards are still checked
8. Click Reset — all unchecked, progress bar resets to 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DeckDetail.js
git commit -m "feat: add Pack This Deck button linking to packing checklist"
```

---

## Verification Checklist

- [ ] DeckDetail header shows "Pack This Deck" button
- [ ] Clicking navigates to `/deck/:id/check`
- [ ] Owned cards list is alphabetical with checkboxes
- [ ] Tapping a card marks it checked (strikethrough, green check icon)
- [ ] localStorage persists checked state across browser close/reopen
- [ ] Reset button clears all checks and removes localStorage entry
- [ ] Progress bar fills proportionally; turns green when all owned cards are checked
- [ ] "All packed" banner appears when 100% complete
- [ ] Missing cards section is collapsed by default; expands on tap
- [ ] Location tags appear on cards that have a location assigned

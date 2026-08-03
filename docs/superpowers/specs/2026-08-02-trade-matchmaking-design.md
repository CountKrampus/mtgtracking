# Trade Matchmaking Design

## Overview

Adds a "Matches" view to the Trading Board that surfaces specific opportunities instead of requiring manual browsing: which of your `have` listings other people currently want, and which of your `want` listings other people currently have. Web app only (no Discord bot surface). Matching is by card name only, case-insensitive — the same printing/set is not required. One-directional lists only — no attempt to detect or highlight two-way swap opportunities.

## Backend

### `GET /api/trades/matches`

New route in `backend/routes/trades.js`, `requireAuth`.

**Algorithm** (mirrors the existing collection-comparison pattern in `backend/routes/usersPublic.js`'s `GET /:username/compare` — load into memory, diff via lowercased name sets, rather than per-name queries):

1. Load the current user's own active listings, split by type: `myHaves = TradeListing.find({userId: req.user._id, status: 'active', type: 'have'})`, `myWants = TradeListing.find({userId: req.user._id, status: 'active', type: 'want'})`.
2. Build `Set`s of lowercased `cardName` for each: `myHaveNames`, `myWantNames`.
3. **"People want your cards"**: query all OTHER users' active `want` listings (`TradeListing.find({status: 'active', type: 'want', userId: {$ne: req.user._id}})`), filter in memory to those whose lowercased `cardName` is in `myHaveNames`. Group the results by which of `myHaves` they match (same lowercased name).
4. **"People have your wants"**: symmetric — query all other users' active `have` listings, filter to those whose lowercased `cardName` is in `myWantNames`, group by which of `myWants` they match.
5. Return `{ havesTheyWant: [{listing, matches: [...]}], wantsTheyHave: [{listing, matches: [...]}] }`, where `listing` is one of the current user's own listings and `matches` is the array of other users' matching listings. Omit entries from either array where `matches` is empty (no point showing a card nobody wants/has).

No new index required at current scale (the existing `{status:1, type:1, createdAt:-1}` compound index already serves the two "all other users' active X-type listings" queries efficiently; the in-memory name-set filtering happens after that indexed fetch, same tradeoff the `compare` route already makes).

## Frontend

### `TradesContext.js`

Add `matches` / `matchesLoading` state and a `fetchMatches()` callback calling `GET /trades/matches`, following the exact existing pattern of `fetchListings`/`fetchMyListings`.

### `TradingBoard.js`

- Add `'matches'` to the tab array (`['browse', 'mine', 'received', 'sent', 'matches']` — order TBD at implementation, likely right after `'mine'` since it's about your own listings), gated to signed-in users only (same as the existing `'mine'`/`'received'`/`'sent'` tabs already implicitly require a user via the "Post Listing" button's gating pattern). Badge shows total match count (`havesTheyWant.length + wantsTheyHave.length`), mirroring the existing `Received (${pendingReceived})` badge convention.
- New tab content: two sections, "People want your cards" and "People have your wants," each rendering one block per matched listing — your listing's card name/condition/qty as a small header, then the list of matching other-user listings underneath (username, their condition/qty, a "Make Offer" button that opens the existing `MakeOfferModal` targeting that specific listing, reusing it exactly as the Browse tab's `ListingCard` already does).
- Empty state: "No matches right now — list more cards or check back later" when both arrays are empty.

## Non-goals

- No two-way swap highlighting/detection.
- No set/printing-level match requirement — card name only.
- No Discord bot command for this feature.
- No notifications (push/email/in-app) when a new match appears — this is a pull-based view, checked on demand.

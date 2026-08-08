# SpellTable-Lite Game Room — Design Spec

## Overview

A multiplayer video game room for playing MTG remotely. Players join via a shareable link, see each other on camera, and share a synced life/commander-damage/poison tracker. No card recognition — this is video chat + game state, not computer vision.

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Scope | Full Game Room: video + synced life/commander damage/poison + deck picker |
| Access | Both: playgroup-anchored AND standalone quick-start |
| Guest join | Yes — display name + manual deck name, no account required |
| Layout | Combined player tiles (camera on top, stats below) |
| Life tracking | Full: life totals + per-commander damage + poison counters |
| Real-time sync | Daily.co `sendAppMessage` (P2P over video channel) + debounced server backup |

---

## Architecture

### Entry Points

1. **Sidebar "Play" button** (Gameplay section) → `POST /api/game-rooms` → navigate to `/room/:code`
2. **PlaygroupDetail "Start Game Room" button** → same flow, passes `playgroupId`

### Route

`/room/:code` — public, no auth required. Handled in `App.js` before the main app renders, same pattern as `/shared/deck/:code`.

### Real-Time Sync Strategy

Daily.co's `sendAppMessage` broadcasts game state changes (life, commander damage, poison, turn) directly between participants over the video data channel. No WebSockets or polling needed for game state. Server stores a snapshot in MongoDB, updated via debounced `PUT` every 5 seconds, so state survives page refreshes.

---

## Backend

### New Model: `backend/models/GameRoom.js`

```js
const mongoose = require('mongoose');

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true, maxlength: 6 },
  hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  playgroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playgroup', default: null },
  status: { type: String, enum: ['lobby', 'active', 'ended'], default: 'lobby' },
  players: [{
    seat: { type: Number, required: true },           // 1–4
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    displayName: { type: String, required: true, maxlength: 50 },
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', default: null },
    deckName: { type: String, default: '' }
  }],
  gameState: {
    lives: { type: mongoose.Schema.Types.Mixed, default: {} },            // { '1': 40, '2': 40, ... }
    commanderDamage: { type: mongoose.Schema.Types.Mixed, default: {} },  // { '1': { '2': 0, '3': 0, ... }, ... }
    poison: { type: mongoose.Schema.Types.Mixed, default: {} },           // { '1': 0, '2': 0, ... }
    turn: { type: Number, default: 1 },
    activePlayerSeat: { type: Number, default: 1 }
  },
  dailyRoomName: { type: String, default: '' },
  dailyRoomUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
});

module.exports = mongoose.model('GameRoom', gameRoomSchema);
```

### New Environment Variable

Add to `backend/.env`:
```
DAILY_API_KEY=your_daily_co_api_key_here
```

Get a free API key at https://dashboard.daily.co — no credit card required.

### New Routes: `backend/routes/gameRooms.js`

All game state mutations validate the request carries a valid `seatToken` (a short-lived JWT issued at join time, signed with `JWT_SECRET`, payload `{ roomCode, seat }`). This prevents guests from mutating other players' state without a full auth system.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/game-rooms` | `requireAuth` | Create room. Calls Daily.co REST API to create room. Generates 6-char `roomCode`. Returns `{ roomCode, roomUrl }`. |
| `GET` | `/api/game-rooms/:code` | none | Get full room document (status, players, gameState). Used by guests. |
| `POST` | `/api/game-rooms/:code/join` | none | Join room. Body: `{ displayName, deckId?, deckName?, userId? }`. Assigns next open seat. Returns `{ seatToken, dailyToken, seat }`. Daily token created via Daily.co meeting-tokens API. |
| `PUT` | `/api/game-rooms/:code/state` | seatToken | Persist game state snapshot. Body: `{ gameState }`. Debounced on client — server just overwrites. |
| `POST` | `/api/game-rooms/:code/start` | host seatToken | Set status → 'active'. Initializes gameState with 40 life per seat. |
| `POST` | `/api/game-rooms/:code/end` | host seatToken | Set status → 'ended', set `endedAt`. For each player with a `userId` and `deckId`, write a `DeckGameLog` entry. |

**Daily.co API calls (server-side):**
```js
// Create room
await axios.post('https://api.daily.co/v1/rooms', {
  properties: { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6 }  // 6-hour expiry
}, { headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` } });

// Create meeting token
await axios.post('https://api.daily.co/v1/meeting-tokens', {
  properties: { room_name: dailyRoomName, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6 }
}, { headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` } });
```

### Register in `backend/server.js`

```js
const gameRoomRoutes = require('./routes/gameRooms');
app.use('/api/game-rooms', gameRoomRoutes);
```

---

## Frontend

### New Dependency

```bash
# in frontend/
npm install @daily-co/daily-js
```

### New Component: `frontend/src/components/GameRoom.js`

Three phases rendered by a `phase` state variable: `'lobby'` → `'active'` → `'ended'`.

#### Lobby Phase

- Displays room code + full share URL (`/room/:code`) with copy button
- Lists joined players (name, deck name, seat number)
- Logged-in users see a deck picker dropdown (their decks from collection)
- Guests see text inputs for display name + deck name
- "Start Game" button visible to host only — calls `POST /api/game-rooms/:code/start`
- Polls `GET /api/game-rooms/:code` every 3 seconds to show players as they join

#### Active Game Phase

**Layout:** 2×2 grid for 4 players, 1×2 for 2, responsive. Each player tile:

```
┌─────────────────────────┐
│   Daily.co video feed   │  ← camera, muted by default for others
│   (top ~55% of tile)    │
├─────────────────────────┤
│  DisplayName · DeckName │
│                         │
│  ❤ [−]  40  [+]        │  ← life total, +/- buttons
│  ☠ Poison: 0  [+] [−]  │  ← poison counters (red badge ≥10)
│  ⚔ Commander Damage ▾  │  ← expand/collapse
│    From P2:  0  [+]     │
│    From P3:  0  [+]     │
│    From P4:  0  [+]     │
└─────────────────────────┘
```

- Poison counter turns red and pulses at 10 (win condition highlight)
- Commander damage panel shows incoming damage from each other player
- All changes broadcast immediately via `call.sendAppMessage({ type: 'state', gameState })`
- Server backup: debounced `PUT /api/game-rooms/:code/state` after 5 seconds of no changes
- Turn tracker strip at top of room: "Turn 3 · Player 2's turn" with "End Turn" button (advances `activePlayerSeat` in gameState)
- "End Game" button (host only) in top-right corner

#### Post-Game Phase

- Final life totals, commander damage summary, who survived
- "Save Results" button — calls `POST /api/game-rooms/:code/end`, writes DeckGameLog for logged-in players with decks
- "Play Again" button — creates a new room with same players pre-filled

### Daily.co Integration (inside GameRoom.js)

```js
import DailyIframe from '@daily-co/daily-js';

// On join:
const call = DailyIframe.createCallObject();
await call.join({ url: dailyRoomUrl, token: dailyToken });

// Broadcast state change:
call.sendAppMessage({ type: 'state', gameState: newState });

// Receive state changes:
call.on('app-message', ({ data }) => {
  if (data.type === 'state') setGameState(data.gameState);
});

// Video tiles — one per participant:
const participants = call.participants();  // keyed by session_id
// Render <video> element from participant.videoTrack
```

### Routing in `App.js`

Add before the main app render (same pattern as SharedDeckView/UserProfile):

```js
import GameRoom from './components/GameRoom';

const roomMatch = window.location.pathname.match(/^\/room\/([a-zA-Z0-9]+)$/);
if (roomMatch) return <GameRoom code={roomMatch[1]} />;
```

### Two Entry Points

**1. Sidebar (`frontend/src/components/Sidebar.js`)**

Add to Gameplay section:
```jsx
{ id: 'play', label: 'Play Online', icon: Video, onClick: handleQuickStart }
```
`handleQuickStart` calls `POST /api/game-rooms`, then navigates to `/room/:code`.

**2. PlaygroupDetail (`frontend/src/components/Playgroups/PlaygroupDetail.js`)**

Add "Start Game Room" button in the header area:
```jsx
<button onClick={handleStartRoom}>🎥 Start Game Room</button>
```
Calls `POST /api/game-rooms` with `{ playgroupId }`, navigates to `/room/:code`.

---

## Data Flow

```
1. Host clicks "New Game Room"
   → POST /api/game-rooms → server creates Daily.co room → returns { roomCode }
   → Host navigates to /room/:code

2. Host shares link. Players visit /room/:code
   → Lobby shows, players enter name + deck
   → POST /api/game-rooms/:code/join → returns { seatToken, dailyToken, seat }
   → Daily.co join with dailyToken → video connects

3. Host clicks "Start Game"
   → POST /api/game-rooms/:code/start → gameState initialized (40 life each)
   → All clients transition to active phase

4. Player adjusts life/commander damage/poison
   → call.sendAppMessage({ type: 'state', gameState }) → all tiles update instantly
   → After 5s debounce: PUT /api/game-rooms/:code/state → MongoDB updated

5. Host clicks "End Game"
   → POST /api/game-rooms/:code/end
   → DeckGameLog entries written for logged-in players with decks
   → All clients transition to post-game phase
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/GameRoom.js` | New model |
| `backend/routes/gameRooms.js` | New routes (6 endpoints) |
| `backend/server.js` | Register gameRoomRoutes |
| `backend/.env` | Add `DAILY_API_KEY` |
| `frontend/src/components/GameRoom.js` | New component (lobby + active + post-game) |
| `frontend/src/App.js` | Add `/room/:code` route + import GameRoom |
| `frontend/src/components/Sidebar.js` | Add "Play Online" to Gameplay section |
| `frontend/src/components/Playgroups/PlaygroupDetail.js` | Add "Start Game Room" button |

---

## Key Behaviors

1. **Guest join:** No account needed. Guests get a `seatToken` (seat-scoped JWT) that lets them update game state for their seat only.
2. **Poison at 10:** Player tile pulses red when poison reaches 10. No auto-elimination — host decides when to end.
3. **Commander damage:** Shows only incoming damage per attacker. Total commander damage tracked separately from regular damage to life total.
4. **Sync on reconnect:** On page refresh/reconnect, client fetches `GET /api/game-rooms/:code` to restore gameState from server backup.
5. **Room expiry:** Daily.co room expires after 6 hours. GameRoom document stays in MongoDB indefinitely for history.
6. **Player limit:** 4 players max (Commander). Seats 1–4. Host is always seat 1.
7. **Turn tracking:** activePlayerSeat advances 1→2→3→4→1. "End Turn" button only enabled for the active player (enforced client-side only — no strict server enforcement needed for casual play).

# SpellTable-Lite Game Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiplayer video game rooms to MTG Tracker — players join via shareable link, see each other on camera, and share a synced life/commander-damage/poison tracker.

**Architecture:** Daily.co provides video infrastructure (free tier, no self-hosted TURN servers). Game state (life totals, commander damage, poison) syncs peer-to-peer via Daily.co's `sendAppMessage` with a MongoDB snapshot every 5 seconds for reconnect recovery. A `seatToken` JWT (signed with the existing `JWT_SECRET`) authorises guest state mutations without a full account.

**Tech Stack:** Node.js/Express/MongoDB (existing), `@daily-co/daily-js` (new frontend dep), Daily.co REST API (server-side room/token creation via axios), `jsonwebtoken` (already in `backend/package.json`)

---

## File Map

| File | Action |
|------|--------|
| `backend/models/GameRoom.js` | Create — Mongoose schema |
| `backend/routes/gameRooms.js` | Create — 6 endpoints |
| `backend/server.js` | Modify — register gameRoomRoutes |
| `backend/.env` | Modify — add `DAILY_API_KEY` |
| `frontend/src/components/GameRoom.js` | Create — full component (lobby → active → post-game) |
| `frontend/src/App.js` | Modify — `/room/:code` route + `onPlayOnline` handler |
| `frontend/src/components/Sidebar.js` | Modify — "Play Online" button + `onPlayOnline` prop |
| `frontend/src/components/Playgroups/PlaygroupDetail.js` | Modify — "Start Game Room" button |

---

## Task 1: GameRoom Model

**Files:**
- Create: `backend/models/GameRoom.js`

- [ ] **Step 1: Create the model file**

```js
// backend/models/GameRoom.js
const mongoose = require('mongoose');

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true, maxlength: 6 },
  hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  playgroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playgroup', default: null },
  status: { type: String, enum: ['lobby', 'active', 'ended'], default: 'lobby' },
  players: [{
    seat: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    displayName: { type: String, required: true, maxlength: 50 },
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', default: null },
    deckName: { type: String, default: '' }
  }],
  gameState: {
    lives: { type: mongoose.Schema.Types.Mixed, default: {} },
    commanderDamage: { type: mongoose.Schema.Types.Mixed, default: {} },
    poison: { type: mongoose.Schema.Types.Mixed, default: {} },
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

- [ ] **Step 2: Verify no syntax errors**

```bash
cd backend && node -e "require('./models/GameRoom'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/GameRoom.js
git commit -m "feat: add GameRoom mongoose model"
```

---

## Task 2: GameRoom Routes

**Files:**
- Create: `backend/routes/gameRooms.js`

Context: `requireAuth` is imported from `../middleware/auth`. `jsonwebtoken` is already in `backend/package.json`. `axios` is already a backend dependency. The Daily.co API key will be in `process.env.DAILY_API_KEY`.

A `seatToken` is a short-lived JWT with payload `{ roomCode, seat }` — it allows guests (who have no user account) to call state-mutation endpoints for their own seat only. Verified by the inline `verifySeatToken` middleware defined in this file.

- [ ] **Step 1: Create the routes file**

```js
// backend/routes/gameRooms.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const GameRoom = require('../models/GameRoom');
const DeckGameLog = require('../models/DeckGameLog');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const DAILY_API_KEY = process.env.DAILY_API_KEY || '';
const DAILY_BASE = 'https://api.daily.co/v1';
const dailyHeaders = () => ({ Authorization: `Bearer ${DAILY_API_KEY}` });

const getUserId = (req) => req.user?._id || null;

// Middleware: verify seatToken from X-Seat-Token header
const verifySeatToken = (req, res, next) => {
  const token = req.headers['x-seat-token'];
  if (!token) return res.status(401).json({ message: 'Seat token required' });
  try {
    req.seatClaim = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired seat token' });
  }
};

// POST /api/game-rooms — create room (requires logged-in user)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { playgroupId } = req.body;
    const hostUserId = getUserId(req);

    // Create Daily.co room
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
    const dailyRes = await axios.post(`${DAILY_BASE}/rooms`, {
      properties: { exp }
    }, { headers: dailyHeaders() });

    const dailyRoomName = dailyRes.data.name;
    const dailyRoomUrl = dailyRes.data.url;

    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const room = new GameRoom({
      roomCode,
      hostUserId,
      playgroupId: playgroupId || null,
      dailyRoomName,
      dailyRoomUrl
    });
    await room.save();

    res.json({ roomCode, roomUrl: `/room/${roomCode}` });
  } catch (err) {
    console.error('Create game room error:', err.message);
    res.status(500).json({ message: 'Failed to create game room', error: err.message });
  }
});

// GET /api/game-rooms/:code — get room state (public, guests use this)
router.get('/:code', async (req, res) => {
  try {
    const room = await GameRoom.findOne({ roomCode: req.params.code.toUpperCase() }).lean();
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/game-rooms/:code/join — join room, get seatToken + Daily meeting token
router.post('/:code/join', async (req, res) => {
  try {
    const { displayName, deckId, deckName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ message: 'displayName is required' });
    }

    const room = await GameRoom.findOne({ roomCode: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status === 'ended') return res.status(400).json({ message: 'This game has ended' });
    if (room.players.length >= 4) return res.status(400).json({ message: 'Room is full (4 players max)' });

    // Assign next available seat
    const takenSeats = room.players.map(p => p.seat);
    const seat = [1, 2, 3, 4].find(s => !takenSeats.includes(s));

    // Attach userId if logged in (optional — guests allowed)
    const userId = req.user?._id || null;

    room.players.push({
      seat,
      userId,
      displayName: displayName.trim(),
      deckId: deckId || null,
      deckName: deckName || ''
    });
    await room.save();

    // Issue seat-scoped JWT
    const seatToken = jwt.sign(
      { roomCode: room.roomCode, seat },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Issue Daily.co meeting token
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
    const tokenRes = await axios.post(`${DAILY_BASE}/meeting-tokens`, {
      properties: { room_name: room.dailyRoomName, exp }
    }, { headers: dailyHeaders() });

    res.json({
      seat,
      seatToken,
      dailyToken: tokenRes.data.token,
      dailyRoomUrl: room.dailyRoomUrl
    });
  } catch (err) {
    console.error('Join game room error:', err.message);
    res.status(500).json({ message: 'Failed to join game room', error: err.message });
  }
});

// POST /api/game-rooms/:code/start — host starts game, initialises gameState
router.post('/:code/start', verifySeatToken, async (req, res) => {
  try {
    if (req.seatClaim.seat !== 1) return res.status(403).json({ message: 'Only the host can start the game' });

    const room = await GameRoom.findOne({ roomCode: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status !== 'lobby') return res.status(400).json({ message: 'Game already started' });
    if (room.players.length < 1) return res.status(400).json({ message: 'No players in room' });

    const seats = room.players.map(p => p.seat);
    const lives = {};
    const commanderDamage = {};
    const poison = {};

    seats.forEach(seat => {
      lives[String(seat)] = 40;
      poison[String(seat)] = 0;
      commanderDamage[String(seat)] = {};
      seats.filter(s => s !== seat).forEach(other => {
        commanderDamage[String(seat)][String(other)] = 0;
      });
    });

    room.gameState = { lives, commanderDamage, poison, turn: 1, activePlayerSeat: seats[0] };
    room.status = 'active';
    room.markModified('gameState');
    await room.save();

    res.json({ status: 'active', gameState: room.gameState });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/game-rooms/:code/state — persist gameState snapshot (debounced from client)
router.put('/:code/state', verifySeatToken, async (req, res) => {
  try {
    const { gameState } = req.body;
    if (!gameState) return res.status(400).json({ message: 'gameState required' });

    const room = await GameRoom.findOne({ roomCode: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status !== 'active') return res.status(400).json({ message: 'Game is not active' });

    room.gameState = gameState;
    room.markModified('gameState');
    await room.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/game-rooms/:code/end — host ends game, writes DeckGameLog entries
router.post('/:code/end', verifySeatToken, async (req, res) => {
  try {
    if (req.seatClaim.seat !== 1) return res.status(403).json({ message: 'Only the host can end the game' });

    const room = await GameRoom.findOne({ roomCode: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status === 'ended') return res.status(400).json({ message: 'Already ended' });

    // Determine winner: player with highest life
    const lives = room.gameState?.lives || {};
    const maxLife = Math.max(...Object.values(lives).map(Number));

    // Write DeckGameLog for logged-in players who have a deckId
    const logPromises = room.players
      .filter(p => p.userId && p.deckId)
      .map(p => {
        const life = Number(lives[String(p.seat)] || 0);
        const result = life === maxLife ? 'win' : 'loss';
        const opponents = room.players
          .filter(op => op.seat !== p.seat)
          .map(op => op.deckName)
          .filter(Boolean)
          .join(', ');
        return DeckGameLog.create({
          deckId: p.deckId,
          userId: p.userId,
          result,
          opponentDeckName: opponents,
          notes: `Game room ${room.roomCode}`
        });
      });

    await Promise.all(logPromises);

    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();

    res.json({ status: 'ended' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend && node -e "require('./routes/gameRooms'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/gameRooms.js
git commit -m "feat: add GameRoom routes (create, join, start, state, end)"
```

---

## Task 3: Register Routes + Environment

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/.env`

- [ ] **Step 1: Add DAILY_API_KEY to `.env`**

Get a free API key from https://dashboard.daily.co (Dashboard → Developers → API Keys). Add to `backend/.env`:

```
DAILY_API_KEY=your_key_here
```

- [ ] **Step 2: Register gameRoomRoutes in `backend/server.js`**

Find the block where deckFolderRoutes is registered (look for `app.use('/api/deck-folders'`). Add immediately after it:

```js
const gameRoomRoutes = require('./routes/gameRooms');
app.use('/api/game-rooms', gameRoomRoutes);
```

- [ ] **Step 3: Restart backend and verify route exists**

```bash
# Kill existing node process and restart
cd backend && npm run dev
```

In a second terminal:
```bash
curl -s http://localhost:5000/api/game-rooms/DOESNOTEXIST | python -m json.tool
```

Expected: `{"message": "Room not found"}` (404 body — confirms route is registered)

- [ ] **Step 4: Commit**

```bash
git add backend/server.js backend/.env
git commit -m "feat: register game-rooms routes, add DAILY_API_KEY env"
```

---

## Task 4: Frontend Setup + App.js Routing

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/App.js`
- Create: `frontend/src/components/GameRoom.js` (stub only — full implementation in Tasks 5–7)

- [ ] **Step 1: Install Daily.co SDK**

```bash
cd frontend && npm install @daily-co/daily-js
```

Expected: installs without errors. Check `frontend/package.json` — `@daily-co/daily-js` appears in dependencies.

- [ ] **Step 2: Create GameRoom stub**

```jsx
// frontend/src/components/GameRoom.js
import React from 'react';

function GameRoom({ code }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Game Room: {code}</div>
    </div>
  );
}

export default GameRoom;
```

- [ ] **Step 3: Add `/room/:code` route to `App.js`**

In `frontend/src/App.js`, find the import block at the top (around line 10 where `SharedDeckView` is imported). Add:

```js
import GameRoom from './components/GameRoom';
```

Then find the public-routes block (around line 3869):
```js
const pathname = window.location.pathname;
const sharedDeckMatch = pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
```

Add a new match BEFORE the `sharedDeckMatch` check:
```js
const gameRoomMatch = pathname.match(/^\/room\/([a-zA-Z0-9]+)$/i);
if (gameRoomMatch) return <GameRoom code={gameRoomMatch[1].toUpperCase()} />;
```

- [ ] **Step 4: Verify stub renders**

Start frontend: `cd frontend && npm start`

Navigate to `http://localhost:3000/room/TEST123`

Expected: Full-screen dark gradient page showing "Game Room: TEST123"

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.js frontend/src/components/GameRoom.js
git commit -m "feat: install daily-js, add /room/:code routing stub"
```

---

## Task 5: GameRoom — Join Form + Lobby Phase

**Files:**
- Modify: `frontend/src/components/GameRoom.js`

The component has three phases driven by a `phase` state: `'join'` → `'lobby'` → `'active'` → `'ended'`.

On load: check `localStorage.getItem('seatToken_<code>')`. If found, skip the join form and go straight to `'lobby'` (rejoining).

In lobby: poll `GET /api/game-rooms/:code` every 3 seconds to update the player list. The host (seat 1) sees a "Start Game" button.

- [ ] **Step 1: Replace GameRoom.js with full join+lobby implementation**

```jsx
// frontend/src/components/GameRoom.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

function GameRoom({ code }) {
  const [phase, setPhase] = useState('loading');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  // Join form state
  const [displayName, setDisplayName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [myDecks, setMyDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [joining, setJoining] = useState(false);

  // Session state (persisted in localStorage)
  const [mySeat, setMySeat] = useState(null);
  const [seatToken, setSeatToken] = useState(null);
  const [dailyToken, setDailyToken] = useState(null);
  const [dailyRoomUrl, setDailyRoomUrl] = useState(null);

  // Game state (filled in Task 6)
  const [gameState, setGameState] = useState(null);

  const storageKey = `gameroom_${code}`;
  const pollRef = useRef(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/game-rooms/${code}`);
      setRoom(res.data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) setError('Room not found');
      else setError('Could not load room');
      return null;
    }
  }, [code]);

  // On mount: check for existing session
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const { seat, seatToken: st, dailyToken: dt, dailyRoomUrl: dru } = JSON.parse(stored);
      setMySeat(seat);
      setSeatToken(st);
      setDailyToken(dt);
      setDailyRoomUrl(dru);
    }

    fetchRoom().then(r => {
      if (!r) return;
      const stored2 = localStorage.getItem(storageKey);
      if (stored2) {
        const { seat } = JSON.parse(stored2);
        if (r.status === 'active') {
          setGameState(r.gameState);
          setPhase('active');
        } else if (r.status === 'ended') {
          setGameState(r.gameState);
          setPhase('ended');
        } else {
          setPhase('lobby');
        }
      } else {
        setPhase('join');
      }
    });

    // Try to load user's decks (optional, fails silently for guests)
    axios.get(`${API_URL}/decks`).then(res => setMyDecks(res.data || [])).catch(() => {});
  }, [code, fetchRoom, storageKey]);

  // Poll room state in lobby
  useEffect(() => {
    if (phase !== 'lobby') return;
    pollRef.current = setInterval(async () => {
      const r = await fetchRoom();
      if (!r) return;
      if (r.status === 'active') {
        setGameState(r.gameState);
        clearInterval(pollRef.current);
        setPhase('active');
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [phase, fetchRoom]);

  const handleJoin = async () => {
    if (!displayName.trim()) return;
    setJoining(true);
    try {
      const res = await axios.post(`${API_URL}/game-rooms/${code}/join`, {
        displayName: displayName.trim(),
        deckId: selectedDeckId || undefined,
        deckName: selectedDeckId
          ? (myDecks.find(d => d._id === selectedDeckId)?.name || deckName)
          : deckName
      });
      const { seat, seatToken: st, dailyToken: dt, dailyRoomUrl: dru } = res.data;
      setMySeat(seat);
      setSeatToken(st);
      setDailyToken(dt);
      setDailyRoomUrl(dru);
      localStorage.setItem(storageKey, JSON.stringify({ seat, seatToken: st, dailyToken: dt, dailyRoomUrl: dru }));
      await fetchRoom();
      setPhase('lobby');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleStartGame = async () => {
    try {
      await axios.post(`${API_URL}/game-rooms/${code}/start`, {}, {
        headers: { 'X-Seat-Token': seatToken }
      });
      const r = await fetchRoom();
      if (r) {
        setGameState(r.gameState);
        setPhase('active');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start game');
    }
  };

  const shareUrl = `${window.location.origin}/room/${code}`;

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white/60">Loading room…</div>
      </div>
    );
  }

  if (error && phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  // JOIN FORM
  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-md border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-1">Join Game Room</h1>
          <p className="text-white/50 text-sm mb-6">Room code: <span className="text-purple-300 font-mono font-bold">{code}</span></p>

          {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">Your name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="Display name"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">Deck</label>
              {myDecks.length > 0 ? (
                <select
                  value={selectedDeckId}
                  onChange={e => setSelectedDeckId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="">— Select a deck —</option>
                  {myDecks.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Deck name (optional)"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                />
              )}
            </div>

            <button
              onClick={handleJoin}
              disabled={joining || !displayName.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
            >
              {joining ? 'Joining…' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LOBBY
  if (phase === 'lobby') {
    const isHost = mySeat === 1;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-lg border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-1">Waiting for players…</h1>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-white/50 text-sm font-mono">{shareUrl}</span>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-2 py-1 rounded transition"
            >
              Copy
            </button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">{error}</div>}

          <div className="space-y-2 mb-6">
            {[1, 2, 3, 4].map(seat => {
              const player = room?.players?.find(p => p.seat === seat);
              return (
                <div key={seat} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  player ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 opacity-50'
                }`}>
                  <span className="text-white/40 text-sm w-6">P{seat}</span>
                  {player ? (
                    <>
                      <span className="text-white font-medium">{player.displayName}</span>
                      {player.deckName && <span className="text-white/40 text-sm ml-auto">{player.deckName}</span>}
                      {seat === mySeat && <span className="text-purple-400 text-xs ml-2">(you)</span>}
                    </>
                  ) : (
                    <span className="text-white/30 text-sm">Waiting…</span>
                  )}
                </div>
              );
            })}
          </div>

          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={!room?.players?.length}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Start Game
            </button>
          ) : (
            <p className="text-center text-white/40 text-sm">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // Placeholders for Task 6 + 7
  if (phase === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white">Game active — video phase coming in Task 6</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-white">Game ended — post-game coming in Task 7</div>
    </div>
  );
}

export default GameRoom;
```

- [ ] **Step 2: Verify join flow manually**

1. Make sure backend is running with `DAILY_API_KEY` set
2. Open `http://localhost:3000/room/NEWROOM` — expect "Room not found" error
3. Create a room via curl:
   ```bash
   curl -s -X POST http://localhost:5000/api/game-rooms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your_jwt_token>" \
     -d '{}' | python -m json.tool
   ```
   Note the returned `roomCode`
4. Open `http://localhost:3000/room/<roomCode>` — expect join form
5. Enter a name, click "Join Room" — expect lobby screen showing your name as P1
6. Open the same URL in a second browser tab — join as a second player — expect both players listed in P1 and P2 slots
7. Click "Start Game" from the P1 tab — expect brief redirect to "Game active — video phase coming in Task 6"

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/GameRoom.js
git commit -m "feat: add GameRoom join form and lobby phase"
```

---

## Task 6: GameRoom — Active Game Phase (Video + State Sync)

**Files:**
- Modify: `frontend/src/components/GameRoom.js`

This task replaces the active-phase placeholder with:
1. Daily.co call object setup (video)
2. A 2×2 grid of combined player tiles
3. Per-tile controls: life total ±, poison ±, commander damage expand/collapse
4. State sync via `sendAppMessage` (instant P2P) + debounced `PUT /api/game-rooms/:code/state` (server backup every 5s)
5. Turn tracker strip + "End Turn" button
6. "End Game" button (host only)

- [ ] **Step 1: Add VideoTile helper component** at the top of `GameRoom.js` (before the `GameRoom` function):

```jsx
function VideoTile({ participant }) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (videoRef.current && participant?.videoTrack) {
      videoRef.current.srcObject = new MediaStream([participant.videoTrack]);
    }
  }, [participant?.videoTrack]);

  if (!participant) {
    return (
      <div className="w-full bg-black/40 flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        <span className="text-white/20 text-3xl">📷</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={participant.local}
      className="w-full object-cover"
      style={{ aspectRatio: '16/9' }}
    />
  );
}
```

- [ ] **Step 2: Replace the active-phase block** inside `GameRoom` with the full implementation.

Find and replace the `if (phase === 'active')` return block:

```jsx
  // ─── ACTIVE GAME ────────────────────────────────────────────
  if (phase === 'active') {
    return (
      <ActiveGame
        code={code}
        room={room}
        mySeat={mySeat}
        seatToken={seatToken}
        dailyToken={dailyToken}
        dailyRoomUrl={dailyRoomUrl}
        initialGameState={gameState}
        onGameEnd={(finalState) => {
          setGameState(finalState);
          setPhase('ended');
        }}
      />
    );
  }
```

- [ ] **Step 3: Add the `ActiveGame` component** to `GameRoom.js` (after the `VideoTile` component, before the `GameRoom` function):

```jsx
import DailyIframe from '@daily-co/daily-js';

function ActiveGame({ code, room, mySeat, seatToken, dailyToken, dailyRoomUrl, initialGameState, onGameEnd }) {
  const [gameState, setGameState] = useState(initialGameState || {});
  const [participants, setParticipants] = useState({});
  const [expandedCmdr, setExpandedCmdr] = useState(null); // seat number
  const callRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isHost = mySeat === 1;

  // Map Daily.co participants by their display name / user_name to seats
  // Daily.co session IDs are transient — we map by matching displayName to players
  const participantBySeat = useCallback((seat) => {
    const player = room?.players?.find(p => p.seat === seat);
    if (!player) return null;
    return Object.values(participants).find(
      p => p.user_name === player.displayName || p.userData?.seat === seat
    ) || null;
  }, [participants, room]);

  // Set up Daily.co call
  useEffect(() => {
    if (!dailyRoomUrl || !dailyToken) return;

    const call = DailyIframe.createCallObject();
    callRef.current = call;

    const updateParticipants = () => setParticipants({ ...call.participants() });

    call.on('participant-joined', updateParticipants);
    call.on('participant-updated', updateParticipants);
    call.on('participant-left', updateParticipants);
    call.on('app-message', ({ data }) => {
      if (data?.type === 'state') {
        setGameState(data.gameState);
      }
      if (data?.type === 'ended') {
        onGameEnd(data.gameState);
      }
    });

    call.join({
      url: dailyRoomUrl,
      token: dailyToken,
      userName: room?.players?.find(p => p.seat === mySeat)?.displayName || `Player ${mySeat}`
    }).then(() => updateParticipants());

    return () => {
      call.destroy();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dailyRoomUrl, dailyToken, mySeat, room, onGameEnd]);

  const broadcastAndSave = useCallback((newState) => {
    setGameState(newState);
    callRef.current?.sendAppMessage({ type: 'state', gameState: newState });

    // Debounced server save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      axios.put(`${API_URL}/game-rooms/${code}/state`, { gameState: newState }, {
        headers: { 'X-Seat-Token': seatToken }
      }).catch(() => {});
    }, 5000);
  }, [code, seatToken]);

  const changeLife = (seat, delta) => {
    const next = { ...gameState, lives: { ...gameState.lives, [String(seat)]: (gameState.lives[String(seat)] || 40) + delta } };
    broadcastAndSave(next);
  };

  const changePoison = (seat, delta) => {
    const next = { ...gameState, poison: { ...gameState.poison, [String(seat)]: Math.max(0, (gameState.poison[String(seat)] || 0) + delta) } };
    broadcastAndSave(next);
  };

  const changeCmdrDamage = (targetSeat, fromSeat, delta) => {
    const cur = gameState.commanderDamage?.[String(targetSeat)]?.[String(fromSeat)] || 0;
    const next = {
      ...gameState,
      commanderDamage: {
        ...gameState.commanderDamage,
        [String(targetSeat)]: {
          ...(gameState.commanderDamage?.[String(targetSeat)] || {}),
          [String(fromSeat)]: Math.max(0, cur + delta)
        }
      }
    };
    broadcastAndSave(next);
  };

  const endTurn = () => {
    const seats = room.players.map(p => p.seat).sort();
    const idx = seats.indexOf(gameState.activePlayerSeat);
    const nextSeat = seats[(idx + 1) % seats.length];
    const isNewTurn = nextSeat <= gameState.activePlayerSeat;
    broadcastAndSave({
      ...gameState,
      activePlayerSeat: nextSeat,
      turn: isNewTurn ? (gameState.turn || 1) + 1 : (gameState.turn || 1)
    });
  };

  const handleEndGame = async () => {
    if (!window.confirm('End the game and save results?')) return;
    callRef.current?.sendAppMessage({ type: 'ended', gameState });
    onGameEnd(gameState);
  };

  const seats = room?.players?.map(p => p.seat).sort() || [];
  const activePlayer = room?.players?.find(p => p.seat === gameState.activePlayerSeat);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-3 flex flex-col gap-3">

      {/* Turn tracker strip */}
      <div className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2 border border-white/10">
        <span className="text-white/60 text-sm">Turn <span className="text-white font-bold">{gameState.turn || 1}</span></span>
        <span className="text-white text-sm">{activePlayer?.displayName}'s turn</span>
        <div className="flex gap-2">
          {mySeat === gameState.activePlayerSeat && (
            <button onClick={endTurn} className="bg-blue-600/70 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded-lg transition">
              End Turn
            </button>
          )}
          {isHost && (
            <button onClick={handleEndGame} className="bg-red-600/70 hover:bg-red-600 text-white text-xs px-3 py-1 rounded-lg transition">
              End Game
            </button>
          )}
        </div>
      </div>

      {/* Player tile grid */}
      <div className={`grid gap-3 flex-1 ${seats.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {seats.map(seat => {
          const player = room.players.find(p => p.seat === seat);
          const life = gameState.lives?.[String(seat)] ?? 40;
          const poison = gameState.poison?.[String(seat)] ?? 0;
          const isMe = seat === mySeat;
          const isDead = life <= 0 || poison >= 10;
          const cmdrExpanded = expandedCmdr === seat;
          const otherSeats = seats.filter(s => s !== seat);

          return (
            <div
              key={seat}
              className={`rounded-2xl border overflow-hidden flex flex-col ${
                isDead ? 'border-red-500/40 opacity-60' : 'border-white/20'
              } ${gameState.activePlayerSeat === seat ? 'ring-2 ring-blue-400/60' : ''} bg-black/40 backdrop-blur-sm`}
            >
              {/* Video */}
              <div className="relative">
                <VideoTile participant={participantBySeat(seat)} />
                {isDead && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-red-400 font-bold text-lg">💀 Eliminated</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-white font-semibold text-sm truncate">{player?.displayName}</span>
                  {player?.deckName && <span className="text-white/40 text-xs truncate ml-2">{player.deckName}</span>}
                </div>

                {/* Life total */}
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-sm">❤</span>
                  <button onClick={() => changeLife(seat, -1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition">−</button>
                  <span className={`text-2xl font-bold w-10 text-center ${life <= 5 ? 'text-red-400' : 'text-white'}`}>{life}</span>
                  <button onClick={() => changeLife(seat, +1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition">+</button>
                </div>

                {/* Poison */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${poison >= 10 ? 'text-green-400 animate-pulse' : 'text-white/40'}`}>☠</span>
                  <button onClick={() => changePoison(seat, -1)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition">−</button>
                  <span className={`text-sm font-bold w-6 text-center ${poison >= 10 ? 'text-green-400 font-bold' : 'text-white/70'}`}>{poison}</span>
                  <button onClick={() => changePoison(seat, +1)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition">+</button>
                  {poison >= 10 && <span className="text-green-400 text-xs font-bold animate-pulse">POISON WIN</span>}
                </div>

                {/* Commander damage toggle */}
                {otherSeats.length > 0 && (
                  <button
                    onClick={() => setExpandedCmdr(cmdrExpanded ? null : seat)}
                    className="text-xs text-white/40 hover:text-white/70 text-left transition flex items-center gap-1"
                  >
                    ⚔ Commander Damage {cmdrExpanded ? '▲' : '▾'}
                  </button>
                )}
                {cmdrExpanded && otherSeats.map(fromSeat => {
                  const fromPlayer = room.players.find(p => p.seat === fromSeat);
                  const dmg = gameState.commanderDamage?.[String(seat)]?.[String(fromSeat)] ?? 0;
                  return (
                    <div key={fromSeat} className="flex items-center gap-2 pl-3">
                      <span className="text-white/50 text-xs flex-1">From {fromPlayer?.displayName}:</span>
                      <button onClick={() => changeCmdrDamage(seat, fromSeat, -1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition">−</button>
                      <span className={`text-sm font-bold w-6 text-center ${dmg >= 21 ? 'text-red-400' : 'text-white'}`}>{dmg}</span>
                      <button onClick={() => changeCmdrDamage(seat, fromSeat, +1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition">+</button>
                      {dmg >= 21 && <span className="text-red-400 text-[10px]">LETHAL</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `useCallback` to the import line at the top of `GameRoom.js`**

The import at line 1 should be:
```js
import React, { useState, useEffect, useRef, useCallback } from 'react';
```

And add the DailyIframe import at line 3:
```js
import DailyIframe from '@daily-co/daily-js';
```

- [ ] **Step 5: Verify active game manually**

1. Create a room, join in two browser tabs (P1 and P2)
2. P1 clicks "Start Game"
3. Both tabs should show the active game grid with video tiles
4. Click −/+ on life totals — both tabs should update within ~1 second
5. Click ⚔ Commander Damage on P1's tile — expand and add damage from P2
6. Reach 10 poison on any player — "POISON WIN" badge should pulse green
7. Check browser console — no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/GameRoom.js
git commit -m "feat: add active game phase with Daily.co video and synced life/commander/poison"
```

---

## Task 7: GameRoom — Post-Game Phase

**Files:**
- Modify: `frontend/src/components/GameRoom.js`

- [ ] **Step 1: Replace the `phase === 'ended'` placeholder** with the full post-game view:

Find and replace:
```jsx
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-white">Game ended — post-game coming in Task 7</div>
    </div>
  );
```

With:
```jsx
  // POST-GAME
  const lives = gameState?.lives || {};
  const maxLife = Math.max(...Object.values(lives).map(Number), 0);
  const winner = room?.players?.find(p => Number(lives[String(p.seat)]) === maxLife);

  const handleSaveResults = async () => {
    try {
      await axios.post(`${API_URL}/game-rooms/${code}/end`, {}, {
        headers: { 'X-Seat-Token': seatToken }
      });
      localStorage.removeItem(storageKey);
      alert('Results saved to game log!');
    } catch (err) {
      alert(err.response?.data?.message || 'Could not save results');
    }
  };

  const handlePlayAgain = async () => {
    try {
      // axios interceptor in App.js adds Authorization header automatically
      const res = await axios.post(`${API_URL}/game-rooms`, {});
      localStorage.removeItem(storageKey);
      window.location.href = `/room/${res.data.roomCode}`;
    } catch {
      alert('Could not create new room. Make sure you are logged in.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-lg border border-white/20">
        <h1 className="text-2xl font-bold text-white mb-1">Game Over</h1>
        {winner && (
          <p className="text-green-400 font-semibold mb-6">🏆 {winner.displayName} wins with {maxLife} life!</p>
        )}

        <div className="space-y-2 mb-6">
          {room?.players?.sort((a, b) => (lives[String(b.seat)] || 0) - (lives[String(a.seat)] || 0)).map(p => {
            const life = lives[String(p.seat)] ?? 0;
            const poison = gameState?.poison?.[String(p.seat)] ?? 0;
            return (
              <div key={p.seat} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-white font-medium flex-1">{p.displayName}</span>
                {p.deckName && <span className="text-white/40 text-sm">{p.deckName}</span>}
                <span className={`font-bold ${life <= 0 ? 'text-red-400' : 'text-white'}`}>{life} ❤</span>
                {poison > 0 && <span className="text-green-400 text-sm">{poison} ☠</span>}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {mySeat === 1 && (
            <button
              onClick={handleSaveResults}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Save Results
            </button>
          )}
          <button
            onClick={handlePlayAgain}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 rounded-lg transition"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: Verify post-game manually**

1. Start a game in two tabs, click "End Game" (host)
2. Both tabs should show post-game summary with final life totals
3. Winner should be highlighted in green
4. Host clicks "Save Results" — expect success alert (verify DeckGameLog entry created in DB if both players had accounts + decks)
5. Click "Play Again" — expect new room created, redirect to new `/room/:code`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/GameRoom.js
git commit -m "feat: add post-game phase with results summary and save"
```

---

## Task 8: Entry Points

**Files:**
- Modify: `frontend/src/components/Sidebar.js`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/Playgroups/PlaygroupDetail.js`

### 8a — Sidebar "Play Online" button

- [ ] **Step 1: Add `Video` to the lucide-react import in `Sidebar.js`**

Find the lucide-react import block (starts at line 1). Add `Video` to the list:

```js
import {
  ...
  Palette,
  Video
} from 'lucide-react';
```

- [ ] **Step 2: Add `onPlayOnline` to the Sidebar props** (around line 38 where props are destructured):

```js
const Sidebar = ({
  ...
  wishlistDealCount,
  onPlayOnline   // NEW
}) => {
```

- [ ] **Step 3: Add "Play Online" button to the Gameplay section** in `Sidebar.js`.

Find the gameplay items array (around line 482):
```js
{expandedSections.gameplay && [
  { id: 'planechase-mode', ...},
  ...
  { id: 'sealed-simulator', ... },
].map(...)}
```

Add a standalone button AFTER the `.map(...)` closing block (after the `})}` ), still inside `{expandedSections.gameplay && ...}`. Replace the `{expandedSections.gameplay && [...].map(...)}` with:

```jsx
{expandedSections.gameplay && (
  <>
    {[
      { id: 'planechase-mode', label: 'Planechase Mode', icon: MapPin },
      { id: 'archenemy-mode', label: 'Archenemy Mode', icon: Shield },
      { id: 'kingdoms-variant', label: 'Kingdoms Variant', icon: Crown },
      { id: 'star-variant', label: 'Star Variant', icon: Star },
      { id: 'custom-format-builder', label: 'Custom Format Builder', icon: Settings },
      { id: 'cube-builder', label: 'Cube Builder', icon: Zap },
      { id: 'sealed-simulator', label: 'Sealed Simulator', icon: Package },
    ].map((item) => {
      const Icon = item.icon;
      const isActive = currentView === item.id;
      return (
        <button
          key={item.id}
          onClick={() => handleGameplayClick(item.id)}
          className={`w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm font-medium ${
            isActive
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title={sidebarCollapsed ? item.label : undefined}
        >
          <Icon size={18} className="flex-shrink-0" />
          {!sidebarCollapsed && <span>{item.label}</span>}
        </button>
      );
    })}
    <button
      onClick={onPlayOnline}
      className="w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm font-medium text-emerald-300 hover:bg-white/10 hover:text-emerald-200"
      title={sidebarCollapsed ? 'Play Online' : undefined}
    >
      <Video size={18} className="flex-shrink-0" />
      {!sidebarCollapsed && <span>Play Online</span>}
    </button>
  </>
)}
```

### 8b — Wire `onPlayOnline` in App.js

- [ ] **Step 4: Add `handlePlayOnline` to `App.js`**

In `App.js`, find where other handler functions are defined (near `handleQuickStart` or where `fetchDecks` etc. are). Add:

```js
const handlePlayOnline = async () => {
  try {
    const res = await axios.post(`${API_URL}/game-rooms`, {});
    window.location.href = `/room/${res.data.roomCode}`;
  } catch (err) {
    alert('Could not create game room. Make sure you are logged in.');
  }
};
```

- [ ] **Step 5: Pass `onPlayOnline` to `<Sidebar>` in App.js**

Find the `<Sidebar` JSX (search for `<Sidebar`). Add the prop:

```jsx
<Sidebar
  ...
  onPlayOnline={handlePlayOnline}
/>
```

### 8c — PlaygroupDetail "Start Game Room" button

- [ ] **Step 6: Add `handleStartRoom` and the button to `PlaygroupDetail.js`**

In `frontend/src/components/Playgroups/PlaygroupDetail.js`, find the header block (around line 92, the `{/* Header */}` comment). Add a handler function inside the component (before the return):

```js
const handleStartRoom = async () => {
  try {
    const res = await axios.post(`${API_URL}/game-rooms`, { playgroupId: playgroup._id });
    window.location.href = `/room/${res.data.roomCode}`;
  } catch (err) {
    alert('Could not create game room. Make sure you are logged in.');
  }
};
```

Then in the header JSX, after the member count line (around line 99), add the button:

```jsx
<div className="mt-3 flex gap-2">
  <button
    onClick={handleStartRoom}
    className="flex items-center gap-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
  >
    🎥 Start Game Room
  </button>
</div>
```

Also verify that `axios` and `API_URL` are already imported/defined at the top of `PlaygroupDetail.js`. If not, add:
```js
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
```

- [ ] **Step 7: Verify both entry points work**

1. Click "Play Online" in Sidebar — expect a new room to be created, browser navigates to `/room/:code`
2. Open a Playgroup → click "Start Game Room" — expect same result with `playgroupId` attached (verify in MongoDB: `db.gamerooms.findOne()` should show `playgroupId` field set)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Sidebar.js frontend/src/App.js frontend/src/components/Playgroups/PlaygroupDetail.js
git commit -m "feat: add Play Online sidebar button and Start Game Room in playgroup"
```

---

## Final Verification Checklist

- [ ] Create room via Sidebar "Play Online" → lobby loads at `/room/:code`
- [ ] Share link with a second browser (incognito) → guest sees join form, enters name, joins
- [ ] Host clicks "Start Game" → both clients show video + life counter grid
- [ ] Adjust life on any tile → other client updates within ~1 second
- [ ] Poison reaches 10 → "POISON WIN" badge pulses green
- [ ] Commander damage reaches 21 → "LETHAL" label appears in red
- [ ] "End Turn" advances turn tracker; active player's tile gets blue ring
- [ ] Host clicks "End Game" → both clients land on post-game summary
- [ ] "Save Results" writes DeckGameLog for logged-in players with decks (verify in DB)
- [ ] "Play Again" creates a new room and redirects
- [ ] Page refresh mid-game → state restored from server backup
- [ ] Playgroup → "Start Game Room" creates room with `playgroupId` set

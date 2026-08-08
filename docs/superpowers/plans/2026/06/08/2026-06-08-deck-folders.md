# Deck Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add folder/subfolder organization to the Deck Builder — folders nest to unlimited depth, decks are moved via right-click context menu, and the deck list acts as a file browser showing the active folder's direct decks plus immediate child subfolders.

**Architecture:** A new `DeckFolder` MongoDB model holds the tree via `parentId` references; a `folderId` field on `Deck` links decks to folders. The frontend keeps a flat folder array in `DeckBuilder.js` and builds the tree client-side. The Settings modal provides a standalone "Deck Folders" tab for rename/delete management.

**Tech Stack:** Node.js + Express + Mongoose (backend); React + Tailwind (frontend); lucide-react icons; axios (auto-auth via existing interceptor — no manual `Authorization` headers needed).

---

## Codebase Context (read before coding)

- **Card schema** lives inline in `backend/server.js`, NOT in a separate file. **Deck schema** IS a separate file at `backend/models/Deck.js`.
- **Auth:** `axios.interceptors.request.use` in `App.js` (line ~81) adds the Bearer token to every axios request automatically. Do NOT manually add `Authorization` headers anywhere in the frontend.
- **Multi-user:** All backend queries must use `buildUserQuery({}, req)` or `getUserId(req)` from `backend/middleware/multiUser.js` to scope to the current user.
- **DeckBuilder.js** owns `decks` state and renders `DeckList`. It passes `decks`, `onViewDeck`, `onDeleteDeck`, `onImportClick`, `onCreateDeck` to `DeckList`.
- **Settings modal** is an inline `SettingsView` component inside `App.js` starting around line 2787. Tabs are defined at line ~2860. The `DeckFoldersTab` component goes at module level (like `PortfolioTab` at line 143).
- **DeckList.js** currently has no folder concept. Its function signature is: `function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck })`.
- **`GET /api/decks`** returns a plain array (no pagination wrapper). Do not assume paginated format.

---

## File Map

| File | Action |
|------|--------|
| `backend/models/DeckFolder.js` | Create |
| `backend/models/Deck.js` | Modify — add `folderId` field |
| `backend/routes/deckFolders.js` | Create — GET/POST/PUT/DELETE |
| `backend/routes/decks.js` | Modify — add `PUT /:id/folder` |
| `backend/server.js` | Modify — register deck-folders routes |
| `frontend/src/components/DeckBuilder.js` | Modify — folders state + callbacks |
| `frontend/src/components/DeckList.js` | Modify — dropdown, tree, breadcrumb, subfolder rows, context menu, move modal |
| `frontend/src/App.js` | Modify — "Deck Folders" settings tab |

---

## Task 1: Backend — DeckFolder Model + folderId on Deck

**Files:**
- Create: `backend/models/DeckFolder.js`
- Modify: `backend/models/Deck.js`

- [ ] **Step 1: Create `backend/models/DeckFolder.js`**

```js
const mongoose = require('mongoose');

const deckFolderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeckFolder', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

deckFolderSchema.index({ userId: 1, parentId: 1 });
deckFolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DeckFolder', deckFolderSchema);
```

- [ ] **Step 2: Add `folderId` to `backend/models/Deck.js`**

In `deckSchema`, add after the `isFeatured` line (before `createdAt`):

```js
folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeckFolder', default: null },
```

The schema block around that insertion point should look like:

```js
  isFeatured: { type: Boolean, default: false },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeckFolder', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
```

- [ ] **Step 3: Verify the file looks correct**

Run: `node -e "const D = require('./backend/models/DeckFolder'); console.log('OK', Object.keys(D.schema.paths))"`

Expected output includes: `userId`, `name`, `parentId`, `createdAt`, `updatedAt`.

- [ ] **Step 4: Commit**

```bash
git add backend/models/DeckFolder.js backend/models/Deck.js
git commit -m "feat: add DeckFolder model and folderId field on Deck"
```

---

## Task 2: Backend — DeckFolder CRUD Routes

**Files:**
- Create: `backend/routes/deckFolders.js`

- [ ] **Step 1: Create `backend/routes/deckFolders.js`**

```js
const express = require('express');
const router = express.Router();
const DeckFolder = require('../models/DeckFolder');
const Deck = require('../models/Deck');
const { requireAuth } = require('../middleware/auth');
const { getUserId } = require('../middleware/multiUser');

// Helper: collect all descendant folder IDs for a given folder (BFS)
async function getDescendantIds(userId, folderId) {
  const allFolders = await DeckFolder.find({ userId }).lean();
  const result = [];
  const queue = [String(folderId)];
  while (queue.length) {
    const current = queue.shift();
    const children = allFolders.filter(f => String(f.parentId) === current);
    children.forEach(c => {
      result.push(c._id);
      queue.push(String(c._id));
    });
  }
  return result;
}

// GET /api/deck-folders — flat list of all folders for the current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const folders = await DeckFolder.find({ userId }).sort({ name: 1 }).lean();
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/deck-folders — create a folder
// Body: { name: string, parentId?: ObjectId|null }
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, parentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' });

    // Validate parentId belongs to this user (if provided)
    if (parentId) {
      const parent = await DeckFolder.findOne({ _id: parentId, userId });
      if (!parent) return res.status(404).json({ message: 'Parent folder not found' });
    }

    const folder = new DeckFolder({
      userId,
      name: name.trim(),
      parentId: parentId || null
    });
    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/deck-folders/:id — rename a folder
// Body: { name: string }
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' });

    const folder = await DeckFolder.findOne({ _id: req.params.id, userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    folder.name = name.trim();
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/deck-folders/:id — delete folder and all descendants
// Decks in deleted folders are moved to root (folderId = null)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const folder = await DeckFolder.findOne({ _id: req.params.id, userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const descendantIds = await getDescendantIds(userId, req.params.id);
    const allIds = [folder._id, ...descendantIds];

    // Move affected decks to root
    await Deck.updateMany({ userId, folderId: { $in: allIds } }, { $set: { folderId: null } });

    // Delete all folders in the subtree
    await DeckFolder.deleteMany({ _id: { $in: allIds } });

    res.json({ message: 'Folder deleted', deleted: allIds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./backend/routes/deckFolders'); console.log('syntax OK')"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/deckFolders.js
git commit -m "feat: add DeckFolder CRUD routes"
```

---

## Task 3: Backend — Register Routes + PUT /decks/:id/folder

**Files:**
- Modify: `backend/server.js` (register deck-folders router)
- Modify: `backend/routes/decks.js` (add folder assignment endpoint)

- [ ] **Step 1: Register deck-folders routes in `backend/server.js`**

Find the line `app.use('/api/decks', deckRoutes);` (around line 838) and add immediately after:

```js
// Deck folder routes
const deckFolderRoutes = require('./routes/deckFolders');
app.use('/api/deck-folders', deckFolderRoutes);
```

- [ ] **Step 2: Add `PUT /:id/folder` to `backend/routes/decks.js`**

Add this route at the end of `backend/routes/decks.js`, just before `module.exports = router;`:

```js
// PUT /api/decks/:id/folder — assign deck to a folder (or move to root if folderId is null)
// Body: { folderId: ObjectId|null }
router.put('/:id/folder', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { folderId } = req.body;
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    if (folderId) {
      // Validate the target folder belongs to this user
      const DeckFolder = require('../models/DeckFolder');
      const folder = await DeckFolder.findOne({ _id: folderId, userId });
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
    }

    deck.folderId = folderId || null;
    await deck.save();
    res.json({ _id: deck._id, folderId: deck.folderId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
```

- [ ] **Step 3: Manual smoke test**

Start the backend (`cd backend && npm run dev`), then:

```bash
# Create a folder
curl -s -X POST http://localhost:5000/api/deck-folders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"name":"Test Folder"}'
# Expected: {"_id":"...","name":"Test Folder","parentId":null,...}

# List folders
curl -s http://localhost:5000/api/deck-folders \
  -H "Authorization: Bearer <your-token>"
# Expected: [{"_id":"...","name":"Test Folder",...}]
```

- [ ] **Step 4: Commit**

```bash
git add backend/server.js backend/routes/decks.js
git commit -m "feat: register deck-folder routes and add PUT /decks/:id/folder endpoint"
```

---

## Task 4: Frontend — DeckBuilder.js Folders State + Callbacks

**Files:**
- Modify: `frontend/src/components/DeckBuilder.js`

**Context:** `DeckBuilder.js` currently manages `decks` state and passes it to `DeckList`. We add `folders` state here and pass folder-related callbacks to `DeckList`. The auth token is handled automatically by the global axios interceptor — no need to pass it manually.

- [ ] **Step 1: Add `folders` state and `fetchFolders` to `DeckBuilder`**

After the existing state declarations (`useState` calls) near the top of the `DeckBuilder` function, add:

```js
const [folders, setFolders] = useState([]);

const fetchFolders = async () => {
  try {
    const res = await axios.get(`${API_URL}/deck-folders`);
    setFolders(res.data);
  } catch (err) {
    console.error('Error fetching deck folders:', err);
  }
};
```

- [ ] **Step 2: Fetch folders on mount alongside decks**

The existing `useEffect` calls `fetchDecks()`. Change it to also call `fetchFolders()`:

```js
useEffect(() => {
  fetchDecks();
  fetchFolders();
}, []);
```

- [ ] **Step 3: Add `createFolder` and `moveDeckToFolder` callbacks**

Add these two functions after `fetchFolders`:

```js
const createFolder = async (name, parentId = null) => {
  await axios.post(`${API_URL}/deck-folders`, { name, parentId: parentId || null });
  await fetchFolders();
};

const moveDeckToFolder = async (deckId, folderId) => {
  await axios.put(`${API_URL}/decks/${deckId}/folder`, { folderId: folderId || null });
  await fetchDecks();
};
```

- [ ] **Step 4: Pass new props to `DeckList`**

The existing `<DeckList>` render (around line 74) currently passes:
```jsx
<DeckList
  decks={decks}
  onViewDeck={...}
  onDeleteDeck={deleteDeck}
  onImportClick={...}
  onCreateDeck={createDeck}
/>
```

Add three new props:
```jsx
<DeckList
  decks={decks}
  onViewDeck={(deck) => {
    setCurrentDeck(deck);
    fetchDeckDetails(deck._id);
    setDeckView('detail');
  }}
  onDeleteDeck={deleteDeck}
  onImportClick={() => setDeckView('import')}
  onCreateDeck={createDeck}
  folders={folders}
  onFolderCreate={createFolder}
  onDeckMoveToFolder={moveDeckToFolder}
/>
```

- [ ] **Step 5: Verify build compiles**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `Successfully compiled` or similar (no errors).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DeckBuilder.js
git commit -m "feat: add folders state and folder callbacks to DeckBuilder"
```

---

## Task 5: Frontend — DeckList.js Folder Toolbar, Dropdown, Breadcrumb, Filtering

**Files:**
- Modify: `frontend/src/components/DeckList.js`

**Context:** `DeckList` currently receives `{ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck }`. We add `folders`, `onFolderCreate`, `onDeckMoveToFolder` to the signature. The component gets new UI: a toolbar folder button that opens a dropdown tree, breadcrumb navigation, subfolder rows above the deck grid, and filtered deck display.

- [ ] **Step 1: Add helper functions before the `DeckList` function (module level)**

Add these pure functions just above `function DeckList(...)`:

```js
function buildFolderTree(folders, parentId = null) {
  return folders
    .filter(f => String(f.parentId || null) === String(parentId))
    .map(f => ({ ...f, children: buildFolderTree(folders, f._id) }));
}

function getFolderPath(folders, folderId) {
  const path = [];
  let current = folders.find(f => String(f._id) === String(folderId));
  while (current) {
    path.unshift(current);
    current = folders.find(f => String(f._id) === String(current.parentId));
  }
  return path;
}
```

- [ ] **Step 2: Add `FolderTreeNode` component before `DeckList` function**

Add this recursive component (still at module level, after the helper functions):

```jsx
function FolderTreeNode({ folder, depth, activeFolderId, onSelect, deckCountByFolder }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = folder.children && folder.children.length > 0;
  const isActive = String(activeFolderId) === String(folder._id);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 rounded cursor-pointer text-sm select-none ${
          isActive ? 'bg-purple-600/30 text-purple-300' : 'text-white/70 hover:bg-white/10'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px' }}
        onClick={() => onSelect(folder._id)}
      >
        <span
          className="w-3 text-white/40 flex-shrink-0 text-xs"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span>📁</span>
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="text-white/30 text-xs">{deckCountByFolder[String(folder._id)] || 0}</span>
      </div>
      {open && hasChildren && folder.children.map(child => (
        <FolderTreeNode
          key={child._id}
          folder={child}
          depth={depth + 1}
          activeFolderId={activeFolderId}
          onSelect={onSelect}
          deckCountByFolder={deckCountByFolder}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update `DeckList` function signature and add new state + computed values**

Change the function signature from:
```js
function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck }) {
```
to:
```js
function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck, folders = [], onFolderCreate, onDeckMoveToFolder }) {
```

Then add these state declarations after the existing ones (`showSleeveCalc`, `creating`, etc.):

```js
const [activeFolderId, setActiveFolderId] = useState(null);
const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
const [newFolderName, setNewFolderName] = useState('');
const [contextMenu, setContextMenu] = useState(null); // { deck, x, y }
const [movingDeck, setMovingDeck] = useState(null);
const [moveTarget, setMoveTarget] = useState(undefined);
```

Also add `useMemo` to the existing import: change `import React, { useState, useEffect, useRef } from 'react';` to `import React, { useState, useEffect, useRef, useMemo } from 'react';`.

Then add these computed values (after the `currentFormat` and `debounceRef` lines):

```js
// Deck count per folder (direct children only)
const deckCountByFolder = useMemo(() => {
  const map = {};
  decks.forEach(d => {
    if (d.folderId) map[String(d.folderId)] = (map[String(d.folderId)] || 0) + 1;
  });
  return map;
}, [decks]);

// Build folder tree for dropdown
const rootFolderTree = useMemo(() => buildFolderTree(folders), [folders]);

// Folder path for breadcrumb
const folderPath = useMemo(() => getFolderPath(folders, activeFolderId), [folders, activeFolderId]);

// Immediate subfolders of active folder (for subfolder rows in deck grid)
const activeSubfolders = useMemo(() => {
  if (!activeFolderId) return [];
  return folders.filter(f => String(f.parentId || null) === String(activeFolderId));
}, [folders, activeFolderId]);

// Decks to display based on active folder
const visibleDecks = useMemo(() => {
  if (!activeFolderId) return decks;
  return decks.filter(d => String(d.folderId) === String(activeFolderId));
}, [decks, activeFolderId]);

// Flat folder list for move picker (depth-first traversal)
const flatFolderList = useMemo(() => {
  const result = [];
  function walk(parentId, depth) {
    folders
      .filter(f => String(f.parentId || null) === String(parentId || null))
      .forEach(f => { result.push({ folder: f, depth }); walk(f._id, depth + 1); });
  }
  walk(null, 0);
  return result;
}, [folders]);
```

- [ ] **Step 4: Add click-outside handlers for dropdown and context menu**

Add these `useEffect` hooks after the existing `useEffect` for commander autocomplete:

```js
// Close folder dropdown on outside click
useEffect(() => {
  if (!folderDropdownOpen) return;
  const handler = () => setFolderDropdownOpen(false);
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [folderDropdownOpen]);

// Close context menu on any click
useEffect(() => {
  if (!contextMenu) return;
  const handler = () => setContextMenu(null);
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}, [contextMenu]);
```

- [ ] **Step 5: Add folder handler functions**

Add these just before the `return (` statement:

```js
const handleFolderSelect = (folderId) => {
  setActiveFolderId(folderId);
  setFolderDropdownOpen(false);
};

const handleCreateFolder = async () => {
  if (!newFolderName.trim()) return;
  await onFolderCreate(newFolderName.trim(), null);
  setNewFolderName('');
};

const handleMoveToFolder = async () => {
  if (moveTarget === undefined) return;
  await onDeckMoveToFolder(movingDeck._id, moveTarget);
  setMovingDeck(null);
  setMoveTarget(undefined);
};
```

- [ ] **Step 6: Add the folder dropdown button to the toolbar JSX**

The current toolbar is (around line 120):
```jsx
<div className="flex justify-between items-center mb-6">
  <h2 className="text-2xl font-bold text-white">My Commander Decks</h2>
  <div className="flex gap-2">
    <button onClick={() => setShowSleeveCalc(true)} ...>Calculate Sleeves</button>
    <button onClick={() => setShowCreateModal(true)} ...>New Deck</button>
    <button onClick={onImportClick} ...>Import Deck</button>
  </div>
</div>
```

Replace it with:
```jsx
<div className="flex justify-between items-center mb-4 flex-wrap gap-2">
  <div className="flex items-center gap-3">
    <h2 className="text-2xl font-bold text-white">My Decks</h2>
    {/* Folder dropdown button */}
    <div className="relative" onMouseDown={e => e.stopPropagation()}>
      <button
        onClick={() => setFolderDropdownOpen(o => !o)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
          activeFolderId
            ? 'bg-purple-600/40 border border-purple-500/50 text-purple-200'
            : 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/20'
        }`}
      >
        📁 {activeFolderId ? (folderPath[folderPath.length - 1]?.name || 'Folder') : 'All Decks'} ▾
      </button>
      {folderDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-white/20 rounded-lg shadow-2xl w-64 py-1 max-h-80 overflow-y-auto">
          {/* All Decks row */}
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm select-none ${
              !activeFolderId ? 'text-purple-300 bg-purple-600/20' : 'text-white/70 hover:bg-white/10'
            }`}
            onClick={() => handleFolderSelect(null)}
          >
            <span>🗂</span>
            <span>All Decks</span>
            <span className="ml-auto text-white/30 text-xs">{decks.length}</span>
          </div>
          {rootFolderTree.length > 0 && <div className="border-t border-white/10 my-1" />}
          {/* Recursive folder tree */}
          {rootFolderTree.map(folder => (
            <FolderTreeNode
              key={folder._id}
              folder={folder}
              depth={0}
              activeFolderId={activeFolderId}
              onSelect={handleFolderSelect}
              deckCountByFolder={deckCountByFolder}
            />
          ))}
          {/* Inline new folder */}
          <div className="border-t border-white/10 mt-1 pt-1 px-3 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs">📁</span>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); e.stopPropagation(); }}
                placeholder="New folder…"
                className="flex-1 bg-transparent text-white text-xs outline-none placeholder-white/25 py-1"
                onClick={e => e.stopPropagation()}
              />
              {newFolderName.trim() && (
                <button
                  onMouseDown={e => { e.preventDefault(); handleCreateFolder(); }}
                  className="text-purple-400 text-xs hover:text-purple-300 font-medium"
                >Add</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  <div className="flex gap-2 flex-wrap">
    <button onClick={() => setShowSleeveCalc(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Calculate Sleeves</button>
    <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"><Plus size={20} />New Deck</button>
    <button onClick={onImportClick} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"><Upload size={20} />Import Deck</button>
  </div>
</div>
```

- [ ] **Step 7: Add breadcrumb below the toolbar**

Add this JSX block immediately after the toolbar div (before the deck grid div):

```jsx
{/* Breadcrumb navigation */}
{activeFolderId && (
  <div className="flex items-center gap-1 text-sm text-white/60 mb-4 flex-wrap">
    <button
      onClick={() => setActiveFolderId(null)}
      className="hover:text-white transition"
    >All Decks</button>
    {folderPath.map((folder, i) => (
      <React.Fragment key={folder._id}>
        <span className="text-white/30">›</span>
        <button
          onClick={() => setActiveFolderId(folder._id)}
          className={`hover:text-white transition ${i === folderPath.length - 1 ? 'text-white font-semibold' : ''}`}
        >
          {folder.name}
        </button>
      </React.Fragment>
    ))}
  </div>
)}
```

- [ ] **Step 8: Replace the deck grid to use `visibleDecks` and show subfolder rows**

Find the deck grid section. It currently opens with:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {decks.map(deck => (
```

Replace the opening lines so it uses `visibleDecks` and prepend subfolder rows:

```jsx
{/* Subfolder rows when inside a folder */}
{activeSubfolders.length > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
    {activeSubfolders.map(folder => (
      <div
        key={folder._id}
        onClick={() => setActiveFolderId(folder._id)}
        className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20 hover:bg-white/10 transition cursor-pointer flex items-center gap-3"
      >
        <span className="text-3xl">📁</span>
        <div>
          <div className="text-white font-semibold">{folder.name}</div>
          <div className="text-white/40 text-sm">{deckCountByFolder[String(folder._id)] || 0} decks</div>
        </div>
      </div>
    ))}
  </div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {visibleDecks.map(deck => (
```

Also update the empty state at the bottom (currently `{decks.length === 0 && ...}`) to use `visibleDecks`:
```jsx
{visibleDecks.length === 0 && activeSubfolders.length === 0 && (
  <div className="text-center py-12 text-white/60">
    {activeFolderId
      ? 'No decks in this folder. Right-click a deck to move it here.'
      : 'No decks yet. Create or import your first deck to get started!'}
  </div>
)}
```

- [ ] **Step 9: Verify build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|warning|compiled"
```

Expected: compiled successfully (warnings OK, errors not OK).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/DeckList.js
git commit -m "feat: add folder dropdown, breadcrumb, subfolder rows, and deck filtering to DeckList"
```

---

## Task 6: Frontend — DeckList.js Context Menu + Move-to-Folder Modal

**Files:**
- Modify: `frontend/src/components/DeckList.js`

- [ ] **Step 1: Add `onContextMenu` to each deck card div**

Find the deck card `<div>` inside the `visibleDecks.map(deck => (` block. It currently looks like:
```jsx
<div
  key={deck._id}
  className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 hover:bg-white/15 transition cursor-pointer"
  onClick={() => onViewDeck(deck)}
>
```

Add `onContextMenu` to it:
```jsx
<div
  key={deck._id}
  className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 hover:bg-white/15 transition cursor-pointer"
  onClick={() => onViewDeck(deck)}
  onContextMenu={e => { e.preventDefault(); setContextMenu({ deck, x: e.clientX, y: e.clientY }); }}
>
```

- [ ] **Step 2: Add context menu overlay**

Add this JSX block just before the closing `</div>` of the outermost return div (just before or after the Create Deck Modal):

```jsx
{/* Right-click context menu */}
{contextMenu && (
  <div
    className="fixed z-[60] bg-gray-900 border border-white/20 rounded-lg shadow-2xl py-1 w-48"
    style={{ top: contextMenu.y, left: contextMenu.x }}
    onClick={e => e.stopPropagation()}
  >
    <button
      className="w-full text-left px-4 py-2 text-white/80 hover:bg-purple-600/30 hover:text-white text-sm flex items-center gap-2 transition"
      onClick={() => { setMovingDeck(contextMenu.deck); setMoveTarget(contextMenu.deck.folderId || null); setContextMenu(null); }}
    >
      📂 Move to folder…
    </button>
    <div className="border-t border-white/10 my-1" />
    <button
      className="w-full text-left px-4 py-2 text-red-400/80 hover:bg-red-600/20 hover:text-red-300 text-sm flex items-center gap-2 transition"
      onClick={() => { onDeleteDeck(contextMenu.deck._id); setContextMenu(null); }}
    >
      🗑 Delete deck
    </button>
  </div>
)}
```

- [ ] **Step 3: Add move-to-folder modal**

Add this JSX block after the context menu overlay (still inside the outermost div):

```jsx
{/* Move to folder modal */}
{movingDeck && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-gray-900 border border-white/20 rounded-xl p-6 w-full max-w-sm shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">Move to Folder</h3>
        <button onClick={() => { setMovingDeck(null); setMoveTarget(undefined); }} className="text-white/40 hover:text-white transition">
          <X size={18} />
        </button>
      </div>
      <p className="text-white/60 text-sm mb-4">
        Moving: <span className="text-white font-medium">{movingDeck.name}</span>
      </p>
      <div className="space-y-0.5 max-h-60 overflow-y-auto mb-4 border border-white/10 rounded-lg p-1">
        {/* Root / no folder option */}
        <button
          onClick={() => setMoveTarget(null)}
          className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition ${
            moveTarget === null ? 'bg-purple-600/30 text-purple-300' : 'text-white/60 hover:bg-white/10'
          }`}
        >
          ⬜ (root — no folder)
          {!movingDeck.folderId && <span className="ml-auto text-xs text-white/30">current</span>}
        </button>
        {/* All folders, flat with indent */}
        {flatFolderList.map(({ folder, depth }) => (
          <button
            key={folder._id}
            onClick={() => setMoveTarget(folder._id)}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            className={`w-full text-left pr-3 py-2 rounded text-sm flex items-center gap-2 transition ${
              String(moveTarget) === String(folder._id)
                ? 'bg-purple-600/30 text-purple-300'
                : 'text-white/70 hover:bg-white/10'
            }`}
          >
            📁 {folder.name}
            {String(movingDeck.folderId) === String(folder._id) && (
              <span className="ml-auto text-xs text-white/30">current</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { setMovingDeck(null); setMoveTarget(undefined); }}
          className="flex-1 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleMoveToFolder}
          disabled={moveTarget === undefined}
          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition"
        >
          Move Here
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify build compiles with no errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "^(ERROR|Failed|error TS)"
```

Expected: no output (no errors).

- [ ] **Step 5: Manual test in browser**
  - Open the deck builder
  - Click the "📁 All Decks ▾" button → dropdown appears
  - Type a folder name in the inline input → press Enter → folder appears in dropdown
  - Click the folder → breadcrumb shows "All Decks › FolderName"
  - Right-click any deck card → context menu appears with "Move to folder…"
  - Click "Move to folder…" → picker opens → select the folder → click "Move Here" → deck disappears from "All Decks" root view (still visible when folder is selected)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DeckList.js
git commit -m "feat: add right-click context menu and move-to-folder modal to DeckList"
```

---

## Task 7: Frontend — App.js "Deck Folders" Settings Tab

**Files:**
- Modify: `frontend/src/App.js`

**Context:** The Settings modal is an inline `SettingsView` component starting around line 2787. Tabs are defined in an array at line ~2860 with ids: `display`, `pricing`, `features`, `data`, `locations`, `tags`, `privacy`, `portfolio`. The `PortfolioTab` component is defined at module level (line 143) and used inside `SettingsView`. We follow the same pattern.

- [ ] **Step 1: Add `DeckFoldersTab` component at module level in `App.js`**

Find the `PortfolioTab` function (line ~143). Add this new component immediately **before** `PortfolioTab`:

```jsx
function DeckFoldersTab() {
  const [folders, setFolders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState(null);
  const [editingName, setEditingName] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [newFolderParent, setNewFolderParent] = React.useState('');

  const fetchFolders = async () => {
    try {
      const res = await axios.get(`${API_URL}/deck-folders`);
      setFolders(res.data);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { fetchFolders(); }, []);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${API_URL}/deck-folders`, {
        name: newFolderName.trim(),
        parentId: newFolderParent || null
      });
      setNewFolderName('');
      setNewFolderParent('');
      fetchFolders();
    } catch (err) {
      alert('Failed to create folder: ' + (err.response?.data?.message || err.message));
    }
  };

  const renameFolder = async (id) => {
    if (!editingName.trim()) return;
    try {
      await axios.put(`${API_URL}/deck-folders/${id}`, { name: editingName.trim() });
      setEditingId(null);
      fetchFolders();
    } catch (err) {
      alert('Failed to rename: ' + (err.response?.data?.message || err.message));
    }
  };

  const deleteFolder = async (id, name) => {
    if (!window.confirm(`Deleting "${name}" will move its decks to root. Continue?`)) return;
    try {
      await axios.delete(`${API_URL}/deck-folders/${id}`);
      fetchFolders();
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    }
  };

  // Flat depth-first list for display
  const flatList = React.useMemo(() => {
    const result = [];
    function walk(parentId, depth) {
      folders
        .filter(f => String(f.parentId || null) === String(parentId || null))
        .forEach(f => { result.push({ folder: f, depth }); walk(f._id, depth + 1); });
    }
    walk(null, 0);
    return result;
  }, [folders]);

  if (loading) return <div className="text-white/50 text-center py-8">Loading folders…</div>;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Deck Folders</h2>

      {flatList.length === 0 ? (
        <p className="text-white/40 text-sm mb-4">No folders yet. Create one below.</p>
      ) : (
        <div className="space-y-0.5 mb-6">
          {flatList.map(({ folder, depth }) => (
            <div
              key={folder._id}
              className="flex items-center gap-2 py-1.5 text-sm"
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              <span className="text-white/50">📁</span>
              {editingId === folder._id ? (
                <>
                  <input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameFolder(folder._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-white/10 border border-white/30 rounded px-2 py-0.5 text-white text-sm outline-none focus:border-purple-400"
                    autoFocus
                  />
                  <button onClick={() => renameFolder(folder._id)} className="text-green-400 text-xs hover:text-green-300 px-1">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-white/40 text-xs hover:text-white px-1">✕</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white">{folder.name}</span>
                  <button
                    onClick={() => { setEditingId(folder._id); setEditingName(folder.name); }}
                    className="text-white/40 hover:text-white text-xs px-1 transition"
                    title="Rename"
                  >✏️</button>
                  <button
                    onClick={() => deleteFolder(folder._id, folder.name)}
                    className="text-red-400/60 hover:text-red-400 text-xs px-1 transition"
                    title="Delete"
                  >🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white/70 text-sm font-medium mb-3">New Folder</h3>
        <input
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createFolder(); }}
          placeholder="Folder name"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none placeholder-white/30 focus:border-white/40 mb-2"
        />
        <div className="flex gap-2">
          <select
            value={newFolderParent}
            onChange={e => setNewFolderParent(e.target.value)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-white/40"
          >
            <option value="">Root (no parent)</option>
            {folders.map(f => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={createFolder}
            disabled={!newFolderName.trim()}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "Deck Folders" to the Settings tabs array**

Find the tabs array at line ~2860:
```js
[
  { id: 'display', label: 'Display' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'features', label: 'Features' },
  { id: 'data', label: 'Data' },
  { id: 'locations', label: 'Locations' },
  { id: 'tags', label: 'Tags' },
  { id: 'privacy', label: 'Privacy & Sharing' },
  { id: 'portfolio', label: 'Portfolio' },
]
```

Add the new tab after `'portfolio'`:
```js
  { id: 'folders', label: 'Deck Folders' },
```

- [ ] **Step 3: Add the tab content block**

Find the Portfolio tab block (around line 3686):
```jsx
{/* Portfolio Tab */}
{settingsTab === 'portfolio' && (
  <PortfolioTab />
)}
```

Add this block immediately after it:
```jsx
{/* Deck Folders Tab */}
{settingsTab === 'folders' && (
  <DeckFoldersTab />
)}
```

- [ ] **Step 4: Verify build compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "^(ERROR|Failed|error TS)"
```

Expected: no output.

- [ ] **Step 5: Manual test**
  - Open Settings (gear icon) → click "Deck Folders" tab
  - Create a folder with a parent → see it indented under the parent
  - Rename a folder → verify the name updates
  - Delete a folder → confirm dialog → folder removed
  - Navigate to Deck Builder → folder still visible (DeckBuilder re-fetches on mount)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: add Deck Folders settings tab with create/rename/delete management"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Dropdown filter button ("📁 Folders ▾") in DeckList toolbar — Task 5 Step 6
- ✅ Unlimited nesting — `buildFolderTree` is recursive with no depth limit
- ✅ Right-click context menu → "Move to folder…" — Task 6 Steps 1–2
- ✅ Inline "+" at bottom of dropdown — Task 5 Step 6
- ✅ "Deck Folders" tab in Settings — Task 7
- ✅ Uncategorized decks visible in "All Decks", hidden in specific folder — `visibleDecks` useMemo in Task 5 Step 3
- ✅ Direct decks + immediate child subfolder rows — Task 5 Steps 7–8
- ✅ Breadcrumb with clickable segments — Task 5 Step 7
- ✅ Delete cascade (descendants + deck reassignment to root) — Task 2 Step 1 `getDescendantIds` helper
- ✅ `PUT /decks/:id/folder` validates folder ownership — Task 3 Step 2
- ✅ Deck count badges (direct children only) — `deckCountByFolder` useMemo in Task 5 Step 3

**Placeholder scan:** None found.

**Type consistency:** `folderId` used consistently across all tasks. `buildFolderTree` defined in Task 5 and referenced only in Task 5. `getFolderPath` defined in Task 5 and referenced only in Task 5.

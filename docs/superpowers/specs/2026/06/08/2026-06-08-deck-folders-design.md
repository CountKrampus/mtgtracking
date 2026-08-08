# Deck Folders Design — 2026-06-08

## Overview

Folder/subfolder organization for the Deck Builder, with a file-browser navigation model. Decks can be placed into folders, folders nest to unlimited depth, and the deck list shows the current folder's direct decks plus immediate child subfolders as clickable rows.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Layout | Dropdown filter button ("📁 Folders ▾") in DeckList toolbar |
| Nesting | Unlimited depth |
| Move decks | Right-click context menu on deck card → "Move to folder…" |
| Folder creation | Inline "+" at bottom of dropdown tree |
| Folder manage | "Deck Folders" tab in Settings modal (rename, delete, create) |
| Uncategorized decks | Visible in "All Decks", hidden when a specific folder is active |
| Viewing a folder | Shows direct decks + immediate child subfolder rows (drill-down) |

---

## Backend

### 1. New Model: `backend/models/DeckFolder.js`

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
deckFolderSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });

module.exports = mongoose.model('DeckFolder', deckFolderSchema);
```

### 2. Deck Model Change (`backend/models/Deck.js`)

Add one field:
```js
folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeckFolder', default: null }
```

### 3. New Routes: `backend/routes/deckFolders.js`

All routes use `requireAuth`. All queries are scoped to `getUserId(req)`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/deck-folders` | Return flat array of all folders for user |
| `POST` | `/api/deck-folders` | Create folder. Body: `{ name, parentId? }` |
| `PUT` | `/api/deck-folders/:id` | Rename folder. Body: `{ name }` |
| `DELETE` | `/api/deck-folders/:id` | Delete folder (see behavior below) |

**DELETE behavior:**
- Find all descendant folder IDs (recursive via repeated queries or in-memory after fetching all)
- Set `folderId = null` on all Decks where `folderId` is in the descendant set or equals the deleted folder
- Delete all descendant DeckFolder documents
- Delete the target DeckFolder document

### 4. Deck Routes Change (`backend/routes/decks.js`)

Add one endpoint:

```
PUT /api/decks/:id/folder   body: { folderId }   (null = move to root)
```

Sets `deck.folderId = folderId` and saves. Validates that `folderId` belongs to the same user if non-null.

### 5. Register in `backend/server.js`

```js
const deckFolderRoutes = require('./routes/deckFolders');
app.use('/api/deck-folders', deckFolderRoutes);
```

---

## Frontend

### DeckList.js changes

**New state:**
```js
const [folders, setFolders] = useState([]);          // flat list from API
const [activeFolderId, setActiveFolderId] = useState(null);  // null = All Decks
const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
const [contextMenu, setContextMenu] = useState(null);  // { deckId, x, y }
const [movingDeck, setMovingDeck] = useState(null);    // deck being moved
```

**Fetch folders on mount:**
```js
useEffect(() => {
  axios.get(`${API_URL}/deck-folders`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => setFolders(r.data))
    .catch(() => {});
}, []);
```

**Folder tree builder (pure function):**
```js
function buildTree(folders, parentId = null) {
  return folders
    .filter(f => String(f.parentId || null) === String(parentId))
    .map(f => ({ ...f, children: buildTree(folders, f._id) }));
}
```

**Deck count per folder (direct children only):**
```js
const deckCountByFolder = useMemo(() => {
  const map = {};
  decks.forEach(d => {
    if (d.folderId) map[d.folderId] = (map[d.folderId] || 0) + 1;
  });
  return map;
}, [decks]);
```

**Filtered deck list:**
- `activeFolderId === null`: show all decks (no filtering)
- `activeFolderId !== null`: show only `deck.folderId === activeFolderId`

**Subfolder rows (shown above deck cards when inside a folder):**
```js
const activeSubfolders = useMemo(() =>
  folders.filter(f => String(f.parentId || null) === String(activeFolderId || null) && activeFolderId !== null),
  [folders, activeFolderId]
);
```

When `activeFolderId !== null`, render subfolder rows above the deck grid:
```jsx
{activeSubfolders.map(folder => (
  <div key={folder._id} onClick={() => setActiveFolderId(folder._id)}
    className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
    <span>📁</span>
    <span className="text-white font-medium">{folder.name}</span>
    <span className="ml-auto text-white/40 text-xs">{deckCountByFolder[folder._id] || 0} decks</span>
  </div>
))}
```

**Breadcrumb navigation:**
Show path when inside a folder: "All Decks › Commander › Competitive"
```js
function getFolderPath(folders, folderId) {
  const path = [];
  let current = folders.find(f => f._id === folderId);
  while (current) {
    path.unshift(current);
    current = folders.find(f => f._id === current.parentId);
  }
  return path;
}
```

**Folder dropdown contents:**
- "🗂 All Decks" row at top (resets `activeFolderId` to null)
- Separator
- Recursive tree of folders with collapse/expand chevrons
- Inline "+" input row at bottom for quick folder creation (creates at root level)
- Clicking a folder: sets `activeFolderId`, closes dropdown

**Inline folder creation in dropdown:**
- Shows a text input at the bottom of the dropdown
- On Enter or "Add" click: `POST /api/deck-folders` with `{ name, parentId: null }`
- Refreshes folder list

**Context menu on deck card:**
- Right-click (`onContextMenu`) on the deck card outer div
- `e.preventDefault()`, `setContextMenu({ deckId: deck._id, x: e.clientX, y: e.clientY })`
- Renders a fixed-position `div` with:
  - "📂 Move to folder…" → opens move picker (`setMovingDeck(deck)`)
  - "✏️ Rename deck" → (existing inline rename or prompt)
  - divider
  - "🗑 Delete deck" → calls existing `onDeleteDeck`
- Click-outside closes context menu

**Move to folder picker:**
- Modal triggered by `movingDeck !== null`
- Shows flat indented list of all folders + "(root — no folder)" at top
- Current folder highlighted
- Clicking a row selects it; "Move Here" button calls `PUT /api/decks/:id/folder`
- On success: refresh decks list, close modal

---

## Settings Modal — "Deck Folders" Tab

**Location:** New tab in the existing Settings modal (alongside Profile, Privacy, Pricing, Portfolio).

**Tab label:** "Deck Folders"

**Contents:**
- Recursive tree view of all folders
- Each row: folder name (indented by depth) + ✏️ (rename inline) + 🗑 (delete with confirmation)
- "+ New Folder" button at bottom → inline input row for name + parent picker (dropdown of existing folders or "root")
- On delete: confirm dialog "Deleting this folder will move its decks to root. Continue?"

---

## Key Behaviors

1. **Delete folder:** All decks in the deleted folder and all descendants are moved to root (`folderId = null`). All descendant folders are also deleted.
2. **Deck in "All Decks" view:** Uncategorized decks (no folderId) are always visible. Foldered decks are also visible in "All Decks".
3. **Deck count badges:** Show direct-child deck count only (not recursive).
4. **Folder selected → subfolder rows appear:** Immediate child subfolders are shown as clickable rows above the deck grid, enabling drill-down navigation.
5. **Breadcrumb:** Shows full path when inside a folder, each segment clickable to navigate up.
6. **No empty-folder restriction:** Empty folders are allowed and persist until manually deleted.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `backend/models/DeckFolder.js` | New model |
| `backend/models/Deck.js` | Add `folderId` field |
| `backend/routes/deckFolders.js` | New routes file (GET, POST, PUT, DELETE) |
| `backend/routes/decks.js` | Add `PUT /:id/folder` endpoint |
| `backend/server.js` | Register `deckFolderRoutes` |
| `frontend/src/components/DeckList.js` | Folder dropdown, subfolder rows, breadcrumb, context menu, move picker |
| `frontend/src/App.js` | Add "Deck Folders" tab to Settings modal; pass folder refresh callbacks to DeckList |

---

## Verification

1. Create a folder "Commander" → verify it appears in the dropdown tree
2. Create a subfolder "Competitive" inside "Commander" → verify nested display
3. Right-click a deck → "Move to folder…" → move it to "Commander" → verify it appears under Commander and disappears from "All Decks" root view (still shows in "All Decks" global view)
4. Click "Commander" in dropdown → see deck + "Competitive" subfolder row
5. Click "Competitive" subfolder row → drill into it, see correct deck count
6. In Settings → Deck Folders: rename "Casual" to "Budget" → verify label updates everywhere
7. Delete "Commander" folder → verify decks moved to root, subfolder "Competitive" also deleted
8. Breadcrumb shows "All Decks › Commander › Competitive" when inside nested folder; clicking "Commander" navigates back up

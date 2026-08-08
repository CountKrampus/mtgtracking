# App.js Refactor / Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break `frontend/src/App.js` (5,806 lines) into focused, maintainable files by extracting inline components, creating domain contexts, splitting view JSX, and replacing the `currentView` state machine with React Router so each view has its own URL (`/collection`, `/forum`, `/decks`, etc.).

**Architecture:** Three domain contexts (`CardCollectionContext`, `WishlistContext`, `LocationTagContext`) hold state and handlers; extracted view components (`CollectionView`, `WishlistView`, `SettingsView`) read from those contexts; React Router v6 `<Routes>` replaces the `currentView` state machine; `App.js` becomes a ~400-line layout shell with a `<Routes>` block. Each task leaves the app fully functional and is committed independently.

**Tech Stack:** React 18, React Router v6 (`react-router-dom`), React Context API, Tailwind CSS, axios.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/App.js` | Modify (shrink 5806→~500 lines) | Layout shell, navigation state, view routing |
| `frontend/src/components/SettingsView.js` | **Create** | Settings page with tabs (extracted from inside `App()`, fixes remount bug) |
| `frontend/src/components/DeckFoldersTab.js` | **Create** | Deck folder tree UI (already module-scope in App.js, move to own file) |
| `frontend/src/components/SparklinePopup.js` | **Create** | SVG price sparkline popup (already module-scope in App.js, move to own file) |
| `frontend/src/contexts/CardCollectionContext.js` | **Create** | `cards` array, CRUD handlers, price update, tag handlers, hover state |
| `frontend/src/contexts/WishlistContext.js` | **Create** | Wishlist items, all wishlist handlers, wishlist form state |
| `frontend/src/contexts/LocationTagContext.js` | **Create** | Locations list, tags list, create/update/delete handlers, `locationStats` |
| `frontend/src/components/CollectionView.js` | **Create** | Entire collection view JSX: filter bar, add-card form, table, feature panels |
| `frontend/src/components/WishlistView.js` | **Create** | Wishlist view JSX |
| `frontend/src/components/ForumView.js` | **Create** | Forum navigation state + routing JSX (Task 10) |
| `frontend/src/components/Sidebar.js` | Modify | Replace `setCurrentView` calls with React Router `<Link>` / `useNavigate` |

---

## Task 1: Extract `SettingsView` to its own file (bug fix)

**Why first:** `SettingsView` is currently defined as `const SettingsView = ({...}) => {}` INSIDE `App()` (line 2513). This is a React anti-pattern — a component defined inside another component's render body gets remounted on every parent render, causing input focus loss and state reset. This is the highest-priority fix.

**Files:**
- Create: `frontend/src/components/SettingsView.js`
- Modify: `frontend/src/App.js` (remove inline definition, add import)

---

- [ ] **Step 1: Create `frontend/src/components/SettingsView.js`**

In App.js, `SettingsView` starts at line 2513 with `const SettingsView = ({` and ends at line 3020 with `};`. Extract the entire body, convert it to a named export, and add the required imports.

```js
import React from 'react';
import axios from 'axios';
import { Settings } from 'lucide-react';
import QRCode from 'qrcode';
import { API_URL } from '../config';
import DeckFoldersTab from './DeckFoldersTab';

export default function SettingsView({
  settings, updateSettings, resetSettings, formatPrice,
  locations, availableTags, locationStats,
  newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
  editingLocation, handleCreateLocation, handleUpdateLocation, cancelEditLocation,
  startEditLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
  newTagName, setNewTagName, handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  generateQR, qrDataUrls, setQrDataUrls, setQRPreviewLocation, setShowQRPreview, setShowPrintLabels
}) {
  // ... paste the full body from App.js lines 2522–3019 here (everything between the arrow and the closing `};`)
  // The body starts with: const [settingsTab, setSettingsTab] = React.useState('display');
  // The body ends with: the closing brace of the return statement
}
```

**Important:** The `DeckFoldersTab` usage inside `SettingsView` (in the "Deck Folders" tab JSX) currently references the module-scope `DeckFoldersTab` from App.js. After Task 2 extracts `DeckFoldersTab` to its own file, update this import. For now, leave the reference and it will resolve after Task 2.

- [ ] **Step 2: Remove `SettingsView` definition from App.js**

Delete lines 2513–3020 from `frontend/src/App.js` (the `const SettingsView = ({...}) => { ... };` block).

- [ ] **Step 3: Add import to App.js**

At the top of App.js, in the local-components import block, add:

```js
import SettingsView from './components/SettingsView';
```

- [ ] **Step 4: Verify**

Run `npm start` from `frontend/`. Open Settings view. Click each tab (Display, Pricing, Features, Data, Locations, Tags, Deck Folders). Type in an input field — confirm the input does NOT lose focus on each keystroke. All tabs should render without errors in the browser console.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsView.js frontend/src/App.js
git commit -m "refactor: extract SettingsView to own file, fix component-in-render remount bug"
```

---

## Task 2: Extract `DeckFoldersTab` to its own file

**Files:**
- Create: `frontend/src/components/DeckFoldersTab.js`
- Modify: `frontend/src/App.js` (remove definition, add import)

---

- [ ] **Step 1: Create `frontend/src/components/DeckFoldersTab.js`**

`DeckFoldersTab` is defined at App.js lines 141–291. It is already at module scope (not inside `App()`), so it doesn't have the remount bug — but it makes App.js large. Move it verbatim:

```js
import React from 'react';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import { API_URL } from '../config';

export default function DeckFoldersTab() {
  const { addToast } = useToast();
  // ... paste lines 142–291 from App.js here (everything after `function DeckFoldersTab() {`)
  // The body starts with: const [folders, setFolders] = React.useState([]);
}
```

Note: `useToast` is already being called inside the body (lines 170, 181, 191 use `addToast`) — the import above is how to make it available since this is now module-scope.

- [ ] **Step 2: Remove from App.js**

Delete lines 141–291 from App.js (the `function DeckFoldersTab() { ... }` block).

- [ ] **Step 3: Add import to App.js**

```js
import DeckFoldersTab from './components/DeckFoldersTab';
```

- [ ] **Step 4: Update SettingsView.js import (if Task 1 is done)**

In `frontend/src/components/SettingsView.js`, verify the `DeckFoldersTab` import points to `./DeckFoldersTab` (not App.js). The import added in Task 1 Step 1 already does this.

- [ ] **Step 5: Verify**

Run `npm start`. Open Settings → Deck Folders tab. Confirm the folder tree renders and the create/rename/delete buttons work.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DeckFoldersTab.js frontend/src/App.js frontend/src/components/SettingsView.js
git commit -m "refactor: extract DeckFoldersTab component to own file"
```

---

## Task 3: Extract `SparklinePopup` to its own file

**Files:**
- Create: `frontend/src/components/SparklinePopup.js`
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Create `frontend/src/components/SparklinePopup.js`**

`SparklinePopup` is at App.js lines 292–337. It takes a `sparkline` prop and renders an SVG price graph. It has no external dependencies beyond React.

```js
import React from 'react';

export default function SparklinePopup({ sparkline }) {
  // ... paste lines 293–337 from App.js here (everything after `function SparklinePopup({ sparkline }) {`)
  // Body starts with: const w = 200, h = 80, pad = 8;
}
```

- [ ] **Step 2: Remove from App.js**

Delete lines 292–337 from App.js.

- [ ] **Step 3: Add import to App.js**

```js
import SparklinePopup from './components/SparklinePopup';
```

- [ ] **Step 4: Verify**

Run `npm start`. Hover over a card price cell in the collection table. Confirm the sparkline popup appears. (If no cards have price history, this may not be testable — check the browser console for no errors.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SparklinePopup.js frontend/src/App.js
git commit -m "refactor: extract SparklinePopup component to own file"
```

---

## Task 4: Create `CardCollectionContext`

This context holds the `cards` array, price update logic, tag handlers (add/remove per card), hover state, and the `handleBulkImport` function. It does NOT hold filter/sort/pagination state (those stay local to `CollectionView` in Task 7).

**Design decision — `handleEdit` and `handleCancel` stay in `CollectionView`:** These two handlers write to `formData`, `typesInputValue`, `tagsInputValue`, `showAddForm`, and `showAutocomplete` — all local CollectionView state. They also write `editingId` which belongs in context. The correct split: context exposes `editingId` + `setEditingId` only. `handleEdit` and `handleCancel` are defined inside `CollectionView` in Task 7, calling `setEditingId` from context alongside local setters.

**Files:**
- Create: `frontend/src/contexts/CardCollectionContext.js`
- Modify: `frontend/src/App.js` (wrap with provider, replace `useState`/handlers with context reads)

---

- [ ] **Step 1: Create `frontend/src/utils/auth.js` first**

Create this file before the context so the import resolves:

```js
export function getAuthHeaders() {
  const token = localStorage.getItem('mtg_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

Also delete the existing `getAuthHeaders` function from App.js (around line 70) so it isn't duplicated.

- [ ] **Step 2: Create `frontend/src/contexts/CardCollectionContext.js`**

```js
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { API_URL } from '../config';
import { getAuthHeaders } from '../utils/auth';

const CardCollectionContext = createContext(null);

export function CardCollectionProvider({ children }) {
  const { addToast } = useToast();

  // ── Core card state ───────────────────────────────────────────────────────
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ── Hover / sparkline state ───────────────────────────────────────────────
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredCardPriceHistory, setHoveredCardPriceHistory] = useState([]);
  const [detailCard, setDetailCard] = useState(null);
  const [sparkline, setSparkline] = useState(null);
  const sparklineTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(sparklineTimerRef.current), []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchCards = async () => {
    // Copy verbatim from App.js `fetchCards` (around line 631)
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (formData, offlineMode) => {
    // Copy verbatim from App.js `handleSubmit` (around line 786)
  };

  // NOTE: handleEdit and handleCancel are NOT in this context.
  // They write to local CollectionView state (formData, typesInputValue, etc.).
  // They are defined in CollectionView in Task 7, using setEditingId from this context.

  const handleDelete = async (id) => {
    // Copy verbatim from App.js `handleDelete` (around line 859)
  };

  // ── Price ─────────────────────────────────────────────────────────────────
  const updateCardPrice = async (id) => {
    // Copy verbatim from App.js `updateCardPrice` (around line 901)
  };

  const updateAllPrices = async (forceUpdate, updateFullData) => {
    // Copy verbatim from App.js `updateAllPrices` (around line 912)
  };

  const updateAllOracleText = async () => {
    // Copy verbatim from App.js `updateAllOracleText` (around line 971)
  };

  // ── Tags (per-card) ───────────────────────────────────────────────────────
  const handleAddTag = async (cardId, newTag) => {
    // Copy verbatim from App.js `handleAddTag` (around line 945)
  };

  const handleRemoveTag = async (cardId, tag) => {
    // Copy verbatim from App.js `handleRemoveTag` (around line 960)
  };

  // ── Hover handlers ────────────────────────────────────────────────────────
  const handleCardHover = async (card) => {
    // Copy verbatim from App.js `handleCardHover` (around line 1002)
  };

  const handlePriceCellEnter = (e, card) => {
    // Copy verbatim from App.js `handlePriceCellEnter` (around line 813)
  };

  const handlePriceCellLeave = () => {
    // Copy verbatim from App.js `handlePriceCellLeave` (around line 832)
  };

  // ── Bulk import ───────────────────────────────────────────────────────────
  const handleBulkImport = async (event, offlineMode, setImportProgress, setIsImporting, setImportResults, setShowImportResults) => {
    // Copy verbatim from App.js `handleBulkImport` (around line 2188)
    // Note: this function updates import progress state that stays in App.js/CollectionView;
    // pass the setters as parameters or restructure to return results.
  };

  const value = useMemo(() => ({
    cards, setCards, loading, fetchCards,
    editingId, setEditingId,
    hoveredCard, setHoveredCard,
    hoveredCardPriceHistory, setHoveredCardPriceHistory,
    detailCard, setDetailCard,
    sparkline, setSparkline, sparklineTimerRef,
    handleSubmit, handleDelete,
    updateCardPrice, updateAllPrices, updateAllOracleText,
    handleAddTag, handleRemoveTag,
    handleCardHover, handlePriceCellEnter, handlePriceCellLeave,
    handleBulkImport,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cards, loading, editingId, hoveredCard, hoveredCardPriceHistory, detailCard, sparkline]);

  return (
    <CardCollectionContext.Provider value={value}>
      {children}
    </CardCollectionContext.Provider>
  );
}

export function useCardCollection() {
  const ctx = useContext(CardCollectionContext);
  if (!ctx) throw new Error('useCardCollection must be used inside CardCollectionProvider');
  return ctx;
}
```

**Note on `getAuthHeaders`:** App.js defines `getAuthHeaders` at the top of the file (around line 70). Extract it to `frontend/src/utils/auth.js` so all contexts can import it.

- [ ] **Step 2: Create `frontend/src/utils/auth.js`**

```js
export function getAuthHeaders() {
  const token = localStorage.getItem('mtg_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

Delete the duplicate `getAuthHeaders` function from App.js after creating this file. Update any imports in App.js and the new context.

- [ ] **Step 3: Implement all handler bodies**

For each handler stub in `CardCollectionContext.js`, copy the implementation verbatim from App.js. Find each one by searching for the function name. The key functions and their approximate App.js line numbers:

| Handler | App.js line |
|---------|-------------|
| `fetchCards` | ~631 |
| `handleSubmit` | ~786 |
| `handleDelete` | ~859 |
| `updateCardPrice` | ~901 |
| `updateAllPrices` | ~912 |
| `updateAllOracleText` | ~971 |
| `handleAddTag` | ~945 |
| `handleRemoveTag` | ~960 |
| `handleCardHover` | ~1002 |
| `handlePriceCellEnter` | ~813 |
| `handlePriceCellLeave` | ~832 |
| `handleBulkImport` | ~2188 |

- [ ] **Step 4: Wrap App with `CardCollectionProvider`**

In `frontend/src/App.js`, in the `AppWithAuth` function at the bottom:

```js
import { CardCollectionProvider } from './contexts/CardCollectionContext';

function AppWithAuth() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CardCollectionProvider>
          <AuthGuard>
            <App />
          </AuthGuard>
        </CardCollectionProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 5: Replace state and handlers in App.js with context reads**

At the top of `function App()`, add:

```js
const {
  cards, setCards, loading, fetchCards,
  editingId, setEditingId,
  hoveredCard, setHoveredCard, hoveredCardPriceHistory, setHoveredCardPriceHistory,
  detailCard, setDetailCard, sparkline, setSparkline, sparklineTimerRef,
  handleSubmit, handleDelete,
  updateCardPrice, updateAllPrices, updateAllOracleText,
  handleAddTag, handleRemoveTag,
  handleCardHover, handlePriceCellEnter, handlePriceCellLeave,
  handleBulkImport,
} = useCardCollection();
```

Then delete the corresponding `useState` declarations and handler definitions from App.js. The variable names stay the same, so no JSX changes are needed yet.

- [ ] **Step 6: Verify**

Run `npm start`. Add a card, edit it, delete it. Update a price. The collection should behave exactly as before. Check browser console for no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/contexts/CardCollectionContext.js frontend/src/utils/auth.js frontend/src/App.js
git commit -m "refactor: create CardCollectionContext, extract card CRUD + price + tag handlers"
```

---

## Task 5: Create `LocationTagContext`

This context holds the locations list, available tags, and all create/update/delete handlers for both.

**Files:**
- Create: `frontend/src/contexts/LocationTagContext.js`
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Create `frontend/src/contexts/LocationTagContext.js`**

```js
import React, { createContext, useContext, useState, useMemo } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { useCardCollection } from './CardCollectionContext';
import { getAuthHeaders } from '../utils/auth';
import { API_URL } from '../config';

const LocationTagContext = createContext(null);

export function LocationTagProvider({ children }) {
  const { addToast } = useToast();
  const { cards } = useCardCollection();

  // ── Locations ─────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);

  const locationStats = useMemo(() => {
    // Copy verbatim from App.js `locationStats` useMemo (around line 575)
    // Depends on cards (from CardCollectionContext) and locations
  }, [cards, locations]);

  const fetchLocations = async () => {
    // Copy verbatim from App.js `fetchLocations` (around line 649)
  };

  const handleCreateLocation = async () => {
    // Copy verbatim from App.js `handleCreateLocation` (around line 1016)
  };

  const handleUpdateLocation = async () => {
    // Copy verbatim from App.js `handleUpdateLocation` (around line 1036)
  };

  const handleDeleteLocation = async (locationId) => {
    // Copy verbatim from App.js `handleDeleteLocation` (around line 1055)
  };

  const handleToggleLocationIgnorePrice = async (locationId, currentValue) => {
    // Copy verbatim from App.js (around line 1125)
  };

  const startEditLocation = (loc) => setEditingLocation(loc);
  const cancelEditLocation = () => setEditingLocation(null);

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [availableTags, setAvailableTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');

  const fetchAvailableTags = async () => {
    // Copy verbatim from App.js `fetchAvailableTags` (around line 640)
  };

  const handleCreateTag = async () => {
    // Copy verbatim from App.js `handleCreateTag` (around line 1079)
  };

  const handleDeleteTag = async (tagName) => {
    // Copy verbatim from App.js `handleDeleteTag` (around line 1102)
  };

  const handleToggleTagIgnorePrice = async (tagName, currentValue) => {
    // Copy verbatim from App.js (around line 1115)
  };

  const value = useMemo(() => ({
    locations, setLocations, fetchLocations, locationStats,
    newLocationName, setNewLocationName,
    newLocationDesc, setNewLocationDesc,
    editingLocation, startEditLocation, cancelEditLocation,
    handleCreateLocation, handleUpdateLocation, handleDeleteLocation,
    handleToggleLocationIgnorePrice,
    availableTags, setAvailableTags, fetchAvailableTags,
    newTagName, setNewTagName,
    handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locations, locationStats, availableTags, editingLocation, newLocationName, newLocationDesc, newTagName]);

  return (
    <LocationTagContext.Provider value={value}>
      {children}
    </LocationTagContext.Provider>
  );
}

export function useLocationTag() {
  const ctx = useContext(LocationTagContext);
  if (!ctx) throw new Error('useLocationTag must be used inside LocationTagProvider');
  return ctx;
}
```

- [ ] **Step 2: Add `LocationTagProvider` to the provider tree in App.js**

```js
import { LocationTagProvider } from './contexts/LocationTagContext';

function AppWithAuth() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CardCollectionProvider>
          <LocationTagProvider>
            <AuthGuard>
              <App />
            </AuthGuard>
          </LocationTagProvider>
        </CardCollectionProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Replace state/handlers in App.js with `useLocationTag()` reads**

In `function App()`:

```js
const {
  locations, fetchLocations, locationStats,
  newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
  editingLocation, startEditLocation, cancelEditLocation,
  handleCreateLocation, handleUpdateLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
  availableTags, fetchAvailableTags,
  newTagName, setNewTagName,
  handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
} = useLocationTag();
```

Delete all corresponding `useState` declarations and handler function bodies from App.js.

- [ ] **Step 4: Update the initial `useEffect` that calls fetch functions**

The `useEffect` at line ~586 that calls `fetchCards()`, `fetchAvailableTags()`, `fetchLocations()`, `fetchWishlist()` should now only call `fetchCards()` — the location/tag fetches happen inside `LocationTagContext` via a mount effect.

Add to `LocationTagContext.js`:
```js
useEffect(() => {
  fetchLocations();
  fetchAvailableTags();
}, []);
```

Remove `fetchAvailableTags()` and `fetchLocations()` from App.js's mount `useEffect`.

- [ ] **Step 5: Verify**

Run `npm start`. Open Settings → Locations tab. Create, rename, and delete a location. Open Tags tab. Create and delete a tag. Confirm `locationStats` values in the QR preview are correct.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/LocationTagContext.js frontend/src/App.js
git commit -m "refactor: create LocationTagContext, extract location and tag state + handlers"
```

---

## Task 6: Create `WishlistContext`

**Files:**
- Create: `frontend/src/contexts/WishlistContext.js`
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Create `frontend/src/contexts/WishlistContext.js`**

```js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { useCardCollection } from './CardCollectionContext';
import { getAuthHeaders } from '../utils/auth';
import { API_URL } from '../config';

const WishlistContext = createContext(null);

const DEFAULT_WISHLIST_FORM = {
  name: '', targetPrice: '', currentPrice: '', priority: 'medium',
  notes: '', scryfallId: '', imageUrl: '',
};

export function WishlistProvider({ children }) {
  const { addToast } = useToast();
  const { fetchCards } = useCardCollection();

  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistFormData, setWishlistFormData] = useState(DEFAULT_WISHLIST_FORM);
  const [editingWishlistId, setEditingWishlistId] = useState(null);
  const [wishlistAutocompleteResults, setWishlistAutocompleteResults] = useState([]);
  const [showWishlistAutocomplete, setShowWishlistAutocomplete] = useState(false);
  const [wishlistFilterPriority, setWishlistFilterPriority] = useState('all');

  const fetchWishlist = async () => {
    // Copy verbatim from App.js `fetchWishlist` (around line 658)
  };

  const handleWishlistNameChange = async (value) => {
    // Copy verbatim from App.js `handleWishlistNameChange` (around line 1139)
  };

  const handleWishlistSubmit = async () => {
    // Copy verbatim from App.js `handleWishlistSubmit` (around line 1186)
  };

  const handleWishlistEdit = (item) => {
    // Copy verbatim from App.js `handleWishlistEdit` (around line 1206)
  };

  const handleWishlistDelete = async (id) => {
    // Copy verbatim from App.js `handleWishlistDelete` (around line 1226)
  };

  const handleWishlistCancel = () => {
    // Copy verbatim from App.js `handleWishlistCancel` (around line 1237)
  };

  const handleAcquireWishlistItem = async (id) => {
    // Copy verbatim from App.js `handleAcquireWishlistItem` (around line 1258)
    // Note: this calls fetchCards() after acquiring. Import useCardCollection to get fetchCards.
  };

  const updateAllWishlistPrices = async () => {
    // Copy verbatim from App.js `updateAllWishlistPrices` (around line 1272)
  };

  // Used by collection feature panels to add similar/synergy cards to wishlist
  const addToWishlist = async (scryfallCard) => {
    // Copy verbatim from App.js `addSimilarCardToWishlist` (around line 1526)
    // This is the shared "add a Scryfall card object to wishlist" helper
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const value = useMemo(() => ({
    wishlistItems, setWishlistItems, fetchWishlist,
    wishlistFormData, setWishlistFormData,
    editingWishlistId, setEditingWishlistId,
    wishlistAutocompleteResults, setWishlistAutocompleteResults,
    showWishlistAutocomplete, setShowWishlistAutocomplete,
    wishlistFilterPriority, setWishlistFilterPriority,
    handleWishlistNameChange, handleWishlistSubmit, handleWishlistEdit,
    handleWishlistDelete, handleWishlistCancel,
    handleAcquireWishlistItem, updateAllWishlistPrices,
    addToWishlist,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wishlistItems, wishlistFormData, editingWishlistId, wishlistAutocompleteResults, showWishlistAutocomplete, wishlistFilterPriority]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
```

- [ ] **Step 2: Add `WishlistProvider` to the provider tree**

```js
import { WishlistProvider } from './contexts/WishlistContext';

function AppWithAuth() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CardCollectionProvider>
          <LocationTagProvider>
            <WishlistProvider>
              <AuthGuard>
                <App />
              </AuthGuard>
            </WishlistProvider>
          </LocationTagProvider>
        </CardCollectionProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Replace state/handlers in App.js with `useWishlist()` reads**

```js
const {
  wishlistItems, fetchWishlist,
  wishlistFormData, setWishlistFormData,
  editingWishlistId, setEditingWishlistId,
  wishlistAutocompleteResults, setWishlistAutocompleteResults,
  showWishlistAutocomplete, setShowWishlistAutocomplete,
  wishlistFilterPriority, setWishlistFilterPriority,
  handleWishlistNameChange, handleWishlistSubmit, handleWishlistEdit,
  handleWishlistDelete, handleWishlistCancel,
  handleAcquireWishlistItem, updateAllWishlistPrices,
  addToWishlist,
} = useWishlist();
```

Delete corresponding `useState` declarations and handler definitions from App.js.

Also remove `fetchWishlist()` from App.js's mount `useEffect` (it now runs inside `WishlistProvider`).

- [ ] **Step 4: Verify**

Run `npm start`. Open Wishlist view. Add a wishlist item, edit it, delete it. Click "Acquire" on an item and confirm it appears in the collection.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/WishlistContext.js frontend/src/App.js
git commit -m "refactor: create WishlistContext, extract wishlist state + handlers"
```

---

## Task 7: Extract `CollectionView` component

This is the largest single task — the `{currentView === 'collection' && ...}` block in App.js spans roughly lines 3122–5496 (~2,370 lines). It contains the filter bar, add-card form, the card table (all columns, row rendering, hover, bulk selection, context menu), and all the feature panel modals (Similar Cards, Synergies, Commander Recs, Set Completion, Combo Finder, Print Preview, Camera Modal, Price Update Modal).

**Files:**
- Create: `frontend/src/components/CollectionView.js`
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Identify all state that stays local to CollectionView**

This state lives in App.js today but is ONLY used within the collection view. It will be declared inside `CollectionView` with `useState`:

| State var | Purpose |
|-----------|---------|
| `searchTerm`, `filterCondition`, `filterColor`, `filterType`, `filterSpecial`, `filterRarity`, `filterSet`, `filterTag`, `filterLocation` | Filter bar |
| `sortBy` | Table sort |
| `showAddForm`, `showFilters` | UI toggles |
| `currentPage` | Pagination |
| `searchIncludesOracleText` | Search option |
| `autocompleteResults`, `showAutocomplete` | Card name autocomplete |
| `manualEntry` | Manual entry mode |
| `offlineMode` | Import mode |
| `formData` | Add card form |
| `typesInputValue`, `tagsInputValue` | Form input temps |
| `showTagInput`, `newTag` | Inline tag editing |
| `selectedCards`, `bulkUpdateModal`, `bulkCondition`, `bulkLocation`, `bulkTags` | Bulk ops |
| `showPrintPreview` | Print proxy modal |
| `showSimilarCards`, `similarCardsSource`, `similarCards`, `loadingSimilar` | Similar cards panel |
| `showSynergies`, `synergiesSource`, `synergies`, `loadingSynergies`, `synergiesTab` | Synergies panel |
| `showCommanderRecs`, `commanderRecs`, `loadingCommanders`, `commanderColorFilter`, `commanderFinderMode`, `finderColors`, `finderThemes`, `finderCreatureType` | Commander recs |
| `showSetCompletion`, `setCompletionData`, `loadingSetCompletion` | Set completion |
| `showComboFinder`, `comboResults`, `loadingCombos`, `comboTab` | Combo finder |
| `showCameraModal` | Camera OCR |
| `forceUpdate`, `updateFullData`, `showPriceUpdateModal` | Price update modal |
| `importResults`, `showImportResults`, `importProgress`, `isImporting` | Import progress |
| `contextMenu` | Right-click menu |

Also, ALL of the handler functions that only touch local collection state (sort, filter, bulk ops, feature panels) move into `CollectionView`:

| Handler | Move to CollectionView |
|---------|----------------------|
| `handleCardNameChange` | yes |
| `selectAutocompleteCard` | yes |
| `searchScryfallManually` | yes |
| `handleOpenCamera`, `handleCameraClose`, `handleCardExtracted` | yes |
| `toggleColor` | yes |
| `toggleCardSelection`, `toggleSelectAllOnPage` | yes |
| `handleBulkUpdateCondition`, `handleBulkUpdateLocation`, `handleBulkAddTags`, `handleBulkRemoveTags`, `handleBulkDelete` | yes |
| `handlePrintProxies` | yes |
| All similar/synergy/commander/combo fetch + add functions | yes |
| `filteredCards` / `sortedCards` useMemo | yes |
| `paginatedCards` useMemo | yes |
| `totalCards`, `totalValue`, `ignoredValue` derivations | yes (or pass from context) |
| `updateAllWishlistPrices` call | from WishlistContext |

- [ ] **Step 2: Create `frontend/src/components/CollectionView.js`**

```js
import React, { useState, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Plus, /* ... all icons used */ } from 'lucide-react';
import { useCardCollection } from '../contexts/CardCollectionContext';
import { useLocationTag } from '../contexts/LocationTagContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useToast } from '../contexts/ToastContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import SparklinePopup from './SparklinePopup';
import { API_URL } from '../config';
import { standardTypes } from '../constants'; // see Step 3

export default function CollectionView({ fileInputRef }) {
  const { addToast } = useToast();
  const { user: authUser } = useAuthContext() || {};
  const { settings } = useSettings();
  const { visibleColumns, isColumnVisible, toggleColumn } = useColumnVisibility();

  const {
    cards, loading, editingId, setEditingId,
    hoveredCard, hoveredCardPriceHistory, detailCard, setDetailCard, sparkline, setSparkline, sparklineTimerRef,
    handleSubmit, handleEdit, handleDelete, handleCancel,
    updateCardPrice, updateAllPrices, updateAllOracleText,
    handleAddTag, handleRemoveTag,
    handleCardHover, handlePriceCellEnter, handlePriceCellLeave,
    handleBulkImport,
  } = useCardCollection();

  const { locations, availableTags } = useLocationTag();
  const { addToWishlist } = useWishlist();

  // ── Local state (filter / sort / form / feature panels) ──────────────────
  const [searchTerm, setSearchTerm] = useState('');
  // ... declare all local state vars from the list in Step 1

  const [formData, setFormData] = useState({
    name: '', set: '', setCode: '', collectorNumber: '', rarity: '',
    quantity: 1, condition: settings.defaultCondition, price: 0,
    colors: [], types: [], manaCost: '', scryfallId: '', imageUrl: '',
    isFoil: false, isToken: false, oracleText: '', tags: [], location: ''
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    // Copy verbatim from App.js (around line 2255)
    // Uses: cards, searchTerm, filterCondition, filterColor, filterType,
    //       filterSpecial, filterRarity, filterSet, filterTag, filterLocation,
    //       sortBy, searchIncludesOracleText
  }, [cards, searchTerm, filterCondition, filterColor, filterType, filterSpecial, filterRarity, filterSet, filterTag, filterLocation, sortBy, searchIncludesOracleText]);

  const paginatedCards = useMemo(() => {
    // Copy verbatim from App.js (around line 2393)
  }, [filteredCards, currentPage, settings.pageSize]);

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  const totalValue = cards.reduce((sum, c) => sum + (c.price * c.quantity), 0);

  // ── All local handlers ────────────────────────────────────────────────────
  const handleCardNameChange = async (value) => { /* copy from App.js ~678 */ };
  const selectAutocompleteCard = async (cardName) => { /* copy from App.js ~701 */ };
  // ... all other local handlers

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Copy the entire `{currentView === 'collection' && (...)}` JSX block from App.js,
          stripping the outer conditional wrapper.
          Roughly lines 3123–5496 of App.js. */}
    </>
  );
}
```

- [ ] **Step 3: Define `formatPrice` locally in CollectionView**

`formatPrice` is defined in App.js around line 2384 using `useCallback` and reads `settings.currency`. Since `CollectionView` already calls `const { settings } = useSettings()`, copy the `formatPrice` implementation directly into `CollectionView` — it is a pure formatting utility and does not need to be in context or a separate file.

```js
const formatPrice = useCallback((priceUSD) => {
  // Copy verbatim from App.js `formatPrice` (around line 2384)
  // Uses: settings.currency
}, [settings.currency]);
```

`SettingsView` already receives `formatPrice` as a prop (its signature in Task 1), so App.js continues to define and pass it there. `CollectionView` defines its own copy.

- [ ] **Step 4: Extract `standardTypes` constant to shared file**

`standardTypes` (defined at App.js line ~128) is used both in `CollectionView` (for filter dropdown) and by any context that needs it. Move it:

Create `frontend/src/constants.js`:
```js
export const standardTypes = [
  'Artifact', 'Battle', 'Conspiracy', 'Creature', 'Dungeon', 'Enchantment',
  'Instant', 'Kindred', 'Land', 'Phenomenon', 'Plane', 'Planeswalker',
  'Scheme', 'Sorcery', 'Vanguard',
];
```

Remove from App.js, import from `'../constants'` in `CollectionView.js` and anywhere else it's needed.

- [ ] **Step 4: Wire `fileInputRef` from App.js**

The file import `<input ref={fileInputRef}>` lives in App.js's main JSX (line ~3087). It needs to stay there (the hidden input is part of the layout), but the `onChange={handleBulkImport}` calls into the context. App.js passes `fileInputRef` as a prop to `CollectionView` so the "Import" button inside the collection view can trigger `fileInputRef.current?.click()`.

- [ ] **Step 5: Replace the `currentView === 'collection'` block in App.js**

Delete the entire block (lines ~3122–5496) and replace with:

```jsx
{currentView === 'collection' && (
  <CollectionView fileInputRef={fileInputRef} />
)}
```

Also import the component at the top of App.js:
```js
import CollectionView from './components/CollectionView';
```

- [ ] **Step 6: Verify**

Run `npm start`. Full smoke test of the collection view:
1. Add a card via Scryfall autocomplete
2. Filter by color, type, condition
3. Edit a card in-line
4. Click similar cards (layers icon) — panel should open with results
5. Bulk-select two cards and update their condition
6. Click "Update Prices" modal and verify force/full toggles work
7. Hover over a card name — image preview should appear
8. Import a small .txt file

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CollectionView.js frontend/src/constants.js frontend/src/App.js
git commit -m "refactor: extract CollectionView component (~2400 lines of JSX) from App.js"
```

---

## Task 8: Extract `WishlistView` component

The `{currentView === 'wishlist' && ...}` block (App.js lines ~5257–5496) becomes its own component.

**Files:**
- Create: `frontend/src/components/WishlistView.js`
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Create `frontend/src/components/WishlistView.js`**

```js
import React from 'react';
import { useWishlist } from '../contexts/WishlistContext';
import { useToast } from '../contexts/ToastContext';
import { useAuthContext } from '../contexts/AuthContext';
import { API_URL } from '../config';

export default function WishlistView() {
  const { addToast } = useToast();
  const { user: authUser } = useAuthContext() || {};
  const {
    wishlistItems, wishlistFormData, setWishlistFormData,
    editingWishlistId,
    wishlistAutocompleteResults, showWishlistAutocomplete,
    wishlistFilterPriority, setWishlistFilterPriority,
    handleWishlistNameChange, handleWishlistSubmit, handleWishlistEdit,
    handleWishlistDelete, handleWishlistCancel,
    handleAcquireWishlistItem, updateAllWishlistPrices,
  } = useWishlist();

  return (
    <>
      {/* Copy the entire `{currentView === 'wishlist' && (...)}` JSX block from App.js,
          stripping the outer conditional wrapper.
          Roughly lines 5258–5496 of App.js. */}
    </>
  );
}
```

- [ ] **Step 2: Replace block in App.js**

```jsx
{currentView === 'wishlist' && <WishlistView />}
```

- [ ] **Step 3: Verify**

Run `npm start`. Open Wishlist view. Add, edit, delete, and acquire a wishlist item.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/WishlistView.js frontend/src/App.js
git commit -m "refactor: extract WishlistView component from App.js"
```

---

## Task 9: Final App.js cleanup

After Tasks 1–8, App.js should be down to roughly 800–1,200 lines. This task removes any remaining dead code, ensures all imports are used, and documents what remains.

**Files:**
- Modify: `frontend/src/App.js`

---

- [ ] **Step 1: Remove unused `useState` declarations**

Search App.js for any `useState` that was moved to a context but not yet removed. Common stragglers: `forceUpdate`, `updateFullData`, `showPriceUpdateModal` (these were local to the price update modal — either they stay in App.js or move into `CardCollectionContext`).

For each stale declaration: confirm it's not referenced in any remaining JSX, then delete it.

- [ ] **Step 2: Remove unused imports**

Run the dev server and check the ESLint output for `no-unused-vars`. Remove any import that was only needed by code that's now in a context or extracted component.

- [ ] **Step 3: Move remaining forum-related state to ForumView (optional but recommended)**

The forum navigation state (`selectedCategoryId`, `selectedThreadId`, `forumRefreshKey`, `selectedForumProfileUsername`, `showForumLeaderboard`, `cosmeticVersion`) is only used inside the `currentView === 'forum'` block. Consider extracting a `ForumView` component that owns this state internally.

If doing this: create `frontend/src/components/ForumView.js`, move the state + the forum JSX block into it, replace the block in App.js with `<ForumView />`. This is optional — the forum state is only ~10 lines and doesn't cause bloat.

- [ ] **Step 4: Audit what remains in App.js**

After all tasks, App.js should contain only:
- Imports (~30 lines)
- `AppWithAuth` / provider tree (~20 lines)
- `function App()` containing:
  - Navigation state: `currentView`, `sidebarCollapsed`, `sidebarOpen`, `showCommandPalette`, `openPanel`
  - Auth UI state: `showAccountSettings`, `showAdminPanel`
  - Forum navigation state (if not extracted): ~10 vars
  - Price update modal state: `forceUpdate`, `updateFullData`, `showPriceUpdateModal`
  - QR/print state: `showQRPreview`, `qrPreviewLocation`, `qrDataUrls`, `showPrintLabels`
  - `fileInputRef`
  - Keyboard shortcut handler
  - URL routing for shared deck (`/shared/deck/:code`)
  - Layout JSX: top bar, sidebar, `<main>`, all `currentView === 'xxx'` routing
  - Global modals: AccountSettings, AdminPanel, CommandPalette, SpamFilterAdmin, MuteManager

Target: App.js under 700 lines.

- [ ] **Step 5: Verify full app**

Run `npm start`. Full end-to-end smoke test:
- Collection: add, edit, delete, filter, bulk ops, import, price update
- Wishlist: add, acquire
- Deck Builder: open, create deck
- Forum: navigate to category, open thread, post reply
- Settings: all tabs, location/tag management
- Dashboard: stats visible, navigation works
- Check browser console — zero errors

- [ ] **Step 6: Final commit**

```bash
git add frontend/src/App.js
git commit -m "refactor: final App.js cleanup, remove dead code and unused imports"
```

---

## Task 10: Add React Router — give each view its own URL

Replace the `currentView` state machine with React Router v6 so navigation looks like `https://mtgtracker.store/collection`, `/forum`, `/decks`, etc. The browser back/forward buttons will work, and users can deep-link directly to any view.

**Files:**
- Modify: `frontend/package.json` (add dependency)
- Modify: `frontend/src/App.js` (replace `currentView` state + all `{currentView === 'xxx'}` blocks with `<Routes>`)
- Modify: `frontend/src/components/Sidebar.js` (replace `setCurrentView` calls with `useNavigate` / `<Link>`)
- Create: `frontend/src/components/ForumView.js` (forum state + sub-routing, extracted from App.js)

**Route table:**

| URL path | Component |
|----------|-----------|
| `/` | Redirect → `/dashboard` |
| `/dashboard` | `<Dashboard>` |
| `/collection` | `<CollectionView>` |
| `/wishlist` | `<WishlistView>` |
| `/decks` | `<DeckBuilder>` |
| `/lifecounter` | `<LifeCounter>` |
| `/settings` | `<SettingsView>` |
| `/messages` | `<MessagesPage>` |
| `/profile` | My profile |
| `/forum` | `<ForumView>` |
| `/forum/profile/:username` | Forum profile |
| `/community-decks` | `<CommunityDecks>` |
| `/learn/card-rulings` | `<CardRulingsBrowser>` |
| `/learn/interaction-checker` | `<InteractionChecker>` |
| `/learn/new-player-guide` | `<NewPlayerGuide>` |
| `/learn/keyword-glossary` | `<KeywordGlossary>` |
| `/learn/combo-tutorials` | `<ComboTutorials>` |
| `/learn/format-guides` | `<FormatGuides>` |
| `/play/sealed-simulator` | `<SealedSimulator>` |
| `/play/archenemy` | `<ArchenemyMode>` |
| `/play/star-variant` | `<StarVariant>` |
| `/play/planechase` | `<PlanechaseMode>` |
| `/play/custom-format` | `<CustomFormatBuilder>` |
| `/tools/cube-builder` | `<CubeBuilder>` |
| `/tools/reprint-tracker` | `<ReprintTracker>` |
| `/tools/set-calendar` | `<SetReleaseCalendar>` |
| `/tools/spoilers` | `<SpoilerSeasonIntegration>` |
| `/shared/deck/:code` | `<SharedDeckView>` (public, no layout) |

**Forum internal navigation** (`/forum/category/:id`, `/forum/thread/:id`) stays as state inside `ForumView` — these are transient drill-downs, not pages users bookmark.

---

- [ ] **Step 1: Install `react-router-dom`**

```bash
cd frontend
npm install react-router-dom
```

- [ ] **Step 2: Wrap the app in `<BrowserRouter>`**

In `frontend/src/App.js`, update `AppWithAuth`:

```js
import { BrowserRouter } from 'react-router-dom';

function AppWithAuth() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CardCollectionProvider>
            <LocationTagProvider>
              <WishlistProvider>
                <AuthGuard>
                  <App />
                </AuthGuard>
              </WishlistProvider>
            </LocationTagProvider>
          </CardCollectionProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Extract `ForumView` component**

Create `frontend/src/components/ForumView.js`. Move all forum-related state and the forum JSX block from App.js into it. Internal category/thread navigation stays as state (not URL routes):

```js
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import ForumHome from './Forum/ForumHome';
import CategoryView from './Forum/CategoryView';
import ThreadView from './Forum/ThreadView';
import ForumLeaderboard from './Forum/ForumLeaderboard';
import ForumProfileView from './Forum/ForumProfileView';
import { API_URL } from '../config';

export default function ForumView() {
  const { user: authUser } = useAuthContext() || {};

  // Move these from App.js:
  const [selectedCategoryId, setSelectedCategoryId] = useState(() =>
    localStorage.getItem('forumSelectedCategory') || null
  );
  const [selectedThreadId, setSelectedThreadId] = useState(() =>
    localStorage.getItem('forumSelectedThread') || null
  );
  const [forumRefreshKey, setForumRefreshKey] = useState(0);
  const [cosmeticVersion, setCosmeticVersion] = useState(0);
  const [showForumLeaderboard, setShowForumLeaderboard] = useState(false);
  const [showSpamFilterAdmin, setShowSpamFilterAdmin] = useState(false);
  const [showMuteManager, setShowMuteManager] = useState(false);
  const [selectedForumProfileUsername, setSelectedForumProfileUsername] = useState(null);

  // Copy the forum JSX block verbatim from App.js (`{currentView === 'forum' && ...}`),
  // stripping the outer conditional. Roughly lines 5647–5710 of App.js before Task 9.
  return (
    <div className="flex flex-col h-full">
      {/* ... forum routing JSX ... */}
    </div>
  );
}
```

- [ ] **Step 4: Replace `currentView` state with `useNavigate` in App.js**

Remove:
```js
const [currentView, setCurrentView] = useState(() => {
  return localStorage.getItem('currentView') || 'dashboard';
});
```

Remove the `useEffect` that saves `currentView` to `localStorage` — React Router handles history natively.

Add at the top of `function App()`:
```js
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Inside App():
const navigate = useNavigate();
const location = useLocation();
```

- [ ] **Step 5: Replace all `setCurrentView` calls throughout App.js**

Every `setCurrentView('xxx')` becomes `navigate('/xxx')`. Common ones:

| Old | New |
|-----|-----|
| `setCurrentView('collection')` | `navigate('/collection')` |
| `setCurrentView('dashboard')` | `navigate('/dashboard')` |
| `setCurrentView('forum')` | `navigate('/forum')` |
| `setCurrentView('wishlist')` | `navigate('/wishlist')` |
| `setCurrentView('decks')` | `navigate('/decks')` |
| `setCurrentView('settings')` | `navigate('/settings')` |
| `setCurrentView('messages')` | `navigate('/messages')` |
| `setCurrentView('my-profile')` | `navigate('/profile')` |
| `setCurrentView('forum-profile')` | `navigate('/forum/profile/' + username)` |

Search for all `setCurrentView(` calls in App.js and Sidebar.js and replace them.

- [ ] **Step 6: Replace `{currentView === 'xxx' && ...}` blocks with `<Routes>`**

In App.js's main return, replace the entire `{currentView === 'xxx' && ...}` section inside `<main>` with:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';

<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={
    <Suspense fallback={<LoadingFallback />}>
      <Dashboard
        cards={cards}
        totalCards={totalCards}
        totalValue={totalValue}
        ignoredValue={ignoredValue}
        setCurrentView={(v) => navigate('/' + v)}
        onAddCard={() => navigate('/collection')}
        onImport={() => fileInputRef.current?.click()}
        onUpdatePrices={() => setShowPriceUpdateModal(true)}
        fileInputRef={fileInputRef}
        isImporting={isImporting}
        formatPrice={formatPrice}
      />
    </Suspense>
  } />
  <Route path="/collection" element={<CollectionView fileInputRef={fileInputRef} />} />
  <Route path="/wishlist" element={<WishlistView />} />
  <Route path="/decks" element={<Suspense fallback={<LoadingFallback />}><DeckBuilder /></Suspense>} />
  <Route path="/lifecounter" element={<Suspense fallback={<LoadingFallback />}><LifeCounter onBack={() => navigate('/dashboard')} /></Suspense>} />
  <Route path="/settings" element={<SettingsView {...settingsProps} />} />
  <Route path="/messages" element={authUser ? <MessagesPage user={authUser} onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />} />
  <Route path="/profile" element={authUser ? <UserProfile ... /> : <Navigate to="/dashboard" replace />} />
  <Route path="/forum" element={<ForumView />} />
  <Route path="/forum/profile/:username" element={<ForumProfilePage ... />} />
  <Route path="/community-decks" element={<CommunityDecks />} />
  <Route path="/learn/card-rulings" element={<Suspense fallback={<LoadingFallback />}><CardRulingsBrowser /></Suspense>} />
  <Route path="/learn/interaction-checker" element={<Suspense fallback={<LoadingFallback />}><InteractionChecker /></Suspense>} />
  <Route path="/learn/new-player-guide" element={<Suspense fallback={<LoadingFallback />}><NewPlayerGuide /></Suspense>} />
  <Route path="/learn/keyword-glossary" element={<Suspense fallback={<LoadingFallback />}><KeywordGlossary /></Suspense>} />
  <Route path="/learn/combo-tutorials" element={<Suspense fallback={<LoadingFallback />}><ComboTutorials /></Suspense>} />
  <Route path="/learn/format-guides" element={<Suspense fallback={<LoadingFallback />}><FormatGuides /></Suspense>} />
  <Route path="/play/sealed-simulator" element={<Suspense fallback={<LoadingFallback />}><SealedSimulator /></Suspense>} />
  <Route path="/play/archenemy" element={<Suspense fallback={<LoadingFallback />}><ArchenemyMode /></Suspense>} />
  <Route path="/play/star-variant" element={<Suspense fallback={<LoadingFallback />}><StarVariant /></Suspense>} />
  <Route path="/play/planechase" element={<Suspense fallback={<LoadingFallback />}><PlanechaseMode /></Suspense>} />
  <Route path="/play/custom-format" element={<Suspense fallback={<LoadingFallback />}><CustomFormatBuilder /></Suspense>} />
  <Route path="/tools/cube-builder" element={<Suspense fallback={<LoadingFallback />}><CubeBuilder /></Suspense>} />
  <Route path="/tools/reprint-tracker" element={<Suspense fallback={<LoadingFallback />}><ReprintTracker /></Suspense>} />
  <Route path="/tools/set-calendar" element={<Suspense fallback={<LoadingFallback />}><SetReleaseCalendar /></Suspense>} />
  <Route path="/tools/spoilers" element={<Suspense fallback={<LoadingFallback />}><SpoilerSeasonIntegration /></Suspense>} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

Define a shared `LoadingFallback` once near the top of App.js:
```js
const LoadingFallback = () => (
  <div className="flex items-center justify-center py-20 text-white/50">Loading...</div>
);
```

The `/shared/deck/:code` route is handled BEFORE the layout renders (checked in `AppWithAuth` before returning the layout), so it stays outside `<Routes>`:

```js
// In AppWithAuth, before the layout:
const sharedDeckMatch = window.location.pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
if (sharedDeckMatch) {
  return <SharedDeckView shareCode={sharedDeckMatch[1]} />;
}
```

- [ ] **Step 7: Update Sidebar to use React Router links**

In `frontend/src/components/Sidebar.js`, replace navigation calls:

```js
import { useNavigate, useLocation } from 'react-router-dom';

// Inside Sidebar component:
const navigate = useNavigate();
const location = useLocation();

// Replace: onClick={() => setCurrentView('collection')}
// With:    onClick={() => navigate('/collection')}

// Replace active state check: currentView === 'collection'
// With:                        location.pathname === '/collection'
//   or for prefix match:       location.pathname.startsWith('/collection')
```

Remove the `currentView` and `setCurrentView` props from Sidebar's prop signature — it reads URL state directly from `useLocation()` instead.

- [ ] **Step 8: Handle the `?location=` URL parameter**

The existing `useEffect` in App.js reads `?location=` from the URL to pre-filter by storage location. Update it to use React Router's `useSearchParams`:

```js
import { useSearchParams } from 'react-router-dom';

// In CollectionView (Task 7), replace the useEffect:
const [searchParams] = useSearchParams();
useEffect(() => {
  const loc = searchParams.get('location');
  if (loc) {
    setFilterLocation(decodeURIComponent(loc));
  }
}, [searchParams]);
```

Remove the corresponding `useEffect` from App.js since `CollectionView` now owns this.

- [ ] **Step 9: Update Caddy reverse proxy (if applicable)**

If running behind Caddy at `mtgtracker.store`, React Router needs the server to serve `index.html` for all non-API paths (SPA fallback). Verify `Caddyfile` has:

```
mtgtracker.store {
  reverse_proxy /api/* localhost:5000
  reverse_proxy localhost:3000
}
```

The `reverse_proxy localhost:3000` directive already forwards everything to CRA's dev server, which handles the SPA fallback automatically. For a production build, replace with:

```
mtgtracker.store {
  reverse_proxy /api/* localhost:5000
  root * /path/to/frontend/build
  try_files {path} /index.html
  file_server
}
```

- [ ] **Step 10: Verify**

Run `npm start`. Test the following:
1. Navigate to `http://localhost:3000/collection` directly — collection view loads without going through dashboard
2. Navigate to `http://localhost:3000/forum` — forum loads
3. Click Sidebar links — URL changes in browser address bar
4. Hit browser back button after navigating — returns to previous view
5. Navigate to `http://localhost:3000/` — redirects to `/dashboard`
6. Navigate to `http://localhost:3000/nonexistent` — redirects to `/dashboard`
7. Navigate to `http://localhost:3000/settings?location=MyBinder` — opens collection with location pre-filtered (QR code scanning)

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.js frontend/src/components/Sidebar.js frontend/src/components/ForumView.js frontend/src/components/CollectionView.js
git commit -m "feat: add React Router, replace currentView state machine with URL routing"
```

---

## Self-Review

### Spec coverage

| Goal | Covered by |
|------|-----------|
| Fix `SettingsView` remount bug | Task 1 |
| Extract inline module-scope components | Tasks 2, 3 |
| Cards CRUD in context | Task 4 |
| Location/tag management in context | Task 5 |
| Wishlist in context | Task 6 |
| Collection view JSX extracted | Task 7 |
| Wishlist view JSX extracted | Task 8 |
| App.js slimmed to routing shell | Task 9 |
| Each view gets its own URL path | Task 10 |
| Sidebar links update URL, back button works | Task 10 |
| Caddy SPA fallback documented | Task 10 Step 9 |

### Type/name consistency checks

- `getAuthHeaders` extracted to `utils/auth.js` in Task 4 Step 2 — referenced by Tasks 5 and 6 correctly.
- `standardTypes` extracted to `constants.js` in Task 7 Step 3 — only CollectionView needs it.
- `addSimilarCardToWishlist` renamed to `addToWishlist` in `WishlistContext` (Task 6) — CollectionView calls `addToWishlist` from `useWishlist()` (Task 7 Step 2). Consistent.
- `DeckFoldersTab` referenced in `SettingsView.js` (Task 1) — resolved by Task 2 which creates the actual file. Task 1 Step 1 adds the import path `'./DeckFoldersTab'` which is correct relative to `components/`.
- `fileInputRef` stays in App.js and is passed as a prop to `CollectionView` (Task 7 Step 4). The hidden `<input>` element stays in App.js's main return JSX.

### Placeholder scan

Tasks 4–8 use "Copy verbatim from App.js line ~N" instructions. These are legitimate "find the code at these lines and paste it" directives, not vague TBDs. The implementer is expected to read App.js at those line numbers and copy the code — the plan cannot inline 3,000 lines of existing handlers without being unreadable.

### Risk notes

- **Task 4 is the highest-risk task.** Moving handlers to context changes import chains and may surface hidden dependencies (e.g., a handler that calls another handler that's still in App.js). Work incrementally: move one handler at a time, verify in browser before committing.
- **Task 7 is the largest task.** The collection view is ~2,400 lines. If the subagent hits context limits, break it: first extract just the JSX block (without moving local state), then move local state from App.js into CollectionView in a second pass.
- **Context ordering matters.** `LocationTagContext` depends on `CardCollectionContext` (for `locationStats` `cards` dependency). The provider tree order in Task 5 Step 2 must have `CardCollectionProvider` wrapping `LocationTagProvider`.
- **Task 10 depends on Tasks 7–9 being complete.** `CollectionView`, `WishlistView`, and `ForumView` must exist as standalone components before they can be placed into `<Route>` elements. Do not attempt Task 10 before Task 8.
- **Sidebar `currentView` prop removal** in Task 10 Step 7 means any place that passes `currentView` or `setCurrentView` to Sidebar must also be updated. Check Sidebar's current prop usage in App.js before making this change.
- **`react-router-dom` is a new dependency.** If any other part of the codebase (e.g., `CommunityDecks`, `SharedDeckView`) already uses `window.location` directly, those should be updated to use `useNavigate` / `useLocation` for consistency, but it is not blocking.

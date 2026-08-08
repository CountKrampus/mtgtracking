# App.js Split Design

## Problem

`frontend/src/App.js` is 1105 lines and carries three unrelated responsibilities: the top-level layout shell (header/sidebar/command palette/keyboard shortcuts), the entire route table (30+ `<Route>` elements), and — the bulk of the bloat — ~35 `useState` variables plus their handler functions for seven Collection-view tools (Commander Recommendations, Set Completion Tracker, Combo Finder, Price Update, QR Preview, Print Labels, Finance Panel) that are "lifted" into App.js purely to be prop-drilled into `CollectionView` (their sole real consumer) and, in a few cases, `SettingsView`.

This lifting causes a real, currently-shipping bug: `Dashboard`'s "Update Prices" button calls `setShowPriceUpdateModal(true)`, but that state only renders anything inside `CollectionView`, which isn't mounted while on `/dashboard` (React Router only mounts the matching route). The click does nothing visible; the modal is simply already open if the user separately navigates to `/collection` afterward. The same class of bug affects every Command Palette (Ctrl+K) action that reaches into this same lifted state ("Update Prices", "Commander Recommendations", "Set Completion Tracker", "View Finance") — those work today only when the user happens to already be on `/collection`.

## Goals

- Reduce `App.js` to its actual responsibilities: layout shell, global keyboard shortcuts, Command Palette command definitions, axios auth interceptors, and rendering the route table.
- Extract each of the seven Collection tools into a self-contained component that owns its own state/API calls, matching the pattern already established this session by `DuplicateCleanup.js` (props limited to `isOpen`, `onClose`, and whatever data it needs — no state threaded through a parent).
- Fix the cross-route trigger bug as a natural consequence of the extraction (not a separate patch): every place that currently flips one of these lifted booleans from outside `CollectionView` needs a mechanism that actually works regardless of current route.
- Extract the route table into its own file.

## Non-goals

- No change to the actual UI/behavior of any of the seven tools themselves — this is a structural move, not a rewrite. Each extracted component should be behaviorally identical to its current inline form.
- No change to routes, URLs, or navigation structure beyond adding the one new `?tool=` query parameter described below.
- No change to anything outside `App.js`'s three responsibilities and the handful of files that consume its lifted state (`CollectionView.js`, `SettingsView.js`, `Dashboard.js`) — not a general app-wide refactor.
- No test infrastructure changes — this repo has no frontend test suite; verification is `npm run build` plus manual click-through.

## Design

### 1. Cross-route tool triggers: the `?tool=` query parameter

Six of the seven tools (all except QR/Print Labels — see below) are rendered exclusively inside `CollectionView`, but are triggered from three places: `CollectionView` itself (a toolbar button), `Dashboard` (only "Update Prices"), and the global Command Palette (works from any route).

`CollectionView` reads `?tool=` from the URL on mount via `useSearchParams` (react-router-dom). Valid values: `priceUpdate`, `commanderRecs`, `setCompletion`, `comboFinder`, `finance`. On mount, if `?tool=` matches one of these, `CollectionView` opens the corresponding modal's `isOpen` state and then calls `setSearchParams({}, { replace: true })` to strip the param from the URL (so it doesn't reopen on a later remount/back-navigation).

Any trigger from outside `CollectionView` becomes `navigate('/collection?tool=priceUpdate')` (etc.) instead of directly setting a boolean:
- `Dashboard`'s "Update Prices" button: `onUpdatePrices={() => navigate('/collection?tool=priceUpdate')}` (passed down from `App.js`, which already has `navigate` in scope).
- Command Palette commands for `act-prices`, `tool-commanders`, `tool-sets`, `act-finance` (and the combo-finder equivalent if one exists in the palette) become `() => navigate('/collection?tool=...')`.
- A trigger already on `/collection` (e.g. `CollectionView`'s own toolbar buttons) keeps calling the local `isOpen` setter directly — no need to round-trip through the URL when already on the right page.

### 2. Extracted components

Each becomes a new file under `frontend/src/components/CollectionTools/`, following `DuplicateCleanup.js`'s shape: a default-exported component taking `{ isOpen, onClose, cards, ...whatever data it genuinely needs (e.g. formatPrice) }`, with all of its own `useState` and handler logic moved inside it verbatim from `App.js`.

- `CommanderRecommendationsModal.js` — owns `commanderRecs`, `loadingCommanders`, `commanderColorFilter`, `commanderFinderMode`, `finderColors`, `finderThemes`, `finderCreatureType`, and the `getCommanderRecommendations`/`searchCommandersByPreference`/`addCommanderToCollection` handlers.
- `SetCompletionModal.js` — owns `completionData`, `loadingSetCompletion`, and `getSetCompletionData`.
- `ComboFinderModal.js` — owns `comboResults`, `loadingCombos`, `comboTab`, and `findCombos`/`addToWishlistFromCombo`.
- `PriceUpdateModal.js` — owns `forceUpdate`, `updateFullData`, and the update-all-prices call.
- `FinancePanel.js` — owns `financeData` and `openFinancePanel`'s fetch logic (the "open" trigger itself becomes the `isOpen` prop; the component fetches its data when `isOpen` flips true rather than via an externally-called `openFinancePanel` function).

`CollectionView` renders all five, e.g.:
```jsx
<PriceUpdateModal isOpen={activeTool === 'priceUpdate'} onClose={() => setActiveTool(null)} cards={cards} formatPrice={formatPrice} />
```
where `activeTool` is a single `useState(null)` local to `CollectionView`, initialized from `?tool=` on mount as described above, and also settable directly by `CollectionView`'s own toolbar buttons (`onClick={() => setActiveTool('priceUpdate')}`) — one state variable replaces the five separate `show*` booleans.

### 3. QR Preview / Print Labels: shared hook, not a lifted-state modal

Unlike the other six, QR/Print Labels is triggered from two different routes' own UI (`CollectionView`'s per-location QR button and `SettingsView`'s Locations manager), not from an App-level trigger reaching into a single mounted instance. Cross-route query-param signaling isn't the right fit here since both consumers need it "live" while mounted on their own route, independently.

Extract `frontend/src/hooks/useQRLabels.js`: a custom hook (not a component) returning `{ qrDataUrls, generateQR, showQRPreview, qrPreviewLocation, setQRPreviewLocation, showPrintLabels, setShowPrintLabels, closePreview }`, containing exactly the `generateQR` function and related state currently in `App.js`. Also extract `frontend/src/components/CollectionTools/QRPreviewModal.js`, a presentational component taking the hook's return values as props (same pattern as the other five modals) — this keeps `CollectionView` and `SettingsView` consistent with the rest of the design rather than one-off inlining. `CollectionView` and `SettingsView` each call `useQRLabels()` independently (each gets its own instance) and render `<QRPreviewModal {...qrLabelsHookReturn} />`.

### 4. Route table extraction

`frontend/src/routes/AppRoutes.js` exports a component wrapping the existing `<Routes>...</Routes>` block verbatim (all 30+ `<Route>` elements, unchanged), taking as props everything those routes currently close over from `App.js`'s scope (`cards`, `navigate`, `fileInputRef`, the handful of remaining handlers, etc.). `App.js` renders `<AppRoutes {...props} />` in place of the current inline block. This is a mechanical extraction — no route logic changes, just moving the JSX and its required props to a new file.

### 5. What remains in `App.js`

Layout shell (header/sidebar/`BottomNav`/`CommandPalette` wiring), the `useKeyboardShortcuts`/`handleKeyboardShortcut` global keydown handler (Escape now only needs to close the Command Palette itself, since the five tool modals it used to also check are no longer App-level state), `paletteCommands` definitions (updated per section 1), the axios request/response interceptors, top-level auth/context wiring (`AppWithAuth`), and rendering `<AppRoutes />`.

## Testing

No frontend test infrastructure exists in this repo. Verification is `cd frontend && npm run build` after each extraction step, plus a manual click-through covering: each of the five extracted modals opening correctly from (a) `CollectionView`'s own toolbar and (b) the Command Palette from a different starting route; Dashboard's "Update Prices" button now actually navigating to Collection and opening the modal; QR Preview/Print Labels still working from both `CollectionView` and `SettingsView`; and the Escape key still closing the Command Palette and whichever tool modal is currently open.

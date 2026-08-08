# PWA — Life Counter Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app installable on mobile and enable the life counter to work fully offline via a Workbox service worker.

**Architecture:** Add `service-worker.js` + `serviceWorkerRegistration.js` (CRA PWA template), call `register()` in `index.js`, and render a fixed `OfflineBanner` at the app's top level. No API-call changes needed — the life counter is pure React state.

**Tech Stack:** CRA built-in Workbox (via react-scripts build), React hooks (`useState`/`useEffect`), Tailwind CSS

---

## File Map

| File | Action |
|------|--------|
| `frontend/src/service-worker.js` | Create — Workbox precache service worker |
| `frontend/src/serviceWorkerRegistration.js` | Create — CRA SW registration helper |
| `frontend/src/index.js` | Modify — call `register()` not `unregister()` |
| `frontend/src/components/OfflineBanner.js` | Create — fixed offline indicator bar |
| `frontend/src/App.js` | Modify — render `<OfflineBanner />` at top level |

---

### Task 1: Create the Workbox service worker

**Files:**
- Create: `frontend/src/service-worker.js`

- [ ] **Step 1: Create `frontend/src/service-worker.js`**

```js
/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

// Precache all static assets at install time
precacheAndRoute(self.__WB_MANIFEST);

// Navigation fallback — serve index.html for all navigation requests
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Cache images with stale-while-revalidate
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg')),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 200 })],
  })
);

// Skip waiting on message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

- [ ] **Step 2: Verify the file was created**

Run: `ls frontend/src/service-worker.js`
Expected: file exists

---

### Task 2: Create the service worker registration helper

**Files:**
- Create: `frontend/src/serviceWorkerRegistration.js`

- [ ] **Step 1: Create `frontend/src/serviceWorkerRegistration.js`**

```js
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) return;

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log('Service worker registered (localhost).');
        });
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New content available; please refresh.');
              if (config && config.onUpdate) config.onUpdate(registration);
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) config.onSuccess(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Service worker registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => window.location.reload());
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error.message));
  }
}
```

- [ ] **Step 2: Verify the file was created**

Run: `ls frontend/src/serviceWorkerRegistration.js`
Expected: file exists

---

### Task 3: Enable registration in index.js

**Files:**
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Add import and registration call**

Current `frontend/src/index.js`:
```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './mobile.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);
```

Replace with:
```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './mobile.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

serviceWorkerRegistration.register();
```

- [ ] **Step 2: Verify index.js updated correctly**

Run: `cat frontend/src/index.js`
Expected: shows `serviceWorkerRegistration.register()` call at the bottom

- [ ] **Step 3: Commit**

```bash
git add frontend/src/service-worker.js frontend/src/serviceWorkerRegistration.js frontend/src/index.js
git commit -m "feat: add Workbox service worker for offline support"
```

---

### Task 4: Create OfflineBanner component

**Files:**
- Create: `frontend/src/components/OfflineBanner.js`

- [ ] **Step 1: Create the component**

```js
import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-yellow-500/90 text-black text-sm text-center py-1 font-medium">
      ⚡ You're offline — Life Counter still works
    </div>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls frontend/src/components/OfflineBanner.js`
Expected: file exists

---

### Task 5: Wire OfflineBanner into App.js

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add import at the top of App.js**

Find the existing imports block (around line 1–25). After the last import statement, add:

```js
import OfflineBanner from './components/OfflineBanner';
```

- [ ] **Step 2: Render OfflineBanner at top level**

In `App.js`, find the inner `AppContent` component's return statement (the top-level `<div>` of the rendered UI, or the `<AuthProvider>` wrapping the main layout). Add `<OfflineBanner />` as the first child after any wrapper:

```jsx
return (
  <>
    <OfflineBanner />
    {/* ... rest of the existing JSX ... */}
  </>
);
```

The exact insertion point is wherever the component's `return (` begins with the outermost wrapper. Place `<OfflineBanner />` as the first child inside that wrapper. If the return is a bare `<div ...>` rather than a fragment, keep the div and add `<OfflineBanner />` as its first child.

- [ ] **Step 3: Start dev server and test offline banner**

Run in one terminal: `cd frontend && npm start`

In Chrome DevTools → Network tab → switch "Online" dropdown to "Offline". Verify the yellow banner appears at the top of the screen. Switch back to "Online" — banner disappears.

- [ ] **Step 4: Verify life counter works offline**

1. Navigate to the Life Counter view in the app
2. In DevTools → set Network to Offline
3. Interact with life counters (increment, decrement)
4. Confirm everything works with no console errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OfflineBanner.js frontend/src/App.js
git commit -m "feat: add offline banner; life counter works fully offline"
```

---

## Verification Checklist

- [ ] `npm run build` completes without errors
- [ ] DevTools Application → Service Workers shows the SW registered after a production build
- [ ] DevTools Network → Offline → app shell loads, life counter works, other views show banner
- [ ] Banner disappears when going back online
- [ ] "Add to Home Screen" prompt appears in Chrome on Android (requires HTTPS or localhost)

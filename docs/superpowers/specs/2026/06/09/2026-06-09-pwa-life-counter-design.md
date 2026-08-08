# PWA — Life Counter Offline Design

## Goal

Make the app installable on mobile and enable the life counter to work fully offline. Every other view degrades gracefully with an offline banner.

## Architecture

Create React App ships Workbox integration out of the box. Enabling it precaches all static JS/CSS bundles at install time. Because the life counter is pure React state with no API calls, it works offline automatically once the shell is cached. Other views attempt their normal API calls; failures surface a banner rather than a broken screen.

**Two new files:**
- `frontend/src/service-worker.js` — Workbox-powered service worker (precaches all build assets). CRA's standard template does not include this; copy the file from the official `cra-template-pwa` source at https://github.com/cra-template-pwa/src/service-worker.js or write a minimal Workbox precache config.
- `frontend/src/serviceWorkerRegistration.js` — CRA's registration helper. Also not included in the standard template; copy from `cra-template-pwa` source.

**Modified files:**
- `frontend/src/index.js` — call `serviceWorkerRegistration.register()` instead of `unregister()`
- `frontend/src/App.js` — render `<OfflineBanner>` at the top level
- `frontend/src/components/OfflineBanner.js` — new component (described below)

## Service Worker

Use CRA's built-in `src/service-worker.js` template verbatim. It uses Workbox's `precacheAndRoute` to cache all assets at install time and a stale-while-revalidate strategy for navigation requests. No custom fetch handlers needed — the life counter makes zero API calls so it works without any special routing rules.

Cache strategy for API calls (`/api/*`): **network only** — if the network is unavailable these requests fail, which is expected and handled by the offline banner.

## OfflineBanner Component

```
frontend/src/components/OfflineBanner.js
```

Listens to `window.addEventListener('online' / 'offline')`. When offline, renders a fixed slim bar at the top of the screen:

> ⚡ You're offline — Life Counter still works

When back online, bar disappears. No props. Uses `useState` + `useEffect` for the event listeners. Styled with Tailwind: `bg-yellow-500/90 text-black text-sm text-center py-1 fixed top-0 inset-x-0 z-50`.

## Install Prompt

Browsers show the native "Add to Home Screen" prompt automatically once the service worker is registered and the manifest is valid. The existing `site.webmanifest` already has `"display": "standalone"`, correct icons, and theme colors — no changes needed.

## What Works Offline

| Feature | Offline? | Notes |
|---------|----------|-------|
| Life Counter | ✅ Full | Pure React state, zero API calls |
| Collection | ❌ | Shows offline banner, blank data |
| Deck Builder | ❌ | Shows offline banner, blank data |
| Wishlist | ❌ | Shows offline banner, blank data |
| All other views | ❌ | Shows offline banner, blank data |

## Files to Create / Modify

| File | Change |
|------|--------|
| `frontend/src/service-worker.js` | Create — CRA Workbox template |
| `frontend/src/serviceWorkerRegistration.js` | Create — CRA registration helper |
| `frontend/src/index.js` | Call `register()` instead of `unregister()` |
| `frontend/src/components/OfflineBanner.js` | Create — fixed offline indicator |
| `frontend/src/App.js` | Render `<OfflineBanner />` at the top level |

## Verification

1. `npm run build` + `serve -s build` → open in Chrome → DevTools → Application → Service Workers → confirm registered
2. DevTools → Network → set "Offline" → refresh → app shell loads, life counter works, other views show banner
3. On Android Chrome: visit app → "Add to Home Screen" prompt appears → install → opens fullscreen with no browser chrome

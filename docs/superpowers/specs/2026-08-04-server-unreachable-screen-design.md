# Server Unreachable Screen Design

## Problem

When the frontend cannot reach the backend API, `checkSystemStatus` in `frontend/src/hooks/useAuth.js` exhausts its retries and then assumes single-user mode (`setIsMultiUserEnabled(false)`), so `AuthGuard` renders the full app with no login prompt and no data. A server outage is indistinguishable from a working single-user install — this masked a real outage (DNS pointing at a stale IP) as "auth isn't prompting."

## Behavior

`checkSystemStatus`'s retry-exhausted failure path changes from "assume single-user" to a `navigator.onLine` check:

- **Device offline** (`navigator.onLine === false`): keep today's behavior exactly — fall through, the app renders, the cached collection and existing offline badge show. The offline PWA browsing flow is untouched.
- **Device online but server unreachable**: set a new `serverUnreachable` state (exposed from `useAuth` through `AuthContext`) instead of faking single-user mode.

`AuthGuard` gains one new branch, checked after `isLoading` and before the `!isMultiUserEnabled` check: if `serverUnreachable`, render a full-screen "Can't reach the server" panel:

- Same visual family as the existing loading screen (dark gradient background, centered content).
- Message: "The MTG Tracker server isn't responding. Check that the backend is running, then retry."
- A **Retry** button that re-runs the status check: it resets `serverUnreachable`, sets `isLoading` true (spinner shows), and calls `checkSystemStatus` again. On success the normal flow resumes (login prompt or app).
- One automatic retry when the browser fires an `online` event. No polling loop beyond that.

## Why this is safe

- Real single-user installs are unaffected: their `/auth/status` request succeeds and returns `multiUserEnabled: false` — a successful response remains the only path that grants auth-free entry while online.
- Multi-user installs can no longer silently render an unauthenticated app during an outage.

## Non-goals

- No backend changes.
- No periodic polling/auto-reconnect beyond the single `online`-event retry.
- No change to the offline PWA flow, the offline edit queue, or the offline status badge.
- No change to what happens when the server becomes unreachable *after* a successful load (existing per-request error handling stays as is).

## Testing

No frontend test infrastructure exists in this repo. Verification is:

1. `cd frontend && npm run build` succeeds.
2. Manual: with the backend stopped and the device online, the browser shows the unreachable screen instead of the app; start the backend, click Retry, and the login prompt appears.

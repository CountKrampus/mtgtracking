# Server Unreachable Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the device is online but the backend is unreachable, show a full-screen "Can't reach the server" panel with a Retry button instead of silently rendering the app in fake single-user mode.

**Architecture:** Two files. `frontend/src/hooks/useAuth.js` gains a `serverUnreachable` state, set when `checkSystemStatus` exhausts its retries while `navigator.onLine` is true, plus a `retryConnection` function and a one-shot auto-retry on the browser `online` event. `frontend/src/components/auth/AuthGuard.js` renders the new screen when `serverUnreachable` is set — checked after `isLoading` and **before** `!isMultiUserEnabled` (during an outage `isMultiUserEnabled` stays `false`, so a later check would wrongly render the app). `AuthContext` spreads the whole hook return (`...auth`), so no context changes are needed.

**Tech Stack:** React (CRA), lucide-react (already installed). No frontend test infra — verify via `npm run build` + manual check.

**Pre-existing working-tree note:** `useAuth.js` currently carries uncommitted changes (Copilot's retry loop + the corruption repair). Task 1 commits that baseline first so the feature lands as its own clean commit.

---

## Task 1: `serverUnreachable` state in useAuth

**Files:**
- Modify: `frontend/src/hooks/useAuth.js`

- [ ] **Step 1: Commit the existing uncommitted baseline of this file**

```bash
git add frontend/src/hooks/useAuth.js
git commit -m "fix: repair corrupted validateSession fetch and keep status-check retries"
```

- [ ] **Step 2: Add the state**

Below the existing `const [systemStatus, setSystemStatus] = useState(null);` line, add:

```js
  const [serverUnreachable, setServerUnreachable] = useState(false);
```

- [ ] **Step 3: Change the retry-exhausted branch of `checkSystemStatus`**

Replace:
```js
        // All retries exhausted - assume single-user fallback
        console.error('Failed to check system status after retries:', err);
        setIsMultiUserEnabled(false);
        setIsLoading(false);
        return;
```
with:
```js
        console.error('Failed to check system status after retries:', err);
        if (navigator.onLine) {
          // Online but the server isn't responding - surface it instead of
          // silently pretending this is a single-user install.
          setServerUnreachable(true);
        } else {
          // Device offline - preserve the offline PWA flow (cached collection).
          setIsMultiUserEnabled(false);
        }
        setIsLoading(false);
        return;
```

- [ ] **Step 4: Clear the flag on success**

In `checkSystemStatus`'s success path, directly after `const data = await response.json();`, add:
```js
        setServerUnreachable(false);
```

- [ ] **Step 5: Add `retryConnection` and the online-event auto-retry**

Directly after the closing `};` of `checkSystemStatus`, add:

```js
  const retryConnection = () => {
    setServerUnreachable(false);
    setIsLoading(true);
    checkSystemStatus();
  };

  // One automatic retry when the browser regains connectivity while the
  // unreachable screen is showing. No polling beyond this.
  useEffect(() => {
    if (!serverUnreachable) return;
    const handleOnline = () => retryConnection();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUnreachable]);
```

- [ ] **Step 6: Expose the new values**

In the return object, after `systemStatus,`, add:
```js
    serverUnreachable,
    retryConnection,
```

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useAuth.js
git commit -m "feat: track server-unreachable state distinctly from single-user mode"
```

---

## Task 2: Unreachable screen in AuthGuard

**Files:**
- Modify: `frontend/src/components/auth/AuthGuard.js`

- [ ] **Step 1: Import the icon and destructure the new context values**

Add to the imports:
```js
import { WifiOff } from 'lucide-react';
```

Extend the `useAuthContext()` destructuring to include the two new values:
```js
  const {
    isAuthenticated,
    isLoading,
    isMultiUserEnabled,
    serverUnreachable,
    retryConnection,
    login,
    register,
    error
  } = useAuthContext();
```

- [ ] **Step 2: Add the screen branch**

Directly after the `if (isLoading) { ... }` block and **before** the `if (!isMultiUserEnabled)` block, add:

```jsx
  // Online but the server isn't responding - show a retry screen instead of
  // falling through to the single-user branch below (isMultiUserEnabled is
  // still false during an outage, so that branch would wrongly render the app).
  if (serverUnreachable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="text-center max-w-md">
          <WifiOff size={48} className="mx-auto mb-4 text-purple-400" />
          <h1 className="text-2xl font-bold text-white mb-2">Can't reach the server</h1>
          <p className="text-gray-400 mb-6">
            The MTG Tracker server isn't responding. Check that the backend is running, then retry.
          </p>
          <button
            onClick={retryConnection}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/AuthGuard.js
git commit -m "feat: show a server-unreachable retry screen instead of silently entering the app"
```

---

## Task 3: Manual verification

- [ ] **Step 1: With the backend stopped and the device online**, load the frontend in a browser (cleared session). Expected: after the ~3 retry attempts (a few seconds of loading/app flash), the "Can't reach the server" screen appears — not the app.

- [ ] **Step 2: Start the backend, click Retry.** Expected: brief spinner, then the login prompt (multi-user mode).

- [ ] **Step 3: Regression check the normal path** — with the backend running, reload; login prompt (or the logged-in app, if a session exists) appears as usual, no unreachable screen flash.

- [ ] **Step 4: Request final code review** via `superpowers:requesting-code-review` on the two feature commits.

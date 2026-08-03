# Forum Bug Fixes & Reply Pinning Design

## Overview

Five real bugs found while using the forum feature, plus two confirmed new features (pinning individual replies, and bookmarking threads).

## Bug 1: Lock/Pin/Rename/Move silently fail (missing auth header)

`frontend/src/components/Forum/ThreadView.js`'s `handleToggleLock`, `handleTogglePin`, `handleRenameThread`, and `handleMoveThread` all build their `fetch()` calls without an `Authorization` header — unlike `handleDeleteThread`, which correctly reads `localStorage.getItem('mtg_access_token')` and sends `Authorization: Bearer <token>`. Since the backend's `verifyToken` middleware sets `req.user = null` with no header, `requireAuth`/`requirePermission('forum:moderate')` reject with 401 — and since none of these four handlers check `response.ok` before deciding whether to update state, the click just silently does nothing (no error shown).

**Fix:** add the same token-reading pattern to all four handlers, matching `handleDeleteThread`'s existing convention exactly.

## Bug 2: Category thread count doesn't update (stale cache)

`GET /api/forum/categories` caches its response tree (including each category's `threadCount`) for 300 seconds via `forumCache`. Every category CRUD route (`POST`/`PUT`/`DELETE /categories...`) correctly calls `forumCache.del('categories:tree')` after mutating — but `POST /api/forum/threads` never does, even though it correctly `$inc`s the category's `threadCount` in the database. So the frontend's category overview shows a stale count for up to 5 minutes after a new thread is posted.

**Fix:** add `forumCache.del('categories:tree')` in the `POST /threads` handler, right next to the existing `ForumCategory.findByIdAndUpdate` call.

## Bug 3: Thread's own content never displays

`POST /api/forum/threads` saves the submitted body text onto `ForumThread.content` (not as a separate first `ForumPost`). But `ThreadView.js` only ever renders the thread's list of replies (`ForumPost`s) — it never reads `thread.content` anywhere. So the text typed at thread-creation time is saved correctly but invisible until someone posts a reply.

**Fix:** render `thread.content` (respecting `thread.contentFormat`) as the thread's own first/original post, visually distinct from replies, above the replies list.

## Bug 4: Every new thread triggers a false "Similar Threads Detected" prompt

`POST /api/forum/threads` calls `thread.save()` **before** calling `findDuplicateThreads(title, categoryId, 0.6)`. The duplicate scan queries all threads in that category with no exclusion of the thread's own `_id` — so the brand-new thread matches itself at 100% similarity, which is always `>= 0.6`, guaranteeing a false "duplicate" hit on every single thread creation regardless of whether a real duplicate exists.

**Fix:** exclude the newly created thread's own `_id` from the duplicate-scan results, mirroring the existing exclusion filter already used by `GET /forum/threads/:threadId/duplicates` (`d.threadId.toString() !== thread._id.toString()`).

## Bug 5: "Import Deck" button misparses any thread's prose as a decklist

`DeckImportButton.js` is rendered unconditionally on every thread (`ThreadView.js`, regardless of category). Clicking it calls `POST /forum/threads/:threadId/extract-deck`, which runs `extractDeckFromText` (`backend/utils/deckExtractor.js`) against the thread's raw `content` — a naive line-splitter with a loose fallback rule ("any non-blank line longer than 2 chars that isn't ALL CAPS or a bare number counts as a card name, quantity 1"). This fallback is legitimate for real decklists (singleton Commander lists are commonly just bare card names, no quantity prefix) but fires just as readily on ordinary prose, since there's no check that the thread is actually decklist-shaped content in the first place.

Confirming the "import" in that state calls `POST /cards/bulk-import`, which — because it silently falls back to creating an "offline" card record whenever a name's Scryfall lookup fails, rather than rejecting it — actually persisted garbage `Card` documents (full prose sentences as card names, set "Unknown", $0) into a real collection. This already happened once during testing and was manually cleaned up (9 bogus cards deleted from the affected account).

**Fix:** gate `DeckImportButton`'s visibility to categories where people actually post decklists as thread content — the `Deck Ideas` category (slug `deck-ideas`) — hidden on every other category (Forum Rules, Help & Support, General Discussion, Site Updates, etc.). The loose per-line fallback heuristic itself is not being tightened, since doing so would break legitimate bare-card-name Commander decklist parsing; the real fix is not applying the extractor to content that was never a decklist to begin with.

`GET /forum/threads/:threadId` doesn't populate `categoryId` (only `authorId`), so `thread.categoryId` in the frontend is a raw ObjectId string, not `{slug, name}`. No backend change needed, though — `ThreadView.js` already fetches the full category list separately (used for the move-thread dropdown), so the fix cross-references `thread.categoryId` against that already-fetched list to find the matching category's slug, purely client-side.

## Feature: Pin individual replies

Currently pinning only exists at the thread level (`ForumThread.isPinned`). Add the same concept to `ForumPost`.

- **Schema:** add `isPinned: { type: Boolean, default: false }` to `backend/models/ForumPost.js`.
- **Route:** `PUT /api/forum/posts/:postId/pin`, gated by `verifyToken, requireAuth, requirePermission('forum:moderate')` — same permission as thread pin/lock, no author-level pinning. Toggles `isPinned` and saves, mirroring the existing thread `/pin` route exactly.
- **Ordering:** pinned replies are shown at the top of the thread's post list, above unpinned replies, retaining their own relative order among themselves if more than one is pinned. Unpinned replies keep their existing chronological order below.
- **Visual treatment:** a pinned reply gets a small "📌 Pinned" badge (matching the thread-level badge's wording convention) rendered in **gold** (a new accent color for this state, distinct from the app's purple brand color) alongside the reply's author/timestamp line. The pin/unpin button itself uses lucide-react's `Pin`/`PinOff` icons: dim/neutral color when idle (not pinned), gold with a light gold-tinted background when active (pinned) — swapping to the `PinOff` icon on hover once pinned, so the click target's intent ("click to unpin") is clear without relying on color alone.
- **Permission-gated button:** the pin/unpin control on a reply is only rendered for users with `forum:moderate` (same visibility gate already used for the thread-level moderation toolbar).

## Feature: Bookmark a thread

A private, per-user "save for later" list, separate from moderation-only thread/reply pinning — any signed-in user can bookmark any thread.

- **Data model:** add `bookmarkedThreadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread' }]` to `backend/models/User.js`, following the same array-on-User pattern already used for `badges`/`pinnedCards` (no separate join-table model needed at this scale).
- **Routes:**
  - `PUT /api/forum/threads/:threadId/bookmark` — `verifyToken, requireAuth` (no special permission — any authenticated user can bookmark). Toggles the thread's `_id` in/out of `req.user.bookmarkedThreadIds` and saves.
  - `GET /api/forum/bookmarks` — `verifyToken, requireAuth`. Returns the current user's bookmarked threads (populated with enough fields to render a list: title, category, author, lastPostAt, etc. — same shape as other thread-list endpoints).
- **Frontend:**
  - A bookmark toggle button on `ThreadView.js`, visible to any signed-in user (not gated by `forum:moderate` — this is a personal action, unlike pinning). Uses lucide-react's `Bookmark` icon, toggling its `fill` between `none` (not bookmarked) and `currentColor` (bookmarked) — no new icon needed, no separate "bookmarked" vs "not bookmarked" icon pair.
  - A new **Bookmarks** section on the user's profile page (`frontend/src/components/MyProfile.js` or wherever the profile's tabbed sections live), listing their bookmarked threads with a link into each one.
- **Visibility:** private and per-user — no bookmark count is shown to anyone, including the thread's author. This is intentionally different from pinning, which is a moderator action visible to everyone.

## Non-goals

- No author-level reply pinning (only `forum:moderate` can pin, matching thread-level pinning).
- No limit on how many replies can be pinned in one thread.
- Not fixing the duplicate-detection *feature* itself beyond the self-match bug (e.g. not tuning the 0.6 similarity threshold, not extending it to check content in addition to title).
- Not tightening `extractDeckFromText`'s per-line fallback heuristic — category-gating the button is the fix, not the parser.
- Not changing `POST /cards/bulk-import`'s Scryfall-failure fallback behavior (falling back to an "offline" card record) — that's existing, legitimate behavior for genuine offline-import use elsewhere in the app, out of scope here.
- No bookmarking of individual replies (only threads) — a lighter-weight feature, and not the pattern being asked for.
- (Already done, not part of this implementation: 9 bogus `Card` documents created by testing this exact bug were manually identified and deleted from the affected account before this spec was finalized.)
- No bookmark counts/visibility to other users.

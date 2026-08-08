# Forum UI Polish — Admin Panel & Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the forum admin panel (community section) and the user-facing forum shop with a shared ConfirmModal, search/filter controls, bulk thread delete, and a horizontal shop card layout.

**Architecture:** All changes are frontend-only — no new API endpoints, no backend changes. A shared `ConfirmModal` component (rendered via React portal) replaces all `window.confirm` calls across BadgesTab, ContentModerationTab, and CosmeticsManager. ForumShop's 2-col card grid is switched to a single-column horizontal layout with inline rarity pills and prominent tab counts.

**Tech Stack:** React 17+, Tailwind CSS, Lucide React icons, ReactDOM.createPortal

---

## File Map

| File | Action | Summary |
|---|---|---|
| `frontend/src/components/shared/ConfirmModal.js` | **Create** | Reusable delete confirmation modal via ReactDOM.createPortal |
| `frontend/src/components/admin/community/BadgesTab.js` | **Modify** | Add search, badge count, swap inline confirm for ConfirmModal |
| `frontend/src/components/admin/community/ContentModerationTab.js` | **Modify** | ConfirmModal for 3 window.confirm calls, bulk delete for RecentThreadsTab |
| `frontend/src/components/Forum/CosmeticsManager.js` | **Modify** | Add search + category filter, swap window.confirm for ConfirmModal |
| `frontend/src/components/Forum/ForumShop.js` | **Modify** | Horizontal card layout, tab counts, coin balance polish |

---

## Task 1: Create ConfirmModal shared component

**Files:**
- Create: `frontend/src/components/shared/ConfirmModal.js`

- [ ] **Step 1: Create the shared directory if it doesn't exist**

Run: `ls frontend/src/components/shared` (Windows: `dir frontend\src\components\shared`)

If missing, create it (just adding a file is enough — no `mkdir` needed when using Write tool).

- [ ] **Step 2: Write ConfirmModal.js**

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import { Trash2 } from 'lucide-react';

/**
 * Renders a styled confirmation modal via React portal into document.body.
 * Avoids z-index issues inside scrollable admin tabs.
 *
 * Props:
 *   title     string   — headline, e.g. "Delete post?"
 *   message   string   — body text shown below the icon, e.g. author + preview
 *   onConfirm () => void
 *   onCancel  () => void
 *   danger    boolean  — true (default) = red; false = blue
 */
export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            danger ? 'bg-red-900/60' : 'bg-blue-900/60'
          }`}
        >
          <Trash2 size={22} className={danger ? 'text-red-400' : 'text-blue-400'} />
        </div>
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        {message && <p className="text-gray-400 text-sm mb-6">{message}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-white text-sm rounded-lg transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 3: Verify the file exists and the import path is correct**

The file lives at `frontend/src/components/shared/ConfirmModal.js`.

Import from **admin/community** files: `import ConfirmModal from '../../shared/ConfirmModal';`
Import from **Forum** files: `import ConfirmModal from '../shared/ConfirmModal';`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/ConfirmModal.js
git commit -m "feat: add shared ConfirmModal component (portal-based delete confirmation)"
```

---

## Task 2: BadgesTab — search input + ConfirmModal

**Files:**
- Modify: `frontend/src/components/admin/community/BadgesTab.js`

**Context:** `BadgesTab.js` currently uses an inline `deleteConfirm` state (a badge ID) to expand a row into a "Delete X? / Confirm / Cancel" confirmation UI. Replace this with the shared ConfirmModal. Also add a search input that filters the badge list client-side by name.

- [ ] **Step 1: Add ConfirmModal import and search state**

At the top of `BadgesTab.js`, add the import (after existing imports):
```js
import ConfirmModal from '../../shared/ConfirmModal';
```

Inside the `BadgesTab` function body, the existing state declarations start at ~line 187. Add `search` and rename `deleteConfirm` to `pendingDeleteBadge` (stores the full badge object instead of just an ID so the modal can show the badge name):

Replace the state block (currently lines 187–195):
```js
const [badges, setBadges] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [showForm, setShowForm] = useState(false);
const [editingBadge, setEditingBadge] = useState(null);
const [form, setForm] = useState({ name: '', description: '', icon: '' });
const [showPicker, setShowPicker] = useState(false);
const [saving, setSaving] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState(null);
```
with:
```js
const [badges, setBadges] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [showForm, setShowForm] = useState(false);
const [editingBadge, setEditingBadge] = useState(null);
const [form, setForm] = useState({ name: '', description: '', icon: '' });
const [showPicker, setShowPicker] = useState(false);
const [saving, setSaving] = useState(false);
const [pendingDeleteBadge, setPendingDeleteBadge] = useState(null);
const [search, setSearch] = useState('');
```

- [ ] **Step 2: Update `handleDelete` to clear `pendingDeleteBadge` instead of `deleteConfirm`**

Find the existing `handleDelete` function (~line 275):
```js
async function handleDelete(id) {
  try {
    const res = await fetch(`${API_URL}/admin/badges/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setBadges(prev => prev.filter(b => b._id !== id));
    setDeleteConfirm(null);
  } catch (err) {
    setError(err.message);
  }
}
```
Replace `setDeleteConfirm(null)` with `setPendingDeleteBadge(null)`:
```js
async function handleDelete(id) {
  try {
    const res = await fetch(`${API_URL}/admin/badges/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setBadges(prev => prev.filter(b => b._id !== id));
    setPendingDeleteBadge(null);
  } catch (err) {
    setError(err.message);
  }
}
```

- [ ] **Step 3: Add filteredBadges derived value and update header**

After the `handleDelete` function, before the `return (` statement, add:
```js
const filteredBadges = badges.filter(b =>
  b.name.toLowerCase().includes(search.toLowerCase())
);
```

In the JSX, find the header section (currently renders `<h2>Badges</h2>`):
```jsx
<h2 className="text-xl font-bold text-white">Badges</h2>
<p className="text-sm text-gray-400 mt-1">Manage badge definitions awarded to users</p>
```
Replace with:
```jsx
<h2 className="text-xl font-bold text-white">Badges ({badges.length})</h2>
<p className="text-sm text-gray-400 mt-1">Manage badge definitions awarded to users</p>
```

- [ ] **Step 4: Add search input above the badge list**

Find where the badge list starts — after the form and before `{loading ? ... : ...}` or the `badges.map(...)`. Add this search input before the badge list:

```jsx
{/* Search */}
{!loading && !error && badges.length > 0 && (
  <div className="mb-4">
    <input
      type="text"
      placeholder="Search badges..."
      value={search}
      onChange={e => setSearch(e.target.value)}
      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
    />
  </div>
)}
```

- [ ] **Step 5: Replace inline deleteConfirm row with ConfirmModal trigger**

In the badge list render (`badges.map(badge => ...)` — currently at ~line 416), each badge row has a conditional:
```jsx
{deleteConfirm === badge._id ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-red-400">Delete "{badge.name}"?</span>
    <button onClick={() => handleDelete(badge._id)} ...>Confirm</button>
    <button onClick={() => setDeleteConfirm(null)} ...>Cancel</button>
  </div>
) : (
  <>
    <button onClick={() => openEdit(badge)} ...>Edit</button>
    <button onClick={() => setDeleteConfirm(badge._id)} ...>Delete</button>
  </>
)}
```

Replace the entire block with just the Edit/Delete buttons (the modal will appear globally):
```jsx
<>
  <button
    onClick={() => openEdit(badge)}
    className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs rounded-lg transition"
  >
    Edit
  </button>
  <button
    onClick={() => setPendingDeleteBadge(badge)}
    className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-xs rounded-lg transition"
  >
    Delete
  </button>
</>
```

Also change `badges.map(badge => ...)` to `filteredBadges.map(badge => ...)` so the search filter applies.

- [ ] **Step 6: Add ConfirmModal and empty-search state to JSX**

At the bottom of the return block (just before the closing `</div>`), add:
```jsx
{/* Delete confirmation modal */}
{pendingDeleteBadge && (
  <ConfirmModal
    title={`Delete "${pendingDeleteBadge.name}"?`}
    message="This badge will be permanently removed."
    onConfirm={() => handleDelete(pendingDeleteBadge._id)}
    onCancel={() => setPendingDeleteBadge(null)}
  />
)}
```

Also add an empty-search state when `filteredBadges.length === 0 && search`:
```jsx
{!loading && !error && filteredBadges.length === 0 && search && (
  <div className="text-center text-gray-400 text-sm py-8">
    No badges match "{search}"
  </div>
)}
```

- [ ] **Step 7: Start dev server and verify**

Run from `frontend/` directory:
```bash
npm start
```
Open `http://localhost:3000`, navigate to Admin Panel → Community → Badges tab.

Check:
- Header shows "Badges (N)" where N is the actual count
- Search input filters badge list in real time
- Clicking Delete opens the styled modal (not browser dialog)
- Confirming delete in modal removes the badge
- Cancelling closes the modal

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/community/BadgesTab.js
git commit -m "feat: add search, badge count, and ConfirmModal to BadgesTab"
```

---

## Task 3: ContentModerationTab — ConfirmModal + bulk thread delete

**Files:**
- Modify: `frontend/src/components/admin/community/ContentModerationTab.js`

**Context:** This file has three `window.confirm` calls to replace:
1. Line ~272: `RecentPostsTab.handleDelete` (single post)
2. Line ~303: `RecentPostsTab.handleBulkDelete` (bulk posts)
3. Line ~482: `RecentThreadsTab.handleDelete` (single thread)

Additionally, `RecentThreadsTab` lacks bulk delete (checkbox + toolbar) — need to add it mirroring the existing `RecentPostsTab` pattern. The file already has `EmptyState`, `LoadingSpinner`, and `formatDate` helpers at module scope — keep and reuse them.

- [ ] **Step 1: Add ConfirmModal import**

At the top of `ContentModerationTab.js`, after existing imports:
```js
import ConfirmModal from '../../shared/ConfirmModal';
```

- [ ] **Step 2: Add `formatRelative` and `AuthorCell` helpers at module scope; update `EmptyState` to accept an icon**

Add after the existing `truncate` helper (~line 66), before `// --- Flagged Content Tab ---`:

```js
function formatRelative(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const AVATAR_COLORS = [
  'bg-purple-600', 'bg-blue-600', 'bg-green-600',
  'bg-pink-600',  'bg-amber-600', 'bg-red-600',
];

function AuthorCell({ author }) {
  const name = author?.username || author?.displayName || '?';
  const initial = name[0].toUpperCase();
  const colorClass = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${colorClass}`}>
        {initial}
      </div>
      <span className="text-sm text-gray-300 truncate">{name}</span>
    </div>
  );
}
```

Also update the existing `EmptyState` helper to accept an optional `icon` prop:
```js
function EmptyState({ message, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-3">
      {Icon && <Icon size={28} className="text-gray-600" />}
      <span>{message}</span>
    </div>
  );
}
```

Add `Mail, MessageSquare, ShieldAlert` to the lucide-react import at the top of the file:
```js
import { RefreshCw, Trash2, AlertTriangle, MessageSquare, Layers, Mail, ShieldAlert } from 'lucide-react';
```

- [ ] **Step 3: Update empty state usages to pass icons**

In `RecentPostsTab`, find:
```js
if (posts.length === 0) return <EmptyState message="No posts found." />;
```
Replace:
```js
if (posts.length === 0) return <EmptyState icon={Mail} message="No posts yet." />;
```

In `RecentThreadsTab`, find:
```js
if (threads.length === 0) return <EmptyState message="No threads found." />;
```
Replace:
```js
if (threads.length === 0) return <EmptyState icon={MessageSquare} message="No threads yet." />;
```

In `FlaggedContentTab`, find the empty/fallback message (there may be several paths — update all `<EmptyState message="No flagged content...` variants to):
```jsx
<EmptyState icon={ShieldAlert} message="No flagged content." />
```

- [ ] **Step 4: Wire up `AuthorCell` in RecentPostsTab table rows**

In the `<tbody>` of RecentPostsTab, find the author cell:
```jsx
<td className="px-4 py-3 text-gray-300 text-sm">
  {post.author?.username || post.author?.displayName || '—'}
</td>
```
Replace:
```jsx
<td className="px-4 py-3">
  <AuthorCell author={post.author} />
</td>
```

Also update all `<tr>` row padding in this table to `py-3`:
- The `<thead> <tr>` cells already use `py-3` — no change needed there
- The `<tbody> <tr>` cells: change any `py-2` or `py-2.5` to `py-3`

- [ ] **Step 5: Wire up `AuthorCell` in RecentThreadsTab table rows**

In the `<tbody>` of RecentThreadsTab, find:
```jsx
<td className="px-4 py-3 text-gray-300 text-sm">
  {thread.author?.username || thread.author?.displayName || '—'}
</td>
```
Replace:
```jsx
<td className="px-4 py-3">
  <AuthorCell author={thread.author} />
</td>
```

- [ ] **Step 7: Replace `window.confirm` in RecentPostsTab.handleDelete**

Find (lines ~270–276):
```js
const handleDelete = async (post) => {
  const preview = truncate(post.content || post.body, 60);
  const confirmed = window.confirm(
    `Delete this post by ${post.author?.username || 'unknown'}?\n\n"${preview}"\n\nThis action cannot be undone.`
  );
  if (!confirmed) return;
```

Replace the `window.confirm` block — instead, use a `pendingDeletePost` state. Add state at the top of the `RecentPostsTab` function, alongside existing state:
```js
const [pendingDeletePost, setPendingDeletePost] = useState(null);
```

Then rewrite `handleDelete` to just set that state:
```js
const handleDelete = (post) => {
  setPendingDeletePost(post);
};

const confirmDeletePost = async () => {
  const post = pendingDeletePost;
  setPendingDeletePost(null);
  if (!post) return;

  setDeletingId(post._id);
  try {
    const res = await authFetch(`${API_URL}/admin/forum-posts/${post._id}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p._id !== post._id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(post._id);
        return next;
      });
      showSuccess('Post deleted.');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete post.');
    }
  } catch {
    alert('Failed to delete post.');
  } finally {
    setDeletingId(null);
  }
};
```

- [ ] **Step 8: Replace `window.confirm` in RecentPostsTab.handleBulkDelete**

Find (lines ~299–305):
```js
const handleBulkDelete = async () => {
  const count = selected.size;
  if (count === 0) return;

  const confirmed = window.confirm(`Delete ${count} selected post${count > 1 ? 's' : ''}? This action cannot be undone.`);
  if (!confirmed) return;
```

Add another state to `RecentPostsTab`:
```js
const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
```

Rewrite `handleBulkDelete` to just set the flag:
```js
const handleBulkDelete = () => {
  if (selected.size === 0) return;
  setPendingBulkDelete(true);
};

const confirmBulkDelete = async () => {
  setPendingBulkDelete(false);
  const count = selected.size;
  if (count === 0) return;

  setDeleting(true);
  let deletedCount = 0;
  const ids = new Set(Array.from(selected));

  for (const id of ids) {
    try {
      const res = await authFetch(`${API_URL}/admin/forum-posts/${id}`, { method: 'DELETE' });
      if (res.ok) deletedCount++;
    } catch {
      // continue with remaining
    }
  }

  setPosts((prev) => prev.filter((p) => !ids.has(p._id)));
  setSelected(new Set());
  setDeleting(false);
  showSuccess(`Deleted ${deletedCount} item${deletedCount !== 1 ? 's' : ''}.`);
};
```

- [ ] **Step 9: Add ConfirmModal renders to RecentPostsTab JSX**

In the `RecentPostsTab` return block, at the bottom before the closing `</div>`, add both modals:
```jsx
{pendingDeletePost && (
  <ConfirmModal
    title="Delete post?"
    message={`By ${pendingDeletePost.author?.username || 'unknown'} · "${truncate(pendingDeletePost.content || pendingDeletePost.body, 60)}"`}
    onConfirm={confirmDeletePost}
    onCancel={() => setPendingDeletePost(null)}
  />
)}
{pendingBulkDelete && (
  <ConfirmModal
    title={`Delete ${selected.size} post${selected.size !== 1 ? 's' : ''}?`}
    message="This will permanently remove the selected posts."
    onConfirm={confirmBulkDelete}
    onCancel={() => setPendingBulkDelete(false)}
  />
)}
```

- [ ] **Step 10: Replace `window.confirm` in RecentThreadsTab.handleDelete**

In `RecentThreadsTab` (starts at ~line 438), add state:
```js
const [pendingDeleteThread, setPendingDeleteThread] = useState(null);
const [selected, setSelected] = useState(new Set());
const [deleting, setDeleting] = useState(false);
const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
```

Rewrite single delete:
```js
const handleDelete = (thread) => {
  setPendingDeleteThread(thread);
};

const confirmDeleteThread = async () => {
  const thread = pendingDeleteThread;
  setPendingDeleteThread(null);
  if (!thread) return;

  setDeletingId(thread._id);
  try {
    const res = await authFetch(`${API_URL}/admin/forum-threads/${thread._id}`, { method: 'DELETE' });
    if (res.ok) {
      setThreads((prev) => prev.filter((t) => t._id !== thread._id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(thread._id);
        return next;
      });
      showSuccess('Thread deleted.');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete thread.');
    }
  } catch {
    alert('Failed to delete thread.');
  } finally {
    setDeletingId(null);
  }
};
```

- [ ] **Step 11: Add bulk delete to RecentThreadsTab**

Add bulk delete handler:
```js
const handleBulkDelete = () => {
  if (selected.size === 0) return;
  setPendingBulkDelete(true);
};

const confirmBulkDelete = async () => {
  setPendingBulkDelete(false);
  const count = selected.size;
  if (count === 0) return;

  setDeleting(true);
  let deletedCount = 0;
  const ids = new Set(Array.from(selected));

  for (const id of ids) {
    try {
      const res = await authFetch(`${API_URL}/admin/forum-threads/${id}`, { method: 'DELETE' });
      if (res.ok) deletedCount++;
    } catch {
      // continue with remaining
    }
  }

  setThreads((prev) => prev.filter((t) => !ids.has(t._id)));
  setSelected(new Set());
  setDeleting(false);
  showSuccess(`Deleted ${deletedCount} thread${deletedCount !== 1 ? 's' : ''}.`);
};

const toggleSelect = (id) => {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const toggleSelectAll = () => {
  if (selected.size === threads.length) {
    setSelected(new Set());
  } else {
    setSelected(new Set(threads.map((t) => t._id)));
  }
};
```

- [ ] **Step 12: Update RecentThreadsTab JSX — toolbar, checkbox column, modals**

Replace the existing toolbar (currently shows Refresh + count):
```jsx
<div className="flex items-center gap-3">
  <button
    onClick={fetchThreads}
    className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
  >
    <RefreshCw size={15} />
    Refresh
  </button>
  <span className="text-gray-400 text-sm">{threads.length} threads</span>
</div>
```
with:
```jsx
<div className="flex items-center gap-3 flex-wrap">
  <button
    onClick={fetchThreads}
    className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
  >
    <RefreshCw size={15} />
    Refresh
  </button>
  <span className="text-gray-400 text-sm">{threads.length} threads</span>
  {selected.size > 0 && (
    <button
      onClick={handleBulkDelete}
      disabled={deleting}
      className="flex items-center gap-1.5 px-3 py-1 bg-red-700/40 hover:bg-red-700/60 text-red-300 text-sm rounded-lg transition-colors disabled:opacity-50"
    >
      <Trash2 size={14} />
      Delete Selected ({selected.size})
    </button>
  )}
</div>
```

In the `<thead>`, add a checkbox column before the Title column:
```jsx
<th className="px-4 py-3 w-10">
  <input
    type="checkbox"
    checked={selected.size === threads.length && threads.length > 0}
    onChange={toggleSelectAll}
    className="rounded border-gray-500"
  />
</th>
```

In each `<tr>` inside `<tbody>`, add the matching checkbox cell before the Title cell:
```jsx
<td className="px-4 py-3">
  <input
    type="checkbox"
    checked={selected.has(thread._id)}
    onChange={() => toggleSelect(thread._id)}
    className="rounded border-gray-500"
  />
</td>
```

Also update the date cell to use `formatRelative` with a `title` tooltip:
```jsx
<td
  className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap"
  title={formatDate(thread.createdAt)}
>
  {formatRelative(thread.createdAt)}
</td>
```

Add both modals at the bottom of the RecentThreadsTab return block:
```jsx
{pendingDeleteThread && (
  <ConfirmModal
    title="Delete thread?"
    message={`"${pendingDeleteThread.title || 'Untitled'}" by ${pendingDeleteThread.author?.username || 'unknown'} · All replies will also be deleted.`}
    onConfirm={confirmDeleteThread}
    onCancel={() => setPendingDeleteThread(null)}
  />
)}
{pendingBulkDelete && (
  <ConfirmModal
    title={`Delete ${selected.size} thread${selected.size !== 1 ? 's' : ''}?`}
    message="All replies in these threads will also be permanently deleted."
    onConfirm={confirmBulkDelete}
    onCancel={() => setPendingBulkDelete(false)}
  />
)}
```

- [ ] **Step 13: Verify in browser**

Navigate to Admin Panel → Community → Content Moderation.

Check:
- **Recent Posts**: clicking trash icon opens styled modal; bulk delete button opens modal with count
- **Recent Threads**: checkbox column visible; selecting threads shows "Delete Selected (N)" button; clicking opens modal; single delete icon opens modal; date shows relative format ("2h ago") with full date on hover
- No `window.confirm` browser dialogs appear anywhere in this tab

- [ ] **Step 14: Commit**

```bash
git add frontend/src/components/admin/community/ContentModerationTab.js
git commit -m "feat: replace window.confirm with ConfirmModal, add bulk delete to RecentThreadsTab"
```

---

## Task 4: CosmeticsManager — search, category filter, ConfirmModal

**Files:**
- Modify: `frontend/src/components/Forum/CosmeticsManager.js`

**Context:** The `cosmetics` array is fetched from `/forum/admin/cosmetics` and stored in `useState([])`. The component renders a `grid grid-cols-1 md:grid-cols-2` of cosmetic cards at ~line 740. The current `handleDelete` at ~line 431 calls `window.confirm`. `CosmeticsManager` is a default export from this file.

- [ ] **Step 1: Add ConfirmModal import and new state**

At the top, after existing imports:
```js
import ConfirmModal from '../shared/ConfirmModal';
```

Inside the `CosmeticsManager` function, after the existing state declarations (~line 300–306):
```js
const [cosmetics, setCosmetics] = useState([]);
const [loading, setLoading] = useState(true);
const [showForm, setShowForm] = useState(false);
const [editingId, setEditingId] = useState(null);
const [error, setError] = useState(null);
const [message, setMessage] = useState(null);
const [formData, setFormData] = useState(defaultForm);
```
Add after them:
```js
const [pendingDeleteCosmetic, setPendingDeleteCosmetic] = useState(null);
const [search, setSearch] = useState('');
const [categoryFilter, setCategoryFilter] = useState('');
```

- [ ] **Step 2: Add `filteredCosmetics` derived value**

After the `showCssProperties` derived flag (~line 333), add:
```js
const filteredCosmetics = cosmetics.filter(c => {
  const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
  const matchesCategory = !categoryFilter || c.category === categoryFilter;
  return matchesSearch && matchesCategory;
});
```

- [ ] **Step 3: Rewrite `handleDelete` to use ConfirmModal**

Replace the current `handleDelete` function (~line 431):
```js
const handleDelete = async (id) => {
  if (!window.confirm('Delete this cosmetic? Users who have purchased it will lose access — their purchased count will show stale until cleaned up.')) return;
  try {
    const response = await authFetch(`${API_URL}/forum/admin/cosmetics/${id}`, { method: 'DELETE' });
    ...
  }
};
```
with:
```js
const handleDelete = (cosmetic) => {
  setPendingDeleteCosmetic(cosmetic);
};

const confirmDeleteCosmetic = async () => {
  const cosmetic = pendingDeleteCosmetic;
  setPendingDeleteCosmetic(null);
  if (!cosmetic) return;

  try {
    const response = await authFetch(`${API_URL}/forum/admin/cosmetics/${cosmetic._id}`, { method: 'DELETE' });
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
    }
    if (!response.ok) throw new Error(data.message || 'Failed to delete cosmetic');
    setMessage({ type: 'success', text: 'Cosmetic deleted' });
    setTimeout(() => setMessage(null), 3000);
    fetchCosmetics();
  } catch (err) {
    setError(err.message || 'Failed to delete cosmetic');
    console.error(err);
  }
};
```

- [ ] **Step 4: Update header with item count**

Find:
```jsx
<h3 className="text-lg font-bold text-white">Cosmetics Shop</h3>
```
Replace:
```jsx
<h3 className="text-lg font-bold text-white">Cosmetics Shop ({cosmetics.length})</h3>
```

- [ ] **Step 5: Add search + category filter toolbar**

Add after the header `<div className="flex justify-between items-center">` block (after the "Add Cosmetic" button and before `{message && ...}`):
```jsx
{/* Search + filter toolbar */}
{!showForm && (
  <div className="flex gap-3">
    <input
      type="text"
      placeholder="Search cosmetics..."
      value={search}
      onChange={e => setSearch(e.target.value)}
      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
    />
    <select
      value={categoryFilter}
      onChange={e => setCategoryFilter(e.target.value)}
      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      <option value="">All Categories</option>
      <optgroup label="Post Appearance">
        <option value="titleColor">Title Colors</option>
        <option value="avatarBorder">Avatar Borders</option>
        <option value="flairIcon">Flair Icons</option>
        <option value="postBackground">Post Tints</option>
        <option value="postFrame">Post Frames</option>
        <option value="threadHighlight">Thread Highlight</option>
        <option value="nameplateBackground">Nameplate Background</option>
        <option value="formatBadge">Format Badges</option>
        <option value="setSymbolFlair">Set Symbol Flair</option>
      </optgroup>
      <optgroup label="Forum Profile">
        <option value="profileBorderColor">Profile Borders</option>
        <option value="profileBackground">Profile Background</option>
        <option value="profileBanner">Profile Banners</option>
        <option value="profileTheme">Profile Themes</option>
      </optgroup>
      <optgroup label="Unlocks">
        <option value="memberTitle">Member Title</option>
        <option value="signature">Signature</option>
        <option value="achievementShowcase">Achievement Showcase</option>
        <option value="favoriteCardsShowcase">Card Showcase</option>
        <option value="deckShowcase">Deck Showcase</option>
        <option value="collectionStatsWidget">Stats Widget</option>
        <option value="wishlistPreview">Wishlist Preview</option>
        <option value="aboutMe">About Me</option>
        <option value="personalLinks">Personal Links</option>
      </optgroup>
    </select>
  </div>
)}
```

- [ ] **Step 6: Swap `cosmetics.map` for `filteredCosmetics.map` and update delete button**

Find in the cosmetic grid (~line 741):
```jsx
{cosmetics.map(cosmetic => (
```
Replace:
```jsx
{filteredCosmetics.map(cosmetic => (
```

Find the delete button in the card (~line 771):
```jsx
<button
  onClick={() => handleDelete(cosmetic._id)}
  className="p-1 hover:bg-slate-700 rounded text-red-400"
  title="Delete"
>
  <Trash2 size={16} />
</button>
```
Replace `handleDelete(cosmetic._id)` with `handleDelete(cosmetic)` (pass the full object):
```jsx
<button
  onClick={() => handleDelete(cosmetic)}
  className="p-1 hover:bg-slate-700 rounded text-red-400"
  title="Delete"
>
  <Trash2 size={16} />
</button>
```

- [ ] **Step 7: Add ConfirmModal and empty state to JSX**

Before the closing `</div>` of the component return, add:
```jsx
{/* Delete confirmation modal */}
{pendingDeleteCosmetic && (
  <ConfirmModal
    title={`Delete "${pendingDeleteCosmetic.name}"?`}
    message="Users who have purchased this cosmetic will lose access to it."
    onConfirm={confirmDeleteCosmetic}
    onCancel={() => setPendingDeleteCosmetic(null)}
  />
)}
```

Also update the empty state (~line 783) from:
```jsx
{cosmetics.length === 0 && !showForm && (
  <div className="text-center text-slate-400 py-8">
    No cosmetics yet. Create your first one!
  </div>
)}
```
to:
```jsx
{filteredCosmetics.length === 0 && !showForm && (
  <div className="text-center text-slate-400 py-8">
    {cosmetics.length === 0 ? 'No cosmetics yet. Create your first one!' : `No cosmetics match your search.`}
  </div>
)}
```

- [ ] **Step 8: Verify in browser**

Navigate to Admin Panel → Community → (the CosmeticsManager is inside the forum admin section, typically accessed via the admin shop management tab).

Check:
- Header shows "Cosmetics Shop (N)"
- Search filters the grid in real time
- Category dropdown filters by category (grouped by section)
- Clicking Delete opens the styled modal with cosmetic name
- No `window.confirm` browser dialog appears

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/Forum/CosmeticsManager.js
git commit -m "feat: add search + category filter, ConfirmModal to CosmeticsManager"
```

---

## Task 5: ForumShop — horizontal cards, tab counts, coin balance

**Files:**
- Modify: `frontend/src/components/Forum/ForumShop.js`

**Context:** ForumShop uses a `grid grid-cols-2 gap-3` for items inside each category group (~line 313). Each card has a vertical layout: swatch/icon → name+description → rarity+cost row → action button. The GROUP_TABS array defines `all`, `post`, `profile`, `unlocks` tabs (~line 39). The coin balance renders at ~line 240 with `bg-slate-900`. `catalogItems` holds the full item list from the API (~line 104).

- [ ] **Step 1: Add tab count computation**

The `catalogItems` state holds all items from the API. Add these constants and derived value after the `UNLOCK_CATEGORIES` constant (~line 73), before the `RARITY_STYLES` constant:

```js
const POST_CATS = [
  'titleColor', 'avatarBorder', 'flairIcon', 'postBackground', 'postFrame',
  'threadHighlight', 'nameplateBackground', 'formatBadge', 'setSymbolFlair',
];
const PROFILE_CATS = ['profileBorderColor', 'profileBackground', 'profileBanner', 'profileTheme'];
```

Inside the `ForumShop` component, add a derived value after the `groupedItems` useMemo (search for `const groupedItems`):
```js
const tabCounts = {
  all: catalogItems.length,
  post: catalogItems.filter(c => POST_CATS.includes(c.category)).length,
  profile: catalogItems.filter(c => PROFILE_CATS.includes(c.category)).length,
  unlocks: catalogItems.filter(c => UNLOCK_CATEGORIES.includes(c.category)).length,
};
```

- [ ] **Step 2: Update tab button render to show counts**

Find the GROUP_TABS render (~line 270):
```jsx
{GROUP_TABS.map(tab => {
  const Icon = tab.icon;
  return (
    <button
      key={tab.id}
      onClick={() => setActiveCategory(tab.id)}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        activeCategory === tab.id
          ? 'bg-purple-700 text-white'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      <Icon size={14} />
      {tab.label}
    </button>
  );
})}
```
Replace with:
```jsx
{GROUP_TABS.map(tab => {
  const Icon = tab.icon;
  const count = tabCounts[tab.id] ?? 0;
  return (
    <button
      key={tab.id}
      onClick={() => setActiveCategory(tab.id)}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        activeCategory === tab.id
          ? 'bg-purple-700 text-white'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      <Icon size={14} />
      {tab.label} ({count})
    </button>
  );
})}
```

- [ ] **Step 3: Update coin balance styling**

Find (~line 240):
```jsx
<div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg">
  <Coins size={16} className="text-yellow-400" />
  <span className="font-bold text-yellow-400">{coins.toLocaleString()}</span>
  <span className="text-slate-400 text-sm">coins</span>
</div>
```
Replace:
```jsx
<div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg">
  <Coins size={16} className="text-yellow-400" />
  <span className="text-lg font-bold text-yellow-400">{coins.toLocaleString()}</span>
  <span className="text-slate-400 text-sm">coins</span>
</div>
```

- [ ] **Step 4: Switch item grid to single-column horizontal cards**

Find the item grid (~line 313):
```jsx
<div className="grid grid-cols-2 gap-3">
  {items.map(item => {
    ...
    return (
      <div
        key={item.id}
        className={`p-4 rounded-lg border-2 bg-slate-900 flex flex-col gap-3 ${
          isEquipped ? 'border-green-600' : isOwned ? 'border-blue-700' : 'border-slate-700'
        }`}
      >
        {/* Swatch/icon + name row */}
        <div className="flex items-center gap-3">
          {/* swatch or icon ... */}
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm leading-tight">{item.name}</div>
            <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</div>
          </div>
        </div>

        {/* Rarity + cost row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${RARITY_STYLES[item.rarity] || RARITY_STYLES.common}`}>
              {item.rarity}
            </span>
            {item.availableUntil && (
              <span ...>Limited</span>
            )}
            {item.availableUntil && (() => { ... })()}
          </div>
          <div className="flex items-center gap-1">
            <Coins size={13} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">{item.cost.toLocaleString()}</span>
          </div>
        </div>

        {/* Action button */}
        {/* ... */}
      </div>
    );
  })}
</div>
```

Replace the entire grid + card with:
```jsx
<div className="flex flex-col gap-2">
  {items.map(item => {
    const isOwned = purchased.includes(item.id);
    const isEquipped = equipped[item.category] === item.id;
    const canAfford = coins >= item.cost;
    const isLoading = loadingId === item.id;
    const isUnlock = UNLOCK_CATEGORIES.includes(item.category);

    const borderClass = isEquipped
      ? 'border-green-500'
      : isOwned
        ? 'border-blue-500'
        : item.availableUntil
          ? 'border-amber-500'
          : !canAfford
            ? 'border-slate-700 opacity-60'
            : 'border-slate-700';

    // Preview swatch (56×56)
    const swatchEl = isUnlock ? (
      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700 flex items-center justify-center text-purple-400">
        {item.icon ? renderItemIcon(item.icon) : <Sparkles size={24} />}
      </div>
    ) : item.icon ? (
      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700/60 flex items-center justify-center text-white">
        {renderItemIcon(item.icon)}
      </div>
    ) : item.color === 'rainbow' ? (
      <div
        className="w-14 h-14 rounded-xl flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0088)' }}
      />
    ) : item.color ? (
      <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ backgroundColor: item.color }} />
    ) : (
      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700" />
    );

    // Limited-time: show countdown if within 30 days (was: only ≤7 days)
    const limitedCountdown = item.availableUntil ? (() => {
      const daysLeft = Math.ceil((new Date(item.availableUntil) - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft > 0 ? `⏱ ${daysLeft}d left` : 'Expired';
    })() : null;

    // Action button
    let actionEl;
    if (isUnlock) {
      actionEl = isOwned ? (
        <div className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-900 border border-blue-700 text-blue-200 text-sm font-medium whitespace-nowrap">
          <Check size={14} /> Owned
        </div>
      ) : (
        <button
          onClick={() => handlePurchase(item)}
          disabled={!canAfford || isLoading}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${canAfford && !isLoading ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
        >
          {isLoading ? '...' : !canAfford ? 'Need coins' : 'Unlock'}
        </button>
      );
    } else if (isEquipped) {
      actionEl = (
        <div className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-800 border border-green-600 text-green-200 text-sm font-medium whitespace-nowrap">
          <Check size={14} /> Equipped
        </div>
      );
    } else if (isOwned) {
      actionEl = (
        <button
          onClick={() => handleEquip(item)}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {isLoading ? '...' : 'Equip'}
        </button>
      );
    } else {
      actionEl = (
        <button
          onClick={() => handlePurchase(item)}
          disabled={!canAfford || isLoading}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${canAfford && !isLoading ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
        >
          {isLoading ? '...' : !canAfford ? 'Need coins' : 'Purchase'}
        </button>
      );
    }

    return (
      <div
        key={item.id}
        className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-slate-900 transition-colors ${borderClass}`}
      >
        {swatchEl}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-white font-semibold text-sm">{item.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 capitalize ${RARITY_STYLES[item.rarity] || RARITY_STYLES.common}`}>
              {item.rarity}
            </span>
            {item.availableUntil && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 flex-shrink-0">LIMITED</span>
            )}
          </div>
          <p className="text-slate-400 text-xs truncate">{item.description || item.category}</p>
          {limitedCountdown && (
            <p className="text-amber-400 text-xs mt-0.5">{limitedCountdown}</p>
          )}
        </div>

        {/* Price + action */}
        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1.5">
          {!isOwned && (
            <div className="flex items-center gap-1 justify-end">
              <Coins size={13} className="text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">{item.cost.toLocaleString()}</span>
            </div>
          )}
          {actionEl}
        </div>
      </div>
    );
  })}
</div>
```

> **Important:** The `RainbowSwatch` component is no longer needed since the swatch rendering is now inline in the card. You can leave it in the file (dead code is fine) or remove it — do not remove it if it's imported elsewhere.

- [ ] **Step 5: Verify in browser**

Navigate to the Forum Shop (open the forum, click the shop button).

Check:
- Tab buttons show counts: "All (12)", "Post Appearance (7)", etc.
- Coin balance has amber-tinted background and larger text
- Items render as horizontal cards (swatch left, info center, price+button right)
- Rarity pill appears inline next to the item name
- Limited-time items show amber border + countdown text under description
- Owned/equipped border colors still work correctly
- "Need coins" state still appears for unaffordable items

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Forum/ForumShop.js
git commit -m "feat: horizontal card layout, tab counts, coin balance polish in ForumShop"
```

---

## Final Verification

- [ ] Run `npm start` from `frontend/` and do a complete walkthrough:
  - Admin Panel → Badges: search, count, delete modal
  - Admin Panel → Content Moderation → Recent Posts: single + bulk delete modal
  - Admin Panel → Content Moderation → Recent Threads: checkbox column, bulk delete modal, relative dates
  - CosmeticsManager: search + category filter, item count, delete modal
  - Forum Shop: tab counts, amber coin balance, horizontal cards, rarity pills, limited countdowns
- [ ] No `window.confirm` calls remain in any of the 4 modified files (run: `grep -n "window.confirm" frontend/src/components/admin/community/BadgesTab.js frontend/src/components/admin/community/ContentModerationTab.js frontend/src/components/Forum/CosmeticsManager.js`)

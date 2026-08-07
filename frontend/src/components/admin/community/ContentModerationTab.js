import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Trash2, AlertTriangle, MessageSquare, Layers, Mail, ShieldAlert } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';
import ConfirmModal from '../../shared/ConfirmModal';

// --- Module-scope helpers (never define inside render — causes DOM remount on every keystroke) ---

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
}

function EmptyState({ message, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-3">
      {Icon && <Icon size={28} className="text-gray-600" />}
      <span>{message}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm inline-block mb-3">
        {message}
      </div>
      {onRetry && (
        <div>
          <button
            onClick={onRetry}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessMessage({ message }) {
  return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-green-400 text-sm">
      {message}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text, maxLen) {
  if (!text) return '—';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

function formatRelative(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
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

// --- Flagged Content Tab ---

function FlaggedContentTab({ authFetch }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [flaggedItems, setFlaggedItems] = useState([]);
  // Fallback recent posts when flagging not implemented
  const [fallbackPosts, setFallbackPosts] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const fetchFlagged = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotImplemented(false);

    try {
      const res = await authFetch(`${API_URL}/admin/forum-content?flagged=true`);

      if (res.status === 404 || res.status === 501) { setNotImplemented(true); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || `Error ${res.status}`);
        return;
      }

      const data = await res.json();
      setFlaggedItems(data.items || data.content || data.posts || []);
    } catch {
      setError('Failed to connect to moderation API');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const fetchFallbackPosts = useCallback(async () => {
    setFallbackLoading(true);
    try {
      const res = await authFetch(`${API_URL}/forum/posts?limit=20&sort=new`);
      if (res.ok) {
        const data = await res.json();
        setFallbackPosts(data.posts || data || []);
      }
    } catch {
      // ignore
    } finally {
      setFallbackLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  useEffect(() => {
    if (notImplemented) {
      fetchFallbackPosts();
    }
  }, [notImplemented, fetchFallbackPosts]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchFlagged} />;

  if (notImplemented) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
          <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-300 text-sm font-medium">No flagging system implemented yet</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              Displaying recent posts below as a fallback.
            </p>
          </div>
        </div>

        {fallbackLoading ? (
          <LoadingSpinner />
        ) : fallbackPosts.length === 0 ? (
          <EmptyState icon={ShieldAlert} message="No recent posts found." />
        ) : (
          <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Content Preview</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Thread</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {fallbackPosts.map((post, idx) => (
                  <tr key={post._id || idx} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-white text-sm">
                      {post.author?.username || post.author?.displayName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm max-w-xs">
                      {truncate(post.content || post.body, 100)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {post.thread?.title || post.threadTitle || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {formatDate(post.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (flaggedItems.length === 0) {
    return <EmptyState icon={ShieldAlert} message="No flagged content." />;
  }

  return (
    <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Author</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Content</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Flagged</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-600">
          {flaggedItems.map((item, idx) => (
            <tr key={item._id || idx} className="hover:bg-gray-700/50 transition-colors">
              <td className="px-4 py-3 text-white text-sm">
                {item.author?.username || item.author?.displayName || '—'}
              </td>
              <td className="px-4 py-3 text-gray-300 text-sm max-w-xs">
                {truncate(item.content || item.body, 100)}
              </td>
              <td className="px-4 py-3 text-yellow-400 text-sm">
                {item.flagReason || item.reason || '—'}
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                {formatDate(item.flaggedAt || item.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Recent Posts Tab ---

function RecentPostsTab({ authFetch }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [pendingDeletePost, setPendingDeletePost] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const timerRef = useRef(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await authFetch(`${API_URL}/forum/posts?limit=50&sort=new`);
      if (res.status === 404) {
        setError('Posts endpoint not available (404).');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setPosts(data.posts || data || []);
    } catch {
      setError('Failed to load posts. The endpoint may not be available.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

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

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map((p) => p._id)));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchPosts} />;
  if (posts.length === 0) return <EmptyState icon={Mail} message="No posts yet." />;

  const allSelected = selected.size === posts.length && posts.length > 0;

  return (
    <div className="space-y-3">
      {successMsg && <SuccessMessage message={successMsg} />}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={fetchPosts}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
        <span className="text-gray-400 text-sm">{posts.length} posts</span>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting…' : `Delete Selected (${selected.size})`}
          </button>
        )}
      </div>

      <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="accent-purple-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Author</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Content Preview</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Thread</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {posts.map((post, idx) => (
              <tr key={post._id || idx} className={`hover:bg-gray-700/50 transition-colors ${selected.has(post._id) ? 'bg-purple-900/20' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(post._id)}
                    onChange={() => toggleSelect(post._id)}
                    className="accent-purple-500 w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <AuthorCell author={post.author} />
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm max-w-xs">
                  <span title={post.content || post.body}>
                    {truncate(post.content || post.body, 100)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {post.thread?.title || post.threadTitle || '—'}
                </td>
                <td
                  className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap"
                  title={formatDate(post.createdAt)}
                >
                  {formatRelative(post.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(post)}
                    disabled={deletingId === post._id}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete post"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}

// --- Recent Threads Tab ---

function RecentThreadsTab({ authFetch }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [pendingDeleteThread, setPendingDeleteThread] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const timerRef = useRef(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await authFetch(`${API_URL}/forum/threads?limit=50&sort=new`);
      if (res.status === 404) {
        setError('Threads endpoint not available (404).');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setThreads(data.threads || data || []);
    } catch {
      setError('Failed to load threads. The endpoint may not be available.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

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

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchThreads} />;
  if (threads.length === 0) return <EmptyState icon={MessageSquare} message="No threads yet." />;

  return (
    <div className="space-y-3">
      {successMsg && <SuccessMessage message={successMsg} />}

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
            {deleting ? 'Deleting…' : `Delete Selected (${selected.size})`}
          </button>
        )}
      </div>

      <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === threads.length && threads.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Author</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Replies</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {threads.map((thread, idx) => (
              <tr key={thread._id || idx} className={`hover:bg-gray-700/50 transition-colors ${selected.has(thread._id) ? 'bg-purple-900/20' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(thread._id)}
                    onChange={() => toggleSelect(thread._id)}
                    className="rounded border-gray-500"
                  />
                </td>
                <td className="px-4 py-3 text-white text-sm font-medium">
                  {thread.title || '(Untitled)'}
                </td>
                <td className="px-4 py-3">
                  <AuthorCell author={thread.author} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {thread.replyCount ?? thread.postCount ?? '—'}
                </td>
                <td
                  className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap"
                  title={formatDate(thread.createdAt)}
                >
                  {formatRelative(thread.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(thread)}
                    disabled={deletingId === thread._id}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}

// --- Tab bar definitions (at module scope) ---
const TABS = [
  { id: 'flagged', label: 'Flagged Content', icon: AlertTriangle },
  { id: 'posts', label: 'Recent Posts', icon: MessageSquare },
  { id: 'threads', label: 'Recent Threads', icon: Layers },
];

// --- Main export ---

export default function ContentModerationTab() {
  const { authFetch } = useAuthContext();
  const [activeTab, setActiveTab] = useState('flagged');

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700 pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'flagged' && <FlaggedContentTab authFetch={authFetch} />}
        {activeTab === 'posts' && <RecentPostsTab authFetch={authFetch} />}
        {activeTab === 'threads' && <RecentThreadsTab authFetch={authFetch} />}
      </div>
    </div>
  );
}

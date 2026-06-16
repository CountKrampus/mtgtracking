import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, History, Lock, Unlock, RefreshCw, X } from 'lucide-react';
import PostComposer from './PostComposer';
import PostEditHistory from './PostEditHistory';
import UserAvatar from '../avatars/UserAvatar';

export default function ThreadView({ threadId, apiUrl, user, onBack, onThreadUpdated, onViewProfile }) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [historyPostId, setHistoryPostId] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/forum/threads/${threadId}?page=${page}&limit=20`
        );
        const data = await response.json();
        setThread(data.thread);
        setPosts(data.posts);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching thread:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [threadId, page, apiUrl]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${apiUrl}/forum/categories`);
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, [apiUrl]);

  const handleRenameThread = async () => {
    if (!newTitle.trim()) return;

    try {
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });

      if (response.ok) {
        const updated = await response.json();
        setThread(updated);
        setShowRenameModal(false);
        setNewTitle('');
        onThreadUpdated?.();
      }
    } catch (error) {
      alert('Failed to rename thread');
    }
  };

  const handleDeleteThread = async () => {
    if (!window.confirm('Are you sure you want to delete this thread? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        onBack();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete thread');
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      alert('Failed to delete thread');
    }
  };

  const handleMoveThread = async () => {
    if (!selectedCategoryId) return;

    try {
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategoryId })
      });

      if (response.ok) {
        const updated = await response.json();
        setThread(updated);
        setShowMoveModal(false);
        onThreadUpdated?.();
      }
    } catch (error) {
      alert('Failed to move thread');
    }
  };

  const handleToggleLock = async () => {
    try {
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        setThread(data.thread);
      }
    } catch (error) {
      alert('Failed to lock/unlock thread');
    }
  };

  const handleTogglePin = async () => {
    try {
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        setThread(data.thread);
      }
    } catch (error) {
      alert('Failed to pin/unpin thread');
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts([...posts, newPost]);
    setThread(prev => ({
      ...prev,
      postCount: prev.postCount + 1,
      lastPostAt: new Date(),
      lastPostAuthorId: user._id
    }));
  };

  const handleEditPost = async (postId) => {
    if (!editBody.trim()) return;

    try {
      const response = await fetch(`${apiUrl}/forum/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody, reason: 'User edit' })
      });

      if (response.ok) {
        const updated = await response.json();
        setPosts(posts.map(p => p._id === postId ? updated : p));
        setEditingPostId(null);
        setEditBody('');
      }
    } catch (error) {
      console.error('Error editing post:', error);
    }
  };

  if (!threadId) {
    return <div className="flex-1 p-6 text-slate-400">Select a thread</div>;
  }

  if (loading && !thread) {
    return <div className="flex-1 p-6 text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <button
        onClick={onBack}
        className="mb-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        ← Back
      </button>

      {thread && (
        <>
          <div className="mb-6 pb-6 border-b border-slate-700">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-3xl font-bold text-white">{thread.title}</h1>
              {user?.role === 'admin' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewTitle(thread.title);
                      setShowRenameModal(true);
                    }}
                    className="p-2 hover:bg-slate-700 rounded text-blue-400"
                    title="Rename thread"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategoryId(thread.categoryId);
                      setShowMoveModal(true);
                    }}
                    className="p-2 hover:bg-slate-700 rounded text-purple-400"
                    title="Move to category"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button
                    onClick={handleToggleLock}
                    className={`p-2 hover:bg-slate-700 rounded ${thread.isLocked ? 'text-red-400' : 'text-slate-400'}`}
                    title={thread.isLocked ? 'Unlock thread' : 'Lock thread'}
                  >
                    {thread.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                  </button>
                  <button
                    onClick={handleDeleteThread}
                    className="p-2 hover:bg-slate-700 rounded text-red-500"
                    title="Delete thread"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
            <div className="text-slate-400 text-sm">
              By{' '}
              {onViewProfile ? (
                <button
                  onClick={() => onViewProfile(thread.authorId?.username)}
                  className="text-purple-400 hover:text-purple-300 transition"
                >
                  {thread.authorId?.displayName}
                </button>
              ) : (
                thread.authorId?.displayName
              )}
              {' '}• {thread.views} views • {thread.postCount} posts
              {thread.isLocked && <span className="ml-2 text-red-400">🔒 Locked</span>}
              {thread.isPinned && <span className="ml-2 text-yellow-400">📌 Pinned</span>}
            </div>
          </div>

          {/* Rename Modal */}
          {showRenameModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-bold text-white mb-4">Rename Thread</h3>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowRenameModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenameThread}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Move Modal */}
          {showMoveModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-bold text-white mb-4">Move Thread to Category</h3>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-4"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <optgroup key={cat._id} label={cat.name}>
                      {cat.children?.map((child) => (
                        <option key={child._id} value={child._id}>
                          {cat.name} → {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowMoveModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMoveThread}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
                  >
                    Move
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {posts.map(post => (
              <div key={post._id} className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      {onViewProfile ? (
                        <button
                          onClick={() => onViewProfile(post.authorId?.username)}
                          className="text-purple-400 hover:text-purple-300 transition"
                        >
                          {post.authorId?.displayName || 'Unknown'}
                        </button>
                      ) : (
                        post.authorId?.displayName || 'Unknown'
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(post.createdAt).toLocaleString()}
                      {post.isEdited && ' (edited)'}
                    </div>
                  </div>
                  {user && (user._id === post.authorId._id || user.role === 'admin') && (
                    <div className="flex gap-2">
                      {user._id === post.authorId._id && (
                        <button
                          onClick={() => {
                            setEditingPostId(post._id);
                            setEditBody(post.body);
                          }}
                          className="p-1 hover:bg-slate-700 rounded"
                          title="Edit post"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {post.isEdited && (
                        <button
                          onClick={() => setHistoryPostId(post._id)}
                          className="p-1 hover:bg-slate-700 rounded text-blue-400"
                          title="View edit history"
                        >
                          <History size={16} />
                        </button>
                      )}
                      <button className="p-1 hover:bg-slate-700 rounded text-red-500" title="Delete post">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {editingPostId === post._id ? (
                  <div>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-2"
                      rows="4"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPost(post._id)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-200">{post.body}</div>
                )}
              </div>
            ))}
          </div>

          <PostEditHistory
            postId={historyPostId}
            apiUrl={apiUrl}
            isOpen={!!historyPostId}
            onClose={() => setHistoryPostId(null)}
          />

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-slate-400">
                Page {page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
              >
                Next
              </button>
            </div>
          )}

          {user && !thread.isLocked && (
            <PostComposer
              threadId={threadId}
              apiUrl={apiUrl}
              user={user}
              onPostCreated={handlePostCreated}
            />
          )}
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, History, Lock, Unlock, RefreshCw, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import PostComposer from './PostComposer';
import PostEditHistory from './PostEditHistory';
import UserAvatar from '../avatars/UserAvatar';
import DeckImportButton from './DeckImportButton';
import UserHoverCard from './UserHoverCard';

const FOIL_STYLE = {
  display: 'inline-block',
  background: 'linear-gradient(90deg, #8a6a20 0%, #c0a060 15%, #ffe88a 30%, #fff 50%, #ffe88a 70%, #c0a060 85%, #8a6a20 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  animation: 'foil-shimmer 3s linear infinite',
};

function renderBadgeIcon(iconStr) {
  if (!iconStr) return null;
  if (iconStr.startsWith('mana:')) {
    const key = iconStr.slice(5);
    return <i className={`ms ms-${key}`} style={{ fontSize: 13, verticalAlign: 'middle' }} />;
  }
  if (iconStr.startsWith('lucide:')) {
    const name = iconStr.slice(7);
    const Icon = LucideIcons[name];
    if (Icon) return <Icon size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />;
  }
  return null;
}

function hexWithAlpha(hex, alpha) {
  if (!hex) return undefined;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

function findPostById(nodes, id) {
  if (!nodes || !id) return null;
  for (const node of nodes) {
    if (node._id === id || node._id?.toString() === id?.toString()) return node;
    if (node.replies?.length) {
      const found = findPostById(node.replies, id);
      if (found) return found;
    }
  }
  return null;
}

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function PostNode({ post, isOP, isBestAnswer, user, onViewProfile, onDeletePost, onEditPost, editingPostId, editBody, setEditingPostId, setEditBody, setHistoryPostId }) {
  const [hoverPos, setHoverPos] = useState(null);
  const ac = post.authorCosmetics || {};

  const postWrapperStyle = {
    ...(ac.postBackground?.color ? { backgroundColor: hexWithAlpha(ac.postBackground.color, 0.12) } : {}),
    ...(ac.postFrame?.cssProperties || {}),
  };

  const upvoteCount = post.upvotes?.length || post.upvoteCount || 0;
  const displayName = post.authorId?.displayName || 'Unknown';

  return (
    <div
      key={post._id}
      className={`bg-slate-800 p-4 rounded border border-slate-700${isOP ? ' post-op-spotlight' : ''}${upvoteCount >= 10 ? ' post-upvote-glow' : ''}`}
      style={postWrapperStyle}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2">
          <UserAvatar
            avatarUrl={post.authorId?.avatarUrl}
            username={post.authorId?.username}
            size="sm"
            borderColor={ac.avatarBorder?.color || null}
            animationClass={ac.avatarBorder?.animationClass || null}
          />
          <div
            className="post-nameplate"
            style={ac.nameplateBackground?.color
              ? { backgroundColor: hexWithAlpha(ac.nameplateBackground.color, 0.25) }
              : ac.nameplateBackground?.cssProperties
              ? ac.nameplateBackground.cssProperties
              : {}}
          >
            <div className="font-semibold text-white flex items-center flex-wrap gap-x-1">
              {onViewProfile ? (
                <span
                  className="font-medium text-sm cursor-pointer hover:text-purple-300 transition"
                  style={
                    ac.titleColor?.animationClass === 'text-foil'
                      ? FOIL_STYLE
                      : ac.titleColor?.color === 'rainbow'
                        ? {}
                        : ac.titleColor?.color
                          ? { color: ac.titleColor.color }
                          : {}
                  }
                  onMouseEnter={e => setHoverPos({ x: e.clientX, y: e.clientY, post })}
                  onMouseLeave={() => setHoverPos(null)}
                  onClick={() => onViewProfile(post.authorId?.username)}
                >
                  {displayName}
                </span>
              ) : (
                <span
                  className="font-medium text-sm cursor-pointer hover:text-purple-300 transition"
                  style={
                    ac.titleColor?.animationClass === 'text-foil'
                      ? FOIL_STYLE
                      : ac.titleColor?.color === 'rainbow'
                        ? {}
                        : ac.titleColor?.color
                          ? { color: ac.titleColor.color }
                          : {}
                  }
                  onMouseEnter={e => setHoverPos({ x: e.clientX, y: e.clientY, post })}
                  onMouseLeave={() => setHoverPos(null)}
                >
                  {displayName}
                </span>
              )}
              {isOP && <span className="text-amber-400 text-xs ml-1" title="Thread starter">👑</span>}
              {ac.flairIcon?.icon && (
                <span className="ml-1">{renderBadgeIcon(ac.flairIcon.icon)}</span>
              )}
              {isOP && <span className="ml-1 text-[10px] bg-purple-800/50 text-purple-300 px-1.5 py-0.5 rounded">OP</span>}
              {isBestAnswer && <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-700/30 px-1.5 py-0.5 rounded">✅ Best</span>}
              {post.authorReputation > 0 && (
                <span className="text-amber-400 text-xs font-semibold ml-1">⚡ {post.authorReputation}</span>
              )}
              {(post.authorBadges || []).slice(0, 3).map((badge, i) => (
                <span key={i} className="text-sm ml-0.5" title={badge.name}>
                  {BADGE_EMOJI[badge.name] || '🏅'}
                </span>
              ))}
              {hoverPos && (
                <UserHoverCard
                  pos={hoverPos}
                  username={post.authorId?.username}
                  displayName={post.authorId?.displayName}
                  reputation={post.authorReputation || 0}
                  badges={post.authorBadges || []}
                  onClose={() => setHoverPos(null)}
                />
              )}
            </div>
            {ac.memberTitleText && (
              <div className="text-xs text-slate-500 italic">{ac.memberTitleText}</div>
            )}
            {(ac.formatBadge?.icon || ac.formatBadge?.name) && (
              <div className="text-xs mt-0.5" style={ac.formatBadge.color ? { color: ac.formatBadge.color } : { color: '#94a3b8' }}>
                {ac.formatBadge.icon || ac.formatBadge.name}
              </div>
            )}
            {ac.manaIdentity && ac.manaIdentity.length > 0 && (
              <div className="flex gap-0.5 mt-1">
                {ac.manaIdentity.map(color => (
                  <div
                    key={color}
                    className={`w-3 h-3 rounded-full mana-pip-${color}`}
                    title={color}
                  />
                ))}
              </div>
            )}
            <div className="text-xs text-slate-500">
              {new Date(post.createdAt).toLocaleString()}
              {post.isEdited && ' (edited)'}
            </div>
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
            <button
              onClick={() => onDeletePost(post._id)}
              className="p-1 hover:bg-slate-700 rounded text-red-500"
              title="Delete post"
            >
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
              onClick={() => onEditPost(post._id)}
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
        <>
          <div className="text-slate-200">{post.body}</div>
          {ac.signatureText && (
            <>
              <hr className="border-slate-700 my-2" />
              <p className="text-xs italic text-slate-500">{ac.signatureText}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ThreadView({ threadId, apiUrl, user, onBack, onThreadUpdated, onViewProfile, refreshKey = 0 }) {
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
  }, [threadId, page, apiUrl, refreshKey]);

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
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}`, {
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
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/threads/${threadId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
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

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (response.ok) {
        setPosts(posts.filter(p => p._id !== postId));
        setThread(prev => ({
          ...prev,
          postCount: prev.postCount - 1
        }));
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
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

  const bestAnswerPost = thread?.isQA && thread?.bestAnswerPostId
    ? findPostById(posts, thread.bestAnswerPostId)
    : null;

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
            <div className="flex items-center gap-2 mb-2">
              <DeckImportButton threadId={threadId} user={user} />
            </div>
            <div className="text-slate-400 text-sm flex items-center flex-wrap gap-x-1">
              By{' '}
              {onViewProfile ? (
                <button
                  onClick={() => onViewProfile(thread.authorId?.username)}
                  className="text-purple-400 hover:text-purple-300 transition"
                >
                  {thread.authorId?.displayName || thread.authorId?.username || 'Unknown'}
                </button>
              ) : (
                thread.authorId?.displayName || thread.authorId?.username || 'Unknown'
              )}
              {thread.authorReputation > 0 && (
                <span className="text-amber-400 text-xs font-semibold ml-1">⚡ {thread.authorReputation}</span>
              )}
              {(thread.authorBadges || []).slice(0, 3).map((badge, i) => (
                <span key={i} className="text-sm ml-0.5" title={badge.name}>{BADGE_EMOJI[badge.name] || '🏅'}</span>
              ))}
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

          {/* Best answer pin */}
          {bestAnswerPost && (
            <div className="mb-4">
              <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>✅ Best Answer</span>
                <span className="text-white/30">— {bestAnswerPost.upvotes?.length || bestAnswerPost.upvoteCount || 0} upvote{(bestAnswerPost.upvotes?.length || bestAnswerPost.upvoteCount || 0) !== 1 ? 's' : ''}</span>
              </div>
              <div className="border border-green-700/40 bg-green-900/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(bestAnswerPost.authorId?.displayName || bestAnswerPost.authorId?.username || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{bestAnswerPost.authorId?.displayName || bestAnswerPost.authorId?.username}</span>
                </div>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {bestAnswerPost.body || ''}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {posts.map(post => (
              <PostNode
                key={post._id}
                post={post}
                isOP={thread.authorId?._id === post.authorId?._id || thread.authorId === post.authorId?._id}
                isBestAnswer={!!(thread?.bestAnswerPostId && (post._id === thread.bestAnswerPostId || post._id?.toString() === thread.bestAnswerPostId?.toString()))}
                user={user}
                onViewProfile={onViewProfile}
                onDeletePost={handleDeletePost}
                onEditPost={handleEditPost}
                editingPostId={editingPostId}
                editBody={editBody}
                setEditingPostId={setEditingPostId}
                setEditBody={setEditBody}
                setHistoryPostId={setHistoryPostId}
              />
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

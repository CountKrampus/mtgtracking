import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, History } from 'lucide-react';
import PostComposer from './PostComposer';
import PostEditHistory from './PostEditHistory';

export default function ThreadView({ threadId, apiUrl, user, onBack }) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [historyPostId, setHistoryPostId] = useState(null);

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
            <h1 className="text-3xl font-bold text-white mb-2">{thread.title}</h1>
            <div className="text-slate-400 text-sm">
              By {thread.authorId?.displayName} • {thread.views} views • {thread.postCount} posts
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {posts.map(post => (
              <div key={post._id} className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      {post.authorId?.displayName || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(post.createdAt).toLocaleString()}
                      {post.isEdited && ' (edited)'}
                    </div>
                  </div>
                  {user && user._id === post.authorId._id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingPostId(post._id);
                          setEditBody(post.body);
                        }}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setHistoryPostId(post._id)}
                        className="p-1 hover:bg-slate-700 rounded text-blue-400"
                      >
                        <History size={16} />
                      </button>
                      <button className="p-1 hover:bg-slate-700 rounded text-red-500">
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

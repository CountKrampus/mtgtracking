import React, { useState, useEffect } from 'react';
import { Plus, Lock, Pin, ArrowLeft } from 'lucide-react';
import ThreadComposer from './ThreadComposer';

export default function CategoryView({ categoryId, apiUrl, onThreadSelect, user, onBack, onViewProfile }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showComposer, setShowComposer] = useState(false);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    if (!categoryId) return;
    const fetchCategory = async () => {
      try {
        const response = await fetch(`${apiUrl}/forum/categories/${categoryId}`);
        if (response.ok) {
          const data = await response.json();
          setCategory(data);
        }
      } catch (error) {
        console.error('Error fetching category:', error);
      }
    };
    fetchCategory();
  }, [categoryId, apiUrl]);

  useEffect(() => {
    if (!categoryId) return;

    const fetchThreads = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/forum/categories/${categoryId}/threads?page=${page}&limit=20`
        );
        const data = await response.json();
        setThreads(data.threads);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching threads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [categoryId, page, apiUrl]);

  if (!categoryId) {
    return <div className="flex-1 p-6 text-slate-400">Select a category</div>;
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded transition text-white/60 hover:text-white"
              title="Back to forum"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="text-2xl font-bold text-white">Threads</h2>
        </div>
        {user && (
          <button
            onClick={() => setShowComposer(true)}
            className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2 transition"
          >
            <Plus size={18} />
            New Thread
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : !threads || threads.length === 0 ? (
        <div className="text-slate-400">No threads in this category yet</div>
      ) : (
        <div className="space-y-3">
          {threads.map(thread => (
            <button
              key={thread._id}
              onClick={() => onThreadSelect(thread._id)}
              className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {thread.isPinned && (
                      <Pin size={14} className="text-yellow-400 flex-shrink-0" />
                    )}
                    {thread.isQA && thread.bestAnswerPostId && (
                      <span className="bg-green-900/30 text-green-400 border border-green-700/30 text-[10px] px-2 py-0.5 rounded whitespace-nowrap">✅ Answered</span>
                    )}
                    {thread.isQA && !thread.bestAnswerPostId && (
                      <span className="bg-blue-900/30 text-blue-300 border border-blue-700/30 text-[10px] px-2 py-0.5 rounded whitespace-nowrap">❓ Unanswered</span>
                    )}
                    {!thread.isQA && (
                      <span className="bg-gray-700/20 text-gray-500 border border-gray-700/20 text-[10px] px-2 py-0.5 rounded whitespace-nowrap">💬 Discussion</span>
                    )}
                    <h3
                      className="font-semibold text-white"
                      style={thread.authorHighlightColor ? { color: thread.authorHighlightColor } : {}}
                    >{thread.title}</h3>
                    {thread.isLocked && (
                      <Lock size={14} className="text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    By{' '}
                    {onViewProfile ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProfile(thread.authorId?.username);
                        }}
                        className="text-purple-400 hover:text-purple-300 transition"
                      >
                        {thread.authorId?.displayName || 'Unknown'}
                      </button>
                    ) : (
                      thread.authorId?.displayName || 'Unknown'
                    )}
                    {' '}• {thread.postCount} posts
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">{thread.views} views</div>
                  <div className="text-xs text-slate-500">
                    {new Date(thread.lastPostAt || thread.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagination?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-slate-400">
            Page {page} of {pagination?.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination?.pages, p + 1))}
            disabled={page === pagination?.pages}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Next
          </button>
        </div>
      )}

      {/* New Thread Composer */}
      <ThreadComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        categoryId={categoryId}
        apiUrl={apiUrl}
        user={user}
        categoryIsQA={category?.isQA || false}
        onThreadCreated={(newThread) => {
          setShowComposer(false);
          // Add the new thread to the top of the list (re-fetch to be safe with pagination)
          setPage(1);
          setThreads(prev => [newThread, ...prev]);
        }}
      />
    </div>
  );
}

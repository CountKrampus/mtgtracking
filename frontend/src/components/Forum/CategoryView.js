import React, { useState, useEffect } from 'react';
import { Plus, Lock } from 'lucide-react';

export default function CategoryView({ categoryId, apiUrl, onThreadSelect, user }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

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
        <h2 className="text-2xl font-bold text-white">Threads</h2>
        {user && (
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2">
            <Plus size={18} />
            New Thread
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : threads.length === 0 ? (
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
                    <h3 className="font-semibold text-white">{thread.title}</h3>
                    {thread.isLocked && (
                      <Lock size={14} className="text-red-500" />
                    )}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    By {thread.authorId?.displayName || 'Unknown'} • {thread.postCount} posts
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

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
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
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function SpamBadge({ rate }) {
  const pct = (rate * 100).toFixed(1);
  if (rate < 0.05) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/40">
        {pct}%
      </span>
    );
  }
  if (rate <= 0.15) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
        {pct}%
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">
      {pct}%
    </span>
  );
}

export default function CategoryHealthTab() {
  const { authFetch } = useAuthContext();
  const [windowDays, setWindowDays] = useState(7);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/forum/category-stats?window=${windowDays}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load category health stats');
    } finally {
      setLoading(false);
    }
  }, [authFetch, windowDays]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const generatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toLocaleString()
    : null;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Category Health</h3>
        {/* Window toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setWindowDays(7)}
            className={`px-4 py-1 rounded-l-md text-sm font-medium border transition ${
              windowDays === 7
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setWindowDays(30)}
            className={`px-4 py-1 rounded-r-md text-sm font-medium border-t border-b border-r transition ${
              windowDays === 30
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            30d
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={fetchStats}
            className="ml-3 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          <span className="ml-3 text-slate-400 text-sm">Loading stats…</span>
        </div>
      )}

      {/* Data table */}
      {!loading && !error && stats && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Category</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">New Threads</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">New Posts</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Posts/Day</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Unique Authors</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Avg Replies/Thread</th>
                  <th className="text-right px-4 py-3 text-slate-300 font-semibold">Spam Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center px-4 py-8 text-slate-500">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  stats.categories.map((cat, idx) => (
                    <tr
                      key={cat.categoryId}
                      className={`border-b border-slate-700/50 transition ${
                        idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'
                      } hover:bg-slate-700/30`}
                    >
                      <td className="px-4 py-3 text-white font-medium">{cat.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.newThreads}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.newPosts}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {cat.postsPerDay.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{cat.uniqueAuthors}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {cat.avgRepliesPerThread.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SpamBadge rate={cat.spamRate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {generatedAt && (
            <p className="text-xs text-slate-500 text-right">
              Stats as of {generatedAt}
            </p>
          )}
        </>
      )}
    </div>
  );
}

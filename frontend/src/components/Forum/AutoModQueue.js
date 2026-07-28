import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Flag } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

const BADGE_COLORS = {
  hide_and_warn: 'bg-red-500 text-white',
  hide_post: 'bg-orange-500 text-white',
  review: 'bg-yellow-500 text-black',
};

function SuggestedActionBadge({ action }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${BADGE_COLORS[action] || 'bg-gray-400 text-white'}`}>
      {action}
    </span>
  );
}

const CONTENT_TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Posts', value: 'post' },
  { label: 'Threads', value: 'thread' },
];

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Actioned', value: 'actioned' },
  { label: 'Dismissed', value: 'dismissed' },
];

export default function AutoModQueue() {
  const { authFetch } = useAuthContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);
      const res = await authFetch(`${API_URL}/admin/moderation-queue?${params.toString()}`, {
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch moderation queue:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, contentTypeFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleAction = async (contentId, contentType, action) => {
    setActionInProgress(contentId);
    try {
      const res = await authFetch(
        `${API_URL}/admin/moderation-queue/${contentId}/action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, contentType }),
        }
      );
      if (res.ok) {
        await fetchQueue();
      }
    } catch (err) {
      console.error('Moderation action failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Flag size={20} />
          Moderation Queue
        </h2>
        <button
          aria-label="Refresh"
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {CONTENT_TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setContentTypeFilter(value)}
              className={`px-3 py-1 rounded text-sm ${
                contentTypeFilter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-white/60 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-white/60 text-sm">No items in queue.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-left text-white/60">
                <th className="pb-2 pr-3">Content Preview</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Author</th>
                <th className="pb-2 pr-3">Reports</th>
                <th className="pb-2 pr-3">Reasons</th>
                <th className="pb-2 pr-3">Suggested Action</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.contentId}
                  className="border-b border-white/10 hover:bg-white/5"
                >
                  <td className="py-2 pr-3 max-w-xs truncate" title={item.contentPreview}>
                    {item.contentPreview || <span className="text-white/40 italic">Deleted</span>}
                  </td>
                  <td className="py-2 pr-3 capitalize">{item.contentType}</td>
                  <td className="py-2 pr-3">{item.authorUsername}</td>
                  <td className="py-2 pr-3 font-semibold">{item.reportCount}</td>
                  <td className="py-2 pr-3">
                    <span className="text-white/70">{item.reasons.join(', ')}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <SuggestedActionBadge action={item.suggestedAction} />
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => handleAction(item.contentId, item.contentType, 'hide')}
                        disabled={actionInProgress === item.contentId}
                        className="px-2 py-0.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium disabled:opacity-50"
                      >
                        Hide
                      </button>
                      <button
                        onClick={() => handleAction(item.contentId, item.contentType, 'hide_and_warn')}
                        disabled={actionInProgress === item.contentId}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium disabled:opacity-50"
                      >
                        Hide + Warn
                      </button>
                      <button
                        onClick={() => handleAction(item.contentId, item.contentType, 'dismiss')}
                        disabled={actionInProgress === item.contentId}
                        className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// --- Module-scope helpers (never define inside render — causes DOM remount on every keystroke) ---

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
      {message}
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

function NotImplementedState() {
  return (
    <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
      <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-yellow-300 text-sm font-medium">No feedback system implemented</p>
        <p className="text-yellow-400/70 text-xs mt-0.5">
          Feedback submissions would appear here.
        </p>
        <p className="text-yellow-400/70 text-xs mt-1 font-mono">
          To enable feedback, add a <code className="bg-yellow-900/30 px-1 rounded">POST /api/feedback</code> endpoint and <code className="bg-yellow-900/30 px-1 rounded">GET /api/admin/feedback</code> endpoint to the backend.
        </p>
      </div>
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

function getCategoryColor(category) {
  switch (category?.toLowerCase()) {
    case 'bug':
      return 'bg-red-500/20 text-red-300 border border-red-500/30';
    case 'feature':
      return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    default:
      return 'bg-gray-600/30 text-gray-300 border border-gray-600/30';
  }
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    case 'reviewed':
      return 'bg-green-500/20 text-green-300 border border-green-500/30';
    case 'closed':
      return 'bg-gray-600/20 text-gray-300 border border-gray-600/30';
    default:
      return 'bg-gray-600/20 text-gray-300 border border-gray-600/30';
  }
}

function CategoryBadge({ category }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(category)}`}>
      {category || 'Other'}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status || 'Pending'}
    </span>
  );
}

// --- Main Feedback Component ---

export default function FeedbackTab() {
  const { authFetch } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const timerRef = useRef(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotImplemented(false);

    try {
      const res = await authFetch(`${API_URL}/admin/feedback`);

      if (res.status === 404) {
        setNotImplemented(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || `Error ${res.status}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setFeedback(data.feedback || data || []);
    } catch {
      setError('Failed to connect to feedback API');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const updateStatus = useCallback(async (id, status) => {
    try {
      const res = await authFetch(`${API_URL}/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      // Merge in just the updated status rather than replacing the whole row -
      // the PATCH response's submitter is an unpopulated ObjectId (unlike
      // GET's populated one), so replacing the full row would regress the
      // Submitter column to a raw Mongo ID until the next full refresh.
      setFeedback((prev) => prev.map((f) => (f._id === id ? { ...f, status: data.feedback.status } : f)));
    } catch (err) {
      console.error('Error updating feedback status:', err);
      alert('Failed to update feedback status');
    }
  }, [authFetch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchFeedback} />;
  if (notImplemented) return <NotImplementedState />;
  if (feedback.length === 0) return <EmptyState message="No feedback submissions found." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={fetchFeedback}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
        <span className="text-gray-400 text-sm">{feedback.length} feedback items</span>
      </div>

      <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Submitter</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Message</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {feedback.map((item, idx) => (
              <tr key={item._id || idx} className="hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3 text-white text-sm">
                  {typeof item.submitter === 'object'
                    ? item.submitter?.username || item.submitter?.displayName || '—'
                    : item.submitter || '—'}
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm max-w-xs">
                  <span title={item.message}>
                    {truncate(item.message, 120)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <CategoryBadge category={item.category} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {item.status !== 'reviewed' && item.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(item._id, 'reviewed')}
                        className="p-1 text-green-400 hover:text-green-300 transition-colors"
                        title="Mark as reviewed"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {item.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(item._id, 'closed')}
                        className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                        title="Close"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

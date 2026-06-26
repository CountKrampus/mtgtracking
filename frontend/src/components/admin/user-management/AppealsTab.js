import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// DenyModal defined at module scope to prevent DOM remount on every keystroke
function DenyModal({ appeal, onClose, onSubmit }) {
  const [decisionReason, setDecisionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!decisionReason.trim()) return;
    setSubmitting(true);
    await onSubmit(appeal._id, decisionReason.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-t-2xl sm:rounded-lg p-6 w-full sm:max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-1">Deny Appeal</h3>
        <p className="text-sm text-gray-400 mb-4">
          Provide a reason for denying the appeal from{' '}
          <span className="text-white font-medium">
            {appeal.userId?.username || 'Unknown User'}
          </span>
          .
        </p>
        <textarea
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500"
          rows={4}
          placeholder="Reason for denial..."
          value={decisionReason}
          onChange={(e) => setDecisionReason(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !decisionReason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Denying...' : 'Deny Appeal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
    approved: 'bg-green-500/20 text-green-300 border border-green-500/50',
    denied: 'bg-red-500/20 text-red-300 border border-red-500/50',
  };
  const cls = styles[status] || 'bg-gray-500/20 text-gray-300 border border-gray-500/50';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function AppealsTab() {
  const { authFetch } = useAuthContext();

  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [appeals, setAppeals] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [denyTarget, setDenyTarget] = useState(null); // appeal object for deny modal

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter ? `status=${statusFilter}&` : '';
      const res = await authFetch(
        `${API_URL}/admin/ban-appeals?${statusParam}page=${page}&limit=50`
      );
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setAppeals(Array.isArray(data.appeals) ? data.appeals : []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load appeals');
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, page]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleApprove = async (id) => {
    const confirmed = window.confirm('Approve this appeal? The user will be unbanned.');
    if (!confirmed) return;
    try {
      const res = await authFetch(`${API_URL}/admin/ban-appeals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', decisionReason: 'Approved by admin' }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await fetchAppeals();
    } catch (err) {
      alert(`Failed to approve appeal: ${err.message}`);
    }
  };

  const handleDenySubmit = async (id, decisionReason) => {
    try {
      const res = await authFetch(`${API_URL}/admin/ban-appeals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied', decisionReason }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setDenyTarget(null);
      await fetchAppeals();
    } catch (err) {
      alert(`Failed to deny appeal: ${err.message}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const truncate = (text, maxLen = 100) => {
    if (!text) return '—';
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  };

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Ban Appeals</h2>
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="border border-red-500/50 bg-red-500/10 rounded-lg p-4 text-center">
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button
            onClick={fetchAppeals}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          {appeals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No appeals found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Ban Reason</th>
                    <th className="px-4 py-3 font-medium">Appeal Text</th>
                    <th className="px-4 py-3 font-medium">Submitted At</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions / Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {appeals.map((appeal) => (
                    <tr key={appeal._id} className="bg-gray-800 hover:bg-gray-700 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">
                          {appeal.userId?.username || 'Unknown'}
                        </div>
                        {appeal.userId?.email && (
                          <div className="text-gray-400 text-xs">{appeal.userId.email}</div>
                        )}
                      </td>

                      {/* Ban Reason */}
                      <td className="px-4 py-3 text-gray-300 max-w-[180px]">
                        <span title={appeal.banId?.reason || ''}>
                          {truncate(appeal.banId?.reason, 80)}
                        </span>
                      </td>

                      {/* Appeal Text */}
                      <td className="px-4 py-3 text-gray-300 max-w-[220px]">
                        <span title={appeal.appealText || ''}>
                          {truncate(appeal.appealText, 100)}
                        </span>
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {formatDate(appeal.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={appeal.status} />
                      </td>

                      {/* Actions / Review Info */}
                      <td className="px-4 py-3">
                        {appeal.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            {/* Approve */}
                            <button
                              onClick={() => handleApprove(appeal._id)}
                              title="Approve appeal"
                              className="p-1 rounded bg-green-500/20 hover:bg-green-500/40 text-green-300 border border-green-500/50 transition-colors"
                            >
                              <Check size={16} />
                            </button>
                            {/* Deny */}
                            <button
                              onClick={() => setDenyTarget(appeal)}
                              title="Deny appeal"
                              className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/50 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs space-y-1">
                            {appeal.reviewedBy?.username && (
                              <div className="text-gray-400">
                                By:{' '}
                                <span className="text-gray-300">
                                  {appeal.reviewedBy.username}
                                </span>
                              </div>
                            )}
                            {appeal.decisionReason && (
                              <div
                                className="text-gray-400 max-w-[180px]"
                                title={appeal.decisionReason}
                              >
                                {truncate(appeal.decisionReason, 80)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deny Modal */}
      {denyTarget && (
        <DenyModal
          appeal={denyTarget}
          onClose={() => setDenyTarget(null)}
          onSubmit={handleDenySubmit}
        />
      )}
    </div>
  );
}

export default AppealsTab;

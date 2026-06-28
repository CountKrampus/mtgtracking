import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Play, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// ─── Module-scope helpers ──────────────────────────────────────────────────────

const ISSUE_TYPE_BADGES = {
  missing_price: { label: 'Missing Price', className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50' },
  missing_set: { label: 'Missing Set', className: 'bg-orange-900/60 text-orange-300 border-orange-700/50' },
  missing_scryfall_id: { label: 'Missing Scryfall ID', className: 'bg-red-900/60 text-red-300 border-red-700/50' },
  invalid_quantity: { label: 'Invalid Qty', className: 'bg-red-900/60 text-red-300 border-red-700/50' },
  duplicate_entry: { label: 'Duplicate', className: 'bg-orange-900/60 text-orange-300 border-orange-700/50' },
  missing_condition: { label: 'Missing Cond.', className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50' },
};

function IssueTypeBadge({ type }) {
  const config = ISSUE_TYPE_BADGES[type] || {
    label: type || 'Unknown',
    className: 'bg-gray-700/60 text-gray-300 border-gray-600/50',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function AuditStatusBadge({ status }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
        <RefreshCw size={11} className="animate-spin" />
        Running
      </span>
    );
  }
  if (status === 'complete' || status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/60 text-green-300 border border-green-700/50">
        <CheckCircle size={11} />
        Complete
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-300 border border-red-700/50">
        <AlertCircle size={11} />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/60 text-gray-300 border border-gray-600/50">
      <Clock size={11} />
      {status || 'Unknown'}
    </span>
  );
}

function AuditHistoryItem({ audit, isSelected, onClick }) {
  const issueCount = audit.issueCount ?? (Array.isArray(audit.issues) ? audit.issues.length : 0);
  const ranAt = audit.ranAt ? new Date(audit.ranAt).toLocaleString() : '—';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-purple-900/40 border-purple-600/60'
          : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{audit.auditName || 'Unnamed Audit'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ranAt}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AuditStatusBadge status={audit.status} />
          <ChevronRight size={14} className="text-gray-500" />
        </div>
      </div>
      <div className="mt-1.5 text-xs text-gray-400">
        {issueCount} issue{issueCount !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

function IssueRow({ issue, index, auditId, onResolved, authFetch }) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  const handleMarkResolved = async () => {
    setResolving(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/audits/${auditId}/issues/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onResolved();
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const flaggedAt = issue.flaggedAt ? new Date(issue.flaggedAt).toLocaleDateString() : '—';

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/20">
      <td className="px-3 py-2.5">
        <IssueTypeBadge type={issue.type} />
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-200">
        {issue.cardName || issue.cardId || '—'}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-400">{flaggedAt}</td>
      <td className="px-3 py-2.5 text-sm">
        {issue.resolved ? (
          <span className="inline-flex items-center gap-1 text-green-400">
            <CheckCircle size={13} />
            Yes
          </span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={handleMarkResolved}
              disabled={resolving}
              className="text-xs px-2 py-1 rounded bg-purple-700/50 hover:bg-purple-600/60 text-purple-200 border border-purple-600/50 disabled:opacity-50 transition-colors"
            >
              {resolving ? (
                <RefreshCw size={11} className="animate-spin inline mr-1" />
              ) : null}
              {resolving ? 'Saving…' : 'Mark resolved'}
            </button>
            {error && <span className="text-red-400 text-xs">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

function AuditDetailPanel({ auditId, authFetch }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAudit = useCallback(async () => {
    if (!auditId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/audits/${auditId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAudit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auditId, authFetch]);

  useEffect(() => {
    setAudit(null);
    fetchAudit();
  }, [fetchAudit]);

  if (!auditId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Select an audit to view details</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading audit…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <AlertCircle size={28} className="mx-auto mb-2" />
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchAudit}
            className="mt-3 text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!audit) return null;

  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  const ranAt = audit.ranAt ? new Date(audit.ranAt).toLocaleString() : '—';
  const completedAt = audit.completedAt ? new Date(audit.completedAt).toLocaleString() : null;
  const unresolvedCount = issues.filter(i => !i.resolved).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-700/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{audit.auditName || 'Unnamed Audit'}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span>Started: {ranAt}</span>
              {completedAt && <span>Completed: {completedAt}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AuditStatusBadge status={audit.status} />
            <button
              onClick={fetchAudit}
              title="Refresh"
              className="p-1.5 rounded bg-gray-700/60 hover:bg-gray-600/60 text-gray-300 border border-gray-600/50 transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
          <span>{issues.length} total issue{issues.length !== 1 ? 's' : ''}</span>
          <span className="text-red-400">{unresolvedCount} unresolved</span>
          <span className="text-green-400">{issues.length - unresolvedCount} resolved</span>
        </div>
      </div>

      {/* Issues table */}
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <CheckCircle size={28} className="mx-auto mb-2 text-green-600/60" />
              <p className="text-sm">No issues found</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900/95 z-10">
              <tr className="border-b border-gray-700/60">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-36">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Card / Info</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Flagged</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-36">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, idx) => (
                <IssueRow
                  key={idx}
                  issue={issue}
                  index={idx}
                  auditId={audit._id}
                  authFetch={authFetch}
                  onResolved={fetchAudit}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CollectionAuditsTab() {
  const { authFetch } = useAuthContext();

  // Audit history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Selected audit (for detail panel)
  const [selectedAuditId, setSelectedAuditId] = useState(null);

  // Running audit state
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const pollingRef = useRef(null);

  // ── Load history ──────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/audits`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Polling for running audit ─────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollAudit = useCallback(
    (auditId) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const res = await authFetch(`${API_URL}/admin/audits/${auditId}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status !== 'running') {
            stopPolling();
            setRunning(false);
            // Refresh history list and keep this audit selected
            await loadHistory();
            setSelectedAuditId(auditId);
          }
        } catch {
          // ignore poll errors, will retry next tick
        }
      }, 3000);
    },
    [authFetch, stopPolling, loadHistory]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Run audit ─────────────────────────────────────────────────────────────────

  const handleRunAudit = async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);

    const auditName = `Audit ${new Date().toLocaleDateString()}`;
    try {
      const res = await authFetch(`${API_URL}/admin/audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { auditId } = await res.json();

      // Optimistically add to history and select it
      setHistory(prev => [
        { _id: auditId, auditName, status: 'running', ranAt: new Date().toISOString(), issueCount: 0 },
        ...prev,
      ]);
      setSelectedAuditId(auditId);

      // Start polling
      pollAudit(auditId);
    } catch (err) {
      setRunError(err.message);
      setRunning(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col sm:flex-row h-full" style={{ minHeight: '480px' }}>
      {/* ── Left panel: History + Run button ───────────────────────────────────── */}
      <div className="w-full sm:w-1/3 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-700/60 pb-4 mb-4 sm:pb-0 sm:mb-0 sm:pr-4 sm:mr-4">
        {/* Run Audit button */}
        <div className="flex-shrink-0 mb-4">
          <button
            onClick={handleRunAudit}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-700/70 hover:bg-purple-600/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium border border-purple-600/60 transition-colors"
          >
            {running ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play size={15} />
                Run Audit
              </>
            )}
          </button>
          {runError && (
            <p className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-2 py-1">
              {runError}
            </p>
          )}
        </div>

        {/* History header */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-300">Audit History</h3>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            title="Refresh history"
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {historyLoading && history.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <RefreshCw size={16} className="animate-spin mr-2" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : historyError ? (
            <div className="text-center py-6">
              <AlertCircle size={22} className="mx-auto mb-2 text-red-400" />
              <p className="text-xs text-red-400">{historyError}</p>
              <button
                onClick={loadHistory}
                className="mt-2 text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock size={22} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">No audits yet</p>
            </div>
          ) : (
            history.map(audit => (
              <AuditHistoryItem
                key={audit._id}
                audit={audit}
                isSelected={selectedAuditId === audit._id}
                onClick={() => setSelectedAuditId(audit._id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: Audit details ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-lg bg-gray-800/30 border border-gray-700/50">
        <AuditDetailPanel auditId={selectedAuditId} authFetch={authFetch} />
      </div>
    </div>
  );
}

export default CollectionAuditsTab;

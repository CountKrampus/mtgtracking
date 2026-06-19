import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Search, X, Plus, ChevronDown } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// ─── Helpers ────────────────────────────────────────────────────────────────

function escalationClasses(level) {
  if (level >= 3) return 'bg-red-500/20 text-red-300 border border-red-500/50';
  if (level === 2) return 'bg-orange-500/20 text-orange-300 border border-orange-500/50';
  return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function warnedByName(warnedBy) {
  if (!warnedBy) return '—';
  if (typeof warnedBy === 'string') return warnedBy;
  return warnedBy.username || '—';
}

// ─── UserSearchDropdown (module-scope) ──────────────────────────────────────

function UserSearchDropdown({ authFetch, value, onChange, onSelect, placeholder, excludeId }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value changes (e.g. pre-fill)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(`${API_URL}/admin/users?search=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.users || []);
        setResults(excludeId ? list.filter(u => u._id !== excludeId) : list);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, authFetch, excludeId]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(user) {
    setQuery(user.username || user.email || '');
    setOpen(false);
    setResults([]);
    if (onSelect) onSelect(user);
    if (onChange) onChange(user.username || user.email || '');
  }

  function handleChange(e) {
    setQuery(e.target.value);
    if (onChange) onChange(e.target.value);
    // If user clears the input, reset selection
    if (!e.target.value) {
      if (onSelect) onSelect(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder || 'Search users...'}
          className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map(user => (
            <button
              key={user._id}
              type="button"
              onMouseDown={() => handleSelect(user)}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2"
            >
              <span className="font-medium">{user.username}</span>
              {user.email && <span className="text-gray-400 text-xs">{user.email}</span>}
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
          <div className="px-4 py-3 text-sm text-gray-400">No users found</div>
        </div>
      )}
    </div>
  );
}

// ─── IssueWarningModal (module-scope) ────────────────────────────────────────

function IssueWarningModal({ authFetch, initialUser, onClose, onSuccess }) {
  const [selectedUser, setSelectedUser] = useState(initialUser || null);
  const [searchDisplay, setSearchDisplay] = useState(
    initialUser ? (initialUser.username || initialUser.email || '') : ''
  );
  const [reason, setReason] = useState('');
  const [bypassEscalation, setBypassEscalation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select a user.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await authFetch(`${API_URL}/admin/warnings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser._id,
          reason: reason.trim(),
          bypassEscalation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to issue warning.');
        return;
      }
      onSuccess(selectedUser);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 text-white font-semibold">
            <AlertTriangle size={18} className="text-yellow-400" />
            Issue Warning
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* User search */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">User</label>
            <UserSearchDropdown
              authFetch={authFetch}
              value={searchDisplay}
              onChange={setSearchDisplay}
              onSelect={user => {
                setSelectedUser(user);
                if (!user) setSearchDisplay('');
              }}
              placeholder="Search by username or email..."
            />
            {selectedUser && (
              <p className="text-xs text-purple-400 mt-1">
                Selected: {selectedUser.username}{selectedUser.email ? ` (${selectedUser.email})` : ''}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Describe the reason for this warning..."
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Bypass escalation */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bypassEscalation}
              onChange={e => setBypassEscalation(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <span className="text-sm text-gray-300">Bypass escalation</span>
          </label>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm flex items-center gap-1 disabled:opacity-50"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <AlertTriangle size={16} />
              )}
              Issue Warning
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── WarningsSummary (module-scope) ──────────────────────────────────────────

function WarningsSummary({ recentCount, currentEscalation }) {
  return (
    <div className="flex gap-4 mb-4">
      <div className="bg-gray-700 rounded-lg px-4 py-3 flex-1 text-center">
        <div className="text-2xl font-bold text-white">{recentCount}</div>
        <div className="text-xs text-gray-400 mt-1">Warnings (last 90 days)</div>
      </div>
      <div className="bg-gray-700 rounded-lg px-4 py-3 flex-1 text-center">
        <div className="text-sm text-gray-400 mb-1">Current Escalation Level</div>
        {currentEscalation > 0 ? (
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${escalationClasses(currentEscalation)}`}>
            Level {currentEscalation}
          </span>
        ) : (
          <span className="text-green-400 text-sm font-semibold">None</span>
        )}
      </div>
    </div>
  );
}

// ─── WarningsTable (module-scope) ────────────────────────────────────────────

function WarningsTable({ warnings }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-700 text-gray-300">
            <th className="text-left px-4 py-2 font-medium">Reason</th>
            <th className="text-left px-4 py-2 font-medium w-36">Escalation</th>
            <th className="text-left px-4 py-2 font-medium w-32">Warned By</th>
            <th className="text-left px-4 py-2 font-medium w-44">Warned At</th>
          </tr>
        </thead>
        <tbody>
          {warnings.map((w, idx) => (
            <tr
              key={w._id || idx}
              className={`border-t border-gray-700 ${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700/50'} hover:bg-gray-700 transition-colors`}
            >
              <td className="px-4 py-3 text-white break-words max-w-xs">{w.reason || '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${escalationClasses(w.escalationLevel || 1)}`}>
                  Level {w.escalationLevel || 1}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300">{warnedByName(w.warnedBy)}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(w.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main WarningsTab ────────────────────────────────────────────────────────

export function WarningsTab() {
  const { authFetch } = useAuthContext();

  const [selectedUser, setSelectedUser] = useState(null);
  const [searchDisplay, setSearchDisplay] = useState('');

  const [warnings, setWarnings] = useState([]);
  const [recentCount, setRecentCount] = useState(0);
  const [currentEscalation, setCurrentEscalation] = useState(0);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  const [warningsError, setWarningsError] = useState('');

  const [showModal, setShowModal] = useState(false);

  const fetchWarnings = useCallback(async (userId) => {
    setLoadingWarnings(true);
    setWarningsError('');
    try {
      const res = await authFetch(`${API_URL}/admin/warnings/${userId}`);
      const data = await res.json();
      if (!res.ok) {
        setWarningsError(data.message || 'Failed to load warnings.');
        return;
      }
      setWarnings(data.warnings || []);
      setRecentCount(data.recentCount ?? 0);
      setCurrentEscalation(data.currentEscalation ?? 0);
    } catch {
      setWarningsError('Network error. Please try again.');
    } finally {
      setLoadingWarnings(false);
    }
  }, [authFetch]);

  function handleUserSelect(user) {
    if (!user) {
      setSelectedUser(null);
      setWarnings([]);
      setRecentCount(0);
      setCurrentEscalation(0);
      setWarningsError('');
      return;
    }
    setSelectedUser(user);
    fetchWarnings(user._id);
  }

  function handleWarningIssued(user) {
    setShowModal(false);
    // Re-fetch warnings for the currently-viewed user if it's the same one
    if (selectedUser && user && selectedUser._id === user._id) {
      fetchWarnings(selectedUser._id);
    } else if (user) {
      // Switch to the warned user's history
      setSelectedUser(user);
      setSearchDisplay(user.username || user.email || '');
      fetchWarnings(user._id);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar: search + issue warning button */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <UserSearchDropdown
            authFetch={authFetch}
            value={searchDisplay}
            onChange={setSearchDisplay}
            onSelect={handleUserSelect}
            placeholder="Search for a user by username or email..."
          />
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={18} />
          Issue Warning
        </button>
      </div>

      {/* Content area */}
      {!selectedUser ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <AlertTriangle size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Search for a user to see their warning history</p>
          </div>
        </div>
      ) : loadingWarnings ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : warningsError ? (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{warningsError}</span>
          <button
            type="button"
            onClick={() => fetchWarnings(selectedUser._id)}
            className="text-sm underline hover:no-underline ml-4"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Selected user header */}
          <div className="flex items-center gap-2 text-white">
            <span className="font-semibold">{selectedUser.username}</span>
            {selectedUser.email && (
              <span className="text-gray-400 text-sm">({selectedUser.email})</span>
            )}
          </div>

          {/* Summary stats */}
          <WarningsSummary recentCount={recentCount} currentEscalation={currentEscalation} />

          {/* Warnings table or empty state */}
          {warnings.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-sm">No warnings found for this user</p>
            </div>
          ) : (
            <WarningsTable warnings={warnings} />
          )}
        </>
      )}

      {/* Issue Warning modal */}
      {showModal && (
        <IssueWarningModal
          authFetch={authFetch}
          initialUser={selectedUser}
          onClose={() => setShowModal(false)}
          onSuccess={handleWarningIssued}
        />
      )}
    </div>
  );
}

export default WarningsTab;

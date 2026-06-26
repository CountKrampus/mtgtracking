import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Shield, X } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function StatusBadge({ ban }) {
  if (ban.banType === 'permanent') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs border bg-red-500/20 text-red-300 border-red-500/50">
        Permanent
      </span>
    );
  }

  const isExpired = ban.expiresAt && new Date(ban.expiresAt) < new Date();
  const isActive = ban.isActive !== undefined ? ban.isActive : !isExpired;

  if (!isActive || isExpired) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-500/20 text-gray-400 border-gray-500/50">
        Expired
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs border bg-orange-500/20 text-orange-300 border-orange-500/50">
      Suspended
    </span>
  );
}

function UserSearchDropdown({ authFetch, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authFetch(`${API_URL}/admin/users?search=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();
        if (res.ok) {
          setResults(data.users || []);
          setShowDropdown(true);
        }
      } catch {
        // ignore search errors
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, authFetch]);

  const handleSelect = (user) => {
    setSelected(user);
    setQuery(user.username);
    setShowDropdown(false);
    onSelect(user._id);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    onSelect(null);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) {
              setSelected(null);
              onSelect(null);
            }
          }}
          placeholder="Search by username or email..."
          className="w-full pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
        {(query || selected) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user._id}
              type="button"
              onClick={() => handleSelect(user)}
              className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors"
            >
              <p className="text-white text-sm font-medium">{user.displayName || user.username}</p>
              <p className="text-gray-400 text-xs">{user.email} · @{user.username}</p>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-400 text-sm">
          Searching...
        </div>
      )}

      {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-400 text-sm">
          No users found
        </div>
      )}
    </div>
  );
}

function CreateBanModal({ onClose, onCreated, authFetch }) {
  const [userId, setUserId] = useState(null);
  const [banType, setBanType] = useState('suspension');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      setError('Please select a user.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = { userId, banType, reason };
      if (banType === 'suspension' && expiresAt) {
        body.expiresAt = expiresAt;
      }

      const res = await authFetch(`${API_URL}/admin/account-bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        onCreated();
        onClose();
      } else {
        setError(data.message || 'Failed to create ban');
      }
    } catch {
      setError('Failed to create ban');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield size={18} className="text-red-400" />
            Create Ban
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">User</label>
            <UserSearchDropdown authFetch={authFetch} onSelect={setUserId} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ban Type</label>
            <div className="flex gap-3">
              {['suspension', 'permanent'].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="banType"
                    value={type}
                    checked={banType === type}
                    onChange={() => setBanType(type)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-gray-200 capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {banType === 'suspension' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Expires At <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for this ban..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Ban'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditBanModal({ ban, onClose, onUpdated, authFetch }) {
  const [reason, setReason] = useState(ban.reason || '');
  const [expiresAt, setExpiresAt] = useState(
    ban.expiresAt ? new Date(ban.expiresAt).toISOString().slice(0, 16) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = { reason };
      if (ban.banType === 'suspension' && expiresAt) {
        body.expiresAt = expiresAt;
      }

      const res = await authFetch(`${API_URL}/admin/account-bans/${ban._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        setError(data.message || 'Failed to update ban');
      }
    } catch {
      setError('Failed to update ban');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Edit2 size={18} className="text-blue-400" />
            Edit Ban
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          {ban.banType === 'suspension' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Expires At <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BansTab() {
  const { authFetch } = useAuthContext();
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [banTypeFilter, setBanTypeFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBan, setEditingBan] = useState(null);

  const fetchBans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50'
      });
      if (userSearch.trim()) params.set('userId', userSearch.trim());
      if (banTypeFilter) params.set('banType', banTypeFilter);
      if (activeOnly) params.set('active', 'true');

      const res = await authFetch(`${API_URL}/admin/account-bans?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setBans(data.bans || []);
        if (data.totalPages) setTotalPages(data.totalPages);
        if (data.pagination?.totalPages) setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.message || 'Failed to load bans');
      }
    } catch {
      setError('Failed to load bans');
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, userSearch, banTypeFilter, activeOnly]);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [userSearch, banTypeFilter, activeOnly]);

  const handleRevoke = async (ban) => {
    const confirmed = window.confirm(
      `Revoke ban for ${ban.user?.username || ban.userId}? This will lift their ban immediately.`
    );
    if (!confirmed) return;

    try {
      const res = await authFetch(`${API_URL}/admin/account-bans/${ban._id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchBans();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to revoke ban');
      }
    } catch {
      alert('Failed to revoke ban');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm inline-block mb-4">
          {error}
        </div>
        <br />
        <button
          onClick={fetchBans}
          className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Filter by user ID or name..."
            className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>

        <select
          value={banTypeFilter}
          onChange={(e) => setBanTypeFilter(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        >
          <option value="">All Types</option>
          <option value="suspension">Suspension</option>
          <option value="permanent">Permanent</option>
        </select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-purple-500 w-4 h-4"
          />
          <span className="text-sm text-gray-300">Active only</span>
        </label>

        <div className="ml-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-1 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create Ban
          </button>
        </div>
      </div>

      {/* Table */}
      {bans.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          No bans found
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-gray-700/50 rounded-lg">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Banned By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Banned At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Expires At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {bans.map((ban) => (
                  <tr key={ban._id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">
                        {ban.user?.displayName || ban.user?.username || ban.userId || '—'}
                      </p>
                      {ban.user?.username && ban.user?.displayName && (
                        <p className="text-gray-500 text-xs">@{ban.user.username}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {ban.user?.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-200 capitalize">{ban.banType}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm max-w-[200px]">
                      <span className="line-clamp-2" title={ban.reason}>{ban.reason || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {ban.bannedBy?.username || ban.bannedBy?.displayName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {formatDate(ban.createdAt || ban.bannedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {ban.banType === 'permanent' ? '—' : formatDate(ban.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge ban={ban} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingBan(ban)}
                          className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                          title="Edit ban"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleRevoke(ban)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Revoke ban"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateBanModal
          authFetch={authFetch}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchBans}
        />
      )}

      {editingBan && (
        <EditBanModal
          ban={editingBan}
          authFetch={authFetch}
          onClose={() => setEditingBan(null)}
          onUpdated={fetchBans}
        />
      )}
    </div>
  );
}

export default BansTab;

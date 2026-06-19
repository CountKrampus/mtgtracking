import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

const VALID_ROLES = [
  'admin',
  'moderator',
  'content_manager',
  'community_manager',
  'support',
  'user',
  'editor',
  'viewer',
];

const ROLE_LABELS = {
  admin: 'Admin',
  moderator: 'Moderator',
  content_manager: 'Content Manager',
  community_manager: 'Community Manager',
  support: 'Support',
  user: 'User',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-300 border border-red-500/50',
  moderator: 'bg-orange-500/20 text-orange-300 border border-orange-500/50',
  content_manager: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
  community_manager: 'bg-green-500/20 text-green-300 border border-green-500/50',
  support: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
  user: 'bg-gray-500/20 text-gray-300 border border-gray-500/50',
  editor: 'bg-purple-500/20 text-purple-300 border border-purple-500/50',
  viewer: 'bg-slate-500/20 text-slate-300 border border-slate-500/50',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// RoleBadge at module scope — prevents DOM remount on every render
function RoleBadge({ role }) {
  const colorClass = ROLE_COLORS[role] || ROLE_COLORS.user;
  const label = ROLE_LABELS[role] || role;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// HistoryPanel at module scope — prevents DOM remount on every render
function HistoryPanel({ selectedUser, history, loading }) {
  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Select a user to view role history
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">
        Role History — {selectedUser.username}
      </h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No role changes recorded</p>
      ) : (
        <ul className="space-y-2">
          {history.map((entry) => {
            const actor =
              entry.userId?.displayName ||
              entry.userId?.username ||
              'System';
            const oldLabel = ROLE_LABELS[entry.details?.oldRole] || entry.details?.oldRole || '?';
            const newLabel = ROLE_LABELS[entry.details?.newRole] || entry.details?.newRole || '?';
            return (
              <li
                key={entry._id}
                className="bg-gray-700/50 rounded-lg px-3 py-2 text-xs space-y-1"
              >
                <div className="text-gray-400">Changed by{' '}
                  <span className="text-gray-200 font-medium">{actor}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-300">
                  <span>{oldLabel}</span>
                  <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
                  <span className="font-medium text-white">{newLabel}</span>
                </div>
                <div className="text-gray-500">{formatDate(entry.createdAt)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function RoleManagement() {
  const { authFetch } = useAuthContext();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleHistory, setRoleHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(null); // userId string while saving

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/users?limit=100`);
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const loadRoleHistory = useCallback(async (user) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    try {
      const res = await authFetch(`${API_URL}/admin/role-history/${user._id}`);
      if (!res.ok) {
        setRoleHistory([]);
        return;
      }
      const data = await res.json();
      setRoleHistory(data.history || []);
    } catch {
      setRoleHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [authFetch]);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRole(userId);
    try {
      const res = await authFetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed (${res.status})`);
      }
      // Update local state optimistically
      setUsers(prev =>
        prev.map(u => u._id === userId ? { ...u, role: newRole } : u)
      );
      // Refresh history if this user's history is currently shown
      if (selectedUser && selectedUser._id === userId) {
        loadRoleHistory({ ...selectedUser, role: newRole });
      }
    } catch (err) {
      alert(`Failed to update role: ${err.message}`);
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left panel: user table (~60%) */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Role Management</h2>
          <span className="text-xs text-gray-400">{users.length} users</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-center space-y-3">
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={fetchUsers}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Current Role</th>
                  <th className="px-4 py-3 text-left">Change Role</th>
                  <th className="px-4 py-3 text-left">Staff Since</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map(user => {
                  const isUpdating = updatingRole === user._id;
                  return (
                    <tr
                      key={user._id}
                      className="bg-gray-800 hover:bg-gray-700 transition-colors"
                    >
                      {/* Username + email */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{user.username}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </td>

                      {/* Current role badge */}
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Change role select */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            disabled={isUpdating}
                            onChange={e => handleRoleChange(user._id, e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1 text-sm disabled:opacity-50 focus:outline-none focus:border-purple-500"
                          >
                            {VALID_ROLES.map(role => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                          {isUpdating && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 flex-shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Staff since */}
                      <td className="px-4 py-3 text-gray-300">
                        {formatDate(user.staffSince)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => loadRoleHistory(user)}
                          title="View role history"
                          className={`p-1 rounded transition-colors ${
                            selectedUser?._id === user._id
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }`}
                        >
                          <Clock size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right panel: role history (~40%) */}
      <div className="w-80 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-y-auto">
        <HistoryPanel
          selectedUser={selectedUser}
          history={roleHistory}
          loading={historyLoading}
        />
      </div>
    </div>
  );
}

export default RoleManagement;

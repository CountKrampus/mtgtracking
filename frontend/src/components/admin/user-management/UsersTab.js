import React, { useState, useEffect } from 'react';
import { Search, UserCog, Shield, Eye, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

export function UsersTab() {
  const { authFetch, user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [availableBadges, setAvailableBadges] = useState([]);
  const [badgeGrantState, setBadgeGrantState] = useState(null); // { userId, username, action: 'grant'|'revoke', badgeId }
  const [badgeMsg, setBadgeMsg] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    authFetch(`${API_URL}/admin/badges`)
      .then(r => r.json())
      .then(d => setAvailableBadges(d.badges || []))
      .catch(() => {});
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/users?limit=100`);
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u._id === userId ? updatedUser : u));
        setEditingUser(null);
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUsers(users.filter(u => u._id !== userId));
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBadgeAction = async () => {
    if (!badgeGrantState.badgeId) return;
    const { userId, action, badgeId } = badgeGrantState;
    const method = action === 'grant' ? 'POST' : 'DELETE';
    const url = `${API_URL}/admin/badges/${badgeId}/${action === 'grant' ? 'grant' : 'revoke'}/${userId}`;
    try {
      const r = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await r.json();
      setBadgeMsg(r.ok ? `✅ ${data.message}` : `❌ ${data.message}`);
    } catch (e) {
      setBadgeMsg(`❌ Error: ${e.message}`);
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-red-500/20 text-red-300 border-red-500/50',
      editor: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      viewer: 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    };
    const icons = {
      admin: Shield,
      editor: Edit2,
      viewer: Eye
    };
    const Icon = icons[role] || Eye;

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${styles[role]}`}>
        <Icon size={12} />
        {role}
      </span>
    );
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
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={fetchUsers} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <span className="text-gray-400">{filteredUsers.length} users</span>
      </div>

      <div className="bg-gray-700/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Last Login</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white font-medium">{user.displayName || user.username}</p>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                    <p className="text-gray-500 text-xs">@{user.username}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingUser === user._id ? (
                    <select
                      defaultValue={user.role}
                      onChange={(e) => updateUser(user._id, { role: e.target.value })}
                      className="bg-gray-600 text-white rounded px-2 py-1 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    getRoleBadge(user.role)
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.isActive ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <CheckCircle size={14} />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 text-sm">
                      <XCircle size={14} />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setBadgeGrantState({ userId: user._id, username: user.username, action: 'grant', badgeId: '' })}
                      className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded text-xs transition"
                      title="Manage badges"
                    >
                      🏅 Badge
                    </button>
                    <button
                      onClick={() => setEditingUser(editingUser === user._id ? null : user._id)}
                      className="p-1 text-blue-400 hover:text-blue-300"
                      title="Edit role"
                    >
                      <UserCog size={16} />
                    </button>
                    <button
                      onClick={() => updateUser(user._id, { isActive: !user.isActive })}
                      className={`p-1 ${user.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                    {user._id !== currentUser._id && (
                      <button
                        onClick={() => deleteUser(user._id, user.username)}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {badgeGrantState && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-4">
              🏅 Manage Badges — @{badgeGrantState.username}
            </h3>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-1">Select Badge</label>
              <select
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
                value={badgeGrantState.badgeId}
                onChange={e => setBadgeGrantState(s => ({ ...s, badgeId: e.target.value }))}
              >
                <option value="">-- Choose a badge --</option>
                {availableBadges.map(b => (
                  <option key={b._id} value={b._id}>{b.icon || '🏅'} {b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setBadgeGrantState(s => ({ ...s, action: 'grant' }))}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${badgeGrantState.action === 'grant' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                Grant Badge
              </button>
              <button
                onClick={() => setBadgeGrantState(s => ({ ...s, action: 'revoke' }))}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${badgeGrantState.action === 'revoke' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                Revoke Badge
              </button>
            </div>

            {badgeMsg && <p className="text-sm text-center mb-3 text-gray-300">{badgeMsg}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleBadgeAction}
                disabled={!badgeGrantState.badgeId}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
              >
                {badgeGrantState.action === 'grant' ? 'Grant' : 'Revoke'}
              </button>
              <button
                onClick={() => { setBadgeGrantState(null); setBadgeMsg(''); }}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersTab;

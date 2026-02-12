import React, { useState, useEffect } from 'react';
import { Search, UserCog, Shield, Eye, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

export function UserManagement() {
  const { authFetch, user: currentUser } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await authFetch('http://localhost:5000/api/admin/users?limit=100');
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
      const response = await authFetch(`http://localhost:5000/api/admin/users/${userId}`, {
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
      const response = await authFetch(`http://localhost:5000/api/admin/users/${userId}`, {
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
    </div>
  );
}

export default UserManagement;

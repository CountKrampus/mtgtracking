import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Shield, Edit2, Eye } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// Module-scope helper to render role badges
function getRoleBadge(role) {
  const styles = {
    admin: 'bg-red-500/20 text-red-300',
    editor: 'bg-blue-500/20 text-blue-300',
    viewer: 'bg-gray-500/20 text-gray-300'
  };
  const icons = {
    admin: Shield,
    editor: Edit2,
    viewer: Eye
  };
  const Icon = icons[role] || Eye;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${styles[role] || 'bg-gray-500/20 text-gray-300'}`}>
      <Icon size={12} />
      {role}
    </span>
  );
}

export default function SessionsTab() {
  const { authFetch } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch total user count
      const countResponse = await authFetch(`${API_URL}/admin/users?limit=1`);
      const countData = await countResponse.json();
      if (countResponse.ok && countData.total !== undefined) {
        setTotalUsers(countData.total);
      }

      // Fetch recently active users
      const usersResponse = await authFetch(`${API_URL}/admin/users?sort=lastSeen&limit=20`);
      const usersData = await usersResponse.json();
      if (usersResponse.ok) {
        setUsers(usersData.users || []);
      } else {
        setError(usersData.message || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Failed to fetch session data');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatLastActive = (user) => {
    if (user.lastLoginAt) {
      return new Date(user.lastLoginAt).toLocaleString();
    }
    if (user.createdAt) {
      return new Date(user.createdAt).toLocaleString();
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex gap-3 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg">
        <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-100 text-sm">
          Sessions are JWT-based and cannot be revoked server-side. Users must log out or wait for token expiration.
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/50 rounded-lg p-4">
          <div className="text-gray-300 text-sm font-medium">Total Users</div>
          <div className="text-3xl font-bold text-white mt-2">{totalUsers}</div>
        </div>
      </div>

      {/* Recently Active Users Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recently Active Users</h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            <p>{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Try again
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No active users found</p>
          </div>
        ) : (
          <div className="bg-gray-700/50 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Username</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">
                      {user.username || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {user.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatLastActive(user)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

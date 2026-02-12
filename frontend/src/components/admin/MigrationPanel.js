import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

export function MigrationPanel() {
  const { authFetch, user } = useAuthContext();
  const [users, setUsers] = useState([]);
  const [targetUser, setTargetUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, healthRes] = await Promise.all([
        authFetch('http://localhost:5000/api/admin/users?limit=100'),
        authFetch('http://localhost:5000/api/admin/health')
      ]);

      const usersData = await usersRes.json();
      const healthData = await healthRes.json();

      if (usersRes.ok) {
        setUsers(usersData.users);
        setTargetUser(user._id); // Default to current admin
      }

      if (healthRes.ok) {
        setHealth(healthData);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const runMigration = async () => {
    if (!targetUser) {
      alert('Please select a target user');
      return;
    }

    if (!window.confirm('This will assign all orphaned data (cards, decks, locations, tags, wishlist items) to the selected user. Continue?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await authFetch('http://localhost:5000/api/admin/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetUser })
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, data });
        fetchData(); // Refresh health data
      } else {
        setResult({ success: false, error: data.message });
      }
    } catch (err) {
      setResult({ success: false, error: 'Migration failed' });
    } finally {
      setLoading(false);
    }
  };

  const orphanedCount = (health?.data?.orphaned?.cards || 0) + (health?.data?.orphaned?.decks || 0);

  return (
    <div className="space-y-6">
      <div className="bg-gray-700/50 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-purple-400" size={24} />
          <h3 className="text-lg font-medium text-white">Data Migration</h3>
        </div>

        <p className="text-gray-300 mb-6">
          When multi-user mode is enabled, existing data needs to be assigned to a user.
          This tool migrates all orphaned data (data without a userId) to a selected user.
        </p>

        {orphanedCount > 0 ? (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <AlertTriangle size={18} />
              <span className="font-medium">Orphaned Data Found</span>
            </div>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>Cards: {health?.data?.orphaned?.cards || 0}</li>
              <li>Decks: {health?.data?.orphaned?.decks || 0}</li>
            </ul>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle size={18} />
              <span className="font-medium">No orphaned data found</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">All data is properly assigned to users.</p>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Assign orphaned data to:</label>
            <select
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a user...</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.displayName || u.username} ({u.role})
                  {u._id === user._id ? ' - You' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runMigration}
            disabled={loading || !targetUser || orphanedCount === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <ArrowRight size={18} />
                Run Migration
              </>
            )}
          </button>
        </div>

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.success
              ? 'bg-green-500/10 border border-green-500/50'
              : 'bg-red-500/10 border border-red-500/50'
          }`}>
            {result.success ? (
              <>
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle size={18} />
                  <span className="font-medium">Migration Completed</span>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  Data assigned to: {result.data.targetUser}
                </p>
                <ul className="text-gray-400 text-sm">
                  <li>Cards migrated: {result.data.migrated?.cards || 0}</li>
                  <li>Decks migrated: {result.data.migrated?.decks || 0}</li>
                  <li>Locations migrated: {result.data.migrated?.locations || 0}</li>
                  <li>Tags migrated: {result.data.migrated?.tags || 0}</li>
                  <li>Wishlist items migrated: {result.data.migrated?.wishlistItems || 0}</li>
                  <li className="mt-2 font-medium">Total items migrated: {result.data.total}</li>
                </ul>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertTriangle size={18} />
                  <span className="font-medium">Migration Failed</span>
                </div>
                <p className="text-gray-300 text-sm">{result.error}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-700/50 rounded-lg p-6">
        <h4 className="text-white font-medium mb-3">How Migration Works</h4>
        <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
          <li>Select the user who should own the orphaned data</li>
          <li>Click "Run Migration" to assign all orphaned items to that user</li>
          <li>The migration updates cards, decks, locations, tags, and wishlist items</li>
          <li>After migration, each user will only see their own data</li>
          <li>This operation is safe and can be run multiple times</li>
        </ol>
      </div>
    </div>
  );
}

export default MigrationPanel;

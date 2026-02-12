import React, { useState, useEffect } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

export function ActivityLogViewer() {
  const { authFetch } = useAuthContext();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchActivity();
  }, [category, limit]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/admin/activity?limit=${limit}`;
      if (category) url += `&category=${category}`;

      const response = await authFetch(url);
      const data = await response.json();

      if (response.ok) {
        setActivities(data.activity);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch activity log');
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryColor = (cat) => {
    const colors = {
      auth: 'bg-blue-500/20 text-blue-300',
      collection: 'bg-green-500/20 text-green-300',
      deck: 'bg-purple-500/20 text-purple-300',
      wishlist: 'bg-pink-500/20 text-pink-300',
      admin: 'bg-red-500/20 text-red-300',
      export: 'bg-yellow-500/20 text-yellow-300',
      location: 'bg-cyan-500/20 text-cyan-300',
      tag: 'bg-orange-500/20 text-orange-300'
    };
    return colors[cat] || 'bg-gray-500/20 text-gray-300';
  };

  const categories = ['auth', 'collection', 'deck', 'wishlist', 'admin', 'export', 'location', 'tag'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600"
        >
          <option value={25}>Last 25</option>
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
        </select>

        <button
          onClick={fetchActivity}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          <RefreshCw size={16} />
          Refresh
        </button>

        <span className="text-gray-400 text-sm ml-auto">
          {activities.length} entries
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">{error}</div>
      ) : (
        <div className="bg-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Action</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {activities.map((activity, idx) => (
                <tr key={activity._id || idx} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                    {new Date(activity.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {activity.userId?.username || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {formatAction(activity.action)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(activity.category)}`}>
                      {activity.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {activity.targetName || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ActivityLogViewer;

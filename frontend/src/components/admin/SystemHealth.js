import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, Database, Activity, Settings, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

export function SystemHealth() {
  const { authFetch } = useAuthContext();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await authFetch('http://localhost:5000/api/admin/health');
      const data = await response.json();

      if (response.ok) {
        setHealth(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch system health');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const newState = !health?.settings?.maintenanceMode?.value;
      const response = await authFetch('http://localhost:5000/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });

      if (response.ok) {
        fetchHealth();
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to toggle maintenance mode');
    } finally {
      setMaintenanceLoading(false);
    }
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
        <button onClick={fetchHealth} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, subtext, color = 'purple' }) => (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-500/20`}>
          <Icon className={`text-${color}-400`} size={20} />
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
          {subtext && <p className="text-gray-500 text-xs">{subtext}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">System Overview</h3>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={health?.users?.total || 0}
          subtext={`${health?.users?.active || 0} active`}
          color="blue"
        />
        <StatCard
          icon={Activity}
          label="Active Sessions"
          value={health?.sessions?.active || 0}
          subtext={`${health?.sessions?.total || 0} total`}
          color="green"
        />
        <StatCard
          icon={Database}
          label="Total Cards"
          value={health?.data?.cards || 0}
          color="purple"
        />
        <StatCard
          icon={Database}
          label="Total Decks"
          value={health?.data?.decks || 0}
          color="pink"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Users by Role</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Admins</span>
              <span className="text-red-400 font-medium">{health?.users?.byRole?.admin || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Editors</span>
              <span className="text-blue-400 font-medium">{health?.users?.byRole?.editor || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Viewers</span>
              <span className="text-gray-400 font-medium">{health?.users?.byRole?.viewer || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Activity (24h)</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Logins</span>
              <span className="text-green-400 font-medium">{health?.activity?.loginsLast24h || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {(health?.data?.orphaned?.cards > 0 || health?.data?.orphaned?.decks > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertTriangle size={18} />
            <span className="font-medium">Orphaned Data Detected</span>
          </div>
          <p className="text-gray-300 text-sm mb-2">
            There is data without user ownership. Use the Data Migration tab to assign it to a user.
          </p>
          <ul className="text-gray-400 text-sm">
            <li>Orphaned cards: {health?.data?.orphaned?.cards || 0}</li>
            <li>Orphaned decks: {health?.data?.orphaned?.decks || 0}</li>
          </ul>
        </div>
      )}

      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-400" />
            <h4 className="text-white font-medium">System Settings</h4>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-600">
            <div>
              <p className="text-white">Maintenance Mode</p>
              <p className="text-gray-500 text-sm">When enabled, only admins can access the system</p>
            </div>
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className={`px-4 py-1.5 rounded-lg font-medium ${
                health?.settings?.maintenanceMode?.value
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
              }`}
            >
              {maintenanceLoading ? '...' : health?.settings?.maintenanceMode?.value ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-600">
            <div>
              <p className="text-white">Registration</p>
              <p className="text-gray-500 text-sm">Allow new users to register</p>
            </div>
            <span className={`px-4 py-1.5 rounded-lg text-sm ${
              health?.settings?.registrationEnabled?.value
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {health?.settings?.registrationEnabled?.value ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Default User Role</p>
              <p className="text-gray-500 text-sm">Role assigned to new users</p>
            </div>
            <span className="px-4 py-1.5 bg-gray-600 rounded-lg text-gray-300 capitalize">
              {health?.settings?.defaultUserRole?.value || 'editor'}
            </span>
          </div>
        </div>
      </div>

      <div className="text-right text-gray-500 text-sm">
        Server time: {health?.serverTime ? new Date(health.serverTime).toLocaleString() : '-'}
      </div>
    </div>
  );
}

export default SystemHealth;

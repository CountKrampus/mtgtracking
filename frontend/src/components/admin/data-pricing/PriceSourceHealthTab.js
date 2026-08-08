import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function StatCard({ icon: Icon, label, value, color = 'purple' }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-500/20`}>
          <Icon className={`text-${color}-400`} size={20} />
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function PriceSourceHealthTab() {
  const { authFetch } = useAuthContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/price-source-health`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  const scryfall = data.bySource?.Scryfall ?? { count: 0, percentage: 0 };
  const goldfish = data.bySource?.['MTGGoldfish (backup)'] ?? { count: 0, percentage: 0 };
  const notFound = data.bySource?.['None (not found)'] ?? { count: 0, percentage: 0 };
  const notFoundColor = notFound.percentage > 5 ? 'red' : notFound.percentage > 2 ? 'amber' : 'gray';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Price Source Health (30 days)</h3>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Fetches"
          value={data.totalFetches.toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Scryfall Hit Rate"
          value={`${scryfall.percentage}%`}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="MTGGoldfish Fallback"
          value={`${goldfish.percentage}%`}
          color="yellow"
        />
        <StatCard
          icon={AlertTriangle}
          label="Not Found Rate"
          value={`${notFound.percentage}%`}
          color={notFoundColor}
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">Daily Breakdown</h4>
        {data.dailyTrend.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet — prices have not been fetched.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="py-2 pr-6 text-gray-400">Date</th>
                  <th className="py-2 pr-6 text-green-400">Scryfall</th>
                  <th className="py-2 pr-6 text-yellow-400">MTGGoldfish</th>
                  <th className="py-2 text-red-400">Not Found</th>
                </tr>
              </thead>
              <tbody>
                {[...data.dailyTrend].reverse().map((row, i) => (
                  <tr
                    key={row.date}
                    className={`border-b border-gray-800 ${i % 2 !== 0 ? 'bg-gray-700/20' : ''}`}
                  >
                    <td className="py-1.5 pr-6 text-gray-300 font-mono text-xs">{row.date}</td>
                    <td className="py-1.5 pr-6 text-green-400">{row.Scryfall}</td>
                    <td className="py-1.5 pr-6 text-yellow-400">{row['MTGGoldfish (backup)']}</td>
                    <td className={`py-1.5 ${row['None (not found)'] > 0 ? 'text-amber-400 font-semibold' : 'text-gray-500'}`}>
                      {row['None (not found)']}
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

export default PriceSourceHealthTab;

import React, { useState, useEffect } from 'react';
import { BarChart3, Trophy, Clock, Users, Percent, X, TrendingUp } from 'lucide-react';
import useBackendSync from './hooks/useBackendSync';

function StatsDashboard({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const { fetchStats, loading, error } = useBackendSync();

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    const data = await fetchStats();
    setStats(data);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins} min`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={24} className="text-green-400" />
            Statistics
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Loading/Error */}
        {loading && (
          <div className="text-center text-white/60 py-8">
            Loading statistics...
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 py-4 bg-red-900/20 rounded-lg mb-4">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{stats.totalGames}</div>
                <div className="text-white/60 text-sm">Total Games</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.averageTurns}</div>
                <div className="text-white/60 text-sm">Avg. Turns</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{formatDuration(stats.averageDuration)}</div>
                <div className="text-white/60 text-sm">Avg. Duration</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">
                  {Object.keys(stats.winsByPlayer || {}).length}
                </div>
                <div className="text-white/60 text-sm">Players</div>
              </div>
            </div>

            {/* Format Distribution */}
            {stats.gamesByFormat && Object.keys(stats.gamesByFormat).length > 0 && (
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp size={18} />
                  Games by Format
                </h4>
                <div className="flex gap-4">
                  {Object.entries(stats.gamesByFormat).map(([format, count]) => (
                    <div key={format} className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 capitalize">{format}</span>
                        <span className="text-white font-bold">{count}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${format === 'commander' ? 'bg-purple-500' : 'bg-blue-500'}`}
                          style={{ width: `${(count / stats.totalGames) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Win Rates */}
            {stats.winRates && Object.keys(stats.winRates).length > 0 && (
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
                  <Trophy size={18} className="text-yellow-400" />
                  Win Rates
                </h4>
                <div className="space-y-3">
                  {Object.entries(stats.winRates)
                    .sort((a, b) => b[1].winRate - a[1].winRate)
                    .map(([player, data]) => (
                      <div key={player}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-white/40" />
                            <span className="text-white">{player}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-white/60 text-sm">
                              {data.wins}/{data.gamesPlayed} wins
                            </span>
                            <span className={`font-bold ${
                              data.winRate >= 50 ? 'text-green-400' :
                              data.winRate >= 25 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {data.winRate}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              data.winRate >= 50 ? 'bg-green-500' :
                              data.winRate >= 25 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${data.winRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Total Wins Leaderboard */}
            {stats.winsByPlayer && Object.keys(stats.winsByPlayer).length > 0 && (
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
                  <Percent size={18} />
                  Total Wins Leaderboard
                </h4>
                <div className="space-y-2">
                  {Object.entries(stats.winsByPlayer)
                    .sort((a, b) => b[1] - a[1])
                    .map(([player, wins], index) => (
                      <div
                        key={player}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          index === 0 ? 'bg-yellow-600/20' :
                          index === 1 ? 'bg-gray-500/20' :
                          index === 2 ? 'bg-amber-700/20' :
                          'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                            index === 2 ? 'text-amber-400' :
                            'text-white/60'
                          }`}>
                            #{index + 1}
                          </span>
                          <span className="text-white">{player}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy size={14} className={
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                            index === 2 ? 'text-amber-400' :
                            'text-white/40'
                          } />
                          <span className="font-bold text-white">{wins}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {stats.totalGames === 0 && (
              <div className="text-center text-white/60 py-8">
                No games recorded yet. Complete and save games to see statistics.
              </div>
            )}
          </>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default StatsDashboard;

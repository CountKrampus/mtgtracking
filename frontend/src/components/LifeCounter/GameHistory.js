import React, { useState, useEffect } from 'react';
import { History, Trophy, Clock, Users, ChevronRight, X } from 'lucide-react';
import useBackendSync from './hooks/useBackendSync';

function GameHistory({ isOpen, onClose }) {
  const [games, setGames] = useState([]);
  const { fetchGames, loading, error } = useBackendSync();

  useEffect(() => {
    if (isOpen) {
      loadGames();
    }
  }, [isOpen]);

  const loadGames = async () => {
    const data = await fetchGames(50);
    setGames(data || []);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <History size={24} className="text-blue-400" />
            Game History
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
            Loading games...
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 py-4 bg-red-900/20 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Games List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {!loading && games.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              No games recorded yet. Complete a game and save it to see history.
            </div>
          ) : (
            games.map(game => (
              <div
                key={game._id}
                className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Date and Format */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white/60 text-sm">
                        {formatDate(game.createdAt)}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-600/30 text-purple-400 text-xs rounded-full">
                        {game.format === 'commander' ? 'Commander' : 'Standard'}
                      </span>
                    </div>

                    {/* Winner */}
                    {game.winner && (
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy size={16} className="text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">{game.winner}</span>
                        <span className="text-white/40">won</span>
                      </div>
                    )}

                    {/* Players */}
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Users size={14} />
                      <span>
                        {game.players.map(p => p.name).join(', ')}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-2 text-white/40 text-xs">
                      {game.turns > 0 && (
                        <span>{game.turns} turns</span>
                      )}
                      {game.duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDuration(game.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Final Life Totals */}
                  <div className="text-right">
                    <div className="text-white/40 text-xs mb-1">Final Life</div>
                    <div className="space-y-1">
                      {game.players.slice(0, 4).map((player, index) => (
                        <div key={index} className="flex items-center justify-end gap-2">
                          <span className="text-white/60 text-xs truncate max-w-[80px]">
                            {player.name}
                          </span>
                          <span className={`font-mono text-sm ${
                            player.isWinner ? 'text-yellow-400' :
                            player.finalLife <= 0 ? 'text-red-400' :
                            'text-white/70'
                          }`}>
                            {player.finalLife}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Placements */}
                {game.players.some(p => p.placement) && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 flex-wrap">
                    {game.players
                      .sort((a, b) => (a.placement || 99) - (b.placement || 99))
                      .map((player, index) => (
                        <div
                          key={index}
                          className={`px-2 py-1 rounded text-xs ${
                            player.placement === 1 ? 'bg-yellow-600/30 text-yellow-400' :
                            player.placement === 2 ? 'bg-gray-500/30 text-gray-300' :
                            player.placement === 3 ? 'bg-amber-700/30 text-amber-400' :
                            'bg-white/10 text-white/50'
                          }`}
                        >
                          #{player.placement || '?'} {player.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-white/40 text-sm text-center">
            {games.length} game{games.length !== 1 ? 's' : ''} recorded
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default GameHistory;

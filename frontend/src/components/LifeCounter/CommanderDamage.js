import React from 'react';
import { X, Plus, Minus, Swords } from 'lucide-react';

function CommanderDamage({
  player,
  allPlayers,
  onDamageChange,
  onClose
}) {
  // Get opponents (all players except the current one)
  const opponents = allPlayers.filter(p => p.id !== player.id && !p.isEliminated);

  const getDamageFromPlayer = (opponentId) => {
    return player.commanderDamage?.[opponentId] || 0;
  };

  const getIndicatorColor = (damage) => {
    if (damage >= 18) return 'bg-red-500 text-white';
    if (damage >= 15) return 'bg-yellow-500 text-black';
    if (damage >= 10) return 'bg-orange-500 text-white';
    return 'bg-white/20 text-white';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords size={24} className="text-orange-400" />
            Commander Damage
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Player Info */}
        <div className="text-center mb-6 pb-4 border-b border-white/10">
          <span className="text-white/60">Tracking damage to</span>
          <h4 className="text-2xl font-bold text-white">{player.name}</h4>
        </div>

        {/* Opponents List */}
        {opponents.length === 0 ? (
          <div className="text-center text-white/60 py-8">
            No active opponents remaining
          </div>
        ) : (
          <div className="space-y-4">
            {opponents.map(opponent => {
              const damage = getDamageFromPlayer(opponent.id);
              return (
                <div
                  key={opponent.id}
                  className={`p-4 rounded-xl transition ${
                    damage >= 18 ? 'bg-red-900/30 border border-red-500' :
                    damage >= 15 ? 'bg-yellow-900/30 border border-yellow-500' :
                    'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">{opponent.name}</div>
                      <div className="text-white/50 text-sm">
                        {damage >= 21 ? (
                          <span className="text-red-400">LETHAL!</span>
                        ) : (
                          `${21 - damage} more to lethal`
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onDamageChange(player.id, opponent.id, -1)}
                        disabled={damage <= 0}
                        className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus size={16} />
                      </button>

                      <div className={`min-w-[3rem] text-center py-2 px-3 rounded-lg font-bold text-lg ${getIndicatorColor(damage)}`}>
                        {damage}
                      </div>

                      <button
                        onClick={() => onDamageChange(player.id, opponent.id, 1)}
                        className="p-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        damage >= 21 ? 'bg-red-500' :
                        damage >= 18 ? 'bg-red-400' :
                        damage >= 15 ? 'bg-yellow-400' :
                        'bg-orange-400'
                      }`}
                      style={{ width: `${Math.min(100, (damage / 21) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default CommanderDamage;

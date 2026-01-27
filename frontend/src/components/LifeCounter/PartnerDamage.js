import React from 'react';
import { X, Plus, Minus, Users } from 'lucide-react';

/**
 * Partner Damage Tracker - Tracks damage from partner commanders separately
 * In Commander, some players have two commanders (Partners)
 * This component allows tracking damage from each partner individually
 */
function PartnerDamage({
  player,
  allPlayers,
  partnerDamage = {}, // { playerId: { commander1: damage, commander2: damage } }
  onPartnerDamageChange,
  onClose
}) {
  // Get opponents (all players except the current one)
  const opponents = allPlayers.filter(p => p.id !== player.id && !p.isEliminated);

  const getDamage = (opponentId, partnerId) => {
    return partnerDamage[opponentId]?.[partnerId] || 0;
  };

  const getTotalFromOpponent = (opponentId) => {
    const damages = partnerDamage[opponentId] || {};
    return Object.values(damages).reduce((sum, d) => sum + d, 0);
  };

  const getIndicatorColor = (damage) => {
    if (damage >= 18) return 'bg-red-500 text-white';
    if (damage >= 15) return 'bg-yellow-500 text-black';
    if (damage >= 10) return 'bg-orange-500 text-white';
    return 'bg-white/20 text-white';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={24} className="text-orange-400" />
            Partner Commander Damage
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
          <div className="space-y-6">
            {opponents.map(opponent => {
              const totalDamage = getTotalFromOpponent(opponent.id);
              return (
                <div
                  key={opponent.id}
                  className={`p-4 rounded-xl transition ${
                    totalDamage >= 18 ? 'bg-red-900/30 border border-red-500' :
                    totalDamage >= 15 ? 'bg-yellow-900/30 border border-yellow-500' :
                    'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-white font-semibold">{opponent.name}</div>
                    <div className="text-white/50 text-sm">
                      Total: {totalDamage}/21
                      {totalDamage >= 21 && (
                        <span className="text-red-400 ml-2">LETHAL!</span>
                      )}
                    </div>
                  </div>

                  {/* Partner 1 */}
                  <div className="flex items-center justify-between mb-3 bg-black/20 rounded-lg p-3">
                    <div className="text-white/70 text-sm">Commander 1</div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onPartnerDamageChange(player.id, opponent.id, 'c1', -1)}
                        disabled={getDamage(opponent.id, 'c1') <= 0}
                        className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus size={14} />
                      </button>
                      <div className={`min-w-[2.5rem] text-center py-1 px-2 rounded-lg font-bold ${
                        getIndicatorColor(getDamage(opponent.id, 'c1'))
                      }`}>
                        {getDamage(opponent.id, 'c1')}
                      </div>
                      <button
                        onClick={() => onPartnerDamageChange(player.id, opponent.id, 'c1', 1)}
                        className="p-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Partner 2 */}
                  <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                    <div className="text-white/70 text-sm">Commander 2</div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onPartnerDamageChange(player.id, opponent.id, 'c2', -1)}
                        disabled={getDamage(opponent.id, 'c2') <= 0}
                        className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus size={14} />
                      </button>
                      <div className={`min-w-[2.5rem] text-center py-1 px-2 rounded-lg font-bold ${
                        getIndicatorColor(getDamage(opponent.id, 'c2'))
                      }`}>
                        {getDamage(opponent.id, 'c2')}
                      </div>
                      <button
                        onClick={() => onPartnerDamageChange(player.id, opponent.id, 'c2', 1)}
                        className="p-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Combined Progress Bar */}
                  <div className="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        totalDamage >= 21 ? 'bg-red-500' :
                        totalDamage >= 18 ? 'bg-red-400' :
                        totalDamage >= 15 ? 'bg-yellow-400' :
                        'bg-orange-400'
                      }`}
                      style={{ width: `${Math.min(100, (totalDamage / 21) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-white/5 rounded-lg text-white/40 text-xs">
          <p>In Commander, damage from each partner commander is tracked separately.</p>
          <p className="mt-1">21+ damage from a single commander source eliminates the player.</p>
        </div>

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

export default PartnerDamage;

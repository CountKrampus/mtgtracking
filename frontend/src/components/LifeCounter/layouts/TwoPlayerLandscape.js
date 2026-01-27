import React from 'react';
import { Plus, Minus, Droplets, Swords, Crown, Building2, Circle, Skull, ArrowLeft, RotateCcw, LayoutGrid } from 'lucide-react';

/**
 * Face-to-face tablet layout for 2 players
 * Player 1 is upside down at the top, Player 2 is right-side up at the bottom
 */
function TwoPlayerLandscape({
  players,
  gameFormat,
  onLifeChange,
  onPoisonChange,
  onCommanderDamageClick,
  monarch,
  initiative,
  currentPlayerIndex,
  onBack,
  onReset,
  onToggleLayout
}) {
  if (players.length !== 2) {
    return <div className="text-white text-center">This layout requires exactly 2 players</div>;
  }

  const renderPlayerSide = (player, index, isFlipped = false) => {
    const isMonarch = monarch === player.id;
    const hasInitiative = initiative === player.id;
    const isCurrentTurn = currentPlayerIndex === index;

    // Visual state
    const getVisualState = () => {
      if (player.isEliminated) return 'eliminated';
      if (player.life <= 5 || player.poison >= 9) return 'critical';
      if (player.life <= 10 || player.poison >= 7) return 'danger';
      return 'normal';
    };

    const visualState = getVisualState();

    const getBgColor = () => {
      switch (visualState) {
        case 'eliminated':
          return 'bg-gray-800/80';
        case 'critical':
          return 'bg-red-900/50';
        case 'danger':
          return 'bg-yellow-900/30';
        default:
          return `bg-opacity-20`;
      }
    };

    const getLifeColor = () => {
      switch (visualState) {
        case 'eliminated':
          return 'text-gray-500';
        case 'critical':
          return 'text-red-400';
        case 'danger':
          return 'text-yellow-400';
        default:
          return 'text-white';
      }
    };

    const getTotalCommanderDamage = () => {
      return Object.values(player.commanderDamage || {}).reduce((sum, dmg) => sum + dmg, 0);
    };

    return (
      <div
        className={`flex-1 flex flex-col relative overflow-hidden transition-all ${getBgColor()} ${
          isCurrentTurn ? 'ring-4 ring-yellow-400/50 ring-inset' : ''
        }`}
        style={{
          transform: isFlipped ? 'rotate(180deg)' : 'none',
          backgroundColor: player.color ? `${player.color}20` : undefined,
          borderColor: player.color || '#6366f1'
        }}
      >
        {/* Eliminated Overlay */}
        {player.isEliminated && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
            <Skull size={64} className="text-gray-400 mb-2" />
            <span className="text-gray-400 font-semibold text-xl">Eliminated</span>
          </div>
        )}

        {/* Player Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {/* Status Badges */}
          <div className="flex items-center gap-2 mb-2">
            {isCurrentTurn && !player.isEliminated && (
              <div className="px-2 py-0.5 bg-yellow-600/30 rounded-full text-yellow-400 text-xs font-semibold">
                CURRENT TURN
              </div>
            )}
            {isMonarch && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-600/30 rounded-full">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-xs font-semibold">Monarch</span>
              </div>
            )}
            {hasInitiative && (
              <div className="px-2 py-0.5 bg-cyan-600/30 rounded-full text-cyan-400 text-xs font-semibold">
                Initiative
              </div>
            )}
            {player.citysBlessing && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/30 rounded-full">
                <Building2 size={12} className="text-emerald-400" />
              </div>
            )}
            {player.ringProgress > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/30 rounded-full">
                <Circle size={12} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-semibold">{player.ringProgress}</span>
              </div>
            )}
          </div>

          {/* Player Name */}
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: player.isEliminated ? '#6b7280' : (player.color || '#fff') }}
          >
            {player.name}
          </h2>

          {/* Life Total - Big touch target */}
          <div
            className={`text-9xl font-bold mb-6 cursor-pointer select-none transition ${getLifeColor()} ${
              player.isEliminated ? 'line-through' : ''
            } ${visualState === 'critical' ? 'animate-pulse' : ''}`}
            onClick={() => !player.isEliminated && onLifeChange(player.id, 1)}
          >
            {player.life}
          </div>

          {/* Life Adjustment Buttons */}
          <div className={`flex gap-4 mb-6 ${player.isEliminated ? 'opacity-30' : ''}`}>
            <button
              onClick={() => onLifeChange(player.id, -5)}
              disabled={player.isEliminated}
              className="w-16 h-16 bg-red-600/80 hover:bg-red-600 text-white rounded-2xl font-bold text-2xl transition disabled:opacity-50"
            >
              -5
            </button>
            <button
              onClick={() => onLifeChange(player.id, -1)}
              disabled={player.isEliminated}
              className="w-16 h-16 bg-red-500/80 hover:bg-red-500 text-white rounded-2xl transition disabled:opacity-50 flex items-center justify-center"
            >
              <Minus size={32} />
            </button>
            <button
              onClick={() => onLifeChange(player.id, 1)}
              disabled={player.isEliminated}
              className="w-16 h-16 bg-green-500/80 hover:bg-green-500 text-white rounded-2xl transition disabled:opacity-50 flex items-center justify-center"
            >
              <Plus size={32} />
            </button>
            <button
              onClick={() => onLifeChange(player.id, 5)}
              disabled={player.isEliminated}
              className="w-16 h-16 bg-green-600/80 hover:bg-green-600 text-white rounded-2xl font-bold text-2xl transition disabled:opacity-50"
            >
              +5
            </button>
          </div>

          {/* Bottom Row: Poison + Commander Damage */}
          <div className={`flex items-center gap-6 ${player.isEliminated ? 'opacity-30' : ''}`}>
            {/* Poison Counter */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onPoisonChange(player.id, -1)}
                disabled={player.isEliminated || player.poison <= 0}
                className="w-10 h-10 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center"
              >
                <Minus size={20} />
              </button>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                player.poison >= 9 ? 'bg-red-600/50' :
                player.poison >= 7 ? 'bg-yellow-600/50' :
                'bg-purple-900/50'
              }`}>
                <Droplets size={24} className="text-purple-300" />
                <span className={`text-2xl font-bold ${
                  player.poison >= 9 ? 'text-red-300' :
                  player.poison >= 7 ? 'text-yellow-300' :
                  'text-purple-300'
                }`}>
                  {player.poison}
                </span>
              </div>
              <button
                onClick={() => onPoisonChange(player.id, 1)}
                disabled={player.isEliminated}
                className="w-10 h-10 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Commander Damage Button */}
            {gameFormat === 'commander' && (
              <button
                onClick={() => onCommanderDamageClick(player.id)}
                disabled={player.isEliminated}
                className={`px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 ${
                  player.isEliminated
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-600/80 hover:bg-orange-600 text-white'
                }`}
              >
                <Swords size={24} />
                <span className="text-lg">CMD</span>
                {getTotalCommanderDamage() > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-sm ${
                    getTotalCommanderDamage() >= 18 ? 'bg-red-500' :
                    getTotalCommanderDamage() >= 15 ? 'bg-yellow-500' :
                    'bg-white/20'
                  }`}>
                    {getTotalCommanderDamage()}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 relative">
      {/* Player 1 - Flipped (top) */}
      {renderPlayerSide(players[0], 0, true)}

      {/* Center Controls */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="p-3 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full shadow-lg transition"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {onToggleLayout && (
          <button
            onClick={onToggleLayout}
            className="p-3 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full shadow-lg transition"
            title="Grid Layout"
          >
            <LayoutGrid size={20} />
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="p-3 bg-red-600/90 hover:bg-red-500 text-white rounded-full shadow-lg transition"
            title="Reset"
          >
            <RotateCcw size={20} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-1 bg-white/20 flex-shrink-0" />

      {/* Player 2 - Normal (bottom) */}
      {renderPlayerSide(players[1], 1, false)}
    </div>
  );
}

export default TwoPlayerLandscape;

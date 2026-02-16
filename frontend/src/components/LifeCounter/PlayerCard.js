import React, { useState, useRef, useEffect } from 'react';
import { Plus, Minus, Skull, Droplets, Swords, Crown, Building2, Circle, Zap, Star, Tag, Heart, Activity, Shield, Sword, Settings } from 'lucide-react';
import CountersPanel from './CountersPanel';
import ManaPoolTracker from './ManaPoolTracker';
import PlayerStatusIndicators from './PlayerStatusIndicators';
import QuickLifeControls from './QuickLifeControls';
import AnimatedLifeChange from './AnimatedLifeChange';
import PlayerAdvancedControls from './PlayerAdvancedControls';

function PlayerCard({
  player,
  gameFormat,
  players = [],
  onLifeChange,
  onPoisonChange,
  onCommanderDamageClick,
  onCountersChange,
  onManaChange,
  onCommanderDamageChange,
  compact = false,
  isCurrentPlayer = false,
  isMonarch = false,
  hasInitiative = false,
  backgroundImage = null
}) {
  const playerCardRef = useRef(null);
  const [showAdvancedControls, setShowAdvancedControls] = useState({ show: false, position: null });
  // Determine visual state based on life and poison
  const getVisualState = () => {
    if (player.isEliminated) return 'eliminated';
    if (player.life <= 5 || player.poison >= 9) return 'critical';
    if (player.life <= 10 || player.poison >= 7) return 'danger';
    return 'normal';
  };

  const visualState = getVisualState();

  const getContainerClasses = () => {
    const base = 'rounded-2xl p-4 transition-all duration-300 relative overflow-hidden';
    const currentPlayerHighlight = isCurrentPlayer ? 'ring-4 ring-yellow-400/50 ring-offset-2 ring-offset-transparent' : '';

    switch (visualState) {
      case 'eliminated':
        return `${base} bg-gray-800/80 border-2 border-gray-600`;
      case 'critical':
        return `${base} bg-red-900/50 border-2 border-red-500 animate-pulse ${currentPlayerHighlight}`;
      case 'danger':
        return `${base} bg-yellow-900/30 border-2 border-yellow-500 ${currentPlayerHighlight}`;
      default:
        return `${base} bg-white/10 border-2 ${isCurrentPlayer ? 'border-yellow-400' : 'border-white/20'} ${currentPlayerHighlight}`;
    }
  };

  const getLifeTextClasses = () => {
    const base = 'font-bold transition-colors';
    const size = compact ? 'text-5xl' : 'text-7xl';

    switch (visualState) {
      case 'eliminated':
        return `${base} ${size} text-gray-500 line-through`;
      case 'critical':
        return `${base} ${size} text-red-400`;
      case 'danger':
        return `${base} ${size} text-yellow-400`;
      default:
        return `${base} ${size} text-white`;
    }
  };

  const getEliminationReason = () => {
    switch (player.eliminationReason) {
      case 'life':
        return 'Life reached 0';
      case 'poison':
        return '10 poison counters';
      case 'commander':
        return '21 commander damage';
      default:
        return 'Eliminated';
    }
  };

  // Get total commander damage taken
  const getTotalCommanderDamage = () => {
    return Object.values(player.commanderDamage || {}).reduce((sum, dmg) => sum + dmg, 0);
  };

  return (
    <div ref={playerCardRef} className={getContainerClasses()}>
      {/* Background Image */}
      {backgroundImage && !player.isEliminated && (
        <div className="absolute inset-0 z-0">
          <img
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Eliminated Overlay */}
      {player.isEliminated && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
          <Skull size={compact ? 48 : 64} className="text-gray-400 mb-2" />
          <span className="text-gray-400 font-semibold">{getEliminationReason()}</span>
        </div>
      )}

      {/* Player Name */}
      <div className="text-center mb-2 relative z-[1]">
        {isCurrentPlayer && !player.isEliminated && (
          <div className="text-yellow-400 text-xs font-semibold mb-1">▶ CURRENT TURN</div>
        )}
        <h3 className={`font-bold truncate ${compact ? 'text-lg' : 'text-xl'} ${player.isEliminated ? 'text-gray-500' : 'text-white'}`}>
          {player.name}
        </h3>
      </div>

      {/* Status Badges */}
      {!player.isEliminated && (isMonarch || hasInitiative || player.citysBlessing || player.ringProgress > 0) && (
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap relative z-[1]">
          {isMonarch && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-600/30 rounded-full" title="Monarch">
              <Crown size={12} className="text-yellow-400" />
              <span className="text-yellow-400 text-xs font-semibold">Monarch</span>
            </div>
          )}
          {hasInitiative && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-600/30 rounded-full" title="Has Initiative">
              <span className="text-cyan-400 text-xs font-semibold">Initiative</span>
            </div>
          )}
          {player.citysBlessing && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/30 rounded-full" title="City's Blessing">
              <Building2 size={12} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">Blessed</span>
            </div>
          )}
          {player.ringProgress > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/30 rounded-full" title={`Ring Level ${player.ringProgress}`}>
              <Circle size={12} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold">Ring {player.ringProgress}</span>
            </div>
          )}
        </div>
      )}

      {/* Life Total */}
      <div className="text-center mb-4 relative z-[1]">
        <div
          className={getLifeTextClasses()}
          onClick={() => !player.isEliminated && onLifeChange(1)}
          style={{ cursor: player.isEliminated ? 'default' : 'pointer' }}
        >
          <AnimatedLifeChange currentLife={player.life} />
        </div>
      </div>

      {/* Life Adjustment Buttons */}
      <div className={`flex justify-center gap-2 mb-4 relative z-[1] ${player.isEliminated ? 'opacity-30' : ''}`}>
        <button
          onClick={() => onLifeChange(-5)}
          disabled={player.isEliminated}
          className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -5
        </button>
        <button
          onClick={() => onLifeChange(-1)}
          disabled={player.isEliminated}
          className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => onLifeChange(1)}
          disabled={player.isEliminated}
          className="px-4 py-2 bg-green-500/80 hover:bg-green-500 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => onLifeChange(5)}
          disabled={player.isEliminated}
          className="px-3 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +5
        </button>
      </div>

      {/* Counters Panel */}
      <CountersPanel
        playerId={player.id}
        counters={player.counters}
        onCounterChange={onCountersChange}
        compact={compact}
      />

      {/* Player Status Indicators */}
      <PlayerStatusIndicators player={player} />

      {/* Advanced Controls Button */}
      <button
        onClick={(e) => {
          // Get the player card's position using the ref
          if (playerCardRef.current) {
            const rect = playerCardRef.current.getBoundingClientRect();
            setShowAdvancedControls({
              show: true,
              position: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            });
          } else {
            // Fallback to button position if ref isn't available
            const rect = e.currentTarget.getBoundingClientRect();
            setShowAdvancedControls({
              show: true,
              position: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            });
          }
        }}
        className="w-full mt-2 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
      >
        <Settings size={16} />
        Advanced Controls
      </button>

      {/* Advanced Controls Modal */}
      {showAdvancedControls.show && (
        <PlayerAdvancedControls
          player={player}
          gameFormat={gameFormat}
          players={players}
          onLifeChange={(amount) => onLifeChange(amount)}
          onPoisonChange={(amount) => onPoisonChange(amount)}
          onCountersChange={onCountersChange}
          onManaChange={onManaChange}
          onCommanderDamageClick={onCommanderDamageClick}
          onCommanderDamageChange={onCommanderDamageChange}
          position={showAdvancedControls.position}
          onClose={() => setShowAdvancedControls({ show: false, position: null })}
        />
      )}
    </div>
  );
}

export default PlayerCard;

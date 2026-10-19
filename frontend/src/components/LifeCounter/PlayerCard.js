import React, {
  useState,
  useRef
} from 'react';
import {
  Plus,
  Minus,
  Skull,
  Crown,
  Building2,
  Circle,
  Settings
} from 'lucide-react';
import CountersPanel from './CountersPanel';
import PlaneswalkersPanel from './PlaneswalkersPanel';
import PlayerStatusIndicators from './PlayerStatusIndicators';
import AnimatedLifeChange from './AnimatedLifeChange';
import PlayerAdvancedControls from './PlayerAdvancedControls';
import useHoldRepeat from './hooks/useHoldRepeat';

const shortName = (name) => {
  const n = name || '';
  return n.length > 9 ? `${n.slice(0, 8)}\u2026` : n;
};

function PlayerCard({
  player,
  gameFormat,
  // Stable () => players[] getter (LifeCounter backs it with a ref). Needed
  // for the on-card commander damage grid; a plain `players` prop would
  // change identity on every state change and defeat React.memo here.
  getPlayers,
  onLifeChange,        // (amount) => void
  onPoisonChange,      // (amount) => void
  onCommanderDamageClick, // () => void — opens this player's damage modal
  onSetLife,           // (value) => void — direct life entry pad
  onCountersChange,
  onManaChange,
  onCommanderDamageChange,
  onPlaneswalkerAdd,
  onPlaneswalkerLoyaltyChange,
  onPlaneswalkerRemove,
  compact = false,
  isCurrentPlayer = false,
  isMonarch = false,
  hasInitiative = false,
  backgroundImage = null
}) {
  const playerCardRef = useRef(null);
  const [showAdvancedControls, setShowAdvancedControls] = useState({ show: false, position: null });
  const [showLifeEntry, setShowLifeEntry] = useState(false);
  const [lifeInput, setLifeInput] = useState('');

  // Hold-to-repeat on the life buttons: tap fires once, holding auto-repeats.
  // The reducer ignores changes for eliminated players, so the guards below
  // only keep the held repeat from doing pointless work.
  const holdDown5 = useHoldRepeat(() => { if (!player.isEliminated) onLifeChange(-5); });
  const holdDown1 = useHoldRepeat(() => { if (!player.isEliminated) onLifeChange(-1); });
  const holdUp1 = useHoldRepeat(() => { if (!player.isEliminated) onLifeChange(1); });
  const holdUp5 = useHoldRepeat(() => { if (!player.isEliminated) onLifeChange(5); });

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

  const openLifeEntry = () => {
    if (player.isEliminated) return;
    setLifeInput(String(player.life));
    setShowLifeEntry(true);
  };

  const submitLifeEntry = () => {
    const value = parseInt(lifeInput, 10);
    if (!Number.isNaN(value)) onSetLife(value);
    setShowLifeEntry(false);
  };

  // Opponents for the on-card commander damage grid
  const opponents = gameFormat === 'commander' && getPlayers
    ? getPlayers().filter(p => p.id !== player.id)
    : [];
  const damageMap = player.commanderDamage || {};
  // Highest single-source commander damage (the 21-from-one-commander rule)
  const maxCommanderDamage = opponents.reduce(
    (max, o) => Math.max(max, damageMap[o.id] || 0),
    0
  );

  return (
    <div ref={playerCardRef} className={getContainerClasses()} data-testid={`player-card-${player.id}`}>
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

      {/* Life Total — tap to enter an exact total directly */}
      <div className="text-center mb-4 relative z-[1]">
        <button
          type="button"
          onClick={openLifeEntry}
          disabled={player.isEliminated}
          className={`${getLifeTextClasses()} w-full bg-transparent touch-manipulation select-none disabled:cursor-default`}
          aria-label={`Set exact life total for ${player.name}`}
          data-testid={`life-total-${player.id}`}
        >
          <AnimatedLifeChange currentLife={player.life} />
        </button>
      </div>

      {/* Life Adjustment Buttons (hold to repeat) */}
      <div className={`flex justify-center gap-2 mb-4 relative z-[1] ${player.isEliminated ? 'opacity-30' : ''}`}>
        <button
          {...holdDown5}
          disabled={player.isEliminated}
          className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none active:scale-95"
          aria-label={`Remove 5 life from ${player.name}`}
        >
          -5
        </button>
        <button
          {...holdDown1}
          disabled={player.isEliminated}
          className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none active:scale-95"
          aria-label={`Remove 1 life from ${player.name}`}
        >
          <Minus size={18} />
        </button>
        <button
          {...holdUp1}
          disabled={player.isEliminated}
          className="px-4 py-2 bg-green-500/80 hover:bg-green-500 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none active:scale-95"
          aria-label={`Add 1 life to ${player.name}`}
        >
          <Plus size={18} />
        </button>
        <button
          {...holdUp5}
          disabled={player.isEliminated}
          className="px-3 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none active:scale-95"
          aria-label={`Add 5 life to ${player.name}`}
        >
          +5
        </button>
      </div>

      {/* Commander Damage (Commander format, on-card) */}
      {gameFormat === 'commander' && !player.isEliminated && (
        <div
          className="mb-3 relative z-[1]"
          data-testid={`commander-damage-grid-${player.id}`}
        >
          <div className="text-[10px] text-white/40 text-center font-semibold mb-1 uppercase tracking-wide">
            Commander Damage
          </div>
          {compact ? (
            /* Compact (5-6 players): one chip showing the highest single-source
               damage; always visible so damage can be added from anywhere */
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => onCommanderDamageClick()}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold touch-manipulation select-none hover:brightness-125 transition ${
                  maxCommanderDamage >= 14
                    ? 'bg-red-900/60 border-red-500 text-red-200'
                    : maxCommanderDamage > 0
                      ? 'bg-orange-900/50 border-orange-500 text-orange-200'
                      : 'bg-black/30 border-white/20 text-white/60'
                }`}
                title={`Manage commander damage to ${player.name} — tap to open`}
              >
                ⚔ {maxCommanderDamage}/21
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {opponents.map(opp => {
                const dealt = damageMap[opp.id] || 0;
                const danger = dealt >= 14;
                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => onCommanderDamageClick()}
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold text-white/80 hover:brightness-125 transition touch-manipulation select-none ${
                      danger ? 'border-red-500' : dealt > 0 ? 'border-orange-500' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: `${opp.color || '#6366f1'}22` }}
                    title={`${opp.name} has dealt ${dealt}/21 commander damage to ${player.name} — tap to manage`}
                  >
                    {shortName(opp.name)}{' '}
                    <span className={danger ? 'text-red-300' : dealt > 0 ? 'text-orange-300' : 'text-white/50'}>
                      {dealt}/21
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Counters Panel */}
      <CountersPanel
        playerId={player.id}
        counters={player.counters}
        onCounterChange={onCountersChange}
        compact={compact}
      />

      {/* Planeswalkers Panel */}
      <PlaneswalkersPanel
        playerId={player.id}
        planeswalkers={player.planeswalkers}
        onAdd={onPlaneswalkerAdd}
        onLoyaltyChange={onPlaneswalkerLoyaltyChange}
        onRemove={onPlaneswalkerRemove}
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
        className="w-full mt-2 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2 touch-manipulation"
      >
        <Settings size={16} />
        Advanced Controls
      </button>

      {/* Advanced Controls Modal */}
      {showAdvancedControls.show && (
        <PlayerAdvancedControls
          player={player}
          gameFormat={gameFormat}
          onLifeChange={onLifeChange}
          onPoisonChange={onPoisonChange}
          onCountersChange={onCountersChange}
          onManaChange={onManaChange}
          onCommanderDamageClick={onCommanderDamageClick}
          onCommanderDamageChange={onCommanderDamageChange}
          position={showAdvancedControls.position}
          onClose={() => setShowAdvancedControls({ show: false, position: null })}
        />
      )}

      {/* Direct Life Entry Pad */}
      {showLifeEntry && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          data-testid={`life-entry-${player.id}`}
        >
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-white/20">
            <h4 className="text-white font-bold mb-1">Set {player.name}'s life</h4>
            <p className="text-white/50 text-xs mb-4">Enter an exact total.</p>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={lifeInput}
              onChange={(e) => setLifeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitLifeEntry();
                if (e.key === 'Escape') setShowLifeEntry(false);
              }}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              data-testid={`life-entry-input-${player.id}`}
            />
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setLifeInput(v => String((parseInt(v, 10) || 0) - 1))}
                className="flex-1 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-bold transition touch-manipulation select-none active:scale-95"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setLifeInput(v => String((parseInt(v, 10) || 0) + 1))}
                className="flex-1 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg font-bold transition touch-manipulation select-none active:scale-95"
              >
                +1
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLifeEntry(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitLifeEntry}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(PlayerCard);

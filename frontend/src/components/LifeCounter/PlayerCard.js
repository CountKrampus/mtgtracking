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
    const base = 'rounded-2xl border p-3 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-200 relative overflow-hidden sm:p-4';
    const currentPlayerHighlight = isCurrentPlayer ? 'ring-2 ring-amber-300/80 ring-offset-2 ring-offset-slate-950' : '';

    switch (visualState) {
      case 'eliminated':
        return `${base} bg-slate-900/90 border-slate-600/80 opacity-75`;
      case 'critical':
        return `${base} bg-rose-950/65 border-rose-400/70 ${currentPlayerHighlight}`;
      case 'danger':
        return `${base} bg-amber-950/45 border-amber-400/60 ${currentPlayerHighlight}`;
      default:
        return `${base} bg-slate-900/65 ${isCurrentPlayer ? 'border-amber-300/60' : 'border-white/10'} ${currentPlayerHighlight}`;
    }
  };

  const getLifeTextClasses = () => {
    const base = 'font-bold tracking-tight tabular-nums transition-colors';
    const size = compact ? 'text-5xl' : 'text-5xl sm:text-6xl lg:text-7xl';

    switch (visualState) {
      case 'eliminated':
        return `${base} ${size} text-gray-500 line-through`;
      case 'critical':
        return `${base} ${size} text-rose-300`;
      case 'danger':
        return `${base} ${size} text-amber-200`;
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
    <div
      ref={playerCardRef}
      className={getContainerClasses()}
      style={visualState === 'normal' && player.color ? { borderColor: `${player.color}88` } : undefined}
      data-testid={`player-card-${player.id}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80"
        style={{ background: player.color || '#818cf8' }}
      />
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
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Current turn
          </div>
        )}
        <h3 className={`font-bold truncate tracking-tight ${compact ? 'text-base sm:text-lg' : 'text-base sm:text-xl'} ${player.isEliminated ? 'text-gray-500' : 'text-white'}`}>
          {player.name}
        </h3>
      </div>

      {/* Status Badges */}
      {!player.isEliminated && (isMonarch || hasInitiative || player.citysBlessing || player.ringProgress > 0) && (
        <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap relative z-[1]">
          {isMonarch && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-600/30 rounded-full" title="Monarch">
              <Crown size={12} className="text-yellow-400" />
              <span className="text-[10px] font-semibold text-yellow-400 sm:text-xs">Monarch</span>
            </div>
          )}
          {hasInitiative && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-600/30 rounded-full" title="Has Initiative">
              <span className="text-[10px] font-semibold text-cyan-400 sm:text-xs">Initiative</span>
            </div>
          )}
          {player.citysBlessing && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/30 rounded-full" title="City's Blessing">
              <Building2 size={12} className="text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400 sm:text-xs">Blessed</span>
            </div>
          )}
          {player.ringProgress > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/30 rounded-full" title={`Ring Level ${player.ringProgress}`}>
              <Circle size={12} className="text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400 sm:text-xs">Ring {player.ringProgress}</span>
            </div>
          )}
        </div>
      )}

      {/* Life Total — tap to enter an exact total directly */}
      <div className="relative z-[1] mb-3 text-center">
        <button
          type="button"
          onClick={openLifeEntry}
          disabled={player.isEliminated}
          className={`${getLifeTextClasses()} w-full rounded-2xl bg-black/10 py-1 touch-manipulation select-none disabled:cursor-default`}
          aria-label={`Set exact life total for ${player.name}`}
          data-testid={`life-total-${player.id}`}
        >
          <AnimatedLifeChange currentLife={player.life} />
        </button>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35">
          Life total · tap to edit
        </span>
      </div>

      {/* Life Adjustment Buttons (hold to repeat) */}
      <div className={`relative z-[1] mb-3 grid grid-cols-4 gap-1.5 sm:gap-2 ${player.isEliminated ? 'opacity-30' : ''}`}>
        <button
          {...holdDown5}
          disabled={player.isEliminated}
          className="min-h-11 rounded-xl border border-rose-300/15 bg-rose-500/15 text-sm font-bold text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-500/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation select-none sm:min-h-12"
          aria-label={`Remove 5 life from ${player.name}`}
          title="Hold to repeat"
        >
          -5
        </button>
        <button
          {...holdDown1}
          disabled={player.isEliminated}
          className="min-h-11 rounded-xl border border-rose-300/15 bg-rose-500/20 text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-500/35 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation select-none sm:min-h-12"
          aria-label={`Remove 1 life from ${player.name}`}
          title="Hold to repeat"
        >
          <Minus size={20} />
        </button>
        <button
          {...holdUp1}
          disabled={player.isEliminated}
          className="min-h-11 rounded-xl border border-emerald-300/15 bg-emerald-500/20 text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-500/35 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation select-none sm:min-h-12"
          aria-label={`Add 1 life to ${player.name}`}
          title="Hold to repeat"
        >
          <Plus size={20} />
        </button>
        <button
          {...holdUp5}
          disabled={player.isEliminated}
          className="min-h-11 rounded-xl border border-emerald-300/15 bg-emerald-500/15 text-sm font-bold text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-500/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation select-none sm:min-h-12"
          aria-label={`Add 5 life to ${player.name}`}
          title="Hold to repeat"
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
          <div className="mb-1.5 border-t border-white/10 pt-2 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
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
        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/10 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-400/15 touch-manipulation"
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

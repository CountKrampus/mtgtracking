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
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b transition-colors last:border-b-0 ${getBgColor()} ${
          isCurrentTurn ? 'ring-2 ring-yellow-300/60 ring-inset' : ''
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
            <Skull size={40} className="mb-2 text-gray-400 sm:h-12 sm:w-12" />
            <span className="text-sm font-semibold text-gray-300 sm:text-base">Eliminated</span>
          </div>
        )}

        {/* Player Content */}
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-evenly gap-1 px-3 py-2 sm:px-5 sm:py-3">
          {/* Status Badges */}
          <div className="flex min-h-5 flex-wrap items-center justify-center gap-1.5">
            {isCurrentTurn && !player.isEliminated && (
              <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-200">
                TURN
              </div>
            )}
            {isMonarch && (
              <div className="flex items-center gap-1 rounded-full bg-yellow-600/20 px-2 py-0.5">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-[10px] font-semibold text-yellow-300">Monarch</span>
              </div>
            )}
            {hasInitiative && (
              <div className="rounded-full bg-cyan-600/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                Initiative
              </div>
            )}
            {player.citysBlessing && (
              <div className="flex items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5">
                <Building2 size={12} className="text-emerald-400" />
              </div>
            )}
            {player.ringProgress > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-amber-600/20 px-2 py-0.5">
                <Circle size={12} className="text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-300">{player.ringProgress}</span>
              </div>
            )}
          </div>

          {/* Player Name */}
          <h2
            className="mb-0 max-w-full truncate text-lg font-bold tracking-tight sm:text-xl"
            style={{ color: player.isEliminated ? '#6b7280' : (player.color || '#fff') }}
          >
            {player.name}
          </h2>

          {/* Life Total - Big touch target */}
          <div
            className={`cursor-pointer select-none py-0 font-bold leading-none tracking-tighter transition ${getLifeColor()} ${
              player.isEliminated ? 'line-through' : ''
            } ${visualState === 'critical' ? 'animate-pulse' : ''}`}
            style={{ fontSize: 'clamp(2.75rem, 11vh, 6rem)' }}
            onClick={() => !player.isEliminated && onLifeChange(player.id, 1)}
            role="button"
            tabIndex={player.isEliminated ? -1 : 0}
            aria-label={`${player.name}: ${player.life} life. Tap to gain 1 life.`}
            onKeyDown={event => {
              if (!player.isEliminated && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onLifeChange(player.id, 1);
              }
            }}
          >
            {player.life}
          </div>

          {/* Life Adjustment Buttons */}
          <div className={`grid w-full max-w-sm grid-cols-4 gap-2 ${player.isEliminated ? 'opacity-30' : ''}`}>
            <button
              onClick={() => onLifeChange(player.id, -5)}
              disabled={player.isEliminated}
              className="rounded-xl border border-rose-300/15 bg-rose-500/20 text-lg font-bold text-rose-100 transition active:scale-95 disabled:opacity-50"
              aria-label={`Remove 5 life from ${player.name}`}
              style={{ height: 'clamp(2.25rem, 8vh, 3rem)' }}
            >
              -5
            </button>
            <button
              onClick={() => onLifeChange(player.id, -1)}
              disabled={player.isEliminated}
              className="flex items-center justify-center rounded-xl border border-rose-300/15 bg-rose-500/25 text-rose-100 transition active:scale-95 disabled:opacity-50"
              aria-label={`Remove 1 life from ${player.name}`}
              style={{ height: 'clamp(2.25rem, 8vh, 3rem)' }}
            >
              <Minus size={24} />
            </button>
            <button
              onClick={() => onLifeChange(player.id, 1)}
              disabled={player.isEliminated}
              className="flex items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-500/25 text-emerald-100 transition active:scale-95 disabled:opacity-50"
              aria-label={`Add 1 life to ${player.name}`}
              style={{ height: 'clamp(2.25rem, 8vh, 3rem)' }}
            >
              <Plus size={24} />
            </button>
            <button
              onClick={() => onLifeChange(player.id, 5)}
              disabled={player.isEliminated}
              className="rounded-xl border border-emerald-300/15 bg-emerald-500/20 text-lg font-bold text-emerald-100 transition active:scale-95 disabled:opacity-50"
              aria-label={`Add 5 life to ${player.name}`}
              style={{ height: 'clamp(2.25rem, 8vh, 3rem)' }}
            >
              +5
            </button>
          </div>

          {/* Bottom Row: Poison + Commander Damage */}
          <div className={`flex flex-wrap items-center justify-center gap-2 sm:gap-4 ${player.isEliminated ? 'opacity-30' : ''}`}>
            {/* Poison Counter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPoisonChange(player.id, -1)}
                disabled={player.isEliminated || player.poison <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-500/20 text-white transition disabled:opacity-50"
                aria-label={`Remove poison counter from ${player.name}`}
              >
                <Minus size={20} />
              </button>
              <div className={`flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1 ${
                player.poison >= 9 ? 'bg-red-600/50' :
                player.poison >= 7 ? 'bg-yellow-600/50' :
                'bg-purple-900/50'
              }`}>
                <Droplets size={18} className="text-purple-300" />
                <span className={`text-lg font-bold tabular-nums ${
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
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-500/20 text-white transition disabled:opacity-50"
                aria-label={`Add poison counter to ${player.name}`}
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Commander Damage Button */}
            {gameFormat === 'commander' && (
              <button
                onClick={() => onCommanderDamageClick(player.id)}
                disabled={player.isEliminated}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  player.isEliminated
                    ? 'cursor-not-allowed border-white/5 bg-gray-700/50 text-gray-500'
                    : 'border-orange-300/20 bg-orange-500/20 text-orange-100 hover:bg-orange-500/30'
                }`}
                aria-label={`Manage commander damage to ${player.name}`}
              >
                <Swords size={18} />
                <span>CMD</span>
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
    <div
      className="fixed inset-0 z-40 flex w-screen flex-col overflow-hidden bg-slate-950"
      style={{
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Player 1 - Flipped (top) */}
      {renderPlayerSide(players[0], 0, true)}

      {/* Center Controls */}
      <div className="z-20 flex h-10 shrink-0 items-center justify-center gap-2 border-y border-white/10 bg-slate-950 px-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-10 items-center justify-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {onToggleLayout && (
          <button
            onClick={onToggleLayout}
            className="flex h-8 w-10 items-center justify-center rounded-lg text-sky-200 transition hover:bg-sky-400/15 hover:text-white"
            title="Grid Layout"
            aria-label="Switch to grid layout"
          >
            <LayoutGrid size={18} />
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="flex h-8 w-10 items-center justify-center rounded-lg text-rose-200 transition hover:bg-rose-400/15 hover:text-white"
            title="Reset"
            aria-label="Reset game"
          >
            <RotateCcw size={18} />
          </button>
        )}
      </div>

      {/* Player 2 - Normal (bottom) */}
      {renderPlayerSide(players[1], 1, false)}
    </div>
  );
}

export default TwoPlayerLandscape;

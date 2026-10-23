import React from 'react';
import { ChevronLeft, ChevronRight, Zap, RotateCcw } from 'lucide-react';

// Phase display configuration
const PHASE_CONFIG = {
  upkeep: { label: 'Upkeep', color: 'bg-yellow-600', hoverColor: 'hover:bg-yellow-500' },
  draw: { label: 'Draw', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-500' },
  main1: { label: 'Main 1', color: 'bg-green-600', hoverColor: 'hover:bg-green-500' },
  combat: { label: 'Combat', color: 'bg-red-600', hoverColor: 'hover:bg-red-500' },
  main2: { label: 'Main 2', color: 'bg-green-600', hoverColor: 'hover:bg-green-500' },
  end: { label: 'End', color: 'bg-purple-600', hoverColor: 'hover:bg-purple-500' }
};

const GAME_PHASES = ['upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

function TurnTracker({
  currentPlayerIndex,
  turnNumber,
  stormCount,
  players,
  onNextTurn,
  onPreviousTurn,
  onSetCurrentPlayer,
  onIncrementStorm,
  onDecrementStorm,
  onResetStorm,
  currentPhase = 'upkeep',
  onAdvancePhase,
  onSetPhase,
  compact = false
}) {
  const currentPlayer = players[currentPlayerIndex];

  if (compact) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5 shadow-lg backdrop-blur-xl sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              onClick={onPreviousTurn}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
              title="Previous turn"
            >
              <ChevronLeft size={18} className="text-white/70" />
            </button>

            <div className="min-w-0 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/45">Turn {turnNumber}</div>
              <div
                className="max-w-[120px] truncate text-sm font-bold text-white"
                style={{ color: currentPlayer?.color || '#fff' }}
              >
                {currentPlayer?.name || 'Unknown'}
              </div>
            </div>

            <button
              onClick={onNextTurn}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
              title="Next turn"
            >
              <ChevronRight size={18} className="text-white/70" />
            </button>
          </div>

          {/* Storm Counter */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-black/20 px-2 py-1">
            <Zap size={14} className="text-yellow-400" />
            <button
              onClick={onDecrementStorm}
              disabled={stormCount <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-30"
            >
              -
            </button>
            <span className="text-yellow-400 font-bold w-6 text-center">{stormCount}</span>
            <button
              onClick={onIncrementStorm}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-white/70 transition hover:bg-white/10"
            >
              +
            </button>
            <button
              onClick={onResetStorm}
              disabled={stormCount <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
              title="Reset storm count"
              aria-label="Reset storm count"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {players.map((player, index) => (
            <button
              key={player.id}
              onClick={() => onSetCurrentPlayer(index)}
              disabled={player.isEliminated}
              className={`max-w-[120px] shrink-0 truncate rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                index === currentPlayerIndex
                  ? 'border-white/25 bg-white/10 text-white'
                  : 'border-transparent bg-black/15 text-white/50 hover:bg-white/5'
              } disabled:opacity-30`}
              style={index === currentPlayerIndex ? { boxShadow: `inset 0 -2px ${player.color || '#818cf8'}` } : undefined}
              title={`Set ${player.name} as the current player`}
            >
              {player.name}
            </button>
          ))}
        </div>

        {/* Phase Bar - Compact */}
        <div className="mt-1 flex gap-1">
          {GAME_PHASES.map((phase) => {
            const config = PHASE_CONFIG[phase];
            const isActive = currentPhase === phase;
            return (
              <button
                key={phase}
                onClick={() => onSetPhase ? onSetPhase(phase) : (onAdvancePhase && onAdvancePhase())}
                className={`flex-1 py-1 px-1 rounded text-xs font-medium transition ${
                  isActive
                    ? `${config.color} text-white shadow-md shadow-black/20 ring-1 ring-white/30`
                    : `bg-white/5 text-white/50 ${config.hoverColor}`
                }`}
                title={`${config.label}${isActive ? ' (current)' : ''}`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white/60 text-sm font-semibold">Turn Tracker</h3>
        <div className="text-white/80 font-bold">Turn {turnNumber}</div>
      </div>

      {/* Current Player Display */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={onPreviousTurn}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10"
          title="Previous turn"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>

        <div
          className="flex-1 rounded-2xl border border-white/10 py-3 transition"
          style={{ backgroundColor: `${currentPlayer?.color || '#6366f1'}30` }}
        >
          <div className="text-white/60 text-xs mb-1">Current Player</div>
          <div
            className="text-xl font-bold"
            style={{ color: currentPlayer?.color || '#fff' }}
          >
            {currentPlayer?.name || 'Unknown'}
          </div>
          {currentPlayer?.isEliminated && (
            <div className="text-red-400 text-xs mt-1">Eliminated</div>
          )}
        </div>

        <button
          onClick={onNextTurn}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10"
          title="Next turn"
        >
          <ChevronRight size={24} className="text-white" />
        </button>
      </div>

      {/* Player Quick Select */}
      <div className="flex flex-wrap gap-2 mb-4">
        {players.map((player, index) => (
          <button
            key={player.id}
            onClick={() => onSetCurrentPlayer(index)}
            disabled={player.isEliminated}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              index === currentPlayerIndex
                ? 'ring-2 ring-white/80 shadow-md shadow-black/20'
                : ''
            } ${
              player.isEliminated
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: player.color || '#6366f1',
              color: '#fff'
            }}
          >
            {player.name}
          </button>
        ))}
      </div>

      {/* Phase Bar */}
      <div className="mb-4">
        <div className="text-white/60 text-xs font-semibold mb-2">Current Phase</div>
        <div className="flex gap-1">
          {GAME_PHASES.map((phase) => {
            const config = PHASE_CONFIG[phase];
            const isActive = currentPhase === phase;
            return (
              <button
                key={phase}
                onClick={() => onSetPhase ? onSetPhase(phase) : (onAdvancePhase && onAdvancePhase())}
                className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? `${config.color} text-white shadow-md shadow-black/20 ring-1 ring-white/40`
                    : `bg-white/5 text-white/55 ${config.hoverColor}`
                }`}
                title={`${config.label}${isActive ? ' (current)' : ''}`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Storm Counter */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-yellow-400" />
          <span className="text-white/80 font-medium">Storm Count</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDecrementStorm}
            disabled={stormCount <= 0}
            className="w-8 h-8 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded-lg text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            -
          </button>
          <span className="text-yellow-400 font-bold text-xl w-8 text-center">
            {stormCount}
          </span>
          <button
            onClick={onIncrementStorm}
            className="w-8 h-8 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded-lg text-white font-bold transition"
          >
            +
          </button>
          {stormCount > 0 && (
            <button
              onClick={onResetStorm}
              className="p-1 hover:bg-white/10 rounded transition"
              title="Reset storm count"
            >
              <RotateCcw size={16} className="text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* Turn Order Indicator */}
      <div className="mt-3 flex items-center justify-center gap-1">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`w-3 h-3 rounded-full transition ${
              player.isEliminated ? 'opacity-30' : ''
            }`}
            style={{
              backgroundColor: index === currentPlayerIndex
                ? player.color || '#6366f1'
                : `${player.color || '#6366f1'}40`
            }}
            title={player.name}
          />
        ))}
      </div>
    </div>
  );
}

export default TurnTracker;

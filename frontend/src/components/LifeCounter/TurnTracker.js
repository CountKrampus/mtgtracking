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
      <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={onPreviousTurn}
              className="p-1 hover:bg-white/20 rounded-lg transition"
              title="Previous turn"
            >
              <ChevronLeft size={18} className="text-white/70" />
            </button>

            <div className="text-center">
              <div className="text-white/60 text-xs">Turn {turnNumber}</div>
              <div
                className="text-white font-bold text-sm truncate max-w-[120px]"
                style={{ color: currentPlayer?.color || '#fff' }}
              >
                {currentPlayer?.name || 'Unknown'}
              </div>
            </div>

            <button
              onClick={onNextTurn}
              className="p-1 hover:bg-white/20 rounded-lg transition"
              title="Next turn"
            >
              <ChevronRight size={18} className="text-white/70" />
            </button>
          </div>

          {/* Storm Counter */}
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <button
              onClick={onDecrementStorm}
              disabled={stormCount <= 0}
              className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white/70 text-sm disabled:opacity-30"
            >
              -
            </button>
            <span className="text-yellow-400 font-bold w-6 text-center">{stormCount}</span>
            <button
              onClick={onIncrementStorm}
              className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white/70 text-sm"
            >
              +
            </button>
          </div>
        </div>

        {/* Phase Bar - Compact */}
        <div className="flex gap-1">
          {GAME_PHASES.map((phase) => {
            const config = PHASE_CONFIG[phase];
            const isActive = currentPhase === phase;
            return (
              <button
                key={phase}
                onClick={() => onSetPhase ? onSetPhase(phase) : (onAdvancePhase && onAdvancePhase())}
                className={`flex-1 py-1 px-1 rounded text-xs font-medium transition ${
                  isActive
                    ? `${config.color} text-white ring-2 ring-white/50`
                    : `bg-white/10 text-white/50 ${config.hoverColor}`
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
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white/60 text-sm font-semibold">Turn Tracker</h3>
        <div className="text-white/80 font-bold">Turn {turnNumber}</div>
      </div>

      {/* Current Player Display */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={onPreviousTurn}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          title="Previous turn"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>

        <div
          className="flex-1 text-center py-3 rounded-xl transition"
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
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
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
                ? 'ring-2 ring-white'
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
                    ? `${config.color} text-white ring-2 ring-white/50 shadow-lg`
                    : `bg-white/10 text-white/50 ${config.hoverColor}`
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
      <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
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

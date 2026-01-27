import React, { useState, useCallback } from 'react';
import { Shuffle, User } from 'lucide-react';

function RandomPicker({ players, onPick, compact = false }) {
  const [selected, setSelected] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const activePlayers = players.filter(p => !p.isEliminated);

  const pickRandomPlayer = useCallback(() => {
    if (activePlayers.length === 0) return;

    setSpinning(true);
    let count = 0;
    const totalSpins = 15 + Math.floor(Math.random() * 10);

    const interval = setInterval(() => {
      // Pick a random player to highlight during animation
      const randomIndex = Math.floor(Math.random() * activePlayers.length);
      setSelected(activePlayers[randomIndex]);
      count++;

      if (count >= totalSpins) {
        clearInterval(interval);
        // Final selection
        const finalIndex = Math.floor(Math.random() * activePlayers.length);
        const finalPlayer = activePlayers[finalIndex];
        setSelected(finalPlayer);
        setSpinning(false);

        if (onPick) {
          onPick(finalPlayer);
        }
      }
    }, 100 + count * 10); // Slow down over time
  }, [activePlayers, onPick]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={pickRandomPlayer}
          disabled={spinning || activePlayers.length === 0}
          className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
        >
          <Shuffle size={16} className={spinning ? 'animate-spin' : ''} />
          Pick
        </button>
        {selected && (
          <div
            className={`px-3 py-1 rounded-lg font-semibold ${spinning ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: `${selected.color || '#6366f1'}40`,
              color: selected.color || '#6366f1'
            }}
          >
            {selected.name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shuffle size={20} className="text-green-400" />
        <h3 className="text-white font-semibold">Random Player</h3>
      </div>

      {/* Player Display */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {activePlayers.map(player => (
          <div
            key={player.id}
            className={`p-3 rounded-xl transition-all ${
              selected?.id === player.id
                ? 'ring-2 ring-white scale-105'
                : 'opacity-60'
            }`}
            style={{
              backgroundColor: `${player.color || '#6366f1'}40`,
              borderColor: selected?.id === player.id ? player.color : 'transparent'
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: player.color || '#6366f1' }}
              >
                <User size={16} className="text-white" />
              </div>
              <span className="text-white font-medium truncate">{player.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Player Display */}
      {selected && !spinning && (
        <div
          className="text-center py-6 rounded-xl mb-4"
          style={{ backgroundColor: `${selected.color || '#6366f1'}30` }}
        >
          <div className="text-white/60 text-sm mb-2">Selected</div>
          <div
            className="text-3xl font-bold"
            style={{ color: selected.color || '#6366f1' }}
          >
            {selected.name}
          </div>
        </div>
      )}

      {/* Spinning Animation */}
      {spinning && (
        <div className="text-center py-6 rounded-xl mb-4 bg-white/10 animate-pulse">
          <div className="text-white/60 text-sm mb-2">Selecting...</div>
          <div className="text-3xl font-bold text-white animate-bounce">
            {selected?.name || '...'}
          </div>
        </div>
      )}

      {/* Pick Button */}
      <button
        onClick={pickRandomPlayer}
        disabled={spinning || activePlayers.length === 0}
        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Shuffle size={18} className={spinning ? 'animate-spin' : ''} />
        {spinning ? 'Selecting...' : 'Pick Random Player'}
      </button>

      {activePlayers.length === 0 && (
        <div className="text-center text-white/60 text-sm mt-2">
          No active players available
        </div>
      )}
    </div>
  );
}

export default RandomPicker;

import React, { useState } from 'react';
import { Plus, Minus, X, RotateCcw } from 'lucide-react';

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C']; // White, Blue, Black, Red, Green, Colorless
const COLOR_NAMES = {
  'W': 'White',
  'U': 'Blue', 
  'B': 'Black',
  'R': 'Red',
  'G': 'Green',
  'C': 'Colorless'
};

function ManaPoolTracker({
  playerId,
  manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  onManaChange,
  compact = false
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const totalMana = Object.values(manaPool).reduce((sum, count) => sum + count, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {COLORS.filter(color => manaPool[color] > 0).map(color => (
          <div 
            key={color} 
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
              color === 'W' ? 'bg-white text-black' :
              color === 'U' ? 'bg-blue-500 text-white' :
              color === 'B' ? 'bg-gray-800 text-white' :
              color === 'R' ? 'bg-red-500 text-white' :
              color === 'G' ? 'bg-green-500 text-white' :
              'bg-gray-600 text-white'
            }`}
          >
            {manaPool[color]}{color}
          </div>
        ))}
        {totalMana === 0 && (
          <div className="text-white/40 text-xs">No mana</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl p-3 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white/60 text-xs font-semibold">Mana Pool</div>
        <div className="text-white/60 text-xs">Total: {totalMana}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {COLORS.map(color => (
          <div key={color} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  color === 'W' ? 'bg-white text-black' :
                  color === 'U' ? 'bg-blue-500 text-white' :
                  color === 'B' ? 'bg-gray-800 text-white' :
                  color === 'R' ? 'bg-red-500 text-white' :
                  color === 'G' ? 'bg-green-500 text-white' :
                  'bg-gray-600 text-white'
                }`}
              >
                {color}
              </div>
              <span className="text-white/80 text-sm">{COLOR_NAMES[color]}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onManaChange(playerId, color, -1)}
                disabled={manaPool[color] <= 0}
                className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm disabled:opacity-30"
              >
                <Minus size={12} />
              </button>
              <span className="text-white font-bold w-6 text-center">{manaPool[color]}</span>
              <button
                onClick={() => onManaChange(playerId, color, 1)}
                className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex-1 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
        >
          <RotateCcw size={12} /> Clear All
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20">
            <h3 className="text-lg font-bold text-white mb-2">Clear Mana Pool?</h3>
            <p className="text-white/60 mb-4">
              This will remove all mana from your pool. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  COLORS.forEach(color => onManaChange(playerId, color, -manaPool[color]));
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManaPoolTracker;
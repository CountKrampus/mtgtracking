import React from 'react';
import { Trash2 } from 'lucide-react';

// Mana symbols with colors
const MANA_TYPES = [
  { symbol: 'W', name: 'White', color: '#F9FAF4', textColor: '#000' },
  { symbol: 'U', name: 'Blue', color: '#0E68AB', textColor: '#fff' },
  { symbol: 'B', name: 'Black', color: '#150B00', textColor: '#fff' },
  { symbol: 'R', name: 'Red', color: '#D3202A', textColor: '#fff' },
  { symbol: 'G', name: 'Green', color: '#00733E', textColor: '#fff' },
  { symbol: 'C', name: 'Colorless', color: '#CAC5C0', textColor: '#000' }
];

function ManaPoolTracker({
  playerId,
  manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  onManaChange,
  onClearManaPool,
  compact = false
}) {
  const totalMana = Object.values(manaPool).reduce((sum, val) => sum + val, 0);

  if (compact) {
    if (totalMana === 0) return null;

    return (
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {MANA_TYPES.map(mana => {
          const count = manaPool[mana.symbol] || 0;
          if (count === 0) return null;
          return (
            <div
              key={mana.symbol}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: mana.color }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: mana.textColor }}
              >
                {mana.symbol}
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: mana.textColor }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-white/60 text-xs font-semibold">Mana Pool</div>
        {totalMana > 0 && (
          <button
            onClick={() => onClearManaPool(playerId)}
            className="p-1 hover:bg-red-600/50 rounded transition"
            title="Clear mana pool"
          >
            <Trash2 size={12} className="text-red-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1">
        {MANA_TYPES.map(mana => {
          const count = manaPool[mana.symbol] || 0;
          return (
            <div key={mana.symbol} className="flex flex-col items-center gap-1">
              <button
                onClick={() => onManaChange(playerId, mana.symbol, 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition hover:scale-110 hover:shadow-lg"
                style={{
                  backgroundColor: mana.color,
                  color: mana.textColor,
                  boxShadow: count > 0 ? `0 0 10px ${mana.color}` : 'none'
                }}
                title={`Add ${mana.name} mana`}
              >
                {mana.symbol}
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onManaChange(playerId, mana.symbol, -1)}
                  disabled={count <= 0}
                  className="w-4 h-4 flex items-center justify-center bg-red-600/60 hover:bg-red-600 rounded text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span
                  className="text-xs font-bold w-4 text-center"
                  style={{ color: count > 0 ? mana.color : 'rgba(255,255,255,0.4)' }}
                >
                  {count}
                </span>
                <button
                  onClick={() => onManaChange(playerId, mana.symbol, 1)}
                  className="w-4 h-4 flex items-center justify-center bg-green-600/60 hover:bg-green-600 rounded text-white text-xs"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalMana > 0 && (
        <div className="mt-2 text-center text-white/60 text-xs">
          Total: {totalMana} mana
        </div>
      )}
    </div>
  );
}

export default ManaPoolTracker;

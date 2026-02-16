import React from 'react';
import { Zap, RotateCcw } from 'lucide-react';

function FloatingManaReminder({ playerId, manaPool, onClearAll, compact = false }) {
  const totalMana = Object.values(manaPool).reduce((sum, count) => sum + count, 0);
  
  if (totalMana === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {Object.entries(manaPool).filter(([_, count]) => count > 0).map(([color, count]) => (
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
            {count}{color}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-yellow-400 text-xs font-semibold flex items-center gap-1">
          <Zap size={12} />
          Floating Mana
        </div>
        <button
          onClick={() => onClearAll(playerId)}
          className="text-yellow-400/70 hover:text-yellow-400 text-xs flex items-center gap-1"
        >
          <RotateCcw size={10} /> Clear
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {Object.entries(manaPool).filter(([_, count]) => count > 0).map(([color, count]) => (
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
            {count}{color}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FloatingManaReminder;
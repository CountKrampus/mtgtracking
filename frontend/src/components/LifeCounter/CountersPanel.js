import React, { useState } from 'react';
import { Plus, Minus, Zap, Star, X, Tag } from 'lucide-react';

function CountersPanel({
  playerId,
  counters = { energy: 0, experience: 0, custom: {} },
  onCounterChange,
  compact = false
}) {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');

  const handleAddCustomCounter = () => {
    if (newCounterName.trim()) {
      onCounterChange(playerId, newCounterName.trim().toLowerCase(), 0);
      setNewCounterName('');
      setShowAddCustom(false);
    }
  };

  const removeCustomCounter = (counterName) => {
    // Set to -1 to signal removal (handled in reducer)
    onCounterChange(playerId, counterName, -9999);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {/* Energy */}
        {counters.energy > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-600/30 rounded-lg">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-yellow-400 text-xs font-bold">{counters.energy}</span>
          </div>
        )}

        {/* Experience */}
        {counters.experience > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 rounded-lg">
            <Star size={12} className="text-purple-400" />
            <span className="text-purple-400 text-xs font-bold">{counters.experience}</span>
          </div>
        )}

        {/* Custom Counters */}
        {Object.entries(counters.custom || {}).map(([name, value]) => (
          value > 0 && (
            <div key={name} className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 rounded-lg">
              <Tag size={12} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-bold">{value}</span>
            </div>
          )
        ))}
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl p-3 mt-3">
      <div className="text-white/60 text-xs font-semibold mb-2">Counters</div>

      {/* Energy Counter */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <span className="text-white/80 text-sm">Energy</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCounterChange(playerId, 'energy', -1)}
            disabled={counters.energy <= 0}
            className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm disabled:opacity-30"
          >
            <Minus size={12} />
          </button>
          <span className="text-yellow-400 font-bold w-6 text-center">{counters.energy}</span>
          <button
            onClick={() => onCounterChange(playerId, 'energy', 1)}
            className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Experience Counter */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-purple-400" />
          <span className="text-white/80 text-sm">Experience</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCounterChange(playerId, 'experience', -1)}
            disabled={counters.experience <= 0}
            className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm disabled:opacity-30"
          >
            <Minus size={12} />
          </button>
          <span className="text-purple-400 font-bold w-6 text-center">{counters.experience}</span>
          <button
            onClick={() => onCounterChange(playerId, 'experience', 1)}
            className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Custom Counters */}
      {Object.entries(counters.custom || {}).map(([name, value]) => (
        <div key={name} className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-blue-400" />
            <span className="text-white/80 text-sm capitalize">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => removeCustomCounter(name)}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-600/50 rounded text-red-400 text-xs"
              title="Remove counter"
            >
              <X size={10} />
            </button>
            <button
              onClick={() => onCounterChange(playerId, name, -1)}
              disabled={value <= 0}
              className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm disabled:opacity-30"
            >
              <Minus size={12} />
            </button>
            <span className="text-blue-400 font-bold w-6 text-center">{value}</span>
            <button
              onClick={() => onCounterChange(playerId, name, 1)}
              className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      ))}

      {/* Add Custom Counter */}
      {showAddCustom ? (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newCounterName}
            onChange={(e) => setNewCounterName(e.target.value)}
            placeholder="Counter name..."
            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCounter()}
            autoFocus
          />
          <button
            onClick={handleAddCustomCounter}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddCustom(false)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddCustom(true)}
          className="w-full mt-1 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-xs transition flex items-center justify-center gap-1"
        >
          <Plus size={12} /> Add Custom Counter
        </button>
      )}
    </div>
  );
}

export default CountersPanel;

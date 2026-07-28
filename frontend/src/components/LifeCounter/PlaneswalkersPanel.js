import React, { useState } from 'react';
import { Plus, Minus, Shield, X } from 'lucide-react';

let nextPwId = 1;

function PlaneswalkersPanel({
  playerId,
  planeswalkers = [],
  onAdd,
  onLoyaltyChange,
  onRemove,
  compact = false
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLoyalty, setNewLoyalty] = useState(4);

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(playerId, { id: `pw-${nextPwId++}`, name: newName.trim(), loyalty: Math.max(1, newLoyalty) });
      setNewName('');
      setNewLoyalty(4);
      setShowAddForm(false);
    }
  };

  if (planeswalkers.length === 0 && !showAddForm) {
    return (
      <button
        onClick={() => setShowAddForm(true)}
        className="w-full mt-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-xs transition flex items-center justify-center gap-1"
      >
        <Shield size={12} /> Add Planeswalker
      </button>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {planeswalkers.map(pw => (
          <div key={pw.id} className="flex items-center gap-1 px-2 py-1 bg-indigo-600/30 rounded-lg">
            <Shield size={12} className="text-indigo-300" />
            <span className="text-indigo-200 text-xs font-bold">{pw.name}: {pw.loyalty}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl p-3 mt-3">
      <div className="text-white/60 text-xs font-semibold mb-2">Planeswalkers</div>

      {planeswalkers.map(pw => (
        <div key={pw.id} className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-300" />
            <span className="text-white/80 text-sm">{pw.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRemove(playerId, pw.id)}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-600/50 rounded text-red-400 text-xs"
              title="Remove planeswalker"
            >
              <X size={10} />
            </button>
            <button
              onClick={() => onLoyaltyChange(playerId, pw.id, -1)}
              className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm"
            >
              <Minus size={12} />
            </button>
            <span className="text-indigo-300 font-bold w-6 text-center">{pw.loyalty}</span>
            <button
              onClick={() => onLoyaltyChange(playerId, pw.id, 1)}
              className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      ))}

      {showAddForm ? (
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Planeswalker name..."
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <input
              type="number"
              min="1"
              value={newLoyalty}
              onChange={(e) => setNewLoyalty(parseInt(e.target.value) || 1)}
              className="w-16 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
              title="Starting loyalty"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full mt-1 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-xs transition flex items-center justify-center gap-1"
        >
          <Plus size={12} /> Add Planeswalker
        </button>
      )}
    </div>
  );
}

export default PlaneswalkersPanel;

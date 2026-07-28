import React, { useState } from 'react';
import { Save, RotateCcw, Trash2, Camera } from 'lucide-react';

const MAX_SNAPSHOTS = 10;

function GameSnapshotsPanel({ snapshots = [], onSave, onRestore, onDelete, compact = false }) {
  const [label, setLabel] = useState('');

  const handleSave = () => {
    onSave(label.trim());
    setLabel('');
  };

  const formatTime = (savedAt) => new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
        <Camera size={16} className="text-teal-400" />
        Game Snapshots
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Checkpoint label (optional)"
          className="flex-1 px-2 py-1 bg-black/20 border border-white/10 rounded text-white text-sm placeholder-white/40"
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={snapshots.length >= MAX_SNAPSHOTS}
          className="px-3 py-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-sm font-medium flex items-center gap-1"
        >
          <Save size={14} /> Save
        </button>
      </div>

      {snapshots.length >= MAX_SNAPSHOTS && (
        <p className="text-white/40 text-xs">Max {MAX_SNAPSHOTS} snapshots — delete one to save another.</p>
      )}

      {snapshots.length === 0 ? (
        <p className="text-white/40 text-xs text-center py-2">No checkpoints saved yet.</p>
      ) : (
        <div className="space-y-1.5">
          {[...snapshots].reverse().map((snap) => (
            <div key={snap.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-white text-sm truncate">{snap.label || `Turn ${snap.turnNumber}`}</div>
                <div className="text-white/40 text-xs">Turn {snap.turnNumber} · {formatTime(snap.savedAt)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onRestore(snap)}
                  title="Restore this checkpoint"
                  className="p-1.5 bg-teal-600/80 hover:bg-teal-600 text-white rounded transition"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => onDelete(snap.id)}
                  title="Delete checkpoint"
                  className="p-1.5 hover:bg-red-600/50 text-red-400 rounded transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GameSnapshotsPanel;

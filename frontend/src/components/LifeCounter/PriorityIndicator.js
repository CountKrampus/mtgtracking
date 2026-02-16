import React from 'react';
import { Zap, User } from 'lucide-react';

function PriorityIndicator({ 
  hasPriority, 
  onTogglePriority, 
  playerName, 
  compact = false 
}) {
  if (!hasPriority) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 rounded-full text-xs text-blue-300">
        <Zap size={10} />
        <span>Pri</span>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3 mt-3">
      <div className="flex items-center justify-between">
        <div className="text-blue-400 text-xs font-semibold flex items-center gap-1">
          <Zap size={12} />
          Priority: {playerName}
        </div>
        <button
          onClick={onTogglePriority}
          className="text-blue-400/70 hover:text-blue-400 text-xs flex items-center gap-1"
        >
          Pass
        </button>
      </div>
    </div>
  );
}

export default PriorityIndicator;
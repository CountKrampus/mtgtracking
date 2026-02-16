import React from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

function QuickLifeControls({ 
  currentLife, 
  onLifeChange, 
  onStartValue = 20,
  gameFormat = 'commander',
  compact = false 
}) {
  const startingLife = gameFormat === 'commander' ? 40 : onStartValue;
  
  const quickChanges = [
    { label: '-1', value: -1, color: 'bg-red-600/80 hover:bg-red-600' },
    { label: '-5', value: -5, color: 'bg-red-500/80 hover:bg-red-500' },
    { label: '+1', value: 1, color: 'bg-green-600/80 hover:bg-green-600' },
    { label: '+5', value: 5, color: 'bg-green-500/80 hover:bg-green-500' },
  ];

  const specialActions = [
    { label: 'Half', action: () => Math.floor(currentLife / 2), color: 'bg-yellow-600/80 hover:bg-yellow-600' },
    { label: 'Reset', action: () => startingLife, color: 'bg-blue-600/80 hover:bg-blue-600' },
    { label: 'Set...', action: null, color: 'bg-purple-600/80 hover:bg-purple-600' },
  ];

  if (compact) {
    return (
      <div className="flex gap-1 mt-2">
        {quickChanges.map((change, index) => (
          <button
            key={index}
            onClick={() => onLifeChange(change.value)}
            className={`px-2 py-1 rounded text-xs font-bold transition ${change.color} text-white`}
          >
            {change.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl p-3 mt-3">
      <div className="text-white/60 text-xs font-semibold mb-2">Quick Life</div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        {quickChanges.map((change, index) => (
          <button
            key={index}
            onClick={() => onLifeChange(change.value)}
            className={`py-2 rounded-lg font-bold transition ${change.color} text-white`}
          >
            {change.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {specialActions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              if (action.action) {
                onLifeChange(action.action() - currentLife);
              } else {
                // For 'Set...' action, we might want to open a modal or input
                const newValue = prompt('Set life to:', currentLife);
                if (newValue !== null) {
                  const numValue = parseInt(newValue);
                  if (!isNaN(numValue)) {
                    onLifeChange(numValue - currentLife);
                  }
                }
              }
            }}
            className={`py-2 rounded-lg font-medium transition ${action.color} text-white`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickLifeControls;
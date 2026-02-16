import React, { useState, useRef, useEffect } from 'react';
import { ScrollText, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';

function GameLog({ logs = [], onClear, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, expanded]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'life_gain':
        return 'text-green-400';
      case 'life_loss':
        return 'text-red-400';
      case 'poison':
        return 'text-purple-400';
      case 'commander_damage':
        return 'text-orange-400';
      case 'elimination':
        return 'text-gray-400';
      case 'turn':
        return 'text-blue-400';
      case 'mechanic':
        return 'text-yellow-400';
      case 'dice':
        return 'text-pink-400';
      default:
        return 'text-white/70';
    }
  };

  const exportLog = () => {
    const logText = logs.map(log =>
      `[${formatTimestamp(log.timestamp)}] ${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-game-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (compact) {
    if (logs.length === 0) return null;

    const recentLogs = logs.slice(-3);
    return (
      <div className="bg-white/5 rounded-lg p-2">
        <div className="text-white/40 text-xs mb-1">Recent Activity</div>
        <div className="space-y-0.5">
          {recentLogs.map((log, index) => (
            <div key={log.id || index} className={`text-xs truncate ${getLogColor(log.type)}`}>
              {log.message}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-amber-400" />
          <h3 className="text-white font-semibold">Game Log</h3>
          <span className="text-white/40 text-sm">({logs.length} events)</span>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-white/60" />
        ) : (
          <ChevronDown size={18} className="text-white/60" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-white/10">
          {/* Controls */}
          <div className="flex justify-end gap-2 p-2 bg-black/20">
            <button
              onClick={exportLog}
              disabled={logs.length === 0}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded text-xs transition flex items-center gap-1 disabled:opacity-50"
            >
              <Download size={12} /> Export
            </button>
            <button
              onClick={onClear}
              disabled={logs.length === 0}
              className="px-2 py-1 bg-red-600/50 hover:bg-red-600 text-white/70 rounded text-xs transition flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>

          {/* Log List */}
          <div
            ref={scrollRef}
            className="max-h-60 overflow-y-auto p-3 space-y-1"
          >
            {logs.length === 0 ? (
              <div className="text-center text-white/40 py-4">
                No events recorded yet
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="flex gap-2 text-sm"
                >
                  <span className="text-white/40 text-xs font-mono shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className={getLogColor(log.type)}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to create log entries
export const createLogEntry = (type, message) => ({
  id: Date.now() + Math.random(),
  type,
  message,
  timestamp: Date.now()
});

// Pre-defined log creators
export const LogCreators = {
  lifeChange: (playerName, oldLife, newLife) => {
    const diff = newLife - oldLife;
    const type = diff > 0 ? 'life_gain' : 'life_loss';
    const message = diff > 0
      ? `${playerName} gained ${diff} life (${oldLife} → ${newLife})`
      : `${playerName} lost ${Math.abs(diff)} life (${oldLife} → ${newLife})`;
    return createLogEntry(type, message);
  },

  poisonChange: (playerName, oldPoison, newPoison) => {
    const diff = newPoison - oldPoison;
    const message = diff > 0
      ? `${playerName} received ${diff} poison counter${diff > 1 ? 's' : ''} (${newPoison}/10)`
      : `${playerName} removed ${Math.abs(diff)} poison counter${Math.abs(diff) > 1 ? 's' : ''} (${newPoison}/10)`;
    return createLogEntry('poison', message);
  },

  commanderDamage: (targetName, sourceName, damage, total) => {
    const message = `${targetName} took ${damage} commander damage from ${sourceName} (${total}/21)`;
    return createLogEntry('commander_damage', message);
  },

  elimination: (playerName, reason) => {
    const reasons = {
      life: 'life reached 0',
      poison: '10 poison counters',
      commander: '21 commander damage'
    };
    const message = `${playerName} was eliminated (${reasons[reason] || reason})`;
    return createLogEntry('elimination', message);
  },

  turnChange: (playerName, turnNumber) => {
    const message = `Turn ${turnNumber}: ${playerName}'s turn`;
    return createLogEntry('turn', message);
  },

  monarch: (playerName) => {
    const message = `${playerName} became the Monarch`;
    return createLogEntry('mechanic', message);
  },

  initiative: (playerName) => {
    const message = `${playerName} took the Initiative`;
    return createLogEntry('mechanic', message);
  },

  diceRoll: (diceType, result) => {
    const message = `Rolled ${diceType}: ${result}`;
    return createLogEntry('dice', message);
  },

  gameStart: (format, playerCount) => {
    const message = `Game started: ${format} with ${playerCount} players`;
    return createLogEntry('turn', message);
  },

  gameReset: () => {
    const message = 'Game was reset';
    return createLogEntry('turn', message);
  },

  gameEnd: (winnerName) => {
    const message = winnerName
      ? `Game ended - ${winnerName} wins!`
      : 'Game ended - No winner';
    return createLogEntry('turn', message);
  },

  // Shorthand aliases
  poison: (playerName, newPoison) => {
    const message = `${playerName} now has ${newPoison} poison counter${newPoison !== 1 ? 's' : ''} (${newPoison}/10)`;
    return createLogEntry('poison', message);
  },

  // New log creators for counters and mana
  counterChange: (playerName, counterType, newCount, change) => {
    const message = `${playerName} ${change} ${counterType} counter${newCount !== 1 ? 's' : ''} (${newCount} total)`;
    return createLogEntry('mechanic', message);
  },

  manaChange: (playerName, color, newMana, change) => {
    const colorName = color === 'W' ? 'white' : 
                     color === 'U' ? 'blue' : 
                     color === 'B' ? 'black' : 
                     color === 'R' ? 'red' : 
                     color === 'G' ? 'green' : 'colorless';
    const message = `${playerName} ${change} ${colorName} mana (${newMana} total)`;
    return createLogEntry('mechanic', message);
  }
};

export default GameLog;

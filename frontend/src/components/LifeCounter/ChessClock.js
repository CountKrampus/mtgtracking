import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Play, Pause, RotateCcw, Settings } from 'lucide-react';

function ChessClock({
  players,
  currentPlayerIndex,
  onTimeUp,
  onSwitchPlayer,
  compact = false
}) {
  const [timers, setTimers] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [timePerPlayer, setTimePerPlayer] = useState(600); // 10 minutes default
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef(null);

  // Initialize timers when players change
  useEffect(() => {
    const initialTimers = {};
    players.forEach(player => {
      if (!timers[player.id]) {
        initialTimers[player.id] = timePerPlayer;
      } else {
        initialTimers[player.id] = timers[player.id];
      }
    });
    setTimers(initialTimers);
  }, [players.length]);

  // Timer countdown logic
  useEffect(() => {
    if (isRunning && players.length > 0) {
      const currentPlayer = players[currentPlayerIndex];
      if (!currentPlayer || currentPlayer.isEliminated) return;

      intervalRef.current = setInterval(() => {
        setTimers(prev => {
          const newTimers = { ...prev };
          const currentTime = newTimers[currentPlayer.id] || 0;

          if (currentTime <= 0) {
            // Time's up!
            if (onTimeUp) {
              onTimeUp(currentPlayer);
            }
            return prev;
          }

          newTimers[currentPlayer.id] = currentTime - 1;
          return newTimers;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, currentPlayerIndex, players, onTimeUp]);

  const toggleTimer = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const resetTimers = useCallback(() => {
    const resetTimers = {};
    players.forEach(player => {
      resetTimers[player.id] = timePerPlayer;
    });
    setTimers(resetTimers);
    setIsRunning(false);
  }, [players, timePerPlayer]);

  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (playerId) => {
    const time = timers[playerId] || 0;
    if (time <= 30) return 'text-red-400';
    if (time <= 60) return 'text-yellow-400';
    return 'text-white';
  };

  const handleTimeChange = (minutes) => {
    const newTime = minutes * 60;
    setTimePerPlayer(newTime);
    // Reset all timers to new time
    const newTimers = {};
    players.forEach(player => {
      newTimers[player.id] = newTime;
    });
    setTimers(newTimers);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTimer}
          className={`p-2 rounded-lg transition ${
            isRunning ? 'bg-red-600/80 hover:bg-red-600' : 'bg-green-600/80 hover:bg-green-600'
          } text-white`}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex gap-1">
          {players.filter(p => !p.isEliminated).map((player, index) => (
            <div
              key={player.id}
              className={`px-2 py-1 rounded text-xs font-mono ${
                index === currentPlayerIndex && isRunning ? 'bg-white/20 ring-1 ring-white' : 'bg-white/10'
              } ${getTimerColor(player.id)}`}
            >
              {formatTime(timers[player.id])}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-blue-400" />
          <h3 className="text-white font-semibold">Chess Clock</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 hover:bg-white/10 rounded transition"
        >
          <Settings size={16} className="text-white/60" />
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="bg-black/20 rounded-lg p-3 mb-4">
          <div className="text-white/60 text-sm mb-2">Time per player</div>
          <div className="flex gap-2">
            {[5, 10, 15, 20, 30].map(mins => (
              <button
                key={mins}
                onClick={() => handleTimeChange(mins)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  timePerPlayer === mins * 60
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Player Timers */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {players.filter(p => !p.isEliminated).map((player, index) => {
          const isActive = index === currentPlayerIndex;
          const time = timers[player.id] || 0;

          return (
            <div
              key={player.id}
              className={`p-3 rounded-xl transition-all ${
                isActive && isRunning
                  ? 'bg-blue-600/30 ring-2 ring-blue-400'
                  : 'bg-white/5'
              }`}
              style={{
                borderLeft: `4px solid ${player.color || '#6366f1'}`
              }}
            >
              <div className="text-white/70 text-sm truncate mb-1">{player.name}</div>
              <div className={`text-2xl font-mono font-bold ${getTimerColor(player.id)}`}>
                {formatTime(time)}
              </div>
              {time <= 30 && time > 0 && (
                <div className="text-red-400 text-xs animate-pulse">Low time!</div>
              )}
              {time === 0 && (
                <div className="text-red-400 text-xs font-bold">TIME UP!</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={toggleTimer}
          className={`flex-1 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
            isRunning
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {isRunning ? (
            <>
              <Pause size={18} /> Pause
            </>
          ) : (
            <>
              <Play size={18} /> Start
            </>
          )}
        </button>
        <button
          onClick={resetTimers}
          className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
          title="Reset all timers"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Auto-switch reminder */}
      {isRunning && (
        <div className="text-center text-white/40 text-xs mt-2">
          Use turn tracker to switch active player
        </div>
      )}
    </div>
  );
}

export default ChessClock;

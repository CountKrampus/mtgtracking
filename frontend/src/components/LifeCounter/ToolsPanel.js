import React, { useState } from 'react';
import { Wrench, X, Dices, Shuffle, Clock, ScrollText } from 'lucide-react';
import DiceRoller from './DiceRoller';
import RandomPicker from './RandomPicker';
import ChessClock from './ChessClock';
import GameLog from './GameLog';

const TOOLS = [
  { id: 'dice', name: 'Dice Roller', icon: Dices, color: '#9333ea' },
  { id: 'random', name: 'Random Player', icon: Shuffle, color: '#16a34a' },
  { id: 'clock', name: 'Chess Clock', icon: Clock, color: '#2563eb' },
  { id: 'log', name: 'Game Log', icon: ScrollText, color: '#f59e0b' }
];

function ToolsPanel({
  isOpen: externalIsOpen,
  onClose,
  players,
  currentPlayerIndex,
  gameLog = [],
  onAddLog,
  onClearLogs,
  onDiceRoll,
  onRandomPick,
  onTimeUp,
  soundEnabled,
  playSound,
  compact = false
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState('dice');

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onClose ? () => onClose() : setInternalIsOpen;

  const handleToolSelect = (toolId) => {
    if (activeTool === toolId) {
      setActiveTool(null);
    } else {
      setActiveTool(toolId);
    }
  };

  const handleDiceRoll = (diceType, result) => {
    if (onDiceRoll) onDiceRoll(diceType, result);
    if (onAddLog) {
      onAddLog({
        type: 'dice',
        message: `Rolled ${diceType}: ${result}`,
        timestamp: Date.now()
      });
    }
    if (playSound) playSound('diceRoll');
  };

  const handleRandomPick = (player) => {
    if (onRandomPick) onRandomPick(player);
    if (onAddLog) {
      onAddLog({
        type: 'system',
        message: `Random player selected: ${player.name}`,
        timestamp: Date.now()
      });
    }
    if (playSound) playSound('success');
  };

  const handleClearLogs = () => {
    if (onClearLogs) onClearLogs();
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'dice':
        return <DiceRoller onRoll={handleDiceRoll} compact={compact} />;
      case 'random':
        return <RandomPicker players={players} onPick={handleRandomPick} compact={compact} />;
      case 'clock':
        return (
          <ChessClock
            players={players}
            currentPlayerIndex={currentPlayerIndex}
            onTimeUp={onTimeUp}
            compact={compact}
          />
        );
      case 'log':
        return <GameLog logs={gameLog} onClear={handleClearLogs} compact={compact} />;
      default:
        return null;
    }
  };

  // Modal mode (when externalIsOpen is provided)
  if (externalIsOpen !== undefined) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Wrench size={24} className="text-purple-400" />
              Game Tools
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>

          {/* Tool Tabs */}
          <div className="flex border-b border-white/10 mb-4">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition ${
                  activeTool === tool.id
                    ? 'bg-white/10 border-b-2'
                    : 'text-white/50 hover:bg-white/5'
                }`}
                style={{
                  borderBottomColor: activeTool === tool.id ? tool.color : 'transparent',
                  color: activeTool === tool.id ? tool.color : undefined
                }}
              >
                <tool.icon size={20} />
                <span className="text-xs">{tool.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tool Content */}
          <div className="flex-1 overflow-y-auto">
            {renderActiveTool()}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        {/* Floating Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg transition-all flex items-center justify-center ${
            isOpen ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'
          }`}
        >
          {isOpen ? (
            <X size={24} className="text-white" />
          ) : (
            <Wrench size={24} className="text-white" />
          )}
        </button>

        {/* Compact Menu */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 bg-gray-900 rounded-xl shadow-2xl border border-white/20 overflow-hidden w-64">
            <div className="p-2 space-y-1">
              {TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                    activeTool === tool.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  <tool.icon size={18} style={{ color: tool.color }} />
                  <span className="text-sm font-medium">{tool.name}</span>
                </button>
              ))}
            </div>

            {/* Active Tool Content */}
            {activeTool && (
              <div className="border-t border-white/10 p-3">
                {renderActiveTool()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-purple-400" />
          <h3 className="text-white font-semibold">Tools</h3>
        </div>
      </div>

      {/* Tool Tabs */}
      <div className="flex border-b border-white/10">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => handleToolSelect(tool.id)}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition ${
              activeTool === tool.id
                ? 'bg-white/10 border-b-2'
                : 'text-white/50 hover:bg-white/5'
            }`}
            style={{
              borderBottomColor: activeTool === tool.id ? tool.color : 'transparent',
              color: activeTool === tool.id ? tool.color : undefined
            }}
          >
            <tool.icon size={20} />
            <span className="text-xs">{tool.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <div className="p-4">
        {activeTool ? (
          renderActiveTool()
        ) : (
          <div className="text-center text-white/40 py-8">
            Select a tool above to get started
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolsPanel;

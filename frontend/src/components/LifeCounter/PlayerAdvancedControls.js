import React, { useState } from 'react';
import { Settings, X, Plus, Minus, Zap, Star, Tag, RotateCcw, Heart, Activity, Shield, Sword, Droplets } from 'lucide-react';

function PlayerAdvancedControls({
  player,
  gameFormat,
  players = [],
  onLifeChange,
  onPoisonChange,
  onCountersChange,
  onManaChange,
  onCommanderDamageClick,
  onCommanderDamageChange,
  position,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('quick');

  const quickChanges = [
    { label: '-1', value: -1, color: 'bg-red-600/80 hover:bg-red-600' },
    { label: '-5', value: -5, color: 'bg-red-500/80 hover:bg-red-500' },
    { label: '+1', value: 1, color: 'bg-green-600/80 hover:bg-green-600' },
    { label: '+5', value: 5, color: 'bg-green-500/80 hover:bg-green-500' },
  ];

  const specialActions = [
    { label: 'Half', action: () => Math.floor(player.life / 2), color: 'bg-yellow-600/80 hover:bg-yellow-600' },
    { label: 'Reset', action: () => (gameFormat === 'commander' ? 40 : 20), color: 'bg-blue-600/80 hover:bg-blue-600' },
  ];

  const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
  const COLOR_NAMES = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
    'C': 'Colorless'
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] p-4">
      <div
        className="bg-gray-900 rounded-2xl p-4 shadow-2xl border border-white/20 w-72 h-96 overflow-hidden absolute"
        style={{
          left: position ? `${position.x}px` : '50%',
          top: position ? `${position.y}px` : '50%',
          transform: position ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white truncate flex-1 mr-2">
            {player.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-2">
          {[
            { id: 'quick', label: 'Quick', icon: Zap },
            { id: 'counters', label: 'Counters', icon: Tag },
            { id: 'mana', label: 'Mana', icon: Heart },
            { id: 'commander', label: 'Damage', icon: Zap },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-1 flex flex-col items-center gap-0.5 transition ${
                  activeTab === tab.id
                    ? 'bg-white/10 border-b-2 border-purple-400 text-purple-400'
                    : 'text-white/50 hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span className="text-[12px]">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="overflow-hidden max-h-[calc(100%-100px)]">
          {/* Tab Content */}
          <div className="overflow-y-auto max-h-full">
            {activeTab === 'quick' && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-white/60 text-sm font-semibold mb-2">Life Changes</h4>
                  <div className="grid grid-cols-4 gap-2">
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
                </div>

                <div>
                  <h4 className="text-white/60 text-sm font-semibold mb-2">Life Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {specialActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          onLifeChange(action.action() - player.life);
                        }}
                        className={`py-2 rounded-lg font-medium transition ${action.color} text-white`}
                      >
                        {action.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const newValue = prompt('Set life to:', player.life);
                        if (newValue !== null) {
                          const numValue = parseInt(newValue);
                          if (!isNaN(numValue)) {
                            onLifeChange(numValue - player.life);
                          }
                        }
                      }}
                      className="py-2 rounded-lg font-medium transition bg-purple-600/80 hover:bg-purple-600 text-white"
                    >
                      Set...
                    </button>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'counters' && (
              <div className="space-y-4">
                {/* Standard Counters Row */}
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Energy Counter */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Zap size={14} className="text-yellow-400" />
                        <span className="text-white/80 text-xs">Energy</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onCountersChange(player.id, 'energy', -1)}
                          disabled={player.counters?.energy <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-xs disabled:opacity-30"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-yellow-400 font-bold w-5 text-center">{player.counters?.energy || 0}</span>
                        <button
                          onClick={() => onCountersChange(player.id, 'energy', 1)}
                          className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-xs"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Experience Counter */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Star size={14} className="text-purple-400" />
                        <span className="text-white/80 text-xs">Exp</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onCountersChange(player.id, 'experience', -1)}
                          disabled={player.counters?.experience <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-xs disabled:opacity-30"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-purple-400 font-bold w-5 text-center">{player.counters?.experience || 0}</span>
                        <button
                          onClick={() => onCountersChange(player.id, 'experience', 1)}
                          className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-xs"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Radiation Counter */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Zap size={14} className="text-green-400" />
                        <span className="text-white/80 text-xs">Rad</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onCountersChange(player.id, 'radiation', -1)}
                          disabled={player.counters?.radiation <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-xs disabled:opacity-30"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-green-400 font-bold w-5 text-center">{player.counters?.radiation || 0}</span>
                        <button
                          onClick={() => onCountersChange(player.id, 'radiation', 1)}
                          className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-xs"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Counters */}
                {Object.entries(player.counters?.custom || {}).map(([name, value]) => (
                  <div key={name} className="bg-black/20 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-blue-400" />
                        <span className="text-white/80 text-sm capitalize">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onCountersChange(player.id, name, -1)}
                          disabled={value <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-xs disabled:opacity-30"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-blue-400 font-bold w-6 text-center">{value}</span>
                        <button
                          onClick={() => onCountersChange(player.id, name, 1)}
                          className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-xs"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'mana' && (
              <div className="space-y-4">
                <div className="bg-black/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white/60 text-sm font-semibold">Mana Pool</div>
                    <div className="text-white/60 text-sm">Total: {Object.values(player.manaPool || {}).reduce((sum, count) => sum + count, 0)}</div>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-3">
                    {COLORS.map(color => (
                      <div key={color} className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            color === 'W' ? 'bg-white text-black' :
                            color === 'U' ? 'bg-blue-500 text-white' :
                            color === 'B' ? 'bg-gray-800 text-white' :
                            color === 'R' ? 'bg-red-500 text-white' :
                            color === 'G' ? 'bg-green-500 text-white' :
                            'bg-gray-600 text-white'
                          }`}
                        >
                          {color}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onManaChange(player.id, color, -1)}
                            disabled={(player.manaPool?.[color] || 0) <= 0}
                            className="w-6 h-6 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-sm disabled:opacity-30"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-white font-bold w-6 text-center">{player.manaPool?.[color] || 0}</span>
                          <button
                            onClick={() => onManaChange(player.id, color, 1)}
                            className="w-6 h-6 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-sm"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        COLORS.forEach(color => onManaChange(player.id, color, -(player.manaPool?.[color] || 0)));
                      }}
                      className="py-1.5 px-3 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-1"
                    >
                      <RotateCcw size={14} /> Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'commander' && (
              <div className="space-y-2">
                <div className="max-h-32 overflow-y-auto">
                  <div className="mb-2">
                    <h4 className="text-white/60 text-xs font-semibold mb-1">Total Commander Damage</h4>
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-center mb-1">
                        <div className="text-lg font-bold text-orange-400">
                          {Object.values(player.commanderDamage || {}).reduce((sum, dmg) => sum + dmg, 0)}
                        </div>
                        <div className="text-white/60 text-[10px]">Damage Taken</div>
                      </div>

                      {/* Commander Damage by Source */}
                      <div className="space-y-1">
                        {Object.entries(player.commanderDamage || {}).map(([sourceId, damage]) => {
                          // Find the source player name
                          const sourcePlayer = players.find(p => p.id === sourceId);
                          const sourceName = sourcePlayer ? sourcePlayer.name : `Player ${sourceId}`;

                          return (
                            <div key={sourceId} className="flex items-center justify-between bg-white/5 rounded p-1">
                              <span className="text-white/80 text-[10px]">{sourceName.substring(0, 8)}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => onCommanderDamageChange(player.id, sourceId, -1)}
                                  disabled={damage <= 0}
                                  className="w-4 h-4 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-[10px] disabled:opacity-30"
                                >
                                  <Minus size={8} />
                                </button>
                                <span className="text-orange-400 font-bold w-4 text-center text-[10px]">{damage}</span>
                                <button
                                  onClick={() => onCommanderDamageChange(player.id, sourceId, 1)}
                                  className="w-4 h-4 flex items-center justify-center bg-green-600/80 hover:bg-green-600 rounded text-white text-[10px]"
                                >
                                  <Plus size={8} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {Object.keys(player.commanderDamage || {}).length === 0 && (
                        <div className="text-center text-white/40 py-1 text-[10px]">
                          None
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <h4 className="text-white/60 text-xs font-semibold mb-1">Add Commander Damage</h4>
                    <div className="space-y-1">
                      {players.filter(p => p.id !== player.id).map((sourcePlayer) => (
                        <div key={sourcePlayer.id} className="flex items-center justify-between bg-white/5 rounded p-1">
                          <span className="text-white/80 text-[10px]">{sourcePlayer.name.substring(0, 8)}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onCommanderDamageChange(player.id, sourcePlayer.id, -1)}
                              disabled={(player.commanderDamage?.[sourcePlayer.id] || 0) <= 0}
                              className="w-4 h-4 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-[10px] disabled:opacity-30"
                            >
                              <Minus size={8} />
                            </button>
                            <button
                              onClick={() => onCommanderDamageChange(player.id, sourcePlayer.id, 1)}
                              className="w-4 h-4 flex items-center justify-center bg-orange-600/80 hover:bg-orange-600 rounded text-white text-[10px]"
                            >
                              <Zap size={8} />
                            </button>
                            <button
                              onClick={() => onCommanderDamageChange(player.id, sourcePlayer.id, 5)}
                              className="w-4 h-4 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded text-white text-[8px]"
                              title="+5 Commander Damage"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-white/60 text-xs font-semibold mb-1">Poison Counter</h4>
                  <div className="bg-black/20 rounded-lg p-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onPoisonChange(-1)}
                        disabled={player.poison <= 0}
                        className="p-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus size={12} />
                      </button>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                        player.poison >= 9 ? 'bg-red-600/50' :
                        player.poison >= 7 ? 'bg-yellow-600/50' :
                        'bg-purple-900/50'
                      }`}>
                        <Droplets size={14} className="text-purple-300" />
                        <span className={`font-bold text-sm ${
                          player.poison >= 9 ? 'text-red-300' :
                          player.poison >= 7 ? 'text-yellow-300' :
                          'text-purple-300'
                        }`}>
                          {player.poison}
                        </span>
                      </div>
                      <button
                        onClick={() => onPoisonChange(1)}
                        className="p-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded transition"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerAdvancedControls;
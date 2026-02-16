import React, { useState, useEffect } from 'react';
import { Users, Star, Target, Shield, RotateCcw, Play, Pause, MapPin, Zap, Heart, Crown, ShieldOff } from 'lucide-react';

const StarVariant = () => {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', position: 'North', health: 20, enemies: [2, 3, 4], allies: [], isStar: false },
    { id: 2, name: 'Player 2', position: 'East', health: 20, enemies: [1, 3, 4], allies: [], isStar: false },
    { id: 3, name: 'Player 3', position: 'South', health: 20, enemies: [1, 2, 4], allies: [], isStar: false },
    { id: 4, name: 'Player 4', position: 'West', health: 20, enemies: [1, 2, 3], allies: [], isStar: true } // Star player
  ]);

  const [gameStarted, setGameStarted] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [gameLog, setGameLog] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showPositionDiagram, setShowPositionDiagram] = useState(true);

  const positions = [
    { name: 'North', direction: 'top', color: '#3B82F6' },
    { name: 'East', direction: 'right', color: '#EF4444' },
    { name: 'South', direction: 'bottom', color: '#10B981' },
    { name: 'West', direction: 'left', color: '#F59E0B' }
  ];

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const startGame = () => {
    if (players.filter(p => p.isStar).length !== 1) {
      alert('Please assign exactly one Star player before starting the game.');
      return;
    }
    setGameStarted(true);
    addToGameLog('Star variant game started!');
  };

  const endTurn = () => {
    const currentPlayer = players.find(p => p.id === currentTurn);
    const nextPlayerIdx = (players.findIndex(p => p.id === currentTurn) + 1) % players.length;
    const nextPlayer = players[nextPlayerIdx];
    setCurrentTurn(nextPlayer.id);
    addToGameLog(`${currentPlayer?.name} ended turn. ${nextPlayer.name}'s turn.`);
  };

  const setStarPlayer = (playerId) => {
    setPlayers(players.map(player => ({
      ...player,
      isStar: player.id === playerId,
      enemies: player.id === playerId 
        ? players.filter(p => p.id !== playerId).map(p => p.id)  // Star fights everyone else
        : [players.find(p => p.isStar)?.id].filter(Boolean), // Others fight the star
      allies: player.id === playerId 
        ? [] // Star has no allies
        : [] // In Star variant, other players don't necessarily ally with each other
    })));
    addToGameLog(`${players.find(p => p.id === playerId)?.name} is now the Star!`);
  };

  const updatePlayerHealth = (playerId, newHealth) => {
    setPlayers(players.map(player => 
      player.id === playerId ? { ...player, health: Math.max(0, newHealth) } : player
    ));
  };

  const resetGame = () => {
    setGameStarted(false);
    setCurrentTurn(1);
    setGameLog([]);
    setPlayers([
      { id: 1, name: 'Player 1', position: 'North', health: 20, enemies: [2, 3, 4], allies: [], isStar: false },
      { id: 2, name: 'Player 2', position: 'East', health: 20, enemies: [1, 3, 4], allies: [], isStar: false },
      { id: 3, name: 'Player 3', position: 'South', health: 20, enemies: [1, 2, 4], allies: [], isStar: false },
      { id: 4, name: 'Player 4', position: 'West', health: 20, enemies: [1, 2, 3], allies: [], isStar: true }
    ]);
    addToGameLog('Star variant game reset.');
  };

  const getEnemyPlayers = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? players.filter(p => player.enemies.includes(p.id)) : [];
  };

  const getAllyPlayers = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? players.filter(p => player.allies.includes(p.id)) : [];
  };

  const changePlayerName = (playerId, newName) => {
    if (newName.trim()) {
      setPlayers(players.map(player => 
        player.id === playerId ? { ...player, name: newName.trim() } : player
      ));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Star Variant</h1>
        <p className="text-gray-400">
          Seating and enemy/ally tracking for Star format with central Star player
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Game Controls</h2>
            
            <div className="space-y-4">
              {!gameStarted ? (
                <button
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  <Play size={20} />
                  Start Star Game
                </button>
              ) : (
                <button
                  onClick={endTurn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  <RotateCcw size={20} />
                  End Turn (Current: {players.find(p => p.id === currentTurn)?.name})
                </button>
              )}
              
              <button
                onClick={resetGame}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
              >
                <RotateCcw size={20} />
                Reset Game
              </button>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Show Position Diagram</label>
                <button
                  onClick={() => setShowPositionDiagram(!showPositionDiagram)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showPositionDiagram ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showPositionDiagram ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-3">Star Player</h3>
              <div className="space-y-3">
                {players.map(player => (
                  <div 
                    key={player.id} 
                    className={`p-3 rounded-lg border transition ${
                      player.isStar 
                        ? 'border-yellow-500 bg-yellow-500/20' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: positions.find(pos => pos.name === player.position)?.color }}
                        >
                          {player.position.charAt(0)}
                        </div>
                        <span className="text-white">{player.name}</span>
                      </div>
                      
                      <button
                        onClick={() => setStarPlayer(player.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          player.isStar 
                            ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' 
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {player.isStar ? 'Star ✓' : 'Make Star'}
                      </button>
                    </div>
                    
                    {player.isStar && (
                      <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                        Fights all other players
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Player Positions & Relationships</h2>
            
            {showPositionDiagram && (
              <div className="mb-6 flex justify-center">
                <div className="relative w-64 h-64">
                  {/* Central Star Player */}
                  <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: '#FBBF24' }}
                    onClick={() => setStarPlayer(players.find(p => p.position === 'West')?.id)}
                  >
                    <div className="text-center">
                      <Star size={16} className="mx-auto text-yellow-300" />
                      <div className="text-xs mt-1">
                        {players.find(p => p.position === 'West')?.name || 'Star'}
                      </div>
                    </div>
                  </div>
                  
                  {/* North Player */}
                  <div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: '#3B82F6' }}
                    onClick={() => setStarPlayer(players.find(p => p.position === 'North')?.id)}
                  >
                    {players.find(p => p.position === 'North')?.name || 'N'}
                  </div>
                  
                  {/* East Player */}
                  <div 
                    className="absolute top-1/2 right-0 transform translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: '#EF4444' }}
                    onClick={() => setStarPlayer(players.find(p => p.position === 'East')?.id)}
                  >
                    {players.find(p => p.position === 'East')?.name || 'E'}
                  </div>
                  
                  {/* South Player */}
                  <div 
                    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: '#10B981' }}
                    onClick={() => setStarPlayer(players.find(p => p.position === 'South')?.id)}
                  >
                    {players.find(p => p.position === 'South')?.name || 'S'}
                  </div>
                  
                  {/* West Player */}
                  <div 
                    className="absolute top-1/2 left-0 transform -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: '#F59E0B' }}
                    onClick={() => setStarPlayer(players.find(p => p.position === 'West')?.id)}
                  >
                    {players.find(p => p.position === 'West')?.name || 'W'}
                  </div>
                  
                  {/* Connecting Lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {/* Lines from Star to each player */}
                    <line x1="50%" y1="50%" x2="50%" y2="10%" stroke="#6B7280" strokeWidth="1" strokeDasharray="5,5" />
                    <line x1="50%" y1="50%" x2="90%" y2="50%" stroke="#6B7280" strokeWidth="1" strokeDasharray="5,5" />
                    <line x1="50%" y1="50%" x2="50%" y2="90%" stroke="#6B7280" strokeWidth="1" strokeDasharray="5,5" />
                    <line x1="50%" y1="50%" x2="10%" y2="50%" stroke="#FBBF24" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg border-2 transition ${
                    player.id === currentTurn && gameStarted 
                      ? 'border-blue-500 bg-blue-500/20' 
                      : player.isStar 
                      ? 'border-yellow-500 bg-yellow-500/10' 
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: positions.find(pos => pos.name === player.position)?.color }}
                      >
                        {player.position.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{player.name}</h3>
                        <div className="flex items-center gap-2">
                          <span 
                            className={`text-xs px-2 py-1 rounded-full ${
                              player.isStar 
                                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' 
                                : 'bg-white/10 text-gray-300'
                            }`}
                          >
                            {player.position}
                          </span>
                          {player.isStar && (
                            <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded flex items-center gap-1">
                              <Star size={10} />
                              Star
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={player.health}
                        onChange={(e) => updatePlayerHealth(player.id, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        min="0"
                      />
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Heart size={16} className="text-red-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium text-red-400 mb-1">Enemies</h4>
                      <div className="flex flex-wrap gap-1">
                        {getEnemyPlayers(player.id).map(enemy => (
                          <span 
                            key={enemy.id} 
                            className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded flex items-center gap-1"
                          >
                            <Target size={10} />
                            {enemy.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {player.allies.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-400 mb-1">Allies</h4>
                        <div className="flex flex-wrap gap-1">
                          {getAllyPlayers(player.id).map(ally => (
                            <span 
                              key={ally.id} 
                              className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded flex items-center gap-1"
                            >
                              <Shield size={10} />
                              {ally.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => changePlayerName(player.id, e.target.value)}
                      className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="Player name"
                    />
                    
                    <select
                      value={player.position}
                      onChange={(e) => setPlayers(players.map(p => 
                        p.id === player.id ? { ...p, position: e.target.value } : p
                      ))}
                      className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {positions.map(pos => (
                        <option key={pos.name} value={pos.name}>{pos.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">Game Log</h2>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {gameLog.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-8 w-8 mb-2" />
                <p>No game events yet</p>
              </div>
            ) : (
              gameLog.map((entry, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>[{entry.time}]</span>
                  </div>
                  <p className="text-sm text-white">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">About Star Variant</h2>
          <div className="space-y-3 text-gray-300">
            <p>
              Star is a multiplayer Magic: The Gathering variant where one player sits in the center 
              (the "Star") and fights against all other players who sit around the perimeter.
            </p>
            <p>
              The Star player typically has advantages to compensate for fighting multiple opponents, 
              while the outer players may coordinate against the Star.
            </p>
            <p>
              This seating arrangement creates interesting dynamics where the Star must manage 
              multiple fronts while outer players coordinate against them.
            </p>
            
            <div className="mt-4">
              <h3 className="font-semibold text-white mb-2">Strategic Tips</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>As Star:</strong> Focus on one opponent at a time, use board wipes</li>
                <li><strong>As Outer:</strong> Coordinate with other players against the Star</li>
                <li>Track relationships and potential betrayals</li>
                <li>Manage your positioning relative to other players</li>
                <li>Consider the Star's advantages when planning attacks</li>
                <li>Form temporary alliances but be ready to shift strategies</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StarVariant;
import React, { useState } from 'react';
import { Crown, Sword, Shield, Users, RotateCcw, Play, Pause, Zap, Heart } from 'lucide-react';

const KingdomsVariant = () => {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', role: 'King', health: 25, color: '#FFD700', isActive: true },
    { id: 2, name: 'Player 2', role: 'Knight', health: 20, color: '#C0C0C0', isActive: true },
    { id: 3, name: 'Player 3', role: 'Bandit', health: 20, color: '#8B4513', isActive: true },
    { id: 4, name: 'Player 4', role: 'Villager', health: 15, color: '#90EE90', isActive: true }
  ]);

  const [gameStarted, setGameStarted] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [gameLog, setGameLog] = useState([]);
  const [kingdomCards, setKingdomCards] = useState([
    { id: 1, name: 'Royal Castle', type: 'Fortress', effect: 'King gains +2 life per turn', rarity: 'Rare', role: 'King' },
    { id: 2, name: 'Knight\'s Barracks', type: 'Military', effect: 'Knights gain +1/+1', rarity: 'Uncommon', role: 'Knight' },
    { id: 3, name: 'Bandit\'s Hideout', type: 'Stealth', effect: 'Bandits can steal resources', rarity: 'Uncommon', role: 'Bandit' },
    { id: 4, name: 'Village Square', type: 'Economy', effect: 'Villagers gain extra resources', rarity: 'Common', role: 'Villager' },
    { id: 5, name: 'Magic Tower', type: 'Utility', effect: 'All players draw extra card', rarity: 'Rare', role: 'All' },
    { id: 6, name: 'Dragon\'s Lair', type: 'Danger', effect: 'All players take damage', rarity: 'Mythic', role: 'All' },
    { id: 7, name: 'Treasure Vault', type: 'Resource', effect: 'Owner gains resources', rarity: 'Rare', role: 'All' },
    { id: 8, name: 'Healing Spring', type: 'Support', effect: 'All players heal', rarity: 'Uncommon', role: 'All' }
  ]);
  const [claimedKingdoms, setClaimedKingdoms] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const roles = [
    { name: 'King', color: '#FFD700', description: 'Leader of the kingdom, receives special benefits', health: 25, abilities: ['+2 life per turn', 'Extra card draw', 'Immunity to certain effects'] },
    { name: 'Knight', color: '#C0C0C0', description: 'Protector of the realm, excels in combat', health: 20, abilities: ['+1/+1 bonus', 'Extra blocking', 'Protection abilities'] },
    { name: 'Bandit', color: '#8B4513', description: 'Sneaky troublemaker, specializes in theft', health: 20, abilities: ['Resource stealing', 'Invisibility', 'Trap setting'] },
    { name: 'Villager', color: '#90EE90', description: 'Worker of the realm, focuses on economy', health: 15, abilities: ['Extra resources', 'Construction bonuses', 'Support abilities'] },
    { name: 'Wizard', color: '#4169E1', description: 'Master of magic, controls powerful spells', health: 18, abilities: ['Spell mastery', 'Mana efficiency', 'Counterspelling'] },
    { name: 'Merchant', color: '#FFA500', description: 'Trader of goods, controls economy', health: 17, abilities: ['Discounts', 'Resource trading', 'Market manipulation'] },
    { name: 'Spy', color: '#696969', description: 'Gatherer of intelligence, knows secrets', health: 16, abilities: ['Card peeking', 'Information gathering', 'Disguise'] },
    { name: 'Priest', color: '#F0F8FF', description: 'Healer and protector, provides support', health: 19, abilities: ['Healing', 'Blessings', 'Curse removal'] }
  ];

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const startGame = () => {
    setGameStarted(true);
    addToGameLog('Kingdoms game started!');
  };

  const endTurn = () => {
    const currentPlayer = players.find(p => p.id === currentTurn);
    const nextPlayerIdx = (players.findIndex(p => p.id === currentTurn) + 1) % players.length;
    const nextPlayer = players[nextPlayerIdx];
    setCurrentTurn(nextPlayer.id);
    addToGameLog(`${currentPlayer?.name} ended turn. ${nextPlayer.name}'s turn.`);
  };

  const assignRole = (playerId, roleName) => {
    const role = roles.find(r => r.name === roleName);
    if (role) {
      setPlayers(players.map(player => 
        player.id === playerId 
          ? { ...player, role: roleName, health: role.health, color: role.color } 
          : player
      ));
      addToGameLog(`${players.find(p => p.id === playerId)?.name} is now ${roleName}!`);
    }
  };

  const updatePlayerHealth = (playerId, newHealth) => {
    setPlayers(players.map(player => 
      player.id === playerId ? { ...player, health: Math.max(0, newHealth) } : player
    ));
  };

  const claimKingdom = (kingdomId, playerId) => {
    const kingdom = kingdomCards.find(k => k.id === kingdomId);
    const player = players.find(p => p.id === playerId);
    
    if (kingdom && player) {
      setClaimedKingdoms(prev => ({ ...prev, [kingdomId]: playerId }));
      addToGameLog(`${player.name} claimed ${kingdom.name}!`);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setCurrentTurn(1);
    setClaimedKingdoms({});
    setGameLog([]);
    setPlayers([
      { id: 1, name: 'Player 1', role: 'King', health: 25, color: '#FFD700', isActive: true },
      { id: 2, name: 'Player 2', role: 'Knight', health: 20, color: '#C0C0C0', isActive: true },
      { id: 3, name: 'Player 3', role: 'Bandit', health: 20, color: '#8B4513', isActive: true },
      { id: 4, name: 'Player 4', role: 'Villager', health: 15, color: '#90EE90', isActive: true }
    ]);
    addToGameLog('Game reset to initial state.');
  };

  const getRoleInfo = (roleName) => {
    return roles.find(r => r.name === roleName);
  };

  // Helper functions for the JSX
  const getRarityClass = (rarity) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-green-400';
      case 'rare': return 'text-blue-400';
      case 'mythic': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Kingdoms Variant</h1>
        <p className="text-gray-400">
          Role assignment for multiplayer Kingdoms variant with King, Knight, Bandit, Villager, and more
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
                  Start Kingdoms Game
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
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-3">Available Roles</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roles.map(role => (
                  <div 
                    key={role.name} 
                    className="p-3 bg-white/5 rounded-lg border border-white/10"
                    style={{ borderLeft: `4px solid ${role.color}` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Crown size={16} className="text-yellow-400" />
                      <span className="font-medium text-white">{role.name}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{role.description}</p>
                    <div className="text-xs text-purple-300">
                      Health: {role.health} | Abilities: {role.abilities.length}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10 lg:col-span-2">
          <h2 className="text-xl font-semibold text-white mb-4">Players & Roles</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map(player => {
              const roleInfo = getRoleInfo(player.role);
              return (
                <div 
                  key={player.id} 
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition"
                  style={{ borderLeft: `4px solid ${player.color}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.id}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{player.name}</h3>
                        <div className="flex items-center gap-2">
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${player.color}20`, color: player.color }}
                          >
                            {player.role}
                          </span>
                          {player.id === currentTurn && gameStarted && (
                            <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">
                              Turn
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{player.health}</span>
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Heart size={16} className="text-red-400" />
                      </div>
                    </div>
                  </div>
                  
                  {getRoleInfo(player.role) && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-purple-300 mb-1">Abilities:</h4>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {getRoleInfo(player.role).abilities.slice(0, 2).map((ability, idx) => (
                          <li key={idx} className="flex items-start">
                            <Zap size={10} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                            {ability}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="mt-3 flex gap-2">
                    <select
                      value={player.role}
                      onChange={(e) => assignRole(player.id, e.target.value)}
                      className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {roles.map(role => (
                        <option key={role.name} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      value={player.health}
                      onChange={(e) => updatePlayerHealth(player.id, parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      min="0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">Kingdom Cards</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {kingdomCards.map(kingdom => {
              const owner = claimedKingdoms[kingdom.id] ? players.find(p => p.id === claimedKingdoms[kingdom.id]) : null;
              return (
                <div 
                  key={kingdom.id} 
                  className={`p-4 rounded-lg border-2 transition ${
                    owner 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">{kingdom.name}</h3>
                    {owner && (
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: owner.color }}
                        title={owner.name}
                      ></div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                      {kingdom.type}
                    </span>
                    <span className={`text-xs ${getRarityClass(kingdom.rarity)}`}>
                      {kingdom.rarity}
                    </span>
                    <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                      {kingdom.role}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-3">{kingdom.effect}</p>
                  
                  {gameStarted && !owner && (
                    <div className="mt-2">
                      {players.map(player => (
                        <button
                          key={player.id}
                          onClick={() => claimKingdom(kingdom.id, player.id)}
                          className="w-full mt-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
                          style={{ color: player.color }}
                        >
                          Claim by {player.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {owner && (
                    <div className="mt-2 text-xs text-green-400">
                      Claimed by {owner.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">Game Log</h2>
          
          <div className="space-y-2 max-h-80 overflow-y-auto">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">About Kingdoms Variant</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Kingdoms is a multiplayer Magic: The Gathering variant where players take on different 
              roles with unique abilities and starting health pools.
            </p>
            <p>
              Each role has special abilities that affect gameplay differently, creating 
              asymmetric gameplay where each player has a unique experience.
            </p>
            <p>
              Kingdom cards can be claimed by players to gain special benefits 
              and control the board state.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Role Strategy Tips</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>King:</strong> Focus on defense and resource accumulation</li>
              <li><strong>Knight:</strong> Protect allies and engage in combat</li>
              <li><strong>Bandit:</strong> Disrupt opponents and gather resources</li>
              <li><strong>Villager:</strong> Build economy and support allies</li>
              <li>Coordinate with players who have complementary roles</li>
              <li>Adapt your strategy based on your assigned role</li>
              <li>Control key kingdom cards that benefit your role</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KingdomsVariant;
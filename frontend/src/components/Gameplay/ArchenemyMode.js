import React, { useState, useEffect } from 'react';
import { Shield, Zap, BookOpen, Plus, Trash2, Edit2, Save, X, Search, RotateCcw, Play, Pause } from 'lucide-react';

const ArchenemyMode = () => {
  const [schemes, setSchemes] = useState([
    { id: 1, name: "Backup Plan", type: "Scheme", text: "At the beginning of your upkeep, if you have no cards in hand, draw three cards.", rarity: "Common", color: "Black", expansion: "Archenemy" },
    { id: 2, name: "Beast Within", type: "Scheme", text: "At the beginning of your upkeep, sacrifice a permanent you control that shares a color with a permanent an opponent controls.", rarity: "Common", color: "Green", expansion: "Archenemy" },
    { id: 3, name: "Cruel Edict", type: "Scheme", text: "At the beginning of your upkeep, each opponent sacrifices a creature with the greatest toughness among creatures he or she controls.", rarity: "Common", color: "Black", expansion: "Archenemy" },
    { id: 4, name: "Deadly Designs", type: "Scheme", text: "At the beginning of your upkeep, each opponent reveals his or her hand and discards each card that shares a color with a permanent he or she controls.", rarity: "Common", color: "Black", expansion: "Archenemy" },
    { id: 5, name: "Deploy to the Front", type: "Scheme", text: "At the beginning of your upkeep, put a +1/+1 counter on each creature you control that shares a color with a permanent an opponent controls.", rarity: "Common", color: "Red", expansion: "Archenemy" },
    { id: 6, name: "Dictate of Krark", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Red", expansion: "Archenemy" },
    { id: 7, name: "Dictate of the Twin Gods", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Red", expansion: "Archenemy" },
    { id: 8, name: "Distant Melody", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Blue", expansion: "Archenemy" },
    { id: 9, name: "Echoes of the Kin Tree", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Green", expansion: "Archenemy" },
    { id: 10, name: "Emergency Powers", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "White", expansion: "Archenemy" },
    { id: 11, name: "Evacuation", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "White", expansion: "Archenemy" },
    { id: 12, name: "Explosive Revelation", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Red", expansion: "Archenemy" },
    { id: 13, name: "False Dawn", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "White", expansion: "Archenemy" },
    { id: 14, name: "Glimpse the Future", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Blue", expansion: "Archenemy" },
    { id: 15, name: "Grasp of Fate", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "White", expansion: "Archenemy" },
    { id: 16, name: "Harmless Offering", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Black", expansion: "Archenemy" },
    { id: 17, name: "Hidden Gibbons", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Green", expansion: "Archenemy" },
    { id: 18, name: "Insidious Will", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Blue", expansion: "Archenemy" },
    { id: 19, name: "March of the Machines", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Red", expansion: "Archenemy" },
    { id: 20, name: "Mind's Desire", type: "Scheme", text: "At the beginning of your upkeep, if an opponent controls more creatures than you do, that player sacrifices a creature.", rarity: "Common", color: "Blue", expansion: "Archenemy" }
  ]);

  const [newScheme, setNewScheme] = useState({ name: '', type: 'Scheme', text: '', rarity: 'Common', color: 'Multicolor', expansion: 'Archenemy' });
  const [editingScheme, setEditingScheme] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedExpansion, setSelectedExpansion] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [archenemyPlayer, setArchenemyPlayer] = useState(null);
  const [heroPlayers, setHeroPlayers] = useState([]);
  const [gameLog, setGameLog] = useState([]);

  const filteredSchemes = schemes.filter(scheme => {
    const matchesSearch = scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         scheme.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = selectedRarity === 'all' || scheme.rarity === selectedRarity;
    const matchesColor = selectedColor === 'all' || scheme.color === selectedColor;
    const matchesExpansion = selectedExpansion === 'all' || scheme.expansion === selectedExpansion;
    return matchesSearch && matchesRarity && matchesColor && matchesExpansion;
  });

  const addScheme = () => {
    if (!newScheme.name.trim() || !newScheme.text.trim()) return;

    const schemeToAdd = {
      ...newScheme,
      id: Date.now()
    };

    setSchemes([...schemes, schemeToAdd]);
    setNewScheme({ name: '', type: 'Scheme', text: '', rarity: 'Common', color: 'Multicolor', expansion: 'Archenemy' });
    setShowAddForm(false);
    addToGameLog(`Added new scheme: ${schemeToAdd.name}`);
  };

  const deleteScheme = (id) => {
    const scheme = schemes.find(s => s.id === id);
    setSchemes(schemes.filter(scheme => scheme.id !== id));
    addToGameLog(`Deleted scheme: ${scheme?.name}`);
  };

  const startEditing = (scheme) => {
    setEditingScheme({ ...scheme });
  };

  const saveEdit = () => {
    if (!editingScheme.name.trim() || !editingScheme.text.trim()) return;

    setSchemes(schemes.map(scheme => 
      scheme.id === editingScheme.id ? editingScheme : scheme
    ));
    addToGameLog(`Updated scheme: ${editingScheme.name}`);
    setEditingScheme(null);
  };

  const cancelEdit = () => {
    setEditingScheme(null);
  };

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const startGame = () => {
    if (archenemyPlayer && heroPlayers.length >= 1) {
      setGameActive(true);
      addToGameLog(`Archenemy game started with ${archenemyPlayer} as archenemy and ${heroPlayers.length} heroes`);
    } else {
      alert('Please assign an archenemy player and at least one hero player to start the game.');
    }
  };

  const endGame = () => {
    setGameActive(false);
    addToGameLog('Archenemy game ended');
  };

  const resetGame = () => {
    setGameActive(false);
    setArchenemyPlayer(null);
    setHeroPlayers([]);
    setGameLog([]);
    addToGameLog('Archenemy game reset');
  };

  const assignArchenemy = (playerName) => {
    if (heroPlayers.includes(playerName)) {
      setHeroPlayers(heroPlayers.filter(name => name !== playerName));
    }
    setArchenemyPlayer(playerName);
    addToGameLog(`${playerName} assigned as Archenemy`);
  };

  const assignHero = (playerName) => {
    if (archenemyPlayer === playerName) {
      setArchenemyPlayer(null);
    }
    if (!heroPlayers.includes(playerName)) {
      setHeroPlayers([...heroPlayers, playerName]);
      addToGameLog(`${playerName} assigned as Hero`);
    }
  };

  const removeHero = (playerName) => {
    setHeroPlayers(heroPlayers.filter(name => name !== playerName));
    addToGameLog(`${playerName} removed from Heroes`);
  };

  const getColorBadgeClass = (color) => {
    switch (color.toLowerCase()) {
      case 'white': return 'bg-white text-black';
      case 'blue': return 'bg-blue-500 text-white';
      case 'black': return 'bg-gray-800 text-white';
      case 'red': return 'bg-red-500 text-white';
      case 'green': return 'bg-green-500 text-white';
      case 'multicolor': return 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

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
        <h1 className="text-3xl font-bold text-white mb-2">Archenemy Mode</h1>
        <p className="text-gray-400">
          Scheme deck support for Archenemy format with deck building and tracking tools
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Game Controls</h2>
            
            <div className="space-y-4">
              {!gameActive ? (
                <button
                  onClick={startGame}
                  disabled={!archenemyPlayer || heroPlayers.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={20} />
                  Start Archenemy Game
                </button>
              ) : (
                <button
                  onClick={endGame}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  <Pause size={20} />
                  End Game
                </button>
              )}
              
              <button
                onClick={resetGame}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
              >
                <RotateCcw size={20} />
                Reset Game
              </button>
              
              <div className="pt-4 border-t border-white/10">
                <h3 className="font-medium text-white mb-3">Player Assignment</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Archenemy Player</label>
                    <input
                      type="text"
                      value={archenemyPlayer || ''}
                      onChange={(e) => setArchenemyPlayer(e.target.value)}
                      placeholder="Enter archenemy player name"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Hero Players (comma separated)</label>
                    <input
                      type="text"
                      value={heroPlayers.join(', ')}
                      onChange={(e) => setHeroPlayers(e.target.value.split(',').map(name => name.trim()).filter(Boolean))}
                      placeholder="Enter hero player names"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-6 border border-white/10 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Scheme Deck Stats</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Schemes:</span>
                <span className="text-white">{schemes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Common:</span>
                <span className="text-white">{schemes.filter(s => s.rarity === 'Common').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Uncommon:</span>
                <span className="text-white">{schemes.filter(s => s.rarity === 'Uncommon').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rare:</span>
                <span className="text-white">{schemes.filter(s => s.rarity === 'Rare').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mythic:</span>
                <span className="text-white">{schemes.filter(s => s.rarity === 'Mythic').length}</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
            >
              <Plus size={18} />
              {showAddForm ? 'Cancel' : 'Add Scheme'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Scheme Pool</h2>
              
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search schemes..."
                    className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-48"
                  />
                </div>
                
                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Rarities</option>
                  <option value="Common">Common</option>
                  <option value="Uncommon">Uncommon</option>
                  <option value="Rare">Rare</option>
                  <option value="Mythic">Mythic</option>
                </select>
                
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Colors</option>
                  <option value="White">White</option>
                  <option value="Blue">Blue</option>
                  <option value="Black">Black</option>
                  <option value="Red">Red</option>
                  <option value="Green">Green</option>
                  <option value="Multicolor">Multicolor</option>
                </select>
              </div>
            </div>
            
            {showAddForm && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-lg font-medium text-white mb-4">Add New Scheme</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Scheme Name</label>
                    <input
                      type="text"
                      value={newScheme.name}
                      onChange={(e) => setNewScheme({...newScheme, name: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter scheme name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Rarity</label>
                    <select
                      value={newScheme.rarity}
                      onChange={(e) => setNewScheme({...newScheme, rarity: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="Common">Common</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Rare">Rare</option>
                      <option value="Mythic">Mythic</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                    <select
                      value={newScheme.color}
                      onChange={(e) => setNewScheme({...newScheme, color: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="White">White</option>
                      <option value="Blue">Blue</option>
                      <option value="Black">Black</option>
                      <option value="Red">Red</option>
                      <option value="Green">Green</option>
                      <option value="Multicolor">Multicolor</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Expansion</label>
                    <input
                      type="text"
                      value={newScheme.expansion}
                      onChange={(e) => setNewScheme({...newScheme, expansion: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter expansion name"
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Effect Text</label>
                  <textarea
                    value={newScheme.text}
                    onChange={(e) => setNewScheme({...newScheme, text: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter scheme effect text"
                    rows="3"
                  />
                </div>
                
                <button
                  onClick={addScheme}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Add Scheme
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredSchemes.map(scheme => (
                <div 
                  key={scheme.id} 
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition"
                >
                  {editingScheme && editingScheme.id === scheme.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingScheme.name}
                        onChange={(e) => setEditingScheme({...editingScheme, name: e.target.value})}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      
                      <textarea
                        value={editingScheme.text}
                        onChange={(e) => setEditingScheme({...editingScheme, text: e.target.value})}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows="3"
                      />
                      
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          <Save size={14} />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white">{scheme.name}</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(scheme)}
                            className="text-gray-400 hover:text-white p-1 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deleteScheme(scheme.id)}
                            className="text-gray-400 hover:text-red-400 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getColorBadgeClass(scheme.color)}`}>
                          {scheme.color}
                        </span>
                        <span className={`text-xs ${getRarityClass(scheme.rarity)}`}>
                          {scheme.rarity}
                        </span>
                        <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                          {scheme.type}
                        </span>
                      </div>
                      
                      <p className="text-gray-300 text-sm">{scheme.text}</p>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        {scheme.expansion}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {filteredSchemes.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="mx-auto h-12 w-12 mb-4" />
                <h3 className="text-lg font-medium mb-2">No schemes found</h3>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Current Game State</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-red-900/20 to-black/20 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="text-red-400" size={24} />
                <h4 className="font-semibold text-white">Archenemy</h4>
              </div>
              <p className="text-gray-300">
                {archenemyPlayer 
                  ? `${archenemyPlayer} is the Archenemy with ${schemes.length} schemes in deck`
                  : 'No Archenemy assigned yet'}
              </p>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-blue-900/20 to-black/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-blue-400" size={24} />
                <h4 className="font-semibold text-white">Heroes</h4>
              </div>
              <div className="space-y-2">
                {heroPlayers.length > 0 ? (
                  heroPlayers.map((player, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded">
                      <span className="text-white">{player}</span>
                      <button
                        onClick={() => removeHero(player)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No heroes assigned yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Game Log</h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {gameLog.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No game events yet</p>
            ) : (
              gameLog.map((entry, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-xs">[{entry.time}]</span>
                  </div>
                  <p className="text-white">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">About Archenemy</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Archenemy is a casual Magic: The Gathering format where one player (the Archenemy) 
              faces multiple other players (the Heroes) in a cooperative battle.
            </p>
            <p>
              The Archenemy uses a scheme deck containing 40 or more scheme cards that create 
              ongoing effects throughout the game. Schemes are played face up and remain in play.
            </p>
            <p>
              The Heroes work together to defeat the Archenemy, who typically has a 
              larger life total (starting at 40) and powerful schemes to slow down the heroes.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Archenemy Strategy Tips</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li>Archenemy: Build schemes that complement each other</li>
              <li>Heroes: Coordinate your attacks and resource sharing</li>
              <li>Include removal spells that can deal with problematic schemes</li>
              <li>Consider the number of heroes when choosing schemes</li>
              <li>Balance offensive and defensive schemes in your deck</li>
              <li>Heroes should have different roles (aggro, control, support)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchenemyMode;
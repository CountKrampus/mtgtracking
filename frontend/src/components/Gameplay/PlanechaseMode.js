import React, { useState, useEffect } from 'react';
import { Dice6, Globe, Shuffle, Play, RotateCcw, Users, Zap, Star, Crown, Map } from 'lucide-react';

const PlanechaseMode = () => {
  const [planes, setPlanes] = useState([
    { id: 1, name: "Agrithea, Farmstead of Heroes", plane: "Agrithea", effect: "Players can't gain life.", chaos: false },
    { id: 2, name: "Akiro's Heaven", plane: "Akiro's Heaven", effect: "Players can't lose the game.", chaos: false },
    { id: 3, name: "Anarchist's Paradise", plane: "Anarchist's Paradise", effect: "Players can't play artifacts.", chaos: false },
    { id: 4, name: "Aphetto, City of Gears", plane: "Aphetto", effect: "Players can't play enchantments.", chaos: false },
    { id: 5, name: "Archelos, Lagoon Mystic", plane: "Archelos", effect: "Players can't play creatures with flying.", chaos: false },
    { id: 6, name: "Azgol, the Lost City", plane: "Azgol", effect: "Players can't play sorceries.", chaos: false },
    { id: 7, name: "Belenon, Land of Steeds", plane: "Belenon", effect: "Players can't play creatures with power 3 or greater.", chaos: false },
    { id: 8, name: "Cradle of the Accursed", plane: "Cradle of the Accursed", effect: "Players can't play black spells.", chaos: false },
    { id: 9, name: "Dominaria", plane: "Dominaria", effect: "Players can't play instants with converted mana cost 3 or greater.", chaos: false },
    { id: 10, name: "Equilor, Cyclopean Forge", plane: "Equilor", effect: "Players can't play red spells.", chaos: false },
    { id: 11, name: "Errant, Street Artist", plane: "Errant", effect: "Players can't play multicolored spells.", chaos: false },
    { id: 12, name: "Essence Scatter", plane: "Essence Scatter", effect: "Players can't play blue spells.", chaos: false },
    { id: 13, name: "Femeref, Capital of Akros", plane: "Femeref", effect: "Players can't play white spells.", chaos: false },
    { id: 14, name: "Gavony, Township of Thrulls", plane: "Gavony", effect: "Players can't play black spells.", chaos: false },
    { id: 15, name: "Glen Elendra", plane: "Glen Elendra", effect: "Players can't play blue spells.", chaos: false },
    { id: 16, name: "Ixalan, Realm of Riches", plane: "Ixalan", effect: "Players can't play green spells.", chaos: false },
    { id: 17, name: "Kephalai, Sky City", plane: "Kephalai", effect: "Players can't play creatures with power 2 or less.", chaos: false },
    { id: 18, name: "Kinshala, Gorger of Fools", plane: "Kinshala", effect: "Players can't play creatures with toughness 2 or less.", chaos: false },
    { id: 19, name: "Kyneth, Dome of the Epoch", plane: "Kyneth", effect: "Players can't play instants.", chaos: false },
    { id: 20, name: "Lair of the Hydra", plane: "Lair of the Hydra", effect: "Players can't play green spells.", chaos: false },
    { id: 21, name: "Mongseng, Separator of Paths", plane: "Mongseng", effect: "Players can't play multicolored spells.", chaos: false },
    { id: 22, name: "Naya, Drylands Domain", plane: "Naya", effect: "Players can't play red spells.", chaos: false },
    { id: 23, name: "Ondu, Throne of Ages", plane: "Ondu", effect: "Players can't play white spells.", chaos: false },
    { id: 24, name: "Pools of Becoming", plane: "Pools of Becoming", effect: "Players can't play lands.", chaos: false },
    { id: 25, name: "Pyrulea, Factory of Myths", plane: "Pyrulea", effect: "Players can't play red spells.", chaos: false },
    { id: 26, name: "Ravnica, City of Guilds", plane: "Ravnica", effect: "Players can't play multicolored spells.", chaos: false },
    { id: 27, name: "Sanctum of Serra's Mercy", plane: "Sanctum of Serra's Mercy", effect: "Players can't gain life.", chaos: false },
    { id: 28, name: "Shandalar, Maze of Magnificence", plane: "Shandalar", effect: "Players can't play blue spells.", chaos: false },
    { id: 29, name: "Sphinx's Disciple", plane: "Sphinx's Disciple", effect: "Players can't play blue spells.", chaos: false },
    { id: 30, name: "Stairs to Infinity", plane: "Stairs to Infinity", effect: "Players can't play instants with converted mana cost 2 or greater.", chaos: false },
    { id: 31, name: "Subira, Tamer of Elephants", plane: "Subira", effect: "Players can't play creatures with power 4 or greater.", chaos: false },
    { id: 32, name: "Theros, Land of the Gods", plane: "Theros", effect: "Players can't play enchantments.", chaos: false },
    { id: 33, name: "Tolvada, This World and the Next", plane: "Tolvada", effect: "Players can't play black spells.", chaos: false },
    { id: 34, name: "Ulgrotha, Edge of Eternity", plane: "Ulgrotha", effect: "Players can't play creatures with flying.", chaos: false },
    { id: 35, name: "Vryn, the Realm of Flames", plane: "Vryn", effect: "Players can't play red spells.", chaos: false },
    { id: 36, name: "Wildfire, Festival of Burning", plane: "Wildfire", effect: "Players can't gain life.", chaos: false },
    { id: 37, name: "Xerex, Monastery of Wisdom", plane: "Xerex", effect: "Players can't play blue spells.", chaos: false },
    { id: 38, name: "Yavimaya, Cradle of Growth", plane: "Yavimaya", effect: "Players can't play green spells.", chaos: false },
    { id: 39, name: "Zhalfir, Desolate Lighthouse", plane: "Zhalfir", effect: "Players can't play instants.", chaos: false },
    { id: 40, name: "Zopha, Pyromancer's Portal", plane: "Zopha", effect: "Players can't play red spells.", chaos: false }
  ]);

  const [currentPlane, setCurrentPlane] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [chaosMode, setChaosMode] = useState(false);
  const [usedPlanes, setUsedPlanes] = useState([]);
  const [gameActive, setGameActive] = useState(false);
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', active: true, planarDiceRolled: false },
    { id: 2, name: 'Player 2', active: true, planarDiceRolled: false },
    { id: 3, name: 'Player 3', active: true, planarDiceRolled: false },
    { id: 4, name: 'Player 4', active: true, planarDiceRolled: false }
  ]);
  const [gameLog, setGameLog] = useState([]);

  const rollPlanarDie = () => {
    return Math.floor(Math.random() * 20) + 1; // 1-20 for planar die
  };

  const selectRandomPlane = () => {
    if (!gameActive) return;

    setIsRolling(true);

    // Simulate rolling the planar die
    setTimeout(() => {
      const roll = rollPlanarDie();
      let selectedPlane = null;

      if (roll <= 14) {
        // Regular plane (70% chance)
        const availablePlanes = planes.filter(p => !usedPlanes.includes(p.id));
        if (availablePlanes.length > 0) {
          selectedPlane = availablePlanes[Math.floor(Math.random() * availablePlanes.length)];
        } else {
          // If all planes are used, reshuffle
          setUsedPlanes([]);
          selectedPlane = planes[Math.floor(Math.random() * planes.length)];
        }
      } else if (roll <= 17) {
        // Chaos symbol (15% chance)
        if (chaosMode) {
          // Trigger chaos effect
          addToGameLog("CHAOS! Chaos effects are now active!");
        }
        // Select a random plane anyway
        const availablePlanes = planes.filter(p => !usedPlanes.includes(p.id));
        if (availablePlanes.length > 0) {
          selectedPlane = availablePlanes[Math.floor(Math.random() * availablePlanes.length)];
        } else {
          setUsedPlanes([]);
          selectedPlane = planes[Math.floor(Math.random() * planes.length)];
        }
      } else {
        // Plane symbol (25% chance)
        const availablePlanes = planes.filter(p => !usedPlanes.includes(p.id));
        if (availablePlanes.length > 0) {
          selectedPlane = availablePlanes[Math.floor(Math.random() * availablePlanes.length)];
        } else {
          setUsedPlanes([]);
          selectedPlane = planes[Math.floor(Math.random() * planes.length)];
        }
      }

      setCurrentPlane(selectedPlane);
      if (selectedPlane) {
        setUsedPlanes(prev => [...prev, selectedPlane.id]);
        addToGameLog(`Plane revealed: ${selectedPlane.name} - ${selectedPlane.effect}`);
      }

      setIsRolling(false);
    }, 1000);
  };

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const startGame = () => {
    setGameActive(true);
    setCurrentPlane(null);
    setUsedPlanes([]);
    setPlayers(players.map(p => ({ ...p, planarDiceRolled: false })));
    addToGameLog("Planechase game started!");
  };

  const endGame = () => {
    setGameActive(false);
    setCurrentPlane(null);
    setUsedPlanes([]);
    addToGameLog("Planechase game ended.");
  };

  const resetGame = () => {
    setGameActive(false);
    setCurrentPlane(null);
    setUsedPlanes([]);
    setPlayers(players.map(p => ({ ...p, planarDiceRolled: false })));
    setGameLog([]);
    addToGameLog("Game reset to initial state.");
  };

  const togglePlayerActive = (playerId) => {
    setPlayers(players.map(p => 
      p.id === playerId ? { ...p, active: !p.active } : p
    ));
  };

  const markPlayerRolled = (playerId) => {
    setPlayers(players.map(p => 
      p.id === playerId ? { ...p, planarDiceRolled: !p.planarDiceRolled } : p
    ));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Planechase Mode</h1>
        <p className="text-gray-400">
          Random plane selection with planar die integration for Planechase games
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                {gameActive ? "Active Planechase Game" : "Start a Planechase Game"}
              </h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm">
                  {players.filter(p => p.active).length} players
                </span>
                {gameActive && (
                  <span className="px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm">
                    Active
                  </span>
                )}
              </div>
            </div>
            
            {!gameActive ? (
              <div className="text-center py-12">
                <Globe className="mx-auto h-16 w-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Ready to Start Planechase</h3>
                <p className="text-gray-400 mb-6">Click start to begin a new Planechase game</p>
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Start Planechase Game
                </button>
              </div>
            ) : (
              <div>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={selectRandomPlane}
                    disabled={isRolling}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRolling ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Rolling...
                      </>
                    ) : (
                      <>
                        <Dice6 size={20} />
                        Roll Planar Die
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={endGame}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                  >
                    <RotateCcw size={20} />
                    End Game
                  </button>
                </div>

                {currentPlane && (
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-500/30 mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-white">{currentPlane.plane}</h3>
                        <p className="text-purple-300 text-sm">ID: {currentPlane.id}</p>
                      </div>
                      {currentPlane.chaos && (
                        <span className="px-3 py-1 bg-red-600/30 text-red-300 rounded-full text-sm flex items-center gap-1">
                          <Zap size={16} />
                          Chaos
                        </span>
                      )}
                    </div>
                    
                    <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                      <h4 className="font-medium text-purple-300 mb-2">Plane Effect:</h4>
                      <p className="text-white text-lg">{currentPlane.effect}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-white mb-3">Chaos Mode</h3>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <span className="text-gray-300">Enable Chaos Effects</span>
                      <button
                        onClick={() => setChaosMode(!chaosMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          chaosMode ? 'bg-red-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            chaosMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-white mb-3">Plane Pool</h3>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Planes Used:</span>
                        <span className="text-white">{usedPlanes.length}/{planes.length}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${(usedPlanes.length / planes.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Players</h3>
            
            <div className="space-y-3">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${player.active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <span className="text-white">{player.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {gameActive && (
                      <button
                        onClick={() => markPlayerRolled(player.id)}
                        className={`p-1 rounded ${
                          player.planarDiceRolled 
                            ? 'bg-green-600/30 text-green-400' 
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                        }`}
                        title="Mark planar die rolled"
                      >
                        <Dice6 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => togglePlayerActive(player.id)}
                      className={`p-1 rounded ${
                        player.active 
                          ? 'bg-green-600/30 text-green-400' 
                          : 'bg-red-600/30 text-red-400'
                      }`}
                      title={player.active ? "Deactivate player" : "Activate player"}
                    >
                      <Users size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Planes</h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {usedPlanes.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No planes revealed yet</p>
              ) : (
                [...usedPlanes].reverse().map((planeId, index) => {
                  const plane = planes.find(p => p.id === planeId);
                  return plane ? (
                    <div key={planeId} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="font-medium text-white text-sm">{plane.plane}</div>
                      <div className="text-xs text-gray-400 truncate">{plane.effect}</div>
                    </div>
                  ) : null;
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Plane Pool</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {planes.map(plane => (
              <div 
                key={plane.id} 
                className={`p-4 rounded-lg border transition ${
                  usedPlanes.includes(plane.id)
                    ? 'bg-gray-800/50 border-gray-600 opacity-60'
                    : currentPlane?.id === plane.id
                    ? 'bg-purple-900/30 border-purple-500'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-white">{plane.plane}</h4>
                  {plane.chaos && (
                    <span className="text-xs px-2 py-1 bg-red-600/30 text-red-300 rounded">
                      Chaos
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-400">{plane.effect}</p>
                
                {usedPlanes.includes(plane.id) && (
                  <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <Zap size={12} />
                    Used in game
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Game Log</h3>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
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
          <h3 className="text-xl font-semibold text-white mb-4">About Planechase</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Planechase is a casual Magic: The Gathering format that uses oversized Plane cards 
              to change the game rules during play.
            </p>
            <p>
              Players roll a planar die to determine if a new plane is revealed, chaos occurs, 
              or nothing happens. Each plane has a lasting effect that changes how the game is played.
            </p>
            <p>
              This simulator allows you to experience Planechase without needing physical plane cards.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Planechase Rules</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li>Each player rolls the planar die during their planar roll step</li>
              <li>1-14: No effect, continue as normal</li>
              <li>15-17: Chaos symbol - trigger chaos effect if enabled</li>
              <li>18-20: Plane symbol - reveal a new plane</li>
              <li>Planes remain in play until another plane is revealed</li>
              <li>Chaos effects are temporary and occur immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanechaseMode;
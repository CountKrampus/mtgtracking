import React, { useState, useEffect } from 'react';
import { Users, Play, Shield, Swords, User, Palette } from 'lucide-react';
import PlayerProfiles, { PLAYER_COLORS } from './PlayerProfiles';

const API_URL = 'http://localhost:5000/api';

function GameSetup({
  gameFormat,
  setGameFormat,
  playerCount,
  setPlayerCount,
  playerNames,
  setPlayerNames,
  playerColors,
  setPlayerColors,
  playerBackgrounds,
  setPlayerBackgrounds,
  onStartGame
}) {
  const [showProfiles, setShowProfiles] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [availableDecks, setAvailableDecks] = useState([]);
  const [playerDecks, setPlayerDecks] = useState([null, null, null, null, null, null]);

  // Initialize player colors if not set
  useEffect(() => {
    if (!playerColors || playerColors.length === 0) {
      setPlayerColors(PLAYER_COLORS.slice(0, 6).map(c => c.value));
    }
  }, [playerColors, setPlayerColors]);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
    fetchDecks();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles`);
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  const fetchDecks = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/decks`, { headers });
      if (response.ok) {
        const data = await response.json();
        setAvailableDecks(Array.isArray(data) ? data.sort((a, b) => a.name.localeCompare(b.name)) : []);
      }
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    }
  };

  const handleDeckChange = (index, deckId) => {
    const deck = availableDecks.find(d => d._id === deckId) || null;
    setPlayerDecks(prev => {
      const next = [...prev];
      next[index] = deck;
      return next;
    });
  };

  const handleNameChange = (index, name) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleColorChange = (index, color) => {
    const newColors = [...(playerColors || [])];
    newColors[index] = color;
    setPlayerColors(newColors);
    setShowColorPicker(null);
  };

  const handleBackgroundChange = (index, background) => {
    const newBackgrounds = [...(playerBackgrounds || [])];
    newBackgrounds[index] = background;
    setPlayerBackgrounds(newBackgrounds);
  };

  const handleSelectProfile = (profile) => {
    if (selectedSlot !== null) {
      handleNameChange(selectedSlot, profile.name);
      handleColorChange(selectedSlot, profile.avatarColor);
      handleBackgroundChange(selectedSlot, profile.backgroundImage || '');
      setSelectedSlot(null);
    }
  };

  const handleQuickSelectProfile = (index, profile) => {
    handleNameChange(index, profile.name);
    handleColorChange(index, profile.avatarColor);
    handleBackgroundChange(index, profile.backgroundImage || '');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center gap-3">
          <Shield size={32} /> Game Setup
        </h2>

        {/* Format Selection */}
        <div className="mb-8">
          <label className="block text-white/80 mb-3 font-semibold">Game Format</label>
          <div className="flex gap-4">
            <button
              onClick={() => setGameFormat('commander')}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold transition flex flex-col items-center gap-2 ${
                gameFormat === 'commander'
                  ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <Swords size={28} />
              <span>Commander</span>
              <span className="text-sm opacity-70">40 Life</span>
            </button>
            <button
              onClick={() => setGameFormat('standard')}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold transition flex flex-col items-center gap-2 ${
                gameFormat === 'standard'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <Shield size={28} />
              <span>Standard</span>
              <span className="text-sm opacity-70">20 Life</span>
            </button>
          </div>
        </div>

        {/* Player Count Selection */}
        <div className="mb-8">
          <label className="block text-white/80 mb-3 font-semibold">Number of Players</label>
          <div className="flex gap-2 flex-wrap justify-center">
            {[2, 3, 4, 5, 6].map(count => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`w-14 h-14 rounded-xl font-bold text-xl transition ${
                  playerCount === count
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Player Names with Profiles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-white/80 font-semibold flex items-center gap-2">
              <Users size={18} /> Player Names
            </label>
            <button
              onClick={() => {
                setSelectedSlot(null);
                setShowProfiles(true);
              }}
              className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
            >
              <User size={14} />
              Manage Profiles
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: playerCount }, (_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2">
                  {/* Color Picker Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === i ? null : i)}
                      className="w-12 h-12 rounded-lg flex items-center justify-center transition hover:opacity-80"
                      style={{ backgroundColor: (playerColors && playerColors[i]) || PLAYER_COLORS[i % PLAYER_COLORS.length].value }}
                      title="Change color"
                    >
                      <Palette size={20} className="text-white/80" />
                    </button>

                    {/* Color Dropdown */}
                    {showColorPicker === i && (
                      <div className="absolute top-14 left-0 z-10 bg-gray-900 rounded-lg p-2 shadow-xl border border-white/20">
                        <div className="grid grid-cols-4 gap-2">
                          {PLAYER_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => handleColorChange(i, color.value)}
                              className={`w-8 h-8 rounded-full transition hover:scale-110 ${
                                (playerColors && playerColors[i]) === color.value ? 'ring-2 ring-white' : ''
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name Input */}
                  <input
                    type="text"
                    value={playerNames[i] || `Player ${i + 1}`}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={`Player ${i + 1}`}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ borderLeftColor: (playerColors && playerColors[i]) || PLAYER_COLORS[i % PLAYER_COLORS.length].value, borderLeftWidth: '4px' }}
                  />
                </div>

                {/* Deck Selector */}
                {availableDecks.length > 0 && (
                  <select
                    value={playerDecks[i]?._id || ''}
                    onChange={(e) => handleDeckChange(i, e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No deck selected</option>
                    {availableDecks.map(deck => (
                      <option key={deck._id} value={deck._id} style={{ backgroundColor: '#1f2937' }}>
                        {deck.commander?.name ? `${deck.commander.name} — ` : ''}{deck.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Quick Profile Select */}
                {profiles.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {profiles.slice(0, 4).map(profile => (
                      <button
                        key={profile._id}
                        onClick={() => handleQuickSelectProfile(i, profile)}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/70 text-xs font-medium transition flex items-center gap-1"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: profile.avatarColor }}
                        />
                        {profile.name}
                      </button>
                    ))}
                    {profiles.length > 4 && (
                      <button
                        onClick={() => {
                          setSelectedSlot(i);
                          setShowProfiles(true);
                        }}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/70 text-xs font-medium transition"
                      >
                        +{profiles.length - 4} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Start Game Button */}
        <button
          onClick={() => onStartGame(playerDecks)}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-xl transition flex items-center justify-center gap-3 shadow-lg"
        >
          <Play size={24} /> Start Game
        </button>
      </div>

      {/* Player Profiles Modal */}
      <PlayerProfiles
        isOpen={showProfiles}
        onClose={() => {
          setShowProfiles(false);
          fetchProfiles(); // Refresh profiles after closing
        }}
        onSelectProfile={handleSelectProfile}
      />
    </div>
  );
}

export default GameSetup;

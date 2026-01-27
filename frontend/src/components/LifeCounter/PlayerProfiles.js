import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Edit2, Check, User, Image, Upload, Search, Wand2 } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const PLAYER_COLORS = [
  { name: 'Purple', value: '#9333ea' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Orange', value: '#ea580c' }
];

function PlayerProfiles({ isOpen, onClose, onSelectProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState(PLAYER_COLORS[0].value);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Background image state
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(null); // profile ID or 'new'
  const [backgroundSearch, setBackgroundSearch] = useState('');
  const [backgroundResults, setBackgroundResults] = useState([]);
  const [searchingBackground, setSearchingBackground] = useState(false);
  const [editBackground, setEditBackground] = useState('');
  const [editBackgroundType, setEditBackgroundType] = useState('none');
  const [editCommanderName, setEditCommanderName] = useState('');
  const [newBackground, setNewBackground] = useState('');
  const [newBackgroundType, setNewBackgroundType] = useState('none');
  const [newCommanderName, setNewCommanderName] = useState('');
  const fileInputRef = useRef(null);

  // Fetch profiles on mount
  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/lifecounter/profiles`);
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProfileName.trim(),
          avatarColor: newProfileColor,
          backgroundImage: newBackground,
          backgroundType: newBackgroundType,
          commanderName: newCommanderName
        })
      });

      if (response.ok) {
        const newProfile = await response.json();
        setProfiles([...profiles, newProfile]);
        setNewProfileName('');
        setNewProfileColor(PLAYER_COLORS[0].value);
        setNewBackground('');
        setNewBackgroundType('none');
        setNewCommanderName('');
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const updateProfile = async (id) => {
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          avatarColor: editColor,
          backgroundImage: editBackground,
          backgroundType: editBackgroundType,
          commanderName: editCommanderName
        })
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfiles(profiles.map(p => p._id === id ? updatedProfile : p));
        setEditingId(null);
        setEditBackground('');
        setEditBackgroundType('none');
        setEditCommanderName('');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const deleteProfile = async (id) => {
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setProfiles(profiles.filter(p => p._id !== id));
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const startEditing = (profile) => {
    setEditingId(profile._id);
    setEditName(profile.name);
    setEditColor(profile.avatarColor);
    setEditBackground(profile.backgroundImage || '');
    setEditBackgroundType(profile.backgroundType || 'none');
    setEditCommanderName(profile.commanderName || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setEditBackground('');
    setEditBackgroundType('none');
    setEditCommanderName('');
    setShowBackgroundPicker(null);
  };

  // Search Scryfall for card art
  const searchCardArt = async (query) => {
    if (!query.trim()) return;
    setSearchingBackground(true);
    try {
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=art`);
      setBackgroundResults(response.data.data.slice(0, 12));
    } catch (error) {
      console.error('Scryfall search failed:', error);
      setBackgroundResults([]);
    } finally {
      setSearchingBackground(false);
    }
  };

  // Fetch commander art by name
  const fetchCommanderArt = async (commanderName, forProfile = 'new') => {
    if (!commanderName.trim()) return;
    try {
      const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(commanderName)}`);
      const card = response.data;
      const artUrl = card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop || '';

      if (forProfile === 'new') {
        setNewBackground(artUrl);
        setNewBackgroundType('commander');
        setNewCommanderName(commanderName);
      } else {
        setEditBackground(artUrl);
        setEditBackgroundType('commander');
        setEditCommanderName(commanderName);
      }
    } catch (error) {
      console.error('Commander fetch failed:', error);
      alert('Could not find that commander. Please check the name.');
    }
  };

  // Handle file upload
  const handleFileUpload = (event, forProfile = 'new') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please upload a JPG, PNG, or WebP image');
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (forProfile === 'new') {
        setNewBackground(dataUrl);
        setNewBackgroundType('upload');
      } else {
        setEditBackground(dataUrl);
        setEditBackgroundType('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  // Select art from search results
  const selectSearchResult = (card, forProfile = 'new') => {
    const artUrl = card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop || '';
    if (forProfile === 'new') {
      setNewBackground(artUrl);
      setNewBackgroundType('scryfall');
    } else {
      setEditBackground(artUrl);
      setEditBackgroundType('scryfall');
    }
    setShowBackgroundPicker(null);
    setBackgroundResults([]);
    setBackgroundSearch('');
  };

  // Clear background
  const clearBackground = (forProfile = 'new') => {
    if (forProfile === 'new') {
      setNewBackground('');
      setNewBackgroundType('none');
      setNewCommanderName('');
    } else {
      setEditBackground('');
      setEditBackgroundType('none');
      setEditCommanderName('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User size={24} className="text-purple-400" />
            Player Profiles
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Create New Profile */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <h4 className="text-white/80 text-sm font-semibold mb-3">Create New Profile</h4>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Player name..."
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && createProfile()}
            />
            <button
              onClick={createProfile}
              disabled={!newProfileName.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Add
            </button>
          </div>

          {/* Color Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/60 text-sm">Color:</span>
            {PLAYER_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => setNewProfileColor(color.value)}
                className={`w-8 h-8 rounded-full transition ${
                  newProfileColor === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>

          {/* Background Image */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-sm flex items-center gap-1">
                <Image size={14} /> Background:
              </span>
              {newBackground && (
                <button
                  onClick={() => clearBackground('new')}
                  className="text-red-400 text-xs hover:text-red-300"
                >
                  Clear
                </button>
              )}
            </div>

            {newBackground ? (
              <div className="relative w-full h-16 rounded-lg overflow-hidden mb-2">
                <img src={newBackground} alt="Background" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30" />
              </div>
            ) : null}

            <div className="flex gap-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileUpload(e, 'new')}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/70 text-xs font-medium transition flex items-center gap-1"
              >
                <Upload size={12} /> Upload
              </button>
              <button
                onClick={() => setShowBackgroundPicker(showBackgroundPicker === 'new' ? null : 'new')}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/70 text-xs font-medium transition flex items-center gap-1"
              >
                <Search size={12} /> Search Art
              </button>
              <div className="flex-1 flex gap-1">
                <input
                  type="text"
                  value={newCommanderName}
                  onChange={(e) => setNewCommanderName(e.target.value)}
                  placeholder="Commander name..."
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs placeholder-white/40 focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && fetchCommanderArt(newCommanderName, 'new')}
                />
                <button
                  onClick={() => fetchCommanderArt(newCommanderName, 'new')}
                  className="px-2 py-1 bg-purple-600/80 hover:bg-purple-600 rounded text-white text-xs font-medium transition flex items-center gap-1"
                  title="Auto-fill commander art"
                >
                  <Wand2 size={12} />
                </button>
              </div>
            </div>

            {/* Search Results */}
            {showBackgroundPicker === 'new' && (
              <div className="mt-2 bg-black/30 rounded-lg p-2">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={backgroundSearch}
                    onChange={(e) => setBackgroundSearch(e.target.value)}
                    placeholder="Search for card art..."
                    className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs placeholder-white/40 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && searchCardArt(backgroundSearch)}
                  />
                  <button
                    onClick={() => searchCardArt(backgroundSearch)}
                    disabled={searchingBackground}
                    className="px-2 py-1 bg-blue-600/80 hover:bg-blue-600 rounded text-white text-xs font-medium transition"
                  >
                    {searchingBackground ? '...' : 'Search'}
                  </button>
                </div>
                {backgroundResults.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                    {backgroundResults.map(card => (
                      <button
                        key={card.id}
                        onClick={() => selectSearchResult(card, 'new')}
                        className="relative aspect-[4/3] rounded overflow-hidden hover:ring-2 ring-purple-500 transition"
                      >
                        <img
                          src={card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profiles List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-white/60 py-8">Loading profiles...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              No profiles yet. Create one above!
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map(profile => (
                <div
                  key={profile._id}
                  className="bg-white/5 rounded-xl p-3 flex items-center gap-3"
                >
                  {editingId === profile._id ? (
                    // Editing Mode
                    <>
                      <div
                        className="w-10 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: editColor }}
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {PLAYER_COLORS.slice(0, 4).map(color => (
                          <button
                            key={color.value}
                            onClick={() => setEditColor(color.value)}
                            className={`w-6 h-6 rounded-full transition ${
                              editColor === color.value ? 'ring-2 ring-white' : ''
                            }`}
                            style={{ backgroundColor: color.value }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => updateProfile(profile._id)}
                        className="p-2 bg-green-600/80 hover:bg-green-600 rounded-lg transition"
                      >
                        <Check size={16} className="text-white" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                      >
                        <X size={16} className="text-white/60" />
                      </button>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <div className="relative w-10 h-10 rounded-full flex-shrink-0 overflow-hidden">
                        {profile.backgroundImage ? (
                          <img
                            src={profile.backgroundImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: profile.avatarColor }}
                          />
                        )}
                        <div
                          className="absolute inset-0 rounded-full ring-2"
                          style={{ boxShadow: `inset 0 0 0 2px ${profile.avatarColor}` }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{profile.name}</div>
                        {profile.commanderName && (
                          <div className="text-white/50 text-xs">{profile.commanderName}</div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          onSelectProfile(profile);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => startEditing(profile)}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                      >
                        <Edit2 size={16} className="text-white/60" />
                      </button>
                      <button
                        onClick={() => deleteProfile(profile._id)}
                        className="p-2 hover:bg-red-600/50 rounded-lg transition"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default PlayerProfiles;
export { PLAYER_COLORS };

import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit2, Save, X, Search, Filter, BookOpen, Users, Zap, Shield, Package, Layers, Target, Ban, RotateCcw } from 'lucide-react';

const CustomFormatBuilder = () => {
  const [formats, setFormats] = useState([
    {
      id: 1,
      name: 'Custom Commander',
      description: 'Modified Commander format with custom rules',
      rules: {
        deckSize: 100,
        commanderRule: true,
        singleton: true,
        startingLife: 40,
        colorIdentity: true,
        partnerCommanders: true,
        mulliganRule: 'free-mulligan-6'
      },
      cardPool: {
        includeSets: ['All Sets'],
        excludeSets: [],
        bannedList: ['Braids, Conjurer Adept', 'Flash', 'Oko, Thief of Crowns'],
        restrictedList: ['Black Lotus', 'Ancestral Recall']
      },
      specialRules: [
        'Commander damage reduced to 15',
        'Partner commanders allowed',
        'Free mulligan to 6 cards'
      ],
      isActive: true,
      createdAt: '2023-05-15',
      lastUpdated: '2023-12-01'
    },
    {
      id: 2,
      name: 'Budget Standard',
      description: 'Standard format with budget restrictions',
      rules: {
        deckSize: 60,
        commanderRule: false,
        singleton: false,
        startingLife: 20,
        colorIdentity: false,
        partnerCommanders: false,
        mulliganRule: 'regular'
      },
      cardPool: {
        includeSets: ['Recent Sets'],
        excludeSets: [],
        bannedList: [],
        restrictedList: []
      },
      specialRules: [
        'Maximum $5 per card',
        'No mythic rares',
        'Max 4 copies of any rare'
      ],
      isActive: false,
      createdAt: '2023-06-20',
      lastUpdated: '2023-11-15'
    }
  ]);

  const [newFormat, setNewFormat] = useState({
    name: '',
    description: '',
    rules: {
      deckSize: 60,
      commanderRule: false,
      singleton: false,
      startingLife: 20,
      colorIdentity: false,
      partnerCommanders: false,
      mulliganRule: 'regular'
    },
    cardPool: {
      includeSets: [],
      excludeSets: [],
      bannedList: [],
      restrictedList: []
    },
    specialRules: []
  });

  const [editingFormat, setEditingFormat] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('formats');
  const [gameLog, setGameLog] = useState([]);

  const allSets = [
    'Alpha', 'Beta', 'Unlimited', 'Revised', 'Fourth Edition', 'Fifth Edition', 'Classic Sixth Edition',
    'Mirage', 'Visions', 'Weatherlight', 'Tempest', 'Stronghold', 'Exodus', 'Unglued', 'Urza\'s Saga',
    'Urza\'s Legacy', 'Urza\'s Destiny', 'Mercadian Masques', 'Nemesis', 'Prophecy', 'Invasion',
    'Planeshift', 'Apocalypse', 'Odyssey', 'Torment', 'Judgment', 'Onslaught', 'Legions', 'Scourge',
    'Mirrodin', 'Darksteel', 'Fifth Dawn', 'Champions of Kamigawa', 'Betrayers of Kamigawa', 'Saviors of Kamigawa',
    'Ravnica: City of Guilds', 'Guildpact', 'Dissension', 'Coldsnap', 'Time Spiral', 'Planar Chaos', 'Future Sight',
    'Lorwyn', 'Morningtide', 'Shadowmoor', 'Eventide', 'Shards of Alara', 'Conflux', 'Alara Reborn',
    'Zendikar', 'Worldwake', 'Rise of the Eldrazi', 'Magic 2010', 'Zendikar Expeditions', 'World Championship Decks',
    'Magic 2011', 'Scars of Mirrodin', 'Mirrodin Besieged', 'New Phyrexia', 'Magic 2012', 'Innistrad', 'Dark Ascension',
    'Avacyn Restored', 'Magic 2013', 'Return to Ravnica', 'Gatecrash', 'Dragon\'s Maze', 'Magic 2014 Core Set',
    'Theros', 'Born of the Gods', 'Journey into Nyx', 'Magic 2015', 'Khans of Tarkir', 'Fate Reforged', 'Dragons of Tarkir',
    'Magic Origins', 'Battle for Zendikar', 'Oath of the Gatewatch', 'Welcome Deck 2016', 'Shadows over Innistrad', 'Eldritch Moon',
    'Kaladesh', 'Aether Revolt', 'Magic 2017', 'Hour of Devastation', 'Ixalan', 'Rivals of Ixalan', 'Magic 2018',
    'Dominaria', 'Core Set 2019', 'Guilds of Ravnica', 'Ravnica Allegiance', 'War of the Spark', 'Core Set 2020',
    'Throne of Eldraine', 'Theros Beyond Death', 'Ikoria: Lair of Behemoths', 'Jumpstart', 'Core Set 2021',
    'Zendikar Rising', 'Kaldheim', 'Strixhaven: School of Mages', 'Modern Horizons 2', 'Forgotten Realms',
    'Innistrad: Crimson Vow', 'Kamigawa: Neon Dynasty', 'Streets of New Capenna', 'Commander Legends', 'Adventure in the Forgotten Realms',
    'Innistrad: Midnight Hunt', 'Innistrad: Double Feature', 'The Brothers\' War', 'Phyrexia: All Will Be One', 'March of the Machine',
    'March of the Machine: The Aftermath', 'The Lord of the Rings: Tales of Middle-earth', 'Wilds of Eldraine', 'The Lost Caverns of Ixalan',
    'Murders at Karlov Manor', 'Outlaws of Thunder Junction', 'Modern Horizons 3', 'Duskmourn: House of Horror', 'Bloomburrow', 'Thunder Junction: Reloaded',
    'Planechase Anthology', 'Commander 2013 Edition', 'Commander 2014 Edition', 'Commander 2015 Edition', 'Commander 2016 Edition',
    'Commander 2017 Edition', 'Commander 2018 Edition', 'Commander 2019 Edition', 'Commander 2020 Edition', 'Commander Legends: Battle for Baldur\'s Gate',
    'Commander Masters', 'Archenemy', 'Duel Decks Anthology', 'Premium Deck Series', 'From the Vault', 'Mystery Booster', 'Unfinity'
  ];

  const mulliganOptions = [
    { value: 'regular', label: 'Regular Mulligan (until 6 or keep)' },
    { value: 'free-mulligan-6', label: 'Free Mulligan to 6 cards' },
    { value: 'free-mulligan-7', label: 'Free Mulligan to 7 cards' },
    { value: 'scryfall', label: 'Scryfall Mulligan (mulligan bad hands)' },
    { value: 'no-mulligan', label: 'No Mulligan' }
  ];

  const filteredFormats = formats.filter(format => 
    format.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    format.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const addFormat = () => {
    if (!newFormat.name.trim()) return;

    const formatToAdd = {
      ...newFormat,
      id: Date.now(),
      isActive: false,
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setFormats([...formats, formatToAdd]);
    setNewFormat({
      name: '',
      description: '',
      rules: {
        deckSize: 60,
        commanderRule: false,
        singleton: false,
        startingLife: 20,
        colorIdentity: false,
        partnerCommanders: false,
        mulliganRule: 'regular'
      },
      cardPool: {
        includeSets: [],
        excludeSets: [],
        bannedList: [],
        restrictedList: []
      },
      specialRules: []
    });
    setShowAddForm(false);
    addToGameLog(`Added new format: ${formatToAdd.name}`);
  };

  const deleteFormat = (id) => {
    const format = formats.find(f => f.id === id);
    setFormats(formats.filter(format => format.id !== id));
    addToGameLog(`Deleted format: ${format?.name}`);
  };

  const toggleFormatActive = (id) => {
    setFormats(formats.map(format => 
      format.id === id ? { ...format, isActive: !format.isActive } : format
    ));
    const format = formats.find(f => f.id === id);
    addToGameLog(`${format?.name} ${format?.isActive ? 'deactivated' : 'activated'}`);
  };

  const startEditing = (format) => {
    setEditingFormat({ ...format });
  };

  const saveEdit = () => {
    if (!editingFormat.name.trim()) return;

    setFormats(formats.map(format => 
      format.id === editingFormat.id ? { ...editingFormat, lastUpdated: new Date().toISOString().split('T')[0] } : format
    ));
    setEditingFormat(null);
    addToGameLog(`Updated format: ${editingFormat.name}`);
  };

  const cancelEdit = () => {
    setEditingFormat(null);
  };

  const addSpecialRule = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        specialRules: [...editingFormat.specialRules, 'New special rule']
      });
    } else {
      setNewFormat({
        ...newFormat,
        specialRules: [...newFormat.specialRules, 'New special rule']
      });
    }
  };

  const updateSpecialRule = (index, value) => {
    if (editingFormat) {
      const updatedRules = [...editingFormat.specialRules];
      updatedRules[index] = value;
      setEditingFormat({
        ...editingFormat,
        specialRules: updatedRules
      });
    } else {
      const updatedRules = [...newFormat.specialRules];
      updatedRules[index] = value;
      setNewFormat({
        ...newFormat,
        specialRules: updatedRules
      });
    }
  };

  const removeSpecialRule = (index) => {
    if (editingFormat) {
      const updatedRules = [...editingFormat.specialRules];
      updatedRules.splice(index, 1);
      setEditingFormat({
        ...editingFormat,
        specialRules: updatedRules
      });
    } else {
      const updatedRules = [...newFormat.specialRules];
      updatedRules.splice(index, 1);
      setNewFormat({
        ...newFormat,
        specialRules: updatedRules
      });
    }
  };

  const addBannedCard = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        cardPool: {
          ...editingFormat.cardPool,
          bannedList: [...editingFormat.cardPool.bannedList, '']
        }
      });
    } else {
      setNewFormat({
        ...newFormat,
        cardPool: {
          ...newFormat.cardPool,
          bannedList: [...newFormat.cardPool.bannedList, '']
        }
      });
    }
  };

  const updateBannedCard = (index, value) => {
    if (editingFormat) {
      const updatedBanned = [...editingFormat.cardPool.bannedList];
      updatedBanned[index] = value;
      setEditingFormat({
        ...editingFormat,
        cardPool: {
          ...editingFormat.cardPool,
          bannedList: updatedBanned
        }
      });
    } else {
      const updatedBanned = [...newFormat.cardPool.bannedList];
      updatedBanned[index] = value;
      setNewFormat({
        ...newFormat,
        cardPool: {
          ...newFormat.cardPool,
          bannedList: updatedBanned
        }
      });
    }
  };

  const removeBannedCard = (index) => {
    if (editingFormat) {
      const updatedBanned = [...editingFormat.cardPool.bannedList];
      updatedBanned.splice(index, 1);
      setEditingFormat({
        ...editingFormat,
        cardPool: {
          ...editingFormat.cardPool,
          bannedList: updatedBanned
        }
      });
    } else {
      const updatedBanned = [...newFormat.cardPool.bannedList];
      updatedBanned.splice(index, 1);
      setNewFormat({
        ...newFormat,
        cardPool: {
          ...newFormat.cardPool,
          bannedList: updatedBanned
        }
      });
    }
  };

  const toggleCommanderRule = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        rules: {
          ...editingFormat.rules,
          commanderRule: !editingFormat.rules.commanderRule,
          singleton: !editingFormat.rules.commanderRule ? true : editingFormat.rules.singleton, // Enable singleton if commander is enabled
          deckSize: !editingFormat.rules.commanderRule ? 100 : 60 // Default to 100 cards if commander is enabled
        }
      });
    } else {
      setNewFormat({
        ...newFormat,
        rules: {
          ...newFormat.rules,
          commanderRule: !newFormat.rules.commanderRule,
          singleton: !newFormat.rules.commanderRule ? true : newFormat.rules.singleton, // Enable singleton if commander is enabled
          deckSize: !newFormat.rules.commanderRule ? 100 : 60 // Default to 100 cards if commander is enabled
        }
      });
    }
  };

  const toggleSingleton = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        rules: {
          ...editingFormat.rules,
          singleton: !editingFormat.rules.singleton
        }
      });
    } else {
      setNewFormat({
        ...newFormat,
        rules: {
          ...newFormat.rules,
          singleton: !newFormat.rules.singleton
        }
      });
    }
  };

  const toggleColorIdentity = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        rules: {
          ...editingFormat.rules,
          colorIdentity: !editingFormat.rules.colorIdentity
        }
      });
    } else {
      setNewFormat({
        ...newFormat,
        rules: {
          ...newFormat.rules,
          colorIdentity: !newFormat.rules.colorIdentity
        }
      });
    }
  };

  const togglePartnerCommanders = () => {
    if (editingFormat) {
      setEditingFormat({
        ...editingFormat,
        rules: {
          ...editingFormat.rules,
          partnerCommanders: !editingFormat.rules.partnerCommanders
        }
      });
    } else {
      setNewFormat({
        ...newFormat,
        rules: {
          ...newFormat.rules,
          partnerCommanders: !newFormat.rules.partnerCommanders
        }
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Custom Format Builder</h1>
        <p className="text-gray-400">
          Define custom format rules (card pool, ban list, special rules)
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('formats')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'formats'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <Layers size={20} className="inline mr-2" />
          My Formats
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'builder'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <Settings size={20} className="inline mr-2" />
          Format Builder
        </button>
      </div>

      {activeTab === 'formats' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search formats..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
            >
              <Plus size={20} />
              New Format
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Format</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Format Name</label>
                    <input
                      type="text"
                      value={newFormat.name}
                      onChange={(e) => setNewFormat({...newFormat, name: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter format name"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      value={newFormat.description}
                      onChange={(e) => setNewFormat({...newFormat, description: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Describe your format"
                      rows="3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Deck Size</label>
                      <input
                        type="number"
                        value={newFormat.rules.deckSize}
                        onChange={(e) => setNewFormat({
                          ...newFormat, 
                          rules: {...newFormat.rules, deckSize: parseInt(e.target.value) || 60}
                        })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="40"
                        max="1000"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Starting Life</label>
                      <input
                        type="number"
                        value={newFormat.rules.startingLife}
                        onChange={(e) => setNewFormat({
                          ...newFormat, 
                          rules: {...newFormat.rules, startingLife: parseInt(e.target.value) || 20}
                        })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="10"
                        max="100"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFormat.rules.commanderRule}
                        onChange={toggleCommanderRule}
                        className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-300">Commander Format</span>
                    </label>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFormat.rules.singleton}
                        onChange={toggleSingleton}
                        disabled={!newFormat.rules.commanderRule}
                        className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className="text-gray-300">Singleton (No Copies)</span>
                    </label>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFormat.rules.colorIdentity}
                        onChange={toggleColorIdentity}
                        disabled={!newFormat.rules.commanderRule}
                        className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className="text-gray-300">Color Identity Rule</span>
                    </label>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFormat.rules.partnerCommanders}
                        onChange={togglePartnerCommanders}
                        disabled={!newFormat.rules.commanderRule}
                        className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className="text-gray-300">Partner Commanders Allowed</span>
                    </label>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Mulligan Rule</label>
                      <select
                        value={newFormat.rules.mulliganRule}
                        onChange={(e) => setNewFormat({
                          ...newFormat,
                          rules: {...newFormat.rules, mulliganRule: e.target.value}
                        })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {mulliganOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Banned Cards</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {newFormat.cardPool.bannedList.map((card, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={card}
                            onChange={(e) => updateBannedCard(index, e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Card name"
                          />
                          <button
                            onClick={() => removeBannedCard(index)}
                            className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addBannedCard}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Add Banned Card
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Special Rules</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {newFormat.specialRules.map((rule, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={rule}
                            onChange={(e) => updateSpecialRule(index, e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Special rule"
                          />
                          <button
                            onClick={() => removeSpecialRule(index)}
                            className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addSpecialRule}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Add Special Rule
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={addFormat}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                  >
                    Create Format
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {filteredFormats.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No formats found</h3>
                <p className="text-gray-500">
                  {formats.length === 0 
                    ? "No custom formats created yet. Create your first format!" 
                    : "Try adjusting your search criteria"}
                </p>
              </div>
            ) : (
              filteredFormats.map(format => (
                <div key={format.id} className="bg-white/5 rounded-lg p-6 border border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{format.name}</h3>
                      <p className="text-gray-400">{format.description}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(format)}
                        className="p-2 text-gray-400 hover:text-white rounded"
                        title="Edit format"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => deleteFormat(format.id)}
                        className="p-2 text-gray-400 hover:text-red-400 rounded"
                        title="Delete format"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button
                        onClick={() => toggleFormatActive(format.id)}
                        className={`p-2 rounded ${
                          format.isActive 
                            ? 'text-green-400 hover:text-green-300' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title={format.isActive ? "Deactivate format" : "Activate format"}
                      >
                        <Shield size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-purple-300 mb-2">Rules</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Deck Size:</span>
                          <span className="text-white">{format.rules.deckSize}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Starting Life:</span>
                          <span className="text-white">{format.rules.startingLife}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Commander Rule:</span>
                          <span className="text-white">{format.rules.commanderRule ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Singleton:</span>
                          <span className="text-white">{format.rules.singleton ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Color Identity:</span>
                          <span className="text-white">{format.rules.colorIdentity ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Partner Commanders:</span>
                          <span className="text-white">{format.rules.partnerCommanders ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Mulligan Rule:</span>
                          <span className="text-white">{mulliganOptions.find(opt => opt.value === format.rules.mulliganRule)?.label || format.rules.mulliganRule}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-purple-300 mb-2">Restrictions</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Banned Cards:</span>
                          <div className="mt-1">
                            {format.cardPool.bannedList.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {format.cardPool.bannedList.map((card, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-red-500/20 text-red-300 rounded-full text-xs">
                                    {card}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-xs">None</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <span className="text-gray-400">Special Rules:</span>
                          <div className="mt-1">
                            {format.specialRules.length > 0 ? (
                              <ul className="space-y-1">
                                {format.specialRules.map((rule, idx) => (
                                  <li key={idx} className="text-xs text-gray-300 flex items-start">
                                    <Zap size={10} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                                    {rule}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-gray-500 text-xs">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {format.isActive && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                        <Shield size={14} />
                        Active Format
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'builder' && editingFormat && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Edit Format: {editingFormat.name}</h2>
            <button
              onClick={cancelEdit}
              className="p-2 text-gray-400 hover:text-white rounded"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Format Name</label>
                <input
                  type="text"
                  value={editingFormat.name}
                  onChange={(e) => setEditingFormat({...editingFormat, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={editingFormat.description}
                  onChange={(e) => setEditingFormat({...editingFormat, description: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deck Size</label>
                  <input
                    type="number"
                    value={editingFormat.rules.deckSize}
                    onChange={(e) => setEditingFormat({
                      ...editingFormat, 
                      rules: {...editingFormat.rules, deckSize: parseInt(e.target.value) || 60}
                    })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="40"
                    max="1000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Starting Life</label>
                  <input
                    type="number"
                    value={editingFormat.rules.startingLife}
                    onChange={(e) => setEditingFormat({
                      ...editingFormat, 
                      rules: {...editingFormat.rules, startingLife: parseInt(e.target.value) || 20}
                    })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="10"
                    max="100"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFormat.rules.commanderRule}
                    onChange={toggleCommanderRule}
                    className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-300">Commander Format</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFormat.rules.singleton}
                    onChange={toggleSingleton}
                    disabled={!editingFormat.rules.commanderRule}
                    className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-gray-300">Singleton (No Copies)</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFormat.rules.colorIdentity}
                    onChange={toggleColorIdentity}
                    disabled={!editingFormat.rules.commanderRule}
                    className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-gray-300">Color Identity Rule</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFormat.rules.partnerCommanders}
                    onChange={togglePartnerCommanders}
                    disabled={!editingFormat.rules.commanderRule}
                    className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-gray-300">Partner Commanders Allowed</span>
                </label>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Mulligan Rule</label>
                  <select
                    value={editingFormat.rules.mulliganRule}
                    onChange={(e) => setEditingFormat({
                      ...editingFormat,
                      rules: {...editingFormat.rules, mulliganRule: e.target.value}
                    })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {mulliganOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Banned Cards</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editingFormat.cardPool.bannedList.map((card, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={card}
                        onChange={(e) => updateBannedCard(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Card name"
                      />
                      <button
                        onClick={() => removeBannedCard(index)}
                        className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addBannedCard}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Banned Card
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Special Rules</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editingFormat.specialRules.map((rule, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => updateSpecialRule(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Special rule"
                      />
                      <button
                        onClick={() => removeSpecialRule(index)}
                        className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addSpecialRule}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Special Rule
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={saveEdit}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">About Custom Format Builder</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Create custom Magic: The Gathering formats with your own rules, card pools, and restrictions.
            </p>
            <p>
              Define deck construction rules, starting life totals, banned lists, and special game rules.
            </p>
            <p>
              Perfect for homebrew formats, casual playgroups, or testing new format ideas.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Format Building Tips</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li>Start with a base format and modify specific rules</li>
              <li>Consider the power level when creating banned lists</li>
              <li>Test your format with a small group before expanding</li>
              <li>Document your rules clearly for other players</li>
              <li>Review and adjust based on playtesting feedback</li>
              <li>Consider the format's intended playstyle and duration</li>
              <li>Balance restrictions with available card pool</li>
              <li>Consider multiplayer dynamics if applicable</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomFormatBuilder;
import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit2, Save, X, Search, Filter, Download, Upload, Shuffle, Play, RotateCcw, Users, Zap, Star, Trophy, Layers, Target, PackagePlus, PackageCheck } from 'lucide-react';

const CubeBuilder = () => {
  const [cubes, setCubes] = useState([
    {
      id: 1,
      name: 'Pauper Cube',
      description: 'Cube with only common and uncommon cards',
      size: 360,
      owner: 'Player1',
      cards: [
        { id: 1, name: 'Lightning Bolt', set: 'LEA', cmc: 1, type: 'Instant', color: 'Red', rarity: 'Common', power: null, toughness: null },
        { id: 2, name: 'Force of Will', set: 'ME4', cmc: 0, type: 'Instant', color: 'Blue', rarity: 'Rare', power: null, toughness: null },
        { id: 3, name: 'Black Lotus', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Colorless', rarity: 'Mythic', power: null, toughness: null },
        { id: 4, name: 'Ancestral Recall', set: 'LEA', cmc: 0, type: 'Instant', color: 'Blue', rarity: 'Mythic', power: null, toughness: null },
        { id: 5, name: 'Time Walk', set: 'LEA', cmc: 0, type: 'Sorcery', color: 'Green', rarity: 'Mythic', power: null, toughness: null },
        { id: 6, name: 'Mox Pearl', set: 'LEA', cmc: 0, type: 'Artifact', color: 'White', rarity: 'Mythic', power: null, toughness: null },
        { id: 7, name: 'Mox Sapphire', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Blue', rarity: 'Mythic', power: null, toughness: null },
        { id: 8, name: 'Mox Jet', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Black', rarity: 'Mythic', power: null, toughness: null },
        { id: 9, name: 'Mox Ruby', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Red', rarity: 'Mythic', power: null, toughness: null },
        { id: 10, name: 'Mox Emerald', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Green', rarity: 'Mythic', power: null, toughness: null }
      ],
      isActive: false,
      createdDate: '2023-05-15',
      lastUpdated: '2023-12-01'
    },
    {
      id: 2,
      name: 'Budget Cube',
      description: 'Fun cube with budget-friendly cards',
      size: 480,
      owner: 'Player2',
      cards: [],
      isActive: true,
      createdDate: '2023-06-20',
      lastUpdated: '2023-11-15'
    }
  ]);

  const [newCube, setNewCube] = useState({
    name: '',
    description: '',
    size: 360
  });

  const [editingCube, setEditingCube] = useState(null);
  const [selectedCube, setSelectedCube] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState('cubes');
  const [numBoosters, setNumBoosters] = useState(6);
  const [deck, setDeck] = useState([]);
  const [sideboard, setSideboard] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [gameLog, setGameLog] = useState([]);

  const mockCards = [
    { id: 101, name: 'Lightning Bolt', set: 'LEA', cmc: 1, type: 'Instant', color: 'Red', rarity: 'Common', power: null, toughness: null },
    { id: 102, name: 'Counterspell', set: 'LEA', cmc: 2, type: 'Instant', color: 'Blue', rarity: 'Common', power: null, toughness: null },
    { id: 103, name: 'Swords to Plowshares', set: 'LEA', cmc: 1, type: 'Instant', color: 'White', rarity: 'Common', power: null, toughness: null },
    { id: 104, name: 'Force of Will', set: 'ME4', cmc: 0, type: 'Instant', color: 'Blue', rarity: 'Rare', power: null, toughness: null },
    { id: 105, name: 'Black Lotus', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Colorless', rarity: 'Mythic', power: null, toughness: null },
    { id: 106, name: 'Ancestral Recall', set: 'LEA', cmc: 0, type: 'Instant', color: 'Blue', rarity: 'Mythic', power: null, toughness: null },
    { id: 107, name: 'Time Walk', set: 'LEA', cmc: 0, type: 'Sorcery', color: 'Green', rarity: 'Mythic', power: null, toughness: null },
    { id: 108, name: 'Mox Pearl', set: 'LEA', cmc: 0, type: 'Artifact', color: 'White', rarity: 'Mythic', power: null, toughness: null },
    { id: 109, name: 'Mox Sapphire', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Blue', rarity: 'Mythic', power: null, toughness: null },
    { id: 110, name: 'Mox Jet', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Black', rarity: 'Mythic', power: null, toughness: null },
    { id: 111, name: 'Mox Ruby', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Red', rarity: 'Mythic', power: null, toughness: null },
    { id: 112, name: 'Mox Emerald', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Green', rarity: 'Mythic', power: null, toughness: null },
    { id: 113, name: 'Sol Ring', set: 'ME4', cmc: 1, type: 'Artifact', color: 'Colorless', rarity: 'Uncommon', power: null, toughness: null },
    { id: 114, name: 'Birds of Paradise', set: 'ME4', cmc: 0, type: 'Creature', color: 'Green', rarity: 'Uncommon', power: 0, toughness: 1 },
    { id: 115, name: 'Elvish Spirit Guide', set: 'ME4', cmc: 0, type: 'Creature', color: 'Green', rarity: 'Common', power: 1, toughness: 1 },
    { id: 116, name: 'Gitaxian Probe', set: 'ME4', cmc: 0, type: 'Sorcery', color: 'Blue', rarity: 'Common', power: null, toughness: null },
    { id: 117, name: 'Chrome Mox', set: 'ME4', cmc: 0, type: 'Artifact', color: 'Colorless', rarity: 'Uncommon', power: null, toughness: null },
    { id: 118, name: 'Chancellor of the Annex', set: 'ME4', cmc: 4, type: 'Creature', color: 'White', rarity: 'Rare', power: 3, toughness: 4 },
    { id: 119, name: 'Grim Monolith', set: 'ME4', cmc: 3, type: 'Artifact', color: 'Colorless', rarity: 'Rare', power: null, toughness: null },
    { id: 120, name: 'Thorn of Amethyst', set: 'ME4', cmc: 1, type: 'Artifact', color: 'Colorless', rarity: 'Uncommon', power: null, toughness: null }
  ];

  const filteredCubes = cubes.filter(cube =>
    cube.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cube.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCards = mockCards.filter(card => {
    const matchesRarity = filterRarity === 'all' || card.rarity === filterRarity;
    const matchesType = filterType === 'all' || card.type.includes(filterType);
    return matchesRarity && matchesType;
  });

  const addCube = () => {
    if (!newCube.name.trim()) return;

    const cubeToAdd = {
      ...newCube,
      id: Date.now(),
      cards: [],
      isActive: false,
      createdDate: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setCubes([...cubes, cubeToAdd]);
    setNewCube({ name: '', description: '', size: 360 });
    setShowAddForm(false);
    addToGameLog(`Added new cube: ${cubeToAdd.name}`);
  };

  const deleteCube = (id) => {
    const cube = cubes.find(c => c.id === id);
    setCubes(cubes.filter(cube => cube.id !== id));
    if (selectedCube?.id === id) {
      setSelectedCube(null);
    }
    addToGameLog(`Deleted cube: ${cube?.name}`);
  };

  const toggleCubeActive = (id) => {
    setCubes(cubes.map(cube => 
      cube.id === id ? { ...cube, isActive: !cube.isActive } : cube
    ));
    const cube = cubes.find(c => c.id === id);
    addToGameLog(`${cube?.name} ${cube?.isActive ? 'deactivated' : 'activated'}`);
  };

  const startEditing = (cube) => {
    setEditingCube({ ...cube });
  };

  const saveEdit = () => {
    if (!editingCube.name.trim()) return;

    setCubes(cubes.map(cube => 
      cube.id === editingCube.id ? editingCube : cube
    ));
    setEditingCube(null);
    addToGameLog(`Updated cube: ${editingCube.name}`);
  };

  const cancelEdit = () => {
    setEditingCube(null);
  };

  const addToCube = (card) => {
    if (selectedCube) {
      const updatedCube = {
        ...selectedCube,
        cards: [...selectedCube.cards, card],
        size: selectedCube.cards.length + 1
      };

      setSelectedCube(updatedCube);
      setCubes(cubes.map(cube => 
        cube.id === selectedCube.id ? updatedCube : cube
      ));
      addToGameLog(`Added ${card.name} to ${selectedCube.name}`);
    }
  };

  const removeFromCube = (cardId) => {
    if (selectedCube) {
      const updatedCube = {
        ...selectedCube,
        cards: selectedCube.cards.filter(card => card.id !== cardId),
        size: selectedCube.cards.length - 1
      };

      setSelectedCube(updatedCube);
      setCubes(cubes.map(cube => 
        cube.id === selectedCube.id ? updatedCube : cube
      ));
      addToGameLog(`Removed card from ${selectedCube.name}`);
    }
  };

  const addToDeck = (card) => {
    if (deck.length < 40) { // Minimum cube deck size
      setDeck([...deck, card]);
      addToGameLog(`Added ${card.name} to deck`);
    }
  };

  const removeFromDeck = (cardId) => {
    const card = deck.find(c => c.id === cardId);
    if (card) {
      setDeck(deck.filter(c => c.id !== cardId));
      addToGameLog(`Removed ${card?.name} from deck`);
    }
  };

  const startDraft = (cubeId) => {
    const cube = cubes.find(c => c.id === cubeId);
    if (cube && cube.cards.length >= 72) { // At least 18 cards per player for 4-player draft
      addToGameLog(`Started draft for cube: ${cube.name}`);
      // In a real implementation, this would start the draft simulation
      alert(`Draft started for cube: ${cube.name}\nThis would open the draft simulator.`);
    } else {
      alert(`Cube needs at least 72 cards for a 4-player draft (18 cards per player).\nCurrent: ${cube?.cards.length || 0} cards`);
    }
  };

  const exportCube = (cubeId) => {
    const cube = cubes.find(c => c.id === cubeId);
    if (cube) {
      const cubeData = JSON.stringify(cube, null, 2);
      const blob = new Blob([cubeData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cube.name.replace(/\s+/g, '_')}_cube.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToGameLog(`Exported cube: ${cube.name}`);
    }
  };

  const importCube = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedCube = JSON.parse(e.target.result);
          importedCube.id = Date.now(); // Assign new ID
          importedCube.createdDate = new Date().toISOString().split('T')[0];
          importedCube.lastUpdated = new Date().toISOString().split('T')[0];
          setCubes([...cubes, importedCube]);
          addToGameLog(`Imported cube: ${importedCube.name}`);
        } catch (error) {
          alert('Error importing cube: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    }
    event.target.value = ''; // Reset file input
  };

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const getRarityColor = (rarity) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-green-400';
      case 'rare': return 'text-blue-400';
      case 'mythic': return 'text-orange-400';
      case 'basic': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Cube Builder</h1>
        <p className="text-gray-400">
          Build and manage draft cubes with card list and draft tracking
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('cubes')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'cubes'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <Package size={20} className="inline mr-2" />
          My Cubes
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'builder'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <Edit2 size={20} className="inline mr-2" />
          Cube Builder
        </button>
        <button
          onClick={() => setActiveTab('draft')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'draft'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <Shuffle size={20} className="inline mr-2" />
          Draft Simulator
        </button>
      </div>

      {activeTab === 'cubes' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search cubes..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
            >
              <Plus size={20} />
              New Cube
            </button>
            
            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition cursor-pointer">
              <Upload size={20} />
              Import
              <input
                type="file"
                accept=".json"
                onChange={importCube}
                className="hidden"
              />
            </label>
          </div>

          {showAddForm && (
            <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Cube</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cube Name</label>
                  <input
                    type="text"
                    value={newCube.name}
                    onChange={(e) => setNewCube({...newCube, name: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter cube name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={newCube.description}
                    onChange={(e) => setNewCube({...newCube, description: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Describe your cube"
                    rows="3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Default Size</label>
                  <input
                    type="number"
                    value={newCube.size}
                    onChange={(e) => setNewCube({...newCube, size: parseInt(e.target.value) || 360})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="36"
                    max="1000"
                  />
                </div>
                
                <button
                  onClick={addCube}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Create Cube
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCubes.map(cube => (
              <div key={cube.id} className="bg-white/5 rounded-lg p-6 border border-white/10 hover:bg-white/10 transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{cube.name}</h3>
                    <p className="text-gray-400 text-sm">{cube.description}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => startDraft(cube.id)}
                      className="p-2 text-gray-400 hover:text-green-400 rounded"
                      title="Start Draft"
                    >
                      <Shuffle size={18} />
                    </button>
                    <button
                      onClick={() => exportCube(cube.id)}
                      className="p-2 text-gray-400 hover:text-blue-400 rounded"
                      title="Export Cube"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => startEditing(cube)}
                      className="p-2 text-gray-400 hover:text-yellow-400 rounded"
                      title="Edit Cube"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => deleteCube(cube.id)}
                      className="p-2 text-gray-400 hover:text-red-400 rounded"
                      title="Delete Cube"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => toggleCubeActive(cube.id)}
                      className={`p-2 rounded ${
                        cube.isActive 
                          ? 'text-green-400 hover:text-green-300' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title={cube.isActive ? "Deactivate Cube" : "Activate Cube"}
                    >
                      <Star size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Cards:</span>
                    <span className="text-white">{cube.cards.length}/{cube.size}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Owner:</span>
                    <span className="text-white">{cube.owner}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white">{cube.createdDate}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Last Updated:</span>
                    <span className="text-white">{cube.lastUpdated}</span>
                  </div>
                  
                  {cube.isActive && (
                    <div className="pt-2 border-t border-white/10">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                        <Trophy size={12} />
                        Active
                      </span>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setSelectedCube(cube)}
                  className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                >
                  View Cube
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'builder' && selectedCube && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedCube.name}</h2>
              <p className="text-gray-400">{selectedCube.description}</p>
            </div>
            <button
              onClick={() => setSelectedCube(null)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
            >
              Back to Cubes
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">Cube Contents ({selectedCube.cards.length} cards)</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startDraft(selectedCube.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                    >
                      <Shuffle size={16} />
                      Start Draft
                    </button>
                    <button
                      onClick={() => exportCube(selectedCube.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {selectedCube.cards.map(card => (
                    <div key={card.id} className="bg-white/10 rounded-lg p-4 border border-white/20">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-white text-sm leading-tight">{card.name}</h4>
                        <button
                          onClick={() => removeFromCube(card.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Set:</span>
                          <span className="text-white">{card.set}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Type:</span>
                          <span className="text-white">{card.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Color:</span>
                          <span className="text-white">{card.color}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">CMC:</span>
                          <span className="text-white">{card.cmc}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Rarity:</span>
                          <span className={`text-white ${getRarityColor(card.rarity)}`}>{card.rarity}</span>
                        </div>
                      </div>
                      
                      {card.power && card.toughness && (
                        <div className="mt-2 text-center text-green-400 font-medium">
                          {card.power}/{card.toughness}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {selectedCube.cards.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      <Package className="mx-auto h-12 w-12 mb-4" />
                      <p>No cards in this cube yet</p>
                      <p className="text-sm">Add cards from the card pool to build your cube</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Add Cards to Cube</h3>
                
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search cards..."
                      className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All Rarities</option>
                      <option value="Common">Common</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Rare">Rare</option>
                      <option value="Mythic">Mythic</option>
                    </select>
                    
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All Types</option>
                      <option value="Creature">Creatures</option>
                      <option value="Instant">Instants</option>
                      <option value="Sorcery">Sorceries</option>
                      <option value="Artifact">Artifacts</option>
                      <option value="Enchantment">Enchantments</option>
                      <option value="Land">Lands</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4 max-h-64 overflow-y-auto">
                  {filteredCards.map(card => (
                    <div 
                      key={card.id} 
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 mb-2 hover:bg-white/10 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{card.name}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{card.set}</span>
                          <span>•</span>
                          <span>{card.type}</span>
                          <span>•</span>
                          <span className={getRarityColor(card.rarity)}>{card.rarity}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addToCube(card)}
                        className="ml-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                  
                  {filteredCards.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="mx-auto h-8 w-8 mb-2" />
                      <p>No cards match your search</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Cube Stats</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-white">{selectedCube.cards.filter(c => c.type.includes('Creature')).length}</div>
                      <div className="text-xs text-gray-400">Creatures</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-white">{selectedCube.cards.filter(c => c.type.includes('Instant') || c.type.includes('Sorcery')).length}</div>
                      <div className="text-xs text-gray-400">Spells</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-white">{selectedCube.cards.filter(c => c.type.includes('Artifact')).length}</div>
                      <div className="text-xs text-gray-400">Artifacts</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-white">{selectedCube.cards.filter(c => c.type.includes('Land')).length}</div>
                      <div className="text-xs text-gray-400">Lands</div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/10">
                    <h4 className="font-medium text-white mb-2">Color Distribution</h4>
                    <div className="space-y-2">
                      {['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'].map(color => {
                        const count = selectedCube.cards.filter(c => c.color === color).length;
                        if (count === 0) return null;
                        
                        return (
                          <div key={color} className="flex items-center justify-between">
                            <span className="text-gray-300">{color}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-purple-600" 
                                  style={{ width: `${(count / selectedCube.cards.length) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-white text-sm">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Draft Simulator</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Available Cubes for Draft</h3>
              
              <div className="space-y-4">
                {cubes.filter(cube => cube.cards.length >= 36).map(cube => (
                  <div key={cube.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-white">{cube.name}</h4>
                        <p className="text-sm text-gray-400">{cube.description}</p>
                      </div>
                      <span className="text-sm text-gray-400">{cube.cards.length} cards</span>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => startDraft(cube.id)}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
                      >
                        Start Draft
                      </button>
                      <button
                        onClick={() => setSelectedCube(cube)}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
                
                {cubes.filter(cube => cube.cards.length >= 36).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Shuffle className="mx-auto h-12 w-12 mb-4" />
                    <p>No cubes with enough cards for drafting</p>
                    <p className="text-sm">Add at least 36 cards to a cube to enable drafting</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Draft Settings</h3>
              
              <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
                <h4 className="font-medium text-white mb-3">Configuration</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Players</label>
                    <select className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option>2 Players</option>
                      <option>4 Players</option>
                      <option>6 Players</option>
                      <option>8 Players</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Cards per Pack</label>
                    <input
                      type="number"
                      defaultValue="15"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Packs per Player</label>
                    <input
                      type="number"
                      defaultValue="3"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                    />
                    <label className="text-gray-300 text-sm">Enable autopilot</label>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="font-medium text-white mb-3">Draft History</h4>
                
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {cubes.filter(cube => cube.cards.length >= 36).slice(0, 5).map((cube, index) => (
                    <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white">{cube.name}</span>
                        <span className="text-gray-400">Draft #{index + 1}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Started: {new Date().toLocaleDateString()}</div>
                    </div>
                  ))}
                  
                  {cubes.filter(cube => cube.cards.length >= 36).length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No draft history yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCube && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Edit Cube: {editingCube.name}</h3>
              <button
                onClick={cancelEdit}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cube Name</label>
                <input
                  type="text"
                  value={editingCube.name}
                  onChange={(e) => setEditingCube({...editingCube, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={editingCube.description}
                  onChange={(e) => setEditingCube({...editingCube, description: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Size</label>
                <input
                  type="number"
                  value={editingCube.size}
                  onChange={(e) => setEditingCube({...editingCube, size: parseInt(e.target.value) || 360})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
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
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">About Cube Drafting</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Cube drafting is a popular Magic: The Gathering format where players draft cards 
              from a custom pool of cards rather than from booster packs.
            </p>
            <p>
              Cubes are typically built around specific themes, power levels, or color combinations 
              to create unique draft experiences.
            </p>
            <p>
              Popular cube types include Pauper (commons/uncommons only), Power 9 cubes, 
              and themed cubes like tribal or commander-focused.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Cube Building Tips</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li>Maintain proper color balance (roughly equal number of cards in each color)</li>
              <li>Include approximately 35-40% creatures for a balanced curve</li>
              <li>Ensure good distribution of mana costs (the "mana curve")</li>
              <li>Consider synergy between cards while maintaining diversity</li>
              <li>Playtest extensively and adjust ratios based on draft experience</li>
              <li>Keep a consistent power level appropriate for your playgroup</li>
              <li>Include interactive cards that reward good draft choices</li>
              <li>Balance removal, card draw, and bombs appropriately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CubeBuilder;
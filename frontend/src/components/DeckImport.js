import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// ── Commander search with Scryfall autocomplete ───────────────────────────────
function CommanderSearch({ label, value, onChange, onSelect }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value?.name || '');
  }, [value]);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange(null); // clear confirmed selection while typing

    clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(q)}`);
        setSuggestions(res.data.slice(0, 8));
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const selectSuggestion = async (name) => {
    setQuery(name);
    setSuggestions([]);
    setLoading(true);
    try {
      // Call Scryfall directly for full commander data (CORS-enabled, no price lookup needed)
      const res = await axios.get(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`
      );
      const card = res.data;
      const face = card.card_faces?.[0] || card;
      onSelect({
        scryfallId: card.id,
        name: card.name,
        manaCost: face.mana_cost || card.mana_cost || '',
        colorIdentity: card.color_identity || [],
        imageUrl: face.image_uris?.normal || card.image_uris?.normal || '',
        oracleText: face.oracle_text || card.oracle_text || '',
        flavorText: face.flavor_text || card.flavor_text || '',
        typeLine: face.type_line || card.type_line || '',
        power: card.power || '',
        toughness: card.toughness || '',
      });
    } catch {
      alert(`Could not find card "${name}" on Scryfall`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-white/80 text-sm mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="Search Scryfall..."
        className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
      />
      {loading && (
        <div className="absolute right-3 top-8 text-white/50 text-xs">Loading...</div>
      )}
      {suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map(name => (
            <button
              key={name}
              onClick={() => selectSuggestion(name)}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
          <span>✓</span>
          <span>{value.name}</span>
          <span className="text-white/40">{value.manaCost}</span>
        </div>
      )}
    </div>
  );
}

// ── Create New Deck form ──────────────────────────────────────────────────────
function DeckCreateForm({ onBack, onImportComplete }) {
  const [deckName, setDeckName] = useState('');
  const [commander, setCommander] = useState(null);
  const [partner, setPartner] = useState(null);
  const [hasPartner, setHasPartner] = useState(false);
  const [loading, setLoading] = useState(false);

  const canCreate = deckName.trim() && commander;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/decks`, {
        name: deckName.trim(),
        commander,
        partnerCommander: hasPartner && partner ? partner : null,
        mainDeck: [],
      });

      onImportComplete();
    } catch (error) {
      alert('Error creating deck: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Deck name */}
      <div>
        <label className="block text-white/80 text-sm mb-1">Deck Name</label>
        <input
          type="text"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder="My Commander Deck"
          className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* Commander */}
      <CommanderSearch
        label="Commander"
        value={commander}
        onChange={setCommander}
        onSelect={setCommander}
      />

      {/* Partner toggle */}
      <div>
        <button
          onClick={() => { setHasPartner(p => !p); setPartner(null); }}
          className={`px-3 py-1 rounded text-sm transition ${
            hasPartner ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          {hasPartner ? '✓ Has Partner Commander' : '+ Add Partner Commander'}
        </button>
      </div>

      {hasPartner && (
        <CommanderSearch
          label="Partner Commander"
          value={partner}
          onChange={setPartner}
          onSelect={setPartner}
        />
      )}

      {/* Commander preview */}
      {commander?.imageUrl && (
        <div className="flex gap-4">
          <img src={commander.imageUrl} alt={commander.name} className="w-32 rounded-lg" />
          {partner?.imageUrl && (
            <img src={partner.imageUrl} alt={partner.name} className="w-32 rounded-lg" />
          )}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!canCreate || loading}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
      >
        {loading ? 'Creating...' : 'Create Deck'}
      </button>

      <p className="text-white/40 text-xs text-center">
        You can add cards to the deck after creating it using the deck editor.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function DeckImport({ onBack, onImportComplete }) {
  const [mode, setMode] = useState('new'); // 'new' | 'text' | 'moxfield' | 'archidekt'
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!importData.trim()) {
      alert('Please enter a deck list or URL');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/decks/import`, {
        source: mode,
        data: importData
      });

      const { deckData, statistics, validation } = response.data;

      if (validation.errors.length > 0) {
        alert('Deck validation errors:\n' + validation.errors.join('\n'));
      }
      if (validation.warnings.length > 0) {
        alert('Deck validation warnings:\n' + validation.warnings.join('\n'));
      }

      await axios.post(`${API_URL}/decks`, { ...deckData, statistics });

      alert('Deck imported successfully!');
      setImportData('');
      onImportComplete();
    } catch (error) {
      alert('Error importing deck: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'new',       label: '+ New Deck'   },
    { id: 'text',      label: 'Text List'    },
    { id: 'moxfield',  label: 'Moxfield'     },
    { id: 'archidekt', label: 'Archidekt'    },
  ];

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/30">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Add Deck</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
        >
          ← Back to Decks
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
              mode === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* New deck form */}
      {mode === 'new' && (
        <DeckCreateForm onBack={onBack} onImportComplete={onImportComplete} />
      )}

      {/* Import forms */}
      {mode !== 'new' && (
        <>
          <div className="mb-4">
            <label className="block text-white/80 mb-2">
              {mode === 'text' ? 'Paste Deck List' : 'Enter Deck URL'}
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={
                mode === 'text'
                  ? "Commander:\n1 Atraxa, Praetors' Voice\n\nDeck:\n1 Sol Ring\n1 Command Tower\n..."
                  : `https://${mode}.com/decks/...`
              }
              className="w-full h-64 px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono text-sm"
            />
          </div>

          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:bg-gray-600"
          >
            {loading ? 'Importing...' : 'Import & Validate Deck'}
          </button>
        </>
      )}
    </div>
  );
}

export default DeckImport;

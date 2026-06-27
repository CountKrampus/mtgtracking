import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// ── Commander search with Scryfall autocomplete ───────────────────────────────
function CommanderSearch({ label, value, onChange, onSelect }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commanderError, setCommanderError] = useState('');
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
    setCommanderError('');
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
      setCommanderError(`Could not find card "${name}" on Scryfall`);
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
      {commanderError && <p className="text-red-400 text-xs mt-1">{commanderError}</p>}
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
  const [format, setFormat] = useState('commander');
  const [commander, setCommander] = useState(null);
  const [partner, setPartner] = useState(null);
  const [hasPartner, setHasPartner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const isCommanderFormat = format === 'commander';
  const canCreate = deckName.trim() && (!isCommanderFormat || commander);

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setCreateError('');
    try {
      await axios.post(`${API_URL}/decks`, {
        name: deckName.trim(),
        format,
        commander: isCommanderFormat ? commander : null,
        partnerCommander: isCommanderFormat && hasPartner && partner ? partner : null,
        mainDeck: [],
      });

      onImportComplete();
    } catch (error) {
      setCreateError('Error creating deck: ' + (error.response?.data?.message || error.message));
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

      {/* Format */}
      <div>
        <label className="block text-white/80 text-sm mb-1">Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
        >
          <option value="commander">Commander</option>
          <option value="standard">Standard</option>
          <option value="modern">Modern</option>
          <option value="pioneer">Pioneer</option>
          <option value="legacy">Legacy</option>
          <option value="vintage">Vintage</option>
          <option value="pauper">Pauper</option>
          <option value="draft">Draft</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Commander (only for commander format) */}
      {isCommanderFormat && (
        <CommanderSearch
          label="Commander"
          value={commander}
          onChange={setCommander}
          onSelect={setCommander}
        />
      )}

      {/* Partner toggle */}
      {isCommanderFormat && (
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
      )}

      {isCommanderFormat && hasPartner && (
        <CommanderSearch
          label="Partner Commander"
          value={partner}
          onChange={setPartner}
          onSelect={setPartner}
        />
      )}

      {/* Commander preview */}
      {isCommanderFormat && commander?.imageUrl && (
        <div className="flex gap-4">
          <img src={commander.imageUrl} alt={commander.name} className="w-32 rounded-lg" />
          {partner?.imageUrl && (
            <img src={partner.imageUrl} alt={partner.name} className="w-32 rounded-lg" />
          )}
        </div>
      )}

      {createError && <ErrorBanner messages={[createError]} />}

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

// ── Banner components ─────────────────────────────────────────────────────────
function ErrorBanner({ messages }) {
  if (!messages?.length) return null;
  return (
    <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-3 mb-4">
      <p className="text-red-300 font-semibold text-sm mb-1">Errors</p>
      <ul className="list-disc list-inside space-y-1">
        {messages.map((msg, i) => <li key={i} className="text-red-200 text-sm">{msg}</li>)}
      </ul>
    </div>
  );
}

function WarningBanner({ messages }) {
  if (!messages?.length) return null;
  return (
    <div className="bg-yellow-900/50 border border-yellow-500/50 rounded-lg p-3 mb-4">
      <p className="text-yellow-300 font-semibold text-sm mb-1">Warnings</p>
      <ul className="list-disc list-inside space-y-1">
        {messages.map((msg, i) => <li key={i} className="text-yellow-200 text-sm">{msg}</li>)}
      </ul>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function DeckImport({ onBack, onImportComplete }) {
  const [mode, setMode] = useState('new');
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [importPreview, setImportPreview] = useState(null); // { deckData, statistics, validation }
  const [importError, setImportError] = useState('');

  const handleImport = async () => {
    if (!importData.trim()) return;
    setImportError('');
    setValidationErrors([]);
    setValidationWarnings([]);
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/decks/import`, {
        source: mode,
        data: importData,
      });
      setImportPreview(response.data); // { deckData, statistics, validation }
    } catch (error) {
      setImportError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/decks`, {
        ...importPreview.deckData,
        statistics: importPreview.statistics,
      });
      setImportData('');
      onImportComplete();
    } catch (error) {
      setImportError(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'new',         label: '+ New Deck'  },
    { id: 'text',        label: 'Text List'   },
    { id: 'arena',       label: 'MTG Arena'   },
    { id: 'moxfield',    label: 'Moxfield'    },
    { id: 'archidekt',   label: 'Archidekt'   },
    { id: 'tappedout',   label: 'TappedOut'   },
    { id: 'mtggoldfish', label: 'MTGGoldfish' },
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
      <div className="flex flex-wrap gap-2 mb-4">
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
          {importPreview ? (
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold text-lg mb-1">
                  {importPreview.deckData?.name || 'Imported Deck'}
                </h3>
                {importPreview.deckData?.commander && (
                  <p className="text-white/70 text-sm">
                    Commander: {importPreview.deckData.commander.name}
                  </p>
                )}
                <p className="text-white/70 text-sm">
                  Cards: {importPreview.statistics?.totalCards || importPreview.deckData?.mainDeck?.length || 0}
                </p>
              </div>
              <ErrorBanner messages={importPreview.validation?.errors} />
              <WarningBanner messages={importPreview.validation?.warnings} />
              {importError && <ErrorBanner messages={[importError]} />}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Confirm Import'}
                </button>
                <button
                  onClick={() => { setImportPreview(null); setImportError(''); }}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-white/80 mb-2">
                  {mode === 'text' || mode === 'arena' ? 'Paste Deck List' : 'Enter Deck URL'}
                </label>
                {(mode === 'text' || mode === 'arena') && (
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 text-sm rounded-lg cursor-pointer transition mb-2 select-none">
                    Upload .txt file
                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => setImportData(evt.target.result);
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder={
                    mode === 'text'
                      ? "Commander:\n1 Atraxa, Praetors' Voice\n\nDeck:\n1 Sol Ring\n1 Command Tower\n..."
                      : mode === 'arena'
                      ? "Commander\n1 Atraxa, Praetors' Voice (NEO) 15\n\nDeck\n1 Sol Ring (AFC) 263\n..."
                      : `https://${mode === 'mtggoldfish' ? 'mtggoldfish.com' : mode + '.com'}/decks/...`
                  }
                  className="w-full h-64 px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono text-sm"
                />
              </div>

              {importError && <ErrorBanner messages={[importError]} />}
              {validationWarnings.length > 0 && <WarningBanner messages={validationWarnings} />}

              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:bg-gray-600"
              >
                {loading ? 'Importing...' : 'Import & Validate Deck'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default DeckImport;

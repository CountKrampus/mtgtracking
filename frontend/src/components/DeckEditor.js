import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const CATEGORY_ORDER = ['Planeswalker', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Other'];

const CATEGORY_STYLES = {
  Planeswalker: { text: 'text-amber-400',  border: 'border-amber-500/40',  bg: 'bg-amber-500/10'  },
  Creature:     { text: 'text-green-400',  border: 'border-green-500/40',  bg: 'bg-green-500/10'  },
  Instant:      { text: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10'   },
  Sorcery:      { text: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10'    },
  Enchantment:  { text: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
  Artifact:     { text: 'text-gray-300',   border: 'border-gray-500/40',   bg: 'bg-gray-500/10'   },
  Land:         { text: 'text-yellow-500', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  Other:        { text: 'text-white/60',   border: 'border-white/20',      bg: 'bg-white/5'       },
};

function getCategory(card) {
  for (const cat of CATEGORY_ORDER) {
    if (cat === 'Other') return 'Other';
    if ((card.types || []).includes(cat)) return cat;
  }
  return 'Other';
}

// ── Scryfall card search for adding cards not in collection ───────────────────
function ScryfallCardSearch({ onAddCard }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = React.useRef(null);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
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

  const selectCard = async (name) => {
    setQuery('');
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
      const card = res.data;
      const face = card.card_faces?.[0] || card;
      onAddCard({
        scryfallId: card.id,
        name: card.name,
        manaCost: face.mana_cost || card.mana_cost || '',
        types: (face.type_line || card.type_line || '').split('—')[0].trim().split(' ').filter(Boolean),
        colors: card.colors || face.colors || [],
        imageUrl: face.image_uris?.normal || card.image_uris?.normal || '',
        quantity: 1,
      });
    } catch {
      alert(`Could not find "${name}" on Scryfall`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mb-3">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="Search Scryfall to add any card..."
        className="w-full px-3 py-2 bg-white/10 border border-purple-500/50 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
      />
      {loading && <div className="absolute right-3 top-2.5 text-white/40 text-xs">Loading...</div>}
      {suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map(name => (
            <button
              key={name}
              onClick={() => selectCard(name)}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main DeckEditor ───────────────────────────────────────────────────────────
function DeckEditor({ deck, onSave, onCancel }) {
  const [deckName, setDeckName]   = useState(deck.name);
  const [mainDeck, setMainDeck]   = useState(deck.mainDeck ? [...deck.mainDeck] : []);
  const [collection, setCollection] = useState([]);
  const [collFilter, setCollFilter] = useState('');
  const [saving, setSaving]       = useState(false);

  // Load user's collection
  useEffect(() => {
    axios.get(`${API_URL}/cards`)
      .then(res => setCollection(res.data))
      .catch(() => {});
  }, []);

  // ── Deck helpers ────────────────────────────────────────────────────────────
  const totalCardCount = useMemo(
    () => mainDeck.reduce((sum, c) => sum + (c.quantity || 1), 0),
    [mainDeck]
  );

  const deckCardIndex = useMemo(() => {
    const idx = {};
    mainDeck.forEach((c, i) => { idx[c.scryfallId] = i; });
    return idx;
  }, [mainDeck]);

  const addCard = useCallback((card) => {
    setMainDeck(prev => {
      const existing = prev.findIndex(c => c.scryfallId === card.scryfallId);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: (updated[existing].quantity || 1) + 1 };
        return updated;
      }
      return [...prev, { ...card, quantity: 1 }];
    });
  }, []);

  const removeCard = useCallback((scryfallId) => {
    setMainDeck(prev => {
      const existing = prev.findIndex(c => c.scryfallId === scryfallId);
      if (existing === -1) return prev;
      const current = prev[existing];
      if ((current.quantity || 1) > 1) {
        const updated = [...prev];
        updated[existing] = { ...current, quantity: current.quantity - 1 };
        return updated;
      }
      return prev.filter((_, i) => i !== existing);
    });
  }, []);

  const removeCardFully = useCallback((scryfallId) => {
    setMainDeck(prev => prev.filter(c => c.scryfallId !== scryfallId));
  }, []);

  // ── Collection filtering ─────────────────────────────────────────────────────
  const filteredCollection = useMemo(() => {
    const q = collFilter.toLowerCase();
    return collection.filter(c => {
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        (c.types || []).some(t => t.toLowerCase().includes(q))
      );
    });
  }, [collection, collFilter]);

  // ── Categorized deck ────────────────────────────────────────────────────────
  const categorizedDeck = useMemo(() => {
    const cats = {};
    mainDeck.forEach(card => {
      const cat = getCategory(card);
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(card);
    });
    return cats;
  }, [mainDeck]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!deckName.trim()) { alert('Deck name cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/decks/${deck._id}`, {
        ...deck,
        name: deckName.trim(),
        mainDeck,
      });
      onSave(res.data);
    } catch (error) {
      alert('Error saving deck: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const counterColor =
    totalCardCount > 100 ? 'text-red-400' :
    totalCardCount === 100 ? 'text-green-400' : 'text-yellow-400';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <span className={`text-lg font-bold flex-shrink-0 ${counterColor}`}>
          {totalCardCount}/100
        </span>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold transition text-sm"
          >
            {saving ? 'Saving...' : 'Save Deck'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left: Collection + Scryfall search ───────────────────────────── */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
          <h3 className="text-base font-bold text-white mb-3">Add Cards</h3>

          {/* Scryfall search for any card */}
          <ScryfallCardSearch onAddCard={addCard} />

          {/* Collection filter */}
          <input
            type="text"
            value={collFilter}
            onChange={e => setCollFilter(e.target.value)}
            placeholder="Filter your collection..."
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm mb-2"
          />

          <div className="text-white/40 text-xs mb-2">
            Your collection ({filteredCollection.length} cards)
          </div>

          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {filteredCollection.length === 0 && (
              <div className="text-white/30 text-sm text-center py-6 italic">
                {collection.length === 0 ? 'Loading collection...' : 'No matching cards'}
              </div>
            )}
            {filteredCollection.map((card, idx) => {
              const inDeck = deckCardIndex[card.scryfallId] !== undefined;
              return (
                <button
                  key={idx}
                  onClick={() => addCard({
                    scryfallId: card.scryfallId,
                    name: card.name,
                    manaCost: card.manaCost || '',
                    types: card.types || [],
                    colors: card.colors || [],
                    imageUrl: card.imageUrl || '',
                    quantity: 1,
                  })}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition ${
                    inDeck
                      ? 'bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="text-white truncate flex-1">{card.name}</span>
                  <span className="text-white/40 text-xs flex-shrink-0">{card.manaCost}</span>
                  {inDeck && <span className="text-purple-400 text-xs flex-shrink-0">in deck</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Current deck list ─────────────────────────────────────── */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
          <h3 className="text-base font-bold text-white mb-3">
            Deck Contents
            {deck.commander && (
              <span className="ml-2 text-sm font-normal text-white/50">
                Commander: {deck.commander.name}
              </span>
            )}
          </h3>

          {mainDeck.length === 0 ? (
            <div className="text-white/30 text-sm text-center py-10 italic">
              Click cards on the left to add them to your deck.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {CATEGORY_ORDER.filter(cat => categorizedDeck[cat]?.length > 0).map(cat => {
                const cards = categorizedDeck[cat];
                const style = CATEGORY_STYLES[cat];
                const catTotal = cards.reduce((s, c) => s + (c.quantity || 1), 0);
                return (
                  <div key={cat} className={`rounded-lg border ${style.border} overflow-hidden`}>
                    {/* Category header */}
                    <div className={`flex items-center justify-between px-3 py-1.5 ${style.bg}`}>
                      <span className={`font-semibold text-xs uppercase tracking-wide ${style.text}`}>
                        {cat === 'Other' ? 'Other' : `${cat}s`}
                      </span>
                      <span className="text-white/50 text-xs">{catTotal}</span>
                    </div>

                    {/* Cards */}
                    <div className="divide-y divide-white/5">
                      {cards.map((card, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-white/5">
                          {/* Quantity control */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => removeCard(card.scryfallId)}
                              className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-red-500/30 rounded text-white/60 hover:text-red-300 transition text-xs"
                            >
                              −
                            </button>
                            <span className="text-white font-medium w-4 text-center text-xs">
                              {card.quantity || 1}
                            </span>
                            <button
                              onClick={() => addCard(card)}
                              className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-green-500/30 rounded text-white/60 hover:text-green-300 transition text-xs"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-white truncate flex-1">{card.name}</span>
                          <span className="text-white/30 text-xs flex-shrink-0">{card.manaCost}</span>

                          {/* Remove entirely */}
                          <button
                            onClick={() => removeCardFully(card.scryfallId)}
                            className="text-red-400/60 hover:text-red-400 text-xs flex-shrink-0 ml-1 transition"
                            title="Remove card from deck"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeckEditor;

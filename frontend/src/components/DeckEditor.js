import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

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
function ScryfallCardSearch({ onAddCard, commander = false }) {
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
      const deckCard = {
        scryfallId: card.id,
        name: card.name,
        manaCost: face.mana_cost || card.mana_cost || '',
        types: (face.type_line || card.type_line || '').split('—')[0].trim().split(' ').filter(Boolean),
        colors: card.colors || face.colors || [],
        imageUrl: face.image_uris?.normal || card.image_uris?.normal || '',
        quantity: 1,
      };
      onAddCard(commander ? {
        ...deckCard,
        colorIdentity: card.color_identity || [],
        oracleText: card.oracle_text || face.oracle_text || '',
        flavorText: card.flavor_text || face.flavor_text || '',
        typeLine: card.type_line || face.type_line || '',
        power: card.power || face.power || '',
        toughness: card.toughness || face.toughness || '',
      } : deckCard);
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
        placeholder={commander ? 'Search Scryfall for your commander...' : 'Search Scryfall to add any card...'}
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
  const [deckName, setDeckName]       = useState(deck.name);
  const [mainDeck, setMainDeck]       = useState(deck.mainDeck ? [...deck.mainDeck] : []);
  const [commander, setCommander]     = useState(deck.commander?.name ? { ...deck.commander } : null);
  const [commanderSearchOpen, setCommanderSearchOpen] = useState(!deck.commander?.name);
  const [sideboard, setSideboard]     = useState(deck.sideboard ? [...deck.sideboard] : []);
  const [considering, setConsidering] = useState(deck.considering ? [...deck.considering] : []);
  const [deckListTab, setDeckListTab] = useState('main'); // 'main' | 'sideboard' | 'considering'
  const [collection, setCollection]   = useState([]);
  const [collFilter, setCollFilter]   = useState('');
  const [saving, setSaving]           = useState(false);
  const requiresCommander = deck.format === 'commander';

  // Helpers to get/set the active list
  const activeList = deckListTab === 'sideboard' ? sideboard : deckListTab === 'considering' ? considering : mainDeck;
  const setActiveList = deckListTab === 'sideboard' ? setSideboard : deckListTab === 'considering' ? setConsidering : setMainDeck;

  // Load user's collection
  useEffect(() => {
    axios.get(`${API_URL}/cards`)
      .then(res => setCollection(res.data))
      .catch(() => {});
  }, []);

  // ── Deck helpers ────────────────────────────────────────────────────────────
  const totalCardCount = useMemo(() => {
    const mainCount = mainDeck.reduce((sum, c) => sum + (c.quantity || 1), 0);
    const commanderCount = (commander?.name ? 1 : 0) + (deck.partnerCommander?.name ? 1 : 0);
    return mainCount + commanderCount;
  }, [mainDeck, commander, deck.partnerCommander]);

  const deckCardIndex = useMemo(() => {
    const idx = {};
    activeList.forEach((c, i) => { idx[c.scryfallId] = i; });
    return idx;
  }, [activeList]);

  const addCard = useCallback((card) => {
    if (
      requiresCommander &&
      commander?.name &&
      card.name?.trim().toLowerCase() === commander.name.trim().toLowerCase()
    ) {
      alert('Your commander belongs in the commander slot, not in the 99.');
      return;
    }
    setActiveList(prev => {
      const existing = prev.findIndex(c => c.scryfallId === card.scryfallId);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: (updated[existing].quantity || 1) + 1 };
        return updated;
      }
      return [...prev, { ...card, quantity: 1 }];
    });
  }, [setActiveList, requiresCommander, commander]);

  const selectCommander = useCallback((card) => {
    setCommander(card);
    setCommanderSearchOpen(false);
    const commanderName = card.name?.trim().toLowerCase();
    setMainDeck(prev => {
      const index = prev.findIndex(existing => existing.name?.trim().toLowerCase() === commanderName);
      if (index === -1) return prev;
      const next = [...prev];
      const quantity = next[index].quantity || 1;
      if (quantity > 1) next[index] = { ...next[index], quantity: quantity - 1 };
      else next.splice(index, 1);
      return next;
    });
  }, []);

  const removeCard = useCallback((scryfallId) => {
    setActiveList(prev => {
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
  }, [setActiveList]);

  const removeCardFully = useCallback((scryfallId) => {
    setActiveList(prev => prev.filter(c => c.scryfallId !== scryfallId));
  }, [setActiveList]);

  // ── Drag-and-drop: drag a collection card onto the deck list ─────────────────
  const buildDeckCard = useCallback((card) => ({
    scryfallId: card.scryfallId,
    name: card.name,
    manaCost: card.manaCost || '',
    types: card.types || [],
    colors: card.colors || [],
    imageUrl: card.imageUrl || '',
    quantity: 1,
  }), []);

  const handleCardDragStart = useCallback((e, card) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(buildDeckCard(card)));
  }, [buildDeckCard]);

  const handleDeckDrop = useCallback((e) => {
    e.preventDefault();
    try {
      const card = JSON.parse(e.dataTransfer.getData('application/json'));
      if (card && card.scryfallId) addCard(card);
    } catch {
      // ignore invalid drops
    }
  }, [addCard]);

  // ── Commander color identity (for auto-filtering collection) ─────────────────
  const commanderColorIdentity = useMemo(() => {
    const ids = new Set([
      ...(commander?.colorIdentity || []),
      ...(deck.partnerCommander?.colorIdentity || []),
    ]);
    return Array.from(ids);
  }, [commander, deck.partnerCommander]);

  // ── Collection filtering ─────────────────────────────────────────────────────
  const filteredCollection = useMemo(() => {
    const q = collFilter.toLowerCase();
    return collection.filter(c => {
      // Text filter
      if (q && !(
        c.name?.toLowerCase().includes(q) ||
        (c.types || []).some(t => t.toLowerCase().includes(q))
      )) {
        return false;
      }
      // Commander color identity filter: card colors must be within commander identity
      if (commanderColorIdentity.length > 0) {
        const cardColors = c.colors || [];
        if (cardColors.length > 0 && !cardColors.every(col => commanderColorIdentity.includes(col))) {
          return false;
        }
      }
      return true;
    });
  }, [collection, collFilter, commanderColorIdentity]);

  // ── Categorized deck ────────────────────────────────────────────────────────
  const categorizedDeck = useMemo(() => {
    const cats = {};
    activeList.forEach(card => {
      const cat = getCategory(card);
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(card);
    });
    return cats;
  }, [activeList]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!deckName.trim()) { alert('Deck name cannot be empty'); return; }
    if (requiresCommander && !commander?.name) {
      alert('Select a commander before building the rest of your Commander deck.');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/decks/${deck._id}`, {
        ...deck,
        name: deckName.trim(),
        commander,
        mainDeck,
        sideboard,
        considering,
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
        <span className={`text-lg font-bold flex-shrink-0 ${counterColor}`} title="Main deck + commander">
          {totalCardCount}/100
        </span>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || (requiresCommander && !commander?.name)}
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

      {requiresCommander && (
        <div className="bg-purple-900/20 border border-purple-500/40 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-base font-bold text-white">Commander</h3>
              <p className="text-xs text-white/60">
                {commander?.name
                  ? 'Your commander is separate from the 99-card main deck.'
                  : 'Choose your commander first. Then you can add the other 99 cards.'}
              </p>
            </div>
            {commander?.name && !commanderSearchOpen && (
              <button
                onClick={() => setCommanderSearchOpen(true)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition"
              >
                Change
              </button>
            )}
          </div>
          {commander?.name && (
            <div className="flex items-center gap-3 mb-3">
              {commander.imageUrl && (
                <img src={commander.imageUrl} alt="" className="w-10 h-14 object-cover rounded" />
              )}
              <div>
                <div className="text-white font-semibold">{commander.name}</div>
                <div className="text-white/50 text-xs">{commander.typeLine}</div>
              </div>
            </div>
          )}
          {commanderSearchOpen && (
            <ScryfallCardSearch onAddCard={selectCommander} commander />
          )}
        </div>
      )}

      {requiresCommander && !commander?.name ? (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20 text-center">
          <h3 className="text-lg font-bold text-white mb-2">Select your commander to begin</h3>
          <p className="text-sm text-white/60">
            Search for your commander above. It will be saved separately from the 99 cards in your deck.
          </p>
        </div>
      ) : (
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

          {commanderColorIdentity.length > 0 && (
            <div className="px-3 py-2 bg-blue-900/30 border border-blue-600/50 rounded text-xs text-blue-300 mb-2">
              Filtered to commander color identity: {commanderColorIdentity.join('')}
            </div>
          )}

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
                  draggable
                  onDragStart={(e) => handleCardDragStart(e, card)}
                  onClick={() => addCard(buildDeckCard(card))}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition cursor-grab active:cursor-grabbing ${
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

        {/* ── Right: Current deck list (drop zone) ─────────────────────────── */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDeckDrop}
          className="bg-white/10 backdrop-blur-md rounded-lg p-4 border-2 border-dashed border-white/30 hover:border-purple-500/60 transition"
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex rounded-lg overflow-hidden border border-white/20 text-xs font-medium">
              {[
                { key: 'main', label: `Main (${mainDeck.reduce((s,c)=>s+(c.quantity||1),0)})` },
                { key: 'sideboard', label: `Side (${sideboard.reduce((s,c)=>s+(c.quantity||1),0)})` },
                { key: 'considering', label: `Maybe (${considering.reduce((s,c)=>s+(c.quantity||1),0)})` },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setDeckListTab(t.key)}
                  className={`px-3 py-1.5 transition ${deckListTab === t.key ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {commander?.name && (
              <span className="text-xs text-white/40 truncate">Cmdr: {commander.name}</span>
            )}
          </div>

          {activeList.length === 0 ? (
            <div className="text-white/30 text-sm text-center py-10 italic">
              {deckListTab === 'main' && 'Click or drag cards from the left to add them to your deck.'}
              {deckListTab === 'sideboard' && 'Add cards here for your sideboard.'}
              {deckListTab === 'considering' && 'Add cards here that you\'re thinking about including.'}
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
      )}
    </div>
  );
}

export default DeckEditor;

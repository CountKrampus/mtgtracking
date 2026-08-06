import React, { useState } from 'react';
import { X, Crown, Search, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function CommanderRecommendationsModal({ isOpen, onClose, cards, fetchCards }) {
  const [commanderRecs, setCommanderRecs] = useState([]);
  const [loadingCommanders, setLoadingCommanders] = useState(false);
  const [commanderColorFilter, setCommanderColorFilter] = useState('auto');
  const [commanderFinderMode, setCommanderFinderMode] = useState('collection'); // 'collection' | 'finder'
  const [finderColors, setFinderColors] = useState([]);
  const [finderThemes, setFinderThemes] = useState([]);
  const [finderCreatureType, setFinderCreatureType] = useState('');

  const getCommanderRecommendations = async () => {
    setLoadingCommanders(true);
    setCommanderRecs([]);

    try {
      const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      const themeCounts = {};

      cards.forEach(card => {
        if (card.colors) {
          card.colors.forEach(color => {
            const c = color[0].toUpperCase();
            if (colorCounts[c] !== undefined) {
              colorCounts[c] += card.quantity;
            }
          });
        }

        const oracleText = (card.oracleText || '').toLowerCase();
        const themes = [
          { name: 'tokens', patterns: [/create.*token/, /token.*creature/] },
          { name: 'graveyard', patterns: [/from.*graveyard/, /into.*graveyard/, /mill/] },
          { name: 'counters', patterns: [/\+1\/\+1 counter/, /proliferate/] },
          { name: 'lifegain', patterns: [/gain.*life/, /lifelink/] },
          { name: 'sacrifice', patterns: [/sacrifice.*creature/, /when.*dies/] },
          { name: 'spellslinger', patterns: [/instant.*sorcery/, /when.*cast.*spell/] },
          { name: 'artifacts', patterns: [/artifact.*enter/, /artifact.*you.*control/] },
          { name: 'enchantments', patterns: [/enchantment.*enter/, /constellation/] },
          { name: 'tribal', patterns: [/creature.*type/, /creatures.*you.*control.*get/] },
          { name: 'ramp', patterns: [/add.*mana/, /search.*land/] },
          { name: 'draw', patterns: [/draw.*card/, /whenever.*draw/] },
          { name: 'control', patterns: [/counter.*spell/, /destroy.*target/, /exile.*target/] }
        ];

        themes.forEach(({ name, patterns }) => {
          if (patterns.some(p => p.test(oracleText))) {
            themeCounts[name] = (themeCounts[name] || 0) + card.quantity;
          }
        });
      });

      let colorQuery = '';
      if (commanderColorFilter === 'auto') {
        const sortedColors = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .filter(([_, count]) => count > 0);

        if (sortedColors.length >= 2) {
          const topColors = sortedColors.slice(0, 3).map(([c]) => c.toLowerCase());
          colorQuery = `id:${topColors.join('')}`;
        }
      } else if (commanderColorFilter !== 'all') {
        colorQuery = `id:${commanderColorFilter}`;
      }

      const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
      let themeQuery = '';
      if (topTheme) {
        const themeSearches = {
          tokens: 'o:"create" o:"token"',
          graveyard: 'o:"graveyard"',
          counters: 'o:"+1/+1 counter"',
          lifegain: 'o:"gain" o:"life"',
          sacrifice: 'o:"sacrifice"',
          spellslinger: 'o:"instant" o:"sorcery"',
          artifacts: 'o:"artifact"',
          enchantments: 'o:"enchantment"',
          tribal: 'o:"creature" o:"type"',
          ramp: 'o:"add" o:"mana"',
          draw: 'o:"draw" o:"card"',
          control: 'o:"counter" OR o:"destroy"'
        };
        themeQuery = themeSearches[topTheme[0]] || '';
      }

      const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error getting commander recommendations:', error);
      try {
        const response = await axios.get(
          'https://api.scryfall.com/cards/search?q=t:legendary+t:creature&order=edhrec&unique=cards'
        );
        setCommanderRecs(response.data.data.slice(0, 20));
      } catch (e) {
        setCommanderRecs([]);
      }
    } finally {
      setLoadingCommanders(false);
    }
  };

  const addCommanderToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;

      await axios.post(`${API_URL}/cards`, {
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber,
        rarity: cardData.rarity,
        quantity: 1,
        condition: 'NM',
        price: cardData.prices?.usd || 0,
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText,
        tags: ['commander'],
        location: ''
      });

      alert(`Added ${cardData.name} to your collection!`);
      fetchCards();
    } catch (error) {
      console.error('Error adding commander:', error);
      alert('Error adding commander to collection');
    }
  };

  const searchCommandersByPreference = async () => {
    setLoadingCommanders(true);
    setCommanderRecs([]);

    const themeSearches = {
      tokens: 'o:"create" o:"token"',
      graveyard: 'o:"graveyard"',
      counters: 'o:"+1/+1 counter"',
      lifegain: 'o:"gain" o:"life"',
      sacrifice: 'o:"sacrifice"',
      spellslinger: '(o:"instant" o:"sorcery")',
      artifacts: 'o:"artifact"',
      enchantments: 'o:"enchantment"',
      tribal: 'o:"creature you control"',
      ramp: 'o:"search your library" o:"land"',
      draw: 'o:"draw" o:"card"',
      control: '(o:"counter target" OR o:"destroy target")',
      voltron: '(o:"equip" OR o:"aura" OR o:"attach")',
      mill: 'o:"mill"',
      blink: '(o:"exile" o:"return" o:"battlefield")',
      stax: '(o:"can\'t" OR o:"don\'t untap")',
      grouphug: '(o:"each player" o:"draw")',
      aristocrats: '(o:"when" o:"dies")',
      storm: '(o:"copy" o:"spell")',
      landfall: 'o:"landfall"',
    };

    try {
      let parts = ['t:legendary', 't:creature'];

      if (finderColors.length > 0) {
        parts.push(`id<=${finderColors.join('').toLowerCase()}`);
      }

      const themeQueries = finderThemes.map(t => themeSearches[t]).filter(Boolean);
      if (themeQueries.length === 1) {
        parts.push(themeQueries[0]);
      } else if (themeQueries.length > 1) {
        parts.push(`(${themeQueries.join(' OR ')})`);
      }

      if (finderCreatureType.trim()) {
        parts.push(`t:${finderCreatureType.trim().toLowerCase()}`);
      }

      const searchQuery = parts.join(' ');
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error searching commanders by preference:', error);
      setCommanderRecs([]);
    } finally {
      setLoadingCommanders(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) getCommanderRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setCommanderRecs([]);
    setCommanderFinderMode('collection');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-amber-500">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Crown className="text-amber-500" size={24} /> Commander Recommendations
            </h2>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setCommanderFinderMode('collection')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${commanderFinderMode === 'collection' ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                From Collection
              </button>
              <button
                onClick={() => setCommanderFinderMode('finder')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${commanderFinderMode === 'finder' ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                Commander Finder
              </button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/60 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Mode-specific controls */}
        {commanderFinderMode === 'collection' ? (
          <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center gap-4">
            <span className="text-white/60 text-sm">Filter by color:</span>
            <select
              value={commanderColorFilter}
              onChange={(e) => { setCommanderColorFilter(e.target.value); }}
              className="px-3 py-1 bg-white/20 border border-white/30 rounded text-white text-sm"
            >
              <option value="auto">Auto (based on collection)</option>
              <option value="all">All Colors</option>
              <option value="w">White</option>
              <option value="u">Blue</option>
              <option value="b">Black</option>
              <option value="r">Red</option>
              <option value="g">Green</option>
              <option value="wubrg">5-Color</option>
            </select>
            <button
              onClick={getCommanderRecommendations}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm transition"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 bg-white/5 border-b border-white/10 space-y-3">
            {/* Color Identity Picker */}
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm w-24 shrink-0">Colors:</span>
              <div className="flex gap-2">
                {[
                  { code: 'W', label: 'W', bg: 'bg-yellow-100', active: 'bg-yellow-300 ring-2 ring-yellow-400', text: 'text-yellow-900' },
                  { code: 'U', label: 'U', bg: 'bg-blue-200', active: 'bg-blue-400 ring-2 ring-blue-500', text: 'text-blue-900' },
                  { code: 'B', label: 'B', bg: 'bg-gray-400', active: 'bg-gray-600 ring-2 ring-gray-500', text: 'text-gray-100' },
                  { code: 'R', label: 'R', bg: 'bg-red-200', active: 'bg-red-500 ring-2 ring-red-400', text: 'text-red-900' },
                  { code: 'G', label: 'G', bg: 'bg-green-200', active: 'bg-green-500 ring-2 ring-green-400', text: 'text-green-900' },
                ].map(({ code, label, bg, active, text }) => (
                  <button
                    key={code}
                    onClick={() => setFinderColors(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
                    className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center transition ${text} ${finderColors.includes(code) ? active : `${bg} opacity-40 hover:opacity-70`}`}
                    title={code === 'W' ? 'White' : code === 'U' ? 'Blue' : code === 'B' ? 'Black' : code === 'R' ? 'Red' : 'Green'}
                  >
                    {label}
                  </button>
                ))}
                {finderColors.length > 0 && (
                  <button
                    onClick={() => setFinderColors([])}
                    className="px-2 py-1 text-white/40 hover:text-white/70 text-xs transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              {finderColors.length === 0 && <span className="text-white/40 text-xs">Any color</span>}
            </div>

            {/* Strategy/Theme Selector */}
            <div className="flex items-start gap-3">
              <span className="text-white/60 text-sm w-24 shrink-0 pt-1">Themes:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'tokens', 'graveyard', 'counters', 'lifegain', 'sacrifice',
                  'spellslinger', 'artifacts', 'enchantments', 'tribal', 'ramp',
                  'draw', 'control', 'voltron', 'mill', 'blink',
                  'stax', 'grouphug', 'aristocrats', 'storm', 'landfall'
                ].map(theme => (
                  <button
                    key={theme}
                    onClick={() => setFinderThemes(prev => prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme])}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${finderThemes.includes(theme) ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                  >
                    {theme === 'grouphug' ? 'Group Hug' : theme === 'counters' ? '+1/+1 Counters' : theme === 'blink' ? 'Blink/Flicker' : theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Creature Type Input + Search Button */}
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm w-24 shrink-0">Type:</span>
              <input
                type="text"
                value={finderCreatureType}
                onChange={(e) => setFinderCreatureType(e.target.value)}
                placeholder="e.g. Dragon, Elf, Zombie (optional)"
                className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30 w-64"
                onKeyDown={(e) => { if (e.key === 'Enter') searchCommandersByPreference(); }}
              />
              <button
                onClick={searchCommandersByPreference}
                className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium transition flex items-center gap-1.5"
              >
                <Search size={14} /> Search
              </button>
            </div>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {loadingCommanders ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={48} className="text-amber-500 animate-spin mb-4" />
              <p className="text-white/60">{commanderFinderMode === 'collection' ? 'Analyzing your collection and finding commanders...' : 'Searching for commanders...'}</p>
            </div>
          ) : commanderRecs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60">{commanderFinderMode === 'collection' ? 'No commanders found. Try adjusting the color filter.' : 'Select colors, themes, or a creature type and click Search.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {commanderRecs.map((card) => (
                <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                  {card.image_uris?.normal ? (
                    <img src={card.image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                  ) : card.card_faces?.[0]?.image_uris?.normal ? (
                    <img src={card.card_faces[0].image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                  ) : (
                    <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                      <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                    <p className="text-white/60 text-xs truncate">{card.type_line?.replace('Legendary ', '')}</p>
                    <p className="text-green-400 text-sm mt-1">${card.prices?.usd || '0.00'}</p>
                    <button
                      onClick={() => addCommanderToCollection(card)}
                      className="w-full mt-2 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition"
                    >
                      + Add to Collection
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <p className="text-white/40 text-xs text-center">
            {commanderFinderMode === 'collection' ? 'Recommendations based on your collection\'s colors and card themes' : 'Search results based on your selected preferences'} â€¢ Sorted by EDHREC popularity
          </p>
        </div>
      </div>
    </div>
  );
}

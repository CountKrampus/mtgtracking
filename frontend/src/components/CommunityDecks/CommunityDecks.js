import React, { useState, useEffect, useCallback } from 'react';
import { Search, Globe } from 'lucide-react';
import { API_URL } from '../../config';
import SharedDeckView from './SharedDeckView';
import { COLOR_PIPS, FORMAT_COLORS } from './deckConstants';

const FORMATS = ['commander', 'standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'draft', 'oathbreaker', 'other'];
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const COLOR_LABELS = { W: '☀️ White', U: '💧 Blue', B: '💀 Black', R: '🔥 Red', G: '🌲 Green' };

function DeckCard({ deck, onView }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/40 transition group">
      {deck.commander?.imageUrl ? (
        <div className="h-24 overflow-hidden relative">
          <img src={deck.commander.imageUrl} alt="" className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-300" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center text-4xl">
          🃏
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">{deck.name}</h3>
          {deck.format && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 capitalize ${FORMAT_COLORS[deck.format] || FORMAT_COLORS.other}`}>
              {deck.format}
            </span>
          )}
        </div>
        {deck.commander?.name && (
          <p className="text-purple-300 text-xs mb-1 truncate">{deck.commander.name}</p>
        )}
        <p className="text-gray-400 text-xs mb-2">
          by <span className="text-gray-300">@{deck.owner?.username}</span>
        </p>
        <div className="flex items-center gap-2 mb-3">
          {(deck.commander?.colorIdentity || []).map(c => (
            <span key={c} className="text-sm" title={c}>{COLOR_PIPS[c] || c}</span>
          ))}
          {(deck.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-300 rounded">{tag}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span>{deck.cardCount || 0} cards</span>
          {deck.totalValue > 0 && <span>${deck.totalValue.toFixed(2)}</span>}
          {deck.importCount > 0 && <span>↓ {deck.importCount}</span>}
        </div>
        <button
          onClick={() => onView(deck.shareCode)}
          className="w-full py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 hover:text-white rounded-lg text-xs font-medium transition"
        >
          View Deck →
        </button>
      </div>
    </div>
  );
}

function CommunityDecks() {
  const [decks, setDecks] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [viewingShareCode, setViewingShareCode] = useState(null);

  // Filters
  const [format, setFormat] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [commander, setCommander] = useState('');
  const [commanderInput, setCommanderInput] = useState('');
  const [tags, setTags] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [sort, setSort] = useState('imported');

  const fetchDecks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    if (selectedColors.length) params.set('colors', selectedColors.join(','));
    if (commander) params.set('commander', commander);
    if (tags) params.set('tags', tags);
    params.set('sort', sort);
    params.set('page', page);

    fetch(`${API_URL}/decks/community?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then(d => { setDecks(d.decks || []); setTotal(d.total || 0); setPages(d.pages || 1); setLoading(false); })
      .catch(e => { setError(e.message || 'Failed to load decks'); setLoading(false); });
  }, [format, selectedColors, commander, tags, sort, page]);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  // Debounce commander input
  useEffect(() => {
    const t = setTimeout(() => { setCommander(commanderInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [commanderInput]);

  // Debounce tags input
  useEffect(() => {
    const t = setTimeout(() => { setTags(tagsInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [tagsInput]);

  const toggleColor = (c) => {
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setPage(1);
  };

  if (viewingShareCode) {
    return (
      <div>
        <div className="p-4">
          <button onClick={() => setViewingShareCode(null)} className="text-purple-300 hover:text-white text-sm transition">
            ← Back to Community
          </button>
        </div>
        <SharedDeckView shareCode={viewingShareCode} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={22} className="text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Community Decks</h1>
        {total > 0 && <span className="text-gray-400 text-sm">{total} decks</span>}
      </div>

      {/* Filter bar */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Format */}
          <select
            value={format}
            onChange={e => { setFormat(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All Formats</option>
            {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>

          {/* Color toggles */}
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => toggleColor(c)}
                title={COLOR_LABELS[c]}
                className={`w-8 h-8 rounded-lg text-base border transition ${
                  selectedColors.includes(c)
                    ? 'bg-purple-600/50 border-purple-400 shadow-sm'
                    : 'bg-white/5 border-white/10 hover:border-purple-500/40'
                }`}
              >
                {COLOR_PIPS[c]}
              </button>
            ))}
          </div>

          {/* Commander search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Commander name..."
              value={commanderInput}
              onChange={e => setCommanderInput(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg pl-8 pr-3 py-1.5 text-sm w-44"
            />
          </div>

          {/* Tags */}
          <input
            type="text"
            placeholder="Tags (comma-separated)..."
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm w-48"
          />

          {/* Sort */}
          <select
            value={sort}
            onChange={e => { setSort(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm ml-auto"
          >
            <option value="newest">Newest</option>
            <option value="imported">Most Popular</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading decks...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-16">{error}</div>
      ) : decks.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="text-xl mb-2">No decks found</p>
          <p className="text-sm">Try adjusting your filters, or share your own deck!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {decks.map(deck => (
              <DeckCard key={deck._id} deck={deck} onView={setViewingShareCode} />
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-lg text-sm transition"
              >
                ← Previous
              </button>
              <span className="text-gray-400 text-sm">Page {page} of {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-lg text-sm transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CommunityDecks;

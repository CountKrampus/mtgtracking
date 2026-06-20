import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { useAuthContext } from '../../contexts/AuthContext';

const COLOR_PIPS = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲' };
const FORMAT_COLORS = {
  commander: 'bg-purple-600/30 text-purple-300 border-purple-500/40',
  standard:  'bg-blue-600/30 text-blue-300 border-blue-500/40',
  modern:    'bg-green-600/30 text-green-300 border-green-500/40',
  pioneer:   'bg-teal-600/30 text-teal-300 border-teal-500/40',
  legacy:    'bg-amber-600/30 text-amber-300 border-amber-500/40',
  vintage:   'bg-red-600/30 text-red-300 border-red-500/40',
  pauper:    'bg-gray-600/30 text-gray-300 border-gray-500/40',
  draft:     'bg-orange-600/30 text-orange-300 border-orange-500/40',
  other:     'bg-slate-600/30 text-slate-300 border-slate-500/40',
};
const TYPE_ORDER = ['Commander', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'];

function groupByType(mainDeck) {
  const groups = {};
  TYPE_ORDER.forEach(t => { groups[t] = []; });
  (mainDeck || []).forEach(card => {
    const type = TYPE_ORDER.find(t => (card.types || []).includes(t)) || 'Other';
    groups[type].push(card);
  });
  return groups;
}

function SharedDeckView({ shareCode }) {
  const { user: authUser, authFetch } = useAuthContext();
  const [deck, setDeck] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/decks/shared/${shareCode}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.message)))
      .then(data => { setDeck(data.deck); setOwner(data.owner); setLoading(false); })
      .catch(e => { setError(typeof e === 'string' ? e : (e?.message || 'Unknown error')); setLoading(false); });
  }, [shareCode]);

  const handleImport = async () => {
    if (!authUser) { setImportMsg('Log in to import decks.'); return; }
    setImporting(true);
    try {
      const res = await authFetch(`${API_URL}/decks/community/${shareCode}/import`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg('✅ Deck imported! Open your Deck Builder to view it.');
      } else {
        setImportMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setImportMsg(`❌ Error: ${e.message}`);
    }
    setImporting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center text-white text-xl">
      Loading deck...
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center text-red-400 text-xl">
      {error === 'Deck not found' ? '🔍 Deck not found or no longer shared.' : `Error: ${error}`}
    </div>
  );

  const groups = groupByType(deck.mainDeck);
  const colorIdentity = deck.commander?.colorIdentity || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="relative overflow-hidden">
        {deck.commander?.imageUrl && (
          <div className="absolute inset-0 opacity-20">
            <img src={deck.commander.imageUrl} alt="" className="w-full h-full object-cover object-top blur-sm scale-110" />
          </div>
        )}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-start gap-6">
            {deck.commander?.imageUrl && (
              <img src={deck.commander.imageUrl} alt={deck.commander.name}
                className="w-28 rounded-xl shadow-2xl border border-white/20 hidden sm:block flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-white mb-1">{deck.name}</h1>
              {deck.commander?.name && (
                <p className="text-purple-300 text-sm mb-2">Commander: {deck.commander.name}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {deck.format && (
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${FORMAT_COLORS[deck.format] || FORMAT_COLORS.other}`}>
                    {deck.format}
                  </span>
                )}
                {colorIdentity.map(c => (
                  <span key={c} className="text-base" title={c}>{COLOR_PIPS[c] || c}</span>
                ))}
              </div>
              {owner && (
                <p className="text-gray-400 text-sm">
                  by <span className="text-purple-300 font-medium">@{owner.username}</span>
                  {owner.displayName ? ` (${owner.displayName})` : ''}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-400">
                <span>{(deck.mainDeck || []).length} cards</span>
                {deck.totalValue > 0 && <span>${deck.totalValue.toFixed(2)} estimated value</span>}
                {deck.importCount > 0 && <span>Imported {deck.importCount}×</span>}
              </div>
              {deck.description && <p className="text-gray-300 text-sm mt-3 max-w-xl">{deck.description}</p>}
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg"
              >
                {importing ? 'Importing...' : '+ Import to My Decks'}
              </button>
              {importMsg && <p className="text-xs mt-2 text-center max-w-[160px]">{importMsg}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Decklist */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TYPE_ORDER.filter(t => groups[t].length > 0).map(type => (
            <div key={type} className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h3 className="text-white font-semibold text-sm mb-2 border-b border-white/10 pb-1">
                {type} <span className="text-gray-400 font-normal">({groups[type].reduce((s, c) => s + (c.quantity || 1), 0)})</span>
              </h3>
              <ul className="space-y-0.5">
                {groups[type].map((card, i) => (
                  <li key={i} className="text-sm text-gray-300 flex justify-between">
                    <span className="truncate">{card.name}</span>
                    {card.quantity > 1 && <span className="text-gray-500 ml-2 flex-shrink-0">×{card.quantity}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SharedDeckView;

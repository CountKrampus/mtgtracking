import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useWishlist } from '../../contexts/WishlistContext';
import { API_URL } from '../../config';

function MissingCardRow({ card, checked, onToggle }) {
  return (
    <label className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/5 transition-colors cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 flex-shrink-0" />
      {card.image_uris?.normal && (
        <img src={card.image_uris.normal} alt={card.name} className="w-8 h-11 object-cover rounded flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm truncate">{card.name}</div>
        <div className="text-white/40 text-xs truncate">{card.mana_cost || ''}</div>
      </div>
    </label>
  );
}

export default function SetMissingCardsModal({ setCode, setName, ownedCardNames, onClose }) {
  const { wishlistItems, fetchWishlist } = useWishlist();
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedNames, setCheckedNames] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState(null);
  const [partial, setPartial] = useState(false);

  const fetchMissing = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPartial(false);
    let url = `https://api.scryfall.com/cards/search?q=e:${setCode.toLowerCase()}&unique=cards&order=set`;
    const allCards = [];
    try {
      while (url) {
        const res = await axios.get(url);
        allCards.push(...res.data.data);
        url = res.data.has_more ? res.data.next_page : null;
      }
    } catch (err) {
      if (allCards.length > 0) {
        setPartial(true);
      } else {
        setError(err.response?.data?.details || 'Failed to load set card list. Please try again.');
      }
    } finally {
      const missingCards = allCards.filter(c => !ownedCardNames.has(c.name));
      setMissing(missingCards);
      setCheckedNames(new Set(missingCards.map(c => c.name)));
      setLoading(false);
    }
  }, [setCode, ownedCardNames]);

  useEffect(() => { fetchMissing(); }, [fetchMissing]);

  const toggleCard = (name) => {
    setCheckedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectAll = () => setCheckedNames(new Set(missing.map(c => c.name)));
  const selectNone = () => setCheckedNames(new Set());

  const handleAddSelected = async () => {
    setAdding(true);
    const wishlistNames = new Set(wishlistItems.map(w => w.name));
    const toAdd = missing.filter(c => checkedNames.has(c.name));
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const card of toAdd) {
      if (wishlistNames.has(card.name)) {
        skipped++;
        continue;
      }
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: card.name,
          set: card.set_name || '',
          setCode: card.set?.toUpperCase() || '',
          scryfallId: card.id,
          imageUrl: card.image_uris?.normal || '',
          colors: card.colors || [],
          types: card.type_line ? card.type_line.split('—')[0].trim().split(' ') : [],
          manaCost: card.mana_cost || '',
          rarity: card.rarity ? card.rarity[0].toUpperCase() : '',
          targetPrice: 0,
          currentPrice: card.prices?.usd ? parseFloat(card.prices.usd) : 0,
          priority: 'medium',
          notes: '',
          quantity: 1,
          condition: 'NM',
          oracleText: card.oracle_text || ''
        });
        added++;
      } catch {
        failed++;
      }
    }

    await fetchWishlist();
    setAdding(false);
    setResult({ added, skipped, failed });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">Missing from {setName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={32} className="text-teal-500 animate-spin mb-3" />
              <p className="text-white/60 text-sm">Fetching set card list...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle size={28} className="text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchMissing}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <div className="text-center py-8">
              <p className="text-white text-sm">
                Added {result.added} card{result.added !== 1 ? 's' : ''} to your wishlist
                {result.skipped > 0 && ` (${result.skipped} already on your wishlist were skipped)`}
                {result.failed > 0 && ` — ${result.failed} failed, please try again`}
                .
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && !result && missing.length === 0 && (
            <p className="text-center text-white/60 py-8">
              No missing cards found — every card in this set is already owned.
            </p>
          )}

          {!loading && !error && !result && missing.length > 0 && (
            <>
              {partial && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <span className="text-yellow-300 text-xs">This list may be incomplete — part of the set failed to load.</span>
                  <button onClick={fetchMissing} className="text-xs text-yellow-300 hover:text-yellow-200 font-medium transition">Retry</button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-white/60 text-sm">{checkedNames.size} of {missing.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectAll} className="text-xs text-purple-400 hover:text-purple-300 transition">Select All</button>
                  <button onClick={selectNone} className="text-xs text-purple-400 hover:text-purple-300 transition">Select None</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-0.5 mb-4">
                {missing.map(card => (
                  <MissingCardRow
                    key={card.id}
                    card={card}
                    checked={checkedNames.has(card.name)}
                    onToggle={() => toggleCard(card.name)}
                  />
                ))}
              </div>
              <button
                onClick={handleAddSelected}
                disabled={adding || checkedNames.size === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
              >
                {adding ? 'Adding…' : `Add Selected to Wishlist (${checkedNames.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

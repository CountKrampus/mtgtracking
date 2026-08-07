import React, { useState, useMemo, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import axios from 'axios';
import { useCardCollection } from '../contexts/CardCollectionContext';
import { useWishlist } from '../contexts/WishlistContext';

// Aggregates missing cards across ALL of the user's decks, ranked by how
// many decks each is missing from - the cross-deck insight a single deck's
// own "Collection Ownership" panel can't show. Computed entirely
// client-side from already-loaded deck + collection data, matching
// DeckShellExtractor.js's "Find Staples" pattern (see its own comment for
// why this beats a new backend endpoint). The one exception is price: deck
// mainDeck entries have no price field at all (see backend/models/Deck.js),
// so a single batched Scryfall lookup fills that in after the aggregation.
function DeckShoppingList({ decks = [], onClose }) {
  const { cards } = useCardCollection();
  const { addToWishlist } = useWishlist();
  const [prices, setPrices] = useState({}); // scryfallId -> price
  const [pricesLoaded, setPricesLoaded] = useState(false);

  const candidates = useMemo(() => {
    // ownedNames is built from every collection card, not just ones
    // missing a scryfallId - a deck card can itself lack a scryfallId
    // (never fetched full data) while the same card IS owned under a
    // scryfallId'd printing, and name is still the right fallback there.
    const ownedScryfallIds = new Set();
    const ownedNames = new Set();
    cards.forEach(c => {
      if (c.scryfallId) ownedScryfallIds.add(c.scryfallId);
      ownedNames.add(c.name.toLowerCase());
    });
    const isOwned = (card) =>
      (card.scryfallId && ownedScryfallIds.has(card.scryfallId)) || ownedNames.has((card.name || '').toLowerCase());

    const byKey = new Map();
    decks.forEach(deck => {
      const deckCards = [
        deck.commander,
        ...(deck.partnerCommander?.name ? [deck.partnerCommander] : []),
        ...(deck.mainDeck || [])
      ].filter(Boolean);

      deckCards.forEach(card => {
        if (!card?.name || isOwned(card)) return;
        const key = card.scryfallId || card.name;
        const entry = byKey.get(key) || {
          scryfallId: card.scryfallId,
          name: card.name,
          imageUrl: card.imageUrl,
          manaCost: card.manaCost,
          colors: card.colors,
          types: card.types,
          deckIds: new Set(),
        };
        entry.deckIds.add(deck._id);
        byKey.set(key, entry);
      });
    });

    return [...byKey.values()]
      .map(entry => ({ ...entry, deckCount: entry.deckIds.size }))
      .filter(entry => entry.deckCount >= 2)
      .sort((a, b) => b.deckCount - a.deckCount || a.name.localeCompare(b.name));
  }, [decks, cards]);

  useEffect(() => {
    const ids = candidates.filter(c => c.scryfallId).map(c => c.scryfallId);
    if (ids.length === 0) {
      setPricesLoaded(true);
      return;
    }
    setPricesLoaded(false);
    // Scryfall's collection endpoint accepts up to 75 identifiers per call -
    // chunk defensively even though deckCount >= 2 filtering keeps this list
    // short in practice.
    const chunks = [];
    for (let i = 0; i < ids.length; i += 75) chunks.push(ids.slice(i, i + 75));

    Promise.all(
      chunks.map(chunk =>
        axios.post('https://api.scryfall.com/cards/collection', {
          identifiers: chunk.map(id => ({ id }))
        }).then(res => res.data.data || [])
      )
    )
      .then(results => {
        const flat = results.flat();
        const priceMap = {};
        flat.forEach(card => {
          if (card.prices?.usd) priceMap[card.id] = parseFloat(card.prices.usd);
        });
        setPrices(priceMap);
      })
      .catch(error => {
        console.error('Error fetching shopping list prices:', error);
        // Leave prices empty - the list still renders with name/deckCount.
      })
      .finally(() => setPricesLoaded(true));
    // Only re-fetch when the actual set of candidate ids changes, not on
    // every render (candidates is a new array each render since it's a
    // useMemo result recomputed from decks/cards, but its *content* is
    // usually stable between opens of the same modal instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.map(c => c.scryfallId).join(',')]);

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (b.deckCount !== a.deckCount) return b.deckCount - a.deckCount;
      const aPrice = prices[a.scryfallId];
      const bPrice = prices[b.scryfallId];
      if (aPrice == null && bPrice == null) return a.name.localeCompare(b.name);
      if (aPrice == null) return 1; // no price data sorts last within its deckCount tier
      if (bPrice == null) return -1;
      return aPrice - bPrice;
    });
  }, [candidates, prices]);

  const addCandidateToWishlist = (card) => {
    addToWishlist({
      id: card.scryfallId,
      name: card.name,
      image_uris: { normal: card.imageUrl },
      mana_cost: card.manaCost,
      type_line: (card.types || []).join(' '),
      colors: card.colors,
      prices: { usd: prices[card.scryfallId] },
    }, 'Deck shopping list');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={22} className="text-teal-400" />
            Shopping List
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Cards missing from 2 or more of your decks - buying one of these unlocks
          progress across multiple decks at once.
        </p>

        {sortedCandidates.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No cards are missing from 2 or more of your decks - nothing to consolidate here.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedCandidates.map(card => (
              <div key={card.scryfallId || card.name} className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{card.name}</div>
                  <div className="text-slate-400 text-xs">Missing from {card.deckCount} decks</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-300 text-sm w-16 text-right">
                    {prices[card.scryfallId] != null ? `$${prices[card.scryfallId].toFixed(2)}` : (pricesLoaded ? '—' : '…')}
                  </span>
                  <button
                    onClick={() => addCandidateToWishlist(card)}
                    className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded transition"
                  >
                    + Wishlist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeckShoppingList;

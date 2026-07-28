import React, { useState, useMemo } from 'react';
import { X, Layers } from 'lucide-react';

// Finds cards that appear across multiple of the user's decks — staples
// worth noting or upgrading — computed client-side from already-fetched
// deck data, matching this codebase's existing per-deck analysis pattern
// (Power Level, Salt Score, DeckAnalysis) rather than a new backend endpoint.
function DeckShellExtractor({ decks = [], onClose }) {
  const [minDecks, setMinDecks] = useState(2);

  const staples = useMemo(() => {
    const byName = new Map();

    decks.forEach(deck => {
      (deck.mainDeck || []).forEach(card => {
        if (!card?.name) return;
        const entry = byName.get(card.name) || {
          name: card.name,
          imageUrl: card.imageUrl,
          decks: [],
        };
        if (!entry.decks.some(d => d.deckId === deck._id)) {
          entry.decks.push({ deckId: deck._id, deckName: deck.name });
        }
        byName.set(card.name, entry);
      });
    });

    return [...byName.values()]
      .filter(entry => entry.decks.length >= minDecks)
      .sort((a, b) => b.decks.length - a.decks.length || a.name.localeCompare(b.name));
  }, [decks, minDecks]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers size={22} className="text-blue-400" />
            Deck Shell Extractor
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Cards that show up across multiple of your decks — the staples most worth
          upgrading, since improving one copy pays off in every deck that runs it.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-white">Appears in at least</label>
          <select
            value={minDecks}
            onChange={(e) => setMinDecks(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} decks</option>)}
          </select>
        </div>

        {staples.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No cards appear in {minDecks}+ of your decks yet.
          </div>
        ) : (
          <div className="space-y-2">
            {staples.map(entry => (
              <div key={entry.name} className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                {entry.imageUrl && (
                  <img src={entry.imageUrl} alt={entry.name} className="w-10 h-14 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{entry.name}</div>
                  <div className="text-slate-400 text-xs truncate">
                    {entry.decks.map(d => d.deckName).join(', ')}
                  </div>
                </div>
                <span className="px-2 py-1 bg-blue-600/30 text-blue-300 text-xs font-bold rounded-full shrink-0">
                  {entry.decks.length} decks
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeckShellExtractor;

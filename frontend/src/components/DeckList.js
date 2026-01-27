import React from 'react';
import { Upload } from 'lucide-react';

function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Commander Decks</h2>
        <button
          onClick={onImportClick}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"
        >
          <Upload size={20} />
          Import Deck
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map(deck => (
          <div
            key={deck._id}
            className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 hover:bg-white/15 transition cursor-pointer"
            onClick={() => onViewDeck(deck)}
          >
            {deck.commander?.imageUrl && (
              <img
                src={deck.commander.imageUrl}
                alt={deck.commander.name}
                className="w-full rounded-lg mb-3"
              />
            )}
            <h3 className="text-xl font-bold text-white mb-2">{deck.name}</h3>
            <div className="text-white/80 text-sm mb-2">
              Commander: {deck.commander?.name}
              {deck.partnerCommander && ` & ${deck.partnerCommander.name}`}
            </div>
            <div className="flex justify-between text-white/60 text-sm">
              <span>{deck.statistics?.totalCards || 100} cards</span>
              <span>${deck.totalValue?.toFixed(2) || '0.00'}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDeck(deck._id);
              }}
              className="mt-3 w-full px-3 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-sm transition"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {decks.length === 0 && (
        <div className="text-center py-12 text-white/60">
          No decks yet. Import your first Commander deck to get started!
        </div>
      )}
    </div>
  );
}

export default DeckList;

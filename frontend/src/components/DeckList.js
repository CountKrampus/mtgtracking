import React, { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';

function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, deckPlayCounts = {} }) {
  const [groupByFolder, setGroupByFolder] = useState(false);

  // Group decks by folder when enabled
  const grouped = useMemo(() => {
    if (!groupByFolder) return { '': decks };
    const groups = {};
    decks.forEach(deck => {
      const folder = deck.folder || '';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(deck);
    });
    return groups;
  }, [decks, groupByFolder]);

  const hasFolders = decks.some(d => d.folder);

  const DeckCard = ({ deck }) => {
    const playData = deckPlayCounts[deck._id];
    return (
      <div
        className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 hover:bg-white/15 transition cursor-pointer"
        onClick={() => onViewDeck(deck)}
      >
        <div className="relative">
          {deck.commander?.imageUrl && (
            <img
              src={deck.commander.imageUrl}
              alt={deck.commander.name}
              className="w-full rounded-lg mb-3"
            />
          )}
          {playData && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full">
              {playData.gamesPlayed} games
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{deck.name}</h3>
        <div className="text-white/80 text-sm mb-2">
          Commander: {deck.commander?.name}
          {deck.partnerCommander && ` & ${deck.partnerCommander.name}`}
        </div>
        <div className="flex justify-between text-white/60 text-sm mb-2">
          <span>{deck.statistics?.totalCards || 100} cards</span>
          <span>${deck.totalValue?.toFixed(2) || '0.00'}</span>
        </div>
        {deck.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {deck.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteDeck(deck._id);
          }}
          className="mt-1 w-full px-3 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-sm transition"
        >
          Delete
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">My Commander Decks</h2>
          {hasFolders && (
            <button
              onClick={() => setGroupByFolder(f => !f)}
              className={`px-3 py-1 rounded text-sm transition ${
                groupByFolder ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {groupByFolder ? 'Ungrouped' : 'Group by Folder'}
            </button>
          )}
        </div>
        <button
          onClick={onImportClick}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"
        >
          <Upload size={20} />
          Add Deck
        </button>
      </div>

      {groupByFolder ? (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([folder, folderDecks]) => (
            <div key={folder}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white/60 text-sm font-semibold uppercase tracking-wide">
                  {folder || 'Unsorted'}
                </span>
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-white/40 text-xs">{folderDecks.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {folderDecks.map(deck => <DeckCard key={deck._id} deck={deck} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map(deck => <DeckCard key={deck._id} deck={deck} />)}
        </div>
      )}

      {decks.length === 0 && (
        <div className="text-center py-12 text-white/60">
          No decks yet. Import your first Commander deck to get started!
        </div>
      )}
    </div>
  );
}

export default DeckList;

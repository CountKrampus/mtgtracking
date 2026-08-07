import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, X } from 'lucide-react';
import DeckShellExtractor from './DeckShellExtractor';
import DeckShoppingList from './DeckShoppingList';
import DeckComparisonModal from './DeckComparisonModal';

// Helper: build a nested folder tree from a flat array
function buildFolderTree(folders, parentId = null) {
  return folders
    .filter(f => String(f.parentId || null) === String(parentId))
    .map(f => ({ ...f, children: buildFolderTree(folders, f._id) }));
}

// Helper: return ordered path from root to a given folder
function getFolderPath(folders, folderId) {
  const path = [];
  let current = folders.find(f => String(f._id) === String(folderId));
  while (current) {
    path.unshift(current);
    current = folders.find(f => String(f._id) === String(current.parentId));
  }
  return path;
}

// Recursive folder tree node used inside the dropdown
function FolderTreeNode({ folder, depth, activeFolderId, onSelect, deckCountByFolder }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = folder.children && folder.children.length > 0;
  const isActive = String(activeFolderId) === String(folder._id);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 rounded cursor-pointer text-sm select-none ${
          isActive ? 'bg-purple-600/30 text-purple-300' : 'text-white/70 hover:bg-white/10'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px' }}
        onClick={() => onSelect(folder._id)}
      >
        <span
          className="w-3 text-white/40 flex-shrink-0 text-xs"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span>📁</span>
        <span className="flex-1 truncate">{folder.name}</span>
        <span className="text-white/30 text-xs">{deckCountByFolder[String(folder._id)] || 0}</span>
      </div>
      {open && hasChildren && folder.children.map(child => (
        <FolderTreeNode
          key={child._id}
          folder={child}
          depth={depth + 1}
          activeFolderId={activeFolderId}
          onSelect={onSelect}
          deckCountByFolder={deckCountByFolder}
        />
      ))}
    </div>
  );
}

function DeckList({ decks, onViewDeck, onDeleteDeck, onImportClick, onCreateDeck, folders = [], onFolderCreate, onDeckMoveToFolder }) {
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState('commander');
  const [showSleeveCalc, setShowSleeveCalc] = useState(false);
  const [showStaples, setShowStaples] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Folder state
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { deck, x, y }
  const [movingDeck, setMovingDeck] = useState(null);
  const [moveTarget, setMoveTarget] = useState(undefined);

  // Deck count per folder (direct children only)
  const deckCountByFolder = useMemo(() => {
    const map = {};
    decks.forEach(d => {
      if (d.folderId) map[String(d.folderId)] = (map[String(d.folderId)] || 0) + 1;
    });
    return map;
  }, [decks]);

  // Build folder tree for dropdown
  const rootFolderTree = useMemo(() => buildFolderTree(folders), [folders]);

  // Folder path for breadcrumb
  const folderPath = useMemo(() => getFolderPath(folders, activeFolderId), [folders, activeFolderId]);

  // Immediate subfolders of active folder (for subfolder rows in deck grid)
  const activeSubfolders = useMemo(() => {
    if (!activeFolderId) return [];
    return folders.filter(f => String(f.parentId || null) === String(activeFolderId));
  }, [folders, activeFolderId]);

  // Decks to display based on active folder
  const visibleDecks = useMemo(() => {
    if (!activeFolderId) return decks.filter(d => !d.folderId);
    return decks.filter(d => String(d.folderId) === String(activeFolderId));
  }, [decks, activeFolderId]);

  // Flat folder list for move picker (depth-first traversal)
  const flatFolderList = useMemo(() => {
    const result = [];
    function walk(parentId, depth) {
      folders
        .filter(f => String(f.parentId || null) === String(parentId || null))
        .forEach(f => { result.push({ folder: f, depth }); walk(f._id, depth + 1); });
    }
    walk(null, 0);
    return result;
  }, [folders]);

  // Close folder dropdown on outside click
  useEffect(() => {
    if (!folderDropdownOpen) return;
    const handler = () => setFolderDropdownOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [folderDropdownOpen]);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleFolderSelect = (folderId) => {
    setActiveFolderId(folderId);
    setFolderDropdownOpen(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await onFolderCreate(newFolderName.trim(), null);
    setNewFolderName('');
  };

  const handleMoveToFolder = async () => {
    if (moveTarget === undefined) return;
    await onDeckMoveToFolder(movingDeck._id, moveTarget);
    setMovingDeck(null);
    setMoveTarget(undefined);
  };

  const DeckCard = ({ deck }) => {
    return (
      <div
        className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 hover:bg-white/15 transition cursor-pointer"
        onClick={() => onViewDeck(deck)}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ deck, x: e.clientX, y: e.clientY }); }}
      >
        <div className="relative">
          {deck.commander?.imageUrl && (
            <img
              src={deck.commander.imageUrl}
              alt={deck.commander.name}
              className="w-full rounded-lg mb-3"
            />
          )}
        </div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-xl font-bold text-white">{deck.name}</h3>
          {deck.format && (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              {
                commander: 'bg-purple-600 text-white',
                standard: 'bg-blue-600 text-white',
                modern: 'bg-green-600 text-white',
                pioneer: 'bg-teal-600 text-white',
                legacy: 'bg-amber-600 text-white',
                vintage: 'bg-red-600 text-white',
                pauper: 'bg-gray-600 text-white',
                draft: 'bg-orange-600 text-white',
                oathbreaker: 'bg-pink-600 text-white',
                other: 'bg-slate-600 text-white'
              }[deck.format] || 'bg-slate-600 text-white'
            }`}>
              {deck.format.charAt(0).toUpperCase() + deck.format.slice(1)}
            </span>
          )}
        </div>
        {deck.commander?.name && (
          <div className="text-white/80 text-sm mb-2">
            Commander: {deck.commander.name}
            {deck.partnerCommander?.name && ` & ${deck.partnerCommander.name}`}
          </div>
        )}
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
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">My Decks</h2>
          {/* Folder dropdown button */}
          <div className="relative" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => setFolderDropdownOpen(o => !o)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                activeFolderId
                  ? 'bg-purple-600/40 border border-purple-500/50 text-purple-200'
                  : 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/20'
              }`}
            >
              📁 {activeFolderId ? (folderPath[folderPath.length - 1]?.name || 'Folder') : 'Uncategorised decks'} ▾
            </button>
            {folderDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-white/20 rounded-lg shadow-2xl w-64 py-1 max-h-80 overflow-y-auto">
                {/* Uncategorised decks row */}
                <div
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm select-none ${
                    !activeFolderId ? 'text-purple-300 bg-purple-600/20' : 'text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => handleFolderSelect(null)}
                >
                  <span>🗂</span>
                  <span>Uncategorised decks</span>
                  <span className="ml-auto text-white/30 text-xs">{decks.filter(d => !d.folderId).length}</span>
                </div>
                {rootFolderTree.length > 0 && <div className="border-t border-white/10 my-1" />}
                {/* Recursive folder tree */}
                {rootFolderTree.map(folder => (
                  <FolderTreeNode
                    key={folder._id}
                    folder={folder}
                    depth={0}
                    activeFolderId={activeFolderId}
                    onSelect={handleFolderSelect}
                    deckCountByFolder={deckCountByFolder}
                  />
                ))}
                {/* Inline new folder */}
                <div className="border-t border-white/10 mt-1 pt-1 px-3 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs">📁</span>
                    <input
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); e.stopPropagation(); }}
                      placeholder="New folder…"
                      className="flex-1 bg-transparent text-white text-xs outline-none placeholder-white/25 py-1"
                      onClick={e => e.stopPropagation()}
                    />
                    {newFolderName.trim() && (
                      <button
                        onMouseDown={e => { e.preventDefault(); handleCreateFolder(); }}
                        className="text-purple-400 text-xs hover:text-purple-300 font-medium"
                      >Add</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowSleeveCalc(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Calculate Sleeves</button>
          <button onClick={() => setShowStaples(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Find Staples</button>
          <button onClick={() => setShowComparison(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Compare Decks</button>
          <button onClick={() => setShowShoppingList(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-2 transition">Shopping List</button>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"><Plus size={20} />New Deck</button>
          <button onClick={onImportClick} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"><Upload size={20} />Import Deck</button>
        </div>
      </div>

      {/* Breadcrumb navigation */}
      {activeFolderId && (
        <div className="flex items-center gap-1 text-sm text-white/60 mb-4 flex-wrap">
          <button
            onClick={() => setActiveFolderId(null)}
            className="hover:text-white transition"
          >Uncategorised decks</button>
          {folderPath.map((folder, i) => (
            <React.Fragment key={folder._id}>
              <span className="text-white/30">›</span>
              <button
                onClick={() => setActiveFolderId(folder._id)}
                className={`hover:text-white transition ${i === folderPath.length - 1 ? 'text-white font-semibold' : ''}`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Subfolder rows when inside a folder */}
      {activeSubfolders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {activeSubfolders.map(folder => (
            <div
              key={folder._id}
              onClick={() => setActiveFolderId(folder._id)}
              className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20 hover:bg-white/10 transition cursor-pointer flex items-center gap-3"
            >
              <span className="text-3xl">📁</span>
              <div>
                <div className="text-white font-semibold">{folder.name}</div>
                <div className="text-white/40 text-sm">{deckCountByFolder[String(folder._id)] || 0} decks</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDecks.map(deck => (
          <DeckCard key={deck._id} deck={deck} />
        ))}
      </div>

      {visibleDecks.length === 0 && activeSubfolders.length === 0 && (
        <div className="text-center py-12 text-white/60">
          {activeFolderId
            ? 'No decks in this folder. Right-click a deck to move it here.'
            : 'No uncategorised decks. All your decks are in folders, or create a new one!'}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-gray-900 border border-white/20 rounded-lg shadow-2xl py-1 w-48"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-white/80 hover:bg-purple-600/30 hover:text-white text-sm flex items-center gap-2 transition"
            onClick={() => { setMovingDeck(contextMenu.deck); setMoveTarget(contextMenu.deck.folderId || null); setContextMenu(null); }}
          >
            📂 Move to folder…
          </button>
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-red-400/80 hover:bg-red-600/20 hover:text-red-300 text-sm flex items-center gap-2 transition"
            onClick={() => { onDeleteDeck(contextMenu.deck._id); setContextMenu(null); }}
          >
            🗑 Delete deck
          </button>
        </div>
      )}

      {/* Move to folder modal */}
      {movingDeck && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 pb-16 sm:pb-0">
          <div className="bg-gray-900 border border-white/20 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Move to Folder</h3>
              <button onClick={() => { setMovingDeck(null); setMoveTarget(undefined); }} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Moving: <span className="text-white font-medium">{movingDeck.name}</span>
            </p>
            <div className="space-y-0.5 max-h-60 overflow-y-auto mb-4 border border-white/10 rounded-lg p-1">
              {/* Root / no folder option */}
              <button
                onClick={() => setMoveTarget(null)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition ${
                  moveTarget === null ? 'bg-purple-600/30 text-purple-300' : 'text-white/60 hover:bg-white/10'
                }`}
              >
                ⬜ (root — no folder)
                {!movingDeck.folderId && <span className="ml-auto text-xs text-white/30">current</span>}
              </button>
              {/* All folders, flat with indent */}
              {flatFolderList.map(({ folder, depth }) => (
                <button
                  key={folder._id}
                  onClick={() => setMoveTarget(folder._id)}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                  className={`w-full text-left pr-3 py-2 rounded text-sm flex items-center gap-2 transition ${
                    String(moveTarget) === String(folder._id)
                      ? 'bg-purple-600/30 text-purple-300'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  📁 {folder.name}
                  {String(movingDeck.folderId) === String(folder._id) && (
                    <span className="ml-auto text-xs text-white/30">current</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setMovingDeck(null); setMoveTarget(undefined); }}
                className="flex-1 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToFolder}
                disabled={moveTarget === undefined}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition"
              >
                Move Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deck Shell Extractor Modal */}
      {showStaples && (
        <DeckShellExtractor decks={decks} onClose={() => setShowStaples(false)} />
      )}

      {/* Deck Shopping List Modal */}
      {showShoppingList && (
        <DeckShoppingList decks={decks} onClose={() => setShowShoppingList(false)} />
      )}

      {/* Deck Comparison Modal */}
      {showComparison && (
        <DeckComparisonModal decks={decks} onClose={() => setShowComparison(false)} />
      )}

      {/* Create New Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
          <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Create New Deck</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white mb-2">Deck Name</label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="e.g., Atraxa Control"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-white mb-2">Format</label>
                <select
                  value={newDeckFormat}
                  onChange={(e) => setNewDeckFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="commander">Commander</option>
                  <option value="standard">Standard</option>
                  <option value="modern">Modern</option>
                  <option value="pioneer">Pioneer</option>
                  <option value="legacy">Legacy</option>
                  <option value="vintage">Vintage</option>
                  <option value="pauper">Pauper</option>
                  <option value="draft">Draft</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const name = newDeckName.trim() || 'Untitled Deck';
                    const format = newDeckFormat;
                    try {
                      await onCreateDeck({
                        name,
                        format,
                        commander: null,
                        cards: [],
                        folderId: activeFolderId || null
                      });
                      setShowCreateModal(false);
                      setNewDeckName('');
                      setNewDeckFormat('commander');
                    } catch (err) {
                      alert('Error creating deck: ' + (err.message || err));
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeckList;

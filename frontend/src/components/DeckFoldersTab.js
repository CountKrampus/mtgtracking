import React from 'react';
import axios from 'axios';
import { API_URL } from '../config';

export default function DeckFoldersTab() {
  const [folders, setFolders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState(null);
  const [editingName, setEditingName] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [newFolderParent, setNewFolderParent] = React.useState('');

  const fetchFolders = async () => {
    try {
      const res = await axios.get(`${API_URL}/deck-folders`);
      setFolders(res.data);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { fetchFolders(); }, []);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${API_URL}/deck-folders`, {
        name: newFolderName.trim(),
        parentId: newFolderParent || null
      });
      setNewFolderName('');
      setNewFolderParent('');
      fetchFolders();
    } catch (err) {
      alert('Failed to create folder: ' + (err.response?.data?.message || err.message));
    }
  };

  const renameFolder = async (id) => {
    if (!editingName.trim()) return;
    try {
      await axios.put(`${API_URL}/deck-folders/${id}`, { name: editingName.trim() });
      setEditingId(null);
      fetchFolders();
    } catch (err) {
      alert('Failed to rename: ' + (err.response?.data?.message || err.message));
    }
  };

  const deleteFolder = async (id, name) => {
    if (!window.confirm(`Deleting "${name}" will move its decks to root. Continue?`)) return;
    try {
      await axios.delete(`${API_URL}/deck-folders/${id}`);
      fetchFolders();
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    }
  };

  // Flat depth-first list for display
  const flatList = React.useMemo(() => {
    const result = [];
    function walk(parentId, depth) {
      folders
        .filter(f => String(f.parentId || null) === String(parentId || null))
        .forEach(f => { result.push({ folder: f, depth }); walk(f._id, depth + 1); });
    }
    walk(null, 0);
    return result;
  }, [folders]);

  if (loading) return <div className="text-white/50 text-center py-8">Loading folders…</div>;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Deck Folders</h2>

      {flatList.length === 0 ? (
        <p className="text-white/40 text-sm mb-4">No folders yet. Create one below.</p>
      ) : (
        <div className="space-y-0.5 mb-6">
          {flatList.map(({ folder, depth }) => (
            <div
              key={folder._id}
              className="flex items-center gap-2 py-1.5 text-sm"
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              <span className="text-white/50">📁</span>
              {editingId === folder._id ? (
                <>
                  <input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameFolder(folder._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-white/10 border border-white/30 rounded px-2 py-0.5 text-white text-sm outline-none focus:border-purple-400"
                    autoFocus
                  />
                  <button onClick={() => renameFolder(folder._id)} className="text-green-400 text-xs hover:text-green-300 px-1">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-white/40 text-xs hover:text-white px-1">✕</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white">{folder.name}</span>
                  <button
                    onClick={() => { setEditingId(folder._id); setEditingName(folder.name); }}
                    className="text-white/40 hover:text-white text-xs px-1 transition"
                    title="Rename"
                  >✏️</button>
                  <button
                    onClick={() => deleteFolder(folder._id, folder.name)}
                    className="text-red-400/60 hover:text-red-400 text-xs px-1 transition"
                    title="Delete"
                  >🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-white/70 text-sm font-medium mb-3">New Folder</h3>
        <input
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createFolder(); }}
          placeholder="Folder name"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none placeholder-white/30 focus:border-white/40 mb-2"
        />
        <div className="flex gap-2">
          <select
            value={newFolderParent}
            onChange={e => setNewFolderParent(e.target.value)}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-white/40"
          >
            <option value="">Root (no parent)</option>
            {folders.map(f => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={createFolder}
            disabled={!newFolderName.trim()}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

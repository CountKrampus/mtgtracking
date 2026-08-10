import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Eye, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function WarningBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-900/40 border border-amber-600/60 rounded-lg p-4">
      <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-amber-300 text-sm">
        These operations are irreversible. Always create a backup first before running cleanup.
      </p>
    </div>
  );
}

function PreviewResultsCard({ results }) {
  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-300 mb-3">Would delete:</p>
      <ul className="space-y-1 text-sm text-gray-300">
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          Duplicates: <span className="text-white font-semibold ml-1">{results.duplicates}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          Orphaned records: <span className="text-white font-semibold ml-1">{results.orphaned}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          Invalid records: <span className="text-white font-semibold ml-1">{results.invalidRecords}</span>
        </li>
      </ul>
    </div>
  );
}

function CleanupResultsCard({ results }) {
  return (
    <div className="bg-gray-700/50 border border-green-600/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={16} className="text-green-400" />
        <p className="text-sm font-medium text-green-300">Cleanup complete. Deleted:</p>
      </div>
      <ul className="space-y-1 text-sm text-gray-300">
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          Duplicates: <span className="text-white font-semibold ml-1">{results.duplicates}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          Orphaned records: <span className="text-white font-semibold ml-1">{results.orphaned}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          Invalid records: <span className="text-white font-semibold ml-1">{results.invalidRecords}</span>
        </li>
      </ul>
    </div>
  );
}

export function DataCleanupTab() {
  const { token } = useAuthContext();

  const [previewLoading, setPreviewLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState(null);
  const [cleanupResults, setCleanupResults] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setPreviewResults(null);
    setCleanupResults(null);
    setConfirmText('');

    try {
      const res = await fetch(`${API_URL}/admin/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ preview: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setPreviewResults(data.wouldDelete);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (confirmText !== 'CLEANUP' || !previewResults) return;

    setCleanupLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ preview: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setCleanupResults(data.deleted);
      setPreviewResults(null);
      setConfirmText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  const canRunCleanup = confirmText === 'CLEANUP' && previewResults !== null && !cleanupLoading;

  return (
    <div className="space-y-6">
      <WarningBanner />

      {error && (
        <div className="bg-red-900/40 border border-red-600/60 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Preview */}
      <div className="bg-gray-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-700 text-white text-xs font-bold flex-shrink-0">
            1
          </span>
          <h3 className="text-white font-semibold">Preview Cleanup</h3>
        </div>

        <p className="text-gray-400 text-sm">
          Run a dry-run to see what would be deleted without making any changes.
        </p>

        <button
          onClick={handlePreview}
          disabled={previewLoading}
          className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Eye size={16} />
          {previewLoading ? 'Running preview…' : 'Preview Cleanup'}
        </button>

        {previewResults && (
          <div className="space-y-3">
            <PreviewResultsCard results={previewResults} />
            <p className="text-gray-400 text-sm">
              Review the above, then run cleanup to permanently delete these records.
            </p>
          </div>
        )}
      </div>

      {/* Step 2: Run Cleanup */}
      <div className={`bg-gray-800 rounded-lg p-5 space-y-4 ${!previewResults ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold flex-shrink-0">
            2
          </span>
          <h3 className="text-white font-semibold">Run Cleanup</h3>
        </div>

        <p className="text-gray-400 text-sm">
          Type <span className="font-mono text-red-400 font-semibold">CLEANUP</span> to confirm and permanently delete the records shown above.
        </p>

        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={!previewResults || cleanupLoading}
          placeholder='Type "CLEANUP" to confirm'
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          onClick={handleCleanup}
          disabled={!canRunCleanup}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
          {cleanupLoading ? 'Running cleanup…' : 'Run Cleanup'}
        </button>
      </div>

      {cleanupResults && (
        <CleanupResultsCard results={cleanupResults} />
      )}

      <DeadCardsPanel token={token} />
    </div>
  );
}

function DeadCardsPanel({ token }) {
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/dead-cards`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCards(data.cards || []);
      setSelected(new Set());
    } finally { setLoading(false); }
  };

  const toggleAll = () => {
    if (selected.size === cards.length) setSelected(new Set());
    else setSelected(new Set(cards.map(c => c._id)));
  };

  const handleDelete = async () => {
    if (!selected.size || !window.confirm(`Delete ${selected.size} card(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/dead-cards`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] })
      });
      const data = await res.json();
      setDeleted(d => d + (data.deleted || 0));
      await load();
    } finally { setDeleting(false); }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Dead Card Cleanup</h3>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Scan
        </button>
      </div>
      <p className="text-gray-400 text-sm">Cards missing a Scryfall ID, price, or set name — likely from failed imports.</p>
      {deleted > 0 && <p className="text-green-400 text-sm">{deleted} card(s) deleted this session.</p>}
      {cards === null ? (
        <p className="text-gray-500 text-sm">Click Scan to find dead cards.</p>
      ) : cards.length === 0 ? (
        <p className="text-green-400 text-sm">No dead cards found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={selected.size === cards.length} onChange={toggleAll} className="accent-purple-500" />
              Select all ({cards.length})
            </label>
            {selected.size > 0 && (
              <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs transition">
                <Trash2 size={12} /> Delete {selected.size}
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {cards.map(c => (
              <label key={c._id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.has(c._id)} onChange={() => {
                  const s = new Set(selected);
                  s.has(c._id) ? s.delete(c._id) : s.add(c._id);
                  setSelected(s);
                }} className="accent-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="text-gray-400 ml-2">{c.set || 'Unknown set'}</span>
                </div>
                <div className="flex gap-2 text-xs flex-shrink-0">
                  {!c.scryfallId && <span className="text-orange-400">no ID</span>}
                  {!c.price && <span className="text-yellow-400">$0</span>}
                  {(!c.set || c.set === 'Unknown') && <span className="text-red-400">no set</span>}
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default DataCleanupTab;

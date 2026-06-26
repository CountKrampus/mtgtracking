import React, { useState } from 'react';
import { API_URL } from '../../config';

export default function DeckImportButton({ threadId, user }) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deckData, setDeckData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/forum/threads/${threadId}/extract-deck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to extract deck');
      if (!data.cards || data.cards.length === 0) {
        setError('No card list detected in this thread.');
        setLoading(false);
        return;
      }
      setDeckData(data);
      setShowModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!deckData) return;
    setImporting(true);
    setImportResult(null);

    try {
      const cardList = deckData.cards
        .map(c => `${c.quantity} ${c.name}`);

      const res = await fetch(`${API_URL}/cards/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}`
        },
        body: JSON.stringify({ cardList })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');

      setImportResult({
        added: data.added || 0,
        merged: data.merged || 0,
        failed: data.failed || 0,
        total: deckData.total
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setDeckData(null);
    setImportResult(null);
    setError('');
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleExtract}
        disabled={loading}
        className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-sm text-white flex items-center gap-1"
        title="Import deck list from this thread"
      >
        {loading ? '...' : '📋 Import Deck'}
      </button>

      {error && !showModal && (
        <span className="text-red-400 text-xs ml-2">{error}</span>
      )}

      {showModal && deckData && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-slate-800 rounded-t-2xl sm:rounded-lg p-6 sm:max-w-lg w-full sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Import Deck ({deckData.total} cards)
              </h3>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                ✕
              </button>
            </div>

            {!importResult ? (
              <>
                <div className="text-sm text-slate-400 mb-3">
                  Detected {deckData.cards.length} unique cards ({deckData.total} total):
                </div>
                <div className="overflow-y-auto flex-1 mb-4 border border-slate-700 rounded">
                  {deckData.cards.map((card, i) => (
                    <div key={i} className="flex justify-between px-3 py-1 border-b border-slate-700 last:border-0 text-sm">
                      <span className="text-white">{card.name}</span>
                      <span className="text-slate-400">×{card.quantity}</span>
                    </div>
                  ))}
                </div>
                {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white text-sm"
                  >
                    {importing ? 'Importing...' : 'Confirm Import'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="text-white font-semibold text-lg mb-2">Import Complete!</div>
                  <div className="text-slate-300 text-sm space-y-1">
                    {importResult.added > 0 && <div>{importResult.added} cards added</div>}
                    {importResult.merged > 0 && <div>{importResult.merged} cards merged (already in collection)</div>}
                    {importResult.failed > 0 && <div className="text-red-400">{importResult.failed} cards failed</div>}
                  </div>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

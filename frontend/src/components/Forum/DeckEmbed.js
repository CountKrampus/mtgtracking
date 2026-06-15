import React, { useState } from 'react';
import { Copy } from 'lucide-react';

export default function DeckEmbed({ deckId, deckName, apiUrl, user }) {
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!user) {
      alert('Please log in');
      return;
    }

    setImporting(true);
    try {
      await fetch(`${apiUrl}/forum/threads/import-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId })
      });
      alert('Deck imported!');
    } catch (error) {
      console.error('Error importing:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-slate-700 p-3 rounded border border-slate-600 my-2 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">{deckName}</div>
        <div className="text-xs text-slate-400">Deck</div>
      </div>
      <button
        onClick={handleImport}
        disabled={importing || !user}
        className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
      >
        <Copy size={14} />
        Copy
      </button>
    </div>
  );
}

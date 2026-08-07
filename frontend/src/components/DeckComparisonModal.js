import React, { useState, useMemo } from 'react';
import { X, GitCompare } from 'lucide-react';

// Picker step: choose two distinct decks before the comparison renders.
function DeckPicker({ decks, deckAId, deckBId, onSelectA, onSelectB, onCompare }) {
  const canCompare = deckAId && deckBId && deckAId !== deckBId;

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        Pick two of your decks to compare their mana curve, colors, and card overlap.
      </p>
      <div>
        <label className="block text-sm text-white mb-1">Deck A</label>
        <select
          value={deckAId}
          onChange={(e) => onSelectA(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a deck…</option>
          {decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-white mb-1">Deck B</label>
        <select
          value={deckBId}
          onChange={(e) => onSelectB(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">Select a deck…</option>
          {decks.filter(d => d._id !== deckAId).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <button
        onClick={onCompare}
        disabled={!canCompare}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
      >
        Compare
      </button>
    </div>
  );
}

function DeckComparisonModal({ decks = [], onClose }) {
  const [deckAId, setDeckAId] = useState('');
  const [deckBId, setDeckBId] = useState('');
  const [comparing, setComparing] = useState(false);

  const deckA = useMemo(() => decks.find(d => d._id === deckAId), [decks, deckAId]);
  const deckB = useMemo(() => decks.find(d => d._id === deckBId), [decks, deckBId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare size={22} className="text-blue-400" />
            Compare Decks
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!comparing || !deckA || !deckB ? (
          <DeckPicker
            decks={decks}
            deckAId={deckAId}
            deckBId={deckBId}
            onSelectA={setDeckAId}
            onSelectB={setDeckBId}
            onCompare={() => setComparing(true)}
          />
        ) : (
          <div className="text-white/60 text-sm">
            Comparing {deckA.name} vs {deckB.name}… (comparison view built in Task 2/3)
          </div>
        )}
      </div>
    </div>
  );
}

export default DeckComparisonModal;

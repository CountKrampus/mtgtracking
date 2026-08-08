import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTrades } from '../contexts/TradesContext';

function ExcessCopyRow({ card, checked, onToggle, listQuantity, onQuantityChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 px-2 rounded hover:bg-white/5 transition-colors">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm truncate">{card.name}</div>
        <div className="text-white/40 text-xs truncate">{card.set} · {card.condition} · own {card.quantity}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-white/50 text-xs">List:</span>
        <input
          type="number"
          min="1"
          max={card.quantity}
          value={listQuantity}
          onChange={(e) => onQuantityChange(Math.max(1, Math.min(card.quantity, parseInt(e.target.value) || 1)))}
          className="w-14 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm text-center focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function ExcessCopiesModal({ candidates, onClose }) {
  const { createListing } = useTrades();
  const [checkedIds, setCheckedIds] = useState(new Set(candidates.map(c => c._id)));
  const [quantities, setQuantities] = useState(
    Object.fromEntries(candidates.map(c => [c._id, Math.max(1, c.quantity - 1)]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const toggleCard = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setQuantity = (id, value) => {
    setQuantities(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const selected = candidates.filter(c => checkedIds.has(c._id));
    let listed = 0;
    let failed = 0;

    for (const card of selected) {
      try {
        await createListing({
          type: 'have',
          cardName: card.name,
          cardSet: card.set,
          cardSetCode: card.setCode,
          condition: card.condition,
          quantity: quantities[card._id],
          estimatedValue: card.price || 0,
          scryfallId: card.scryfallId,
          imageUrl: card.imageUrl,
          notes: '',
        });
        listed++;
      } catch {
        failed++;
      }
    }

    setSubmitting(false);
    setResult({ listed, failed });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">List Excess Copies for Trade</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {result ? (
            <div className="text-center py-8">
              <p className="text-white text-sm">
                Listed {result.listed} card{result.listed !== 1 ? 's' : ''} for trade
                {result.failed > 0 && ` — ${result.failed} failed, please try again`}.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-white/60 text-sm">{checkedIds.size} of {candidates.length} selected</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCheckedIds(new Set(candidates.map(c => c._id)))} className="text-xs text-purple-400 hover:text-purple-300 transition">Select All</button>
                  <button onClick={() => setCheckedIds(new Set())} className="text-xs text-purple-400 hover:text-purple-300 transition">Select None</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-0.5 mb-4">
                {candidates.map(card => (
                  <ExcessCopyRow
                    key={card._id}
                    card={card}
                    checked={checkedIds.has(card._id)}
                    onToggle={() => toggleCard(card._id)}
                    listQuantity={quantities[card._id]}
                    onQuantityChange={(v) => setQuantity(card._id, v)}
                  />
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || checkedIds.size === 0}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
              >
                {submitting ? 'Listing…' : `List Selected for Trade (${checkedIds.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

export default function DeckAllocationSummary() {
  const [allocation, setAllocation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/decks/card-allocation`)
      .then(response => {
        if (active) setAllocation(response.data);
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.message || 'Could not check copies assigned across decks.');
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return <p role="alert" className="mb-4 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">{error}</p>;
  }
  if (!allocation) {
    return <div className="mb-4 flex items-center gap-2 text-sm text-white/50"><RefreshCw size={14} className="animate-spin" /> Checking deck allocations…</div>;
  }
  if (!allocation.totalCopiesShort) {
    return (
      <div className="mb-4 p-3 bg-green-900/15 border border-green-700/30 rounded-lg flex items-center gap-2 text-sm text-green-200">
        <CheckCircle2 size={16} /> All copies assigned across decks are covered by your collection.
      </div>
    );
  }

  return (
    <section className="mb-4 p-4 bg-amber-950/25 border border-amber-400/25 rounded-lg">
      <h2 className="flex items-center gap-2 text-white font-semibold">
        <AlertTriangle size={18} className="text-amber-300" />
        Deck copy conflicts
      </h2>
      <p className="mt-1 text-sm text-white/60">
        {allocation.totalCopiesShort} {allocation.totalCopiesShort === 1 ? 'copy' : 'copies'} short across {allocation.totalCardsShort} card{allocation.totalCardsShort === 1 ? '' : 's'}.
        A physical copy can only be assigned to one deck at a time.
      </p>
      <ul className="mt-3 grid sm:grid-cols-2 gap-2">
        {allocation.shortages.slice(0, 8).map(item => (
          <li key={item.scryfallId} className="p-2 bg-black/15 rounded text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white truncate">{item.name}</span>
              <span className="text-amber-300 flex-shrink-0">{item.owned} / {item.required} owned</span>
            </div>
            <p className="text-xs text-white/45 mt-1 truncate">Used in {item.decks.map(deck => deck.name).join(', ')}</p>
          </li>
        ))}
      </ul>
      {allocation.shortages.length > 8 && (
        <p className="mt-2 text-xs text-white/45">And {allocation.shortages.length - 8} more card conflicts.</p>
      )}
    </section>
  );
}

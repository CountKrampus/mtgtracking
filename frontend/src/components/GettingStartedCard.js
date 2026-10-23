import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

const STEPS = [
  { title: 'Add your first cards', detail: 'Search for singles or import a list.', path: '/collection' },
  { title: 'Organize your collection', detail: 'Use tags and storage locations to find cards later.', path: '/collection' },
  { title: 'Build a deck', detail: 'Choose a format and start from your collection.', path: '/decks' },
  { title: 'Track cards you want', detail: 'Set target prices and priority in your wishlist.', path: '/wishlist' },
];

function GettingStartedCard({ userId, cardCount, navigate }) {
  const storageKey = `mtg-tracker-getting-started-dismissed:${userId || 'local'}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === 'true');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Keep the dismissal for this visit if browser storage is unavailable.
    }
  };

  if (dismissed) return null;

  return (
    <section className="bg-gradient-to-r from-purple-900/50 to-indigo-900/40 border border-purple-400/25 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Getting started</h2>
          <p className="text-sm text-white/60 mt-1">A few quick steps to set up your MTG collection.</p>
        </div>
        <button onClick={dismiss} title="Dismiss getting started" className="p-1 text-white/50 hover:text-white">
          <X size={18} />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        {STEPS.map((step, index) => (
          <button
            key={step.title}
            onClick={() => navigate(step.path)}
            className="flex items-center gap-3 p-3 rounded-lg text-left bg-black/15 hover:bg-black/25 transition"
          >
            <span className="w-7 h-7 flex-shrink-0 rounded-full border border-purple-300/40 text-purple-200 flex items-center justify-center text-xs">
              {index === 0 && cardCount > 0 ? <Check size={15} /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white">{step.title}</span>
              <span className="block text-xs text-white/50">{step.detail}</span>
            </span>
            <ArrowRight size={15} className="text-white/40" />
          </button>
        ))}
      </div>
    </section>
  );
}

export default GettingStartedCard;

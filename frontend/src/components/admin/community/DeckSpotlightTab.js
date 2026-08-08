// frontend/src/components/admin/community/DeckSpotlightTab.js
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

export default function DeckSpotlightTab() {
  const { authFetch } = useAuthContext();
  const [spotlight, setSpotlight] = useState(null);
  const [decks, setDecks] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [loading, setLoading] = useState(true);
  const [featuring, setFeaturing] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/deck-spotlight/active`)
      .then(r => r.json())
      .then(d => setSpotlight(d.spotlight))
      .finally(() => setLoading(false));
    fetch(`${API_URL}/decks/community?sort=imported&limit=200`)
      .then(r => r.json())
      .then(d => setDecks(d.decks || []));
  }, []);

  const filteredDecks = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.commander?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const daysLeft = spotlight
    ? Math.max(0, Math.ceil((new Date(spotlight.expiresAt) - Date.now()) / 86400000))
    : 0;

  const handleFeature = async () => {
    if (!selectedDeckId) return;
    if (spotlight && !window.confirm('Replace the current spotlight?')) return;
    setFeaturing(true);
    try {
      if (spotlight) {
        const delRes = await authFetch(`${API_URL}/deck-spotlight/${spotlight._id}`, { method: 'DELETE' });
        if (!delRes.ok) { alert('Failed to remove existing spotlight'); return; }
      }
      const res = await authFetch(`${API_URL}/deck-spotlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Failed'); return; }
      const activeRes = await fetch(`${API_URL}/deck-spotlight/active`);
      const activeData = await activeRes.json();
      setSpotlight(activeData.spotlight);
      setSelectedDeckId('');
    } catch {
      alert('Failed to feature deck');
    } finally {
      setFeaturing(false);
    }
  };

  const handleRemove = async () => {
    if (!spotlight || !window.confirm('Remove current spotlight?')) return;
    const res = await authFetch(`${API_URL}/deck-spotlight/${spotlight._id}`, { method: 'DELETE' });
    if (res.ok) setSpotlight(null);
  };

  if (loading) return <p className="p-4 text-white/50">Loading…</p>;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-lg font-bold text-white">Deck of the Week</h2>

      {/* Current spotlight */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Current Spotlight</h3>
        {spotlight ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-white">{spotlight.deckId?.name}</p>
              <p className="mt-0.5 text-sm text-white/60">
                {spotlight.budgetTier} {spotlight.buildLabel} · Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </p>
              {spotlight.threadId && (
                <a href={`/forum/thread/${spotlight.threadId}`} className="mt-1 block text-xs text-indigo-400 hover:underline">
                  View Forum Thread →
                </a>
              )}
            </div>
            <button
              onClick={handleRemove}
              className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/40">No active spotlight.</p>
        )}
      </div>

      {/* Feature a deck */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Feature a Deck</h3>
        <input
          type="text"
          placeholder="Search by deck name or commander…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
        />
        <select
          value={selectedDeckId}
          onChange={e => setSelectedDeckId(e.target.value)}
          className="mb-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none"
          size={5}
        >
          <option value="">— select a deck —</option>
          {filteredDecks.map(d => (
            <option key={d._id} value={d._id}>
              {d.name}{d.commander?.name ? ` · ${d.commander.name}` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={handleFeature}
          disabled={!selectedDeckId || featuring}
          className="w-full rounded-lg bg-yellow-500/80 py-2 text-sm font-semibold text-black disabled:opacity-40 hover:bg-yellow-400"
        >
          {featuring ? 'Featuring…' : '⭐ Feature this deck'}
        </button>
      </div>
    </div>
  );
}

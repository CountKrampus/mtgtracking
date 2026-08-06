import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Loader, Check } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

function CardRow({ card, selected, selectable, onSelect }) {
  return (
    <div
      onClick={selectable ? onSelect : undefined}
      className={`flex items-center justify-between p-2 rounded border text-sm ${
        selectable ? 'cursor-pointer' : ''
      } ${selected ? 'border-purple-500 bg-purple-600/20' : 'border-slate-700 bg-slate-800/50'}`}
    >
      <div className="flex items-center gap-2">
        {selectable && (
          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${selected ? 'bg-purple-500 border-purple-500' : 'border-slate-500'}`}>
            {selected && <Check size={12} className="text-white" />}
          </span>
        )}
        <span className="text-white">{card.name}</span>
        <span className="text-slate-400">{card.set}</span>
        <span className="text-slate-500">{card.condition}{card.isFoil ? ' · Foil' : ''}</span>
      </div>
      <div className="text-slate-300">×{card.quantity}</div>
    </div>
  );
}

export default function DuplicateCleanup({ isOpen, onClose, onMerged }) {
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [exactGroups, setExactGroups] = useState([]);
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  // Chosen target per suggestion group, keyed by the unknown card's id
  const [selectedTargets, setSelectedTargets] = useState({});

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/cards/duplicates`);
      setExactGroups(res.data.exactGroups);
      setSuggestedGroups(res.data.suggestedGroups);
      const preselected = {};
      for (const group of res.data.suggestedGroups) {
        if (group.candidates.length === 1) {
          preselected[group.unknownCard._id] = group.candidates[0]._id;
        }
      }
      setSelectedTargets(preselected);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchDuplicates();
  }, [isOpen, fetchDuplicates]);

  const merge = async (targetId, sourceIds) => {
    await axios.post(`${API_URL}/cards/merge-duplicates`, { targetId, sourceIds });
  };

  const afterMerge = async () => {
    await fetchDuplicates();
    onMerged?.();
  };

  const handleMergeExactGroup = async (group) => {
    setMerging(true);
    setError('');
    try {
      const [target, ...sources] = group.cards; // oldest first (sorted by createdAt server-side)
      await merge(target._id, sources.map(c => c._id));
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAllExact = async () => {
    setMerging(true);
    setError('');
    try {
      for (const group of exactGroups) {
        const [target, ...sources] = group.cards;
        await merge(target._id, sources.map(c => c._id));
      }
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleMergeSuggestion = async (group) => {
    const targetId = selectedTargets[group.unknownCard._id];
    if (!targetId) return;
    setMerging(true);
    setError('');
    try {
      await merge(targetId, [group.unknownCard._id]);
      await afterMerge();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const empty = !loading && exactGroups.length === 0 && suggestedGroups.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Copy size={18} className="text-purple-400" /> Find Duplicates
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader size={16} className="animate-spin" /> Scanning collection...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-sm">{error}</div>
          )}

          {empty && (
            <div className="text-center text-slate-400 py-8">No duplicates found 🎉</div>
          )}

          {exactGroups.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Exact duplicates ({exactGroups.length})</h3>
                <button
                  onClick={handleMergeAllExact}
                  disabled={merging}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition disabled:opacity-50"
                >
                  Merge All
                </button>
              </div>
              <p className="text-slate-500 text-xs mb-3">Identical rows — merging sums their quantities. Always safe.</p>
              <div className="space-y-3">
                {exactGroups.map((group, i) => (
                  <div key={i} className="border border-slate-700 rounded p-2 space-y-1">
                    {group.cards.map(card => <CardRow key={card._id} card={card} />)}
                    <button
                      onClick={() => handleMergeExactGroup(group)}
                      disabled={merging}
                      className="mt-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition disabled:opacity-50"
                    >
                      Merge group
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {suggestedGroups.length > 0 && (
            <section>
              <h3 className="text-white font-semibold mb-2">Suggested merges ({suggestedGroups.length})</h3>
              <p className="text-slate-500 text-xs mb-3">
                Cards imported offline (set "Unknown") that likely match a card you already track. Pick which printing they belong to.
              </p>
              <div className="space-y-3">
                {suggestedGroups.map(group => (
                  <div key={group.unknownCard._id} className="border border-slate-700 rounded p-2 space-y-1">
                    <CardRow card={group.unknownCard} />
                    <div className="text-slate-500 text-xs pl-2">merge into:</div>
                    {group.candidates.map(candidate => (
                      <CardRow
                        key={candidate._id}
                        card={candidate}
                        selectable
                        selected={selectedTargets[group.unknownCard._id] === candidate._id}
                        onSelect={() => setSelectedTargets(prev => ({ ...prev, [group.unknownCard._id]: candidate._id }))}
                      />
                    ))}
                    <button
                      onClick={() => handleMergeSuggestion(group)}
                      disabled={merging || !selectedTargets[group.unknownCard._id]}
                      className="mt-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                    >
                      Merge
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

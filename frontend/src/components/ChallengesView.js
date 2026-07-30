import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Trophy, X, Award, Plus } from 'lucide-react';
import { API_URL } from '../config';

const METRIC_GROUPS = {
  Collection: [
    { value: 'foils_added', label: 'Foils added' },
    { value: 'cards_added', label: 'Cards added' },
    { value: 'value_added', label: 'Collection value added ($)' },
    { value: 'color_added', label: 'Cards added of a color' },
    { value: 'rarity_added', label: 'Cards added of a rarity' },
    { value: 'unique_sets', label: 'Unique sets added from' },
    { value: 'set_completion', label: 'Set completion %' },
    { value: 'high_value_card', label: 'Own a card worth at least $X' },
  ],
  Trading: [
    { value: 'trades_completed', label: 'Trades completed' },
    { value: 'wishlist_acquired', label: 'Wishlist items acquired' },
  ],
  Social: [
    { value: 'forum_posts', label: 'Forum posts' },
    { value: 'forum_threads', label: 'Forum threads started' },
    { value: 'forum_upvotes', label: 'Forum upvotes received' },
  ],
  Manual: [
    { value: 'custom', label: 'Custom (submit proof)' },
  ],
};

const METRIC_CATEGORY = Object.fromEntries(
  Object.entries(METRIC_GROUPS).flatMap(([group, metrics]) => metrics.map(m => [m.value, group]))
);

const COLOR_OPTIONS = [
  { value: 'W', label: 'White' }, { value: 'U', label: 'Blue' }, { value: 'B', label: 'Black' },
  { value: 'R', label: 'Red' }, { value: 'G', label: 'Green' }, { value: 'C', label: 'Colorless' },
];
const RARITY_OPTIONS = [
  { value: 'C', label: 'Common' }, { value: 'U', label: 'Uncommon' }, { value: 'R', label: 'Rare' }, { value: 'M', label: 'Mythic' },
];

function ProofModal({ challenge, onClose, onSubmitted }) {
  const [proofNote, setProofNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/challenges/${challenge._id}/progress`, { proofNote });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit proof');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Submit Proof — {challenge.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2 mb-3">{error}</p>}
        <textarea
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Describe how you completed this challenge..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !proofNote.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {saving ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderboardDrawer({ challenge, onClose }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/challenges/${challenge._id}/leaderboard`)
      .then(res => setEntries(res.data))
      .catch(() => setEntries([]));
  }, [challenge._id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-sm h-full p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Leaderboard — {challenge.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {entries === null ? (
          <p className="text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-400">No participants yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.rank} className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                <span className="text-amber-400 font-bold w-6 text-center">#{entry.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{entry.username || 'Unknown'}</p>
                  <p className="text-slate-400 text-xs">
                    {entry.progress}{entry.completed ? ' — Completed' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposeModal({ onClose, onProposed }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState('cards_added');
  const [target, setTarget] = useState(10);
  const [params, setParams] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await axios.post(`${API_URL}/challenges/propose`, { title, description, metric, target, params });
      onProposed();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit proposal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Propose a Challenge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2 mb-3">{error}</p>}

        <div className="space-y-3">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title" maxLength={100}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500"
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description" maxLength={500} rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 resize-none"
          />
          <select
            value={metric}
            onChange={(e) => { setMetric(e.target.value); setParams({}); }}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          >
            {Object.entries(METRIC_GROUPS).map(([group, metrics]) => (
              <optgroup key={group} label={group}>
                {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </optgroup>
            ))}
          </select>

          {metric === 'color_added' && (
            <select value={params.color || ''} onChange={(e) => setParams({ color: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white">
              <option value="">Select color…</option>
              {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )}
          {metric === 'rarity_added' && (
            <select value={params.rarity || ''} onChange={(e) => setParams({ rarity: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white">
              <option value="">Select rarity…</option>
              {RARITY_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
          {metric === 'set_completion' && (
            <div className="flex gap-2">
              <input
                type="text" value={params.setCode || ''} onChange={(e) => setParams({ ...params, setCode: e.target.value })}
                placeholder="Set code (e.g. mom)" className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500"
              />
              <input
                type="number" min="1" max="100" value={params.targetPercent || ''} onChange={(e) => setParams({ ...params, targetPercent: parseInt(e.target.value) })}
                placeholder="Target %" className="w-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500"
              />
            </div>
          )}
          {metric === 'high_value_card' && (
            <input
              type="number" min="0" step="0.01" value={params.minValue || ''} onChange={(e) => setParams({ minValue: parseFloat(e.target.value) })}
              placeholder="Minimum card value ($)" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500"
            />
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Target</label>
            <input
              type="number" min="1" value={target} onChange={(e) => setTarget(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !description.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {saving ? 'Submitting…' : 'Submit Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({ challenge, onOpenProof, onOpenLeaderboard }) {
  const progress = challenge.progress ?? 0;
  const pct = Math.min(100, Math.round((progress / challenge.target) * 100));
  const category = METRIC_CATEGORY[challenge.metric] || 'Manual';

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">{challenge.title}</h3>
          <p className="text-white/60 text-sm">{challenge.description}</p>
        </div>
        <span className="shrink-0 px-2 py-1 bg-purple-600/30 text-purple-300 text-xs font-medium rounded-full">
          {category}
        </span>
      </div>

      {challenge.progress !== undefined && (
        <div>
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>{progress} / {challenge.target}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${challenge.completed ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {challenge.metric === 'custom' && (
          <button
            onClick={() => onOpenProof(challenge)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
          >
            Submit Proof
          </button>
        )}
        <button
          onClick={() => onOpenLeaderboard(challenge)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <Award size={14} /> Leaderboard
        </button>
      </div>
    </div>
  );
}

export default function ChallengesView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [proofChallenge, setProofChallenge] = useState(null);
  const [leaderboardChallenge, setLeaderboardChallenge] = useState(null);
  const [showProposeModal, setShowProposeModal] = useState(false);

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/challenges`);
      setData(res.data);
    } catch (err) {
      setError('Failed to load challenges');
    }
  }, []);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const monthLabel = data?.month
    ? new Date(`${data.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={24} className="text-amber-400" />
          Monthly Challenges{monthLabel && ` — ${monthLabel}`}
        </h1>
        <button
          onClick={() => setShowProposeModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"
        >
          <Plus size={18} /> Propose a Challenge
        </button>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {!data ? (
        <p className="text-white/60">Loading…</p>
      ) : data.challenges.length === 0 ? (
        <p className="text-white/60 text-center py-12">No active challenges this month yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.challenges.map(challenge => (
            <ChallengeCard
              key={challenge._id}
              challenge={challenge}
              onOpenProof={setProofChallenge}
              onOpenLeaderboard={setLeaderboardChallenge}
            />
          ))}
        </div>
      )}

      {proofChallenge && (
        <ProofModal
          challenge={proofChallenge}
          onClose={() => setProofChallenge(null)}
          onSubmitted={() => { setProofChallenge(null); fetchChallenges(); }}
        />
      )}
      {leaderboardChallenge && (
        <LeaderboardDrawer challenge={leaderboardChallenge} onClose={() => setLeaderboardChallenge(null)} />
      )}
      {showProposeModal && (
        <ProposeModal
          onClose={() => setShowProposeModal(false)}
          onProposed={() => { setShowProposeModal(false); fetchChallenges(); }}
        />
      )}
    </div>
  );
}

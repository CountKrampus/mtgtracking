import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Check, X, Trophy } from 'lucide-react';
import { API_URL } from '../../../config';

const METRIC_OPTIONS = [
  'foils_added', 'cards_added', 'value_added', 'color_added',
  'rarity_added', 'unique_sets', 'set_completion', 'high_value_card',
  'trades_completed', 'wishlist_acquired',
  'forum_posts', 'forum_threads', 'forum_upvotes', 'custom'
];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function CreateChallengeForm({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState('cards_added');
  const [target, setTarget] = useState(10);
  const [month, setMonth] = useState(currentMonth());
  const [params, setParams] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await axios.post(`${API_URL}/admin/challenges`, { title, description, metric, target, month, params });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create challenge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/60 rounded-lg p-4 space-y-3 mb-4">
      {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">{error}</p>}
      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Title" maxLength={100}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500"
      />
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Description" maxLength={500} rows={2}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 resize-none"
      />
      <div className="grid grid-cols-3 gap-2">
        <select value={metric} onChange={(e) => { setMetric(e.target.value); setParams({}); }} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white">
          {METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="number" min="1" value={target} onChange={(e) => setTarget(parseInt(e.target.value) || 1)}
          placeholder="Target" className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
        />
        <input
          type="text" value={month} onChange={(e) => setMonth(e.target.value)}
          placeholder="YYYY-MM" className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
        />
      </div>
      {(metric === 'color_added' || metric === 'rarity_added') && (
        <input
          type="text" value={params[metric === 'color_added' ? 'color' : 'rarity'] || ''}
          onChange={(e) => setParams({ [metric === 'color_added' ? 'color' : 'rarity']: e.target.value })}
          placeholder={metric === 'color_added' ? 'Color letter (W/U/B/R/G/C)' : 'Rarity letter (C/U/R/M)'}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500"
        />
      )}
      {metric === 'set_completion' && (
        <div className="flex gap-2">
          <input type="text" value={params.setCode || ''} onChange={(e) => setParams({ ...params, setCode: e.target.value })} placeholder="Set code" className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500" />
          <input type="number" value={params.targetPercent || ''} onChange={(e) => setParams({ ...params, targetPercent: parseInt(e.target.value) })} placeholder="Target %" className="w-28 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500" />
        </div>
      )}
      {metric === 'high_value_card' && (
        <input type="number" step="0.01" value={params.minValue || ''} onChange={(e) => setParams({ minValue: parseFloat(e.target.value) })} placeholder="Min value ($)" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500" />
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-slate-300 hover:text-white text-sm">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim() || !description.trim()}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-sm font-medium"
        >
          {saving ? 'Creating…' : 'Create & Activate'}
        </button>
      </div>
    </div>
  );
}

function ChallengesTab() {
  const [subTab, setSubTab] = useState('active');
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/challenges`);
      setActiveChallenges(res.data.challenges);
    } catch (err) {
      setError('Failed to load active challenges');
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/challenges/proposals`);
      setProposals(res.data);
    } catch (err) {
      setError('Failed to load proposals');
    }
  }, []);

  useEffect(() => { fetchActive(); fetchProposals(); }, [fetchActive, fetchProposals]);

  const handleApprove = async (id) => {
    try {
      await axios.put(`${API_URL}/admin/challenges/proposals/${id}/approve`);
      fetchProposals();
      fetchActive();
    } catch (err) {
      setError('Failed to approve proposal');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this proposal?')) return;
    try {
      await axios.delete(`${API_URL}/admin/challenges/proposals/${id}`);
      fetchProposals();
    } catch (err) {
      setError('Failed to reject proposal');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Trophy size={20} className="text-amber-400" /> Challenges
        </h2>
        <button
          onClick={() => setShowCreateForm(v => !v)}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <Plus size={16} /> Create Challenge
        </button>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">{error}</p>}
      {showCreateForm && (
        <CreateChallengeForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => { setShowCreateForm(false); fetchActive(); }}
        />
      )}

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setSubTab('active')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${subTab === 'active' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'}`}
        >
          Active Challenges ({activeChallenges.length})
        </button>
        <button
          onClick={() => setSubTab('proposals')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${subTab === 'proposals' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'}`}
        >
          Proposals ({proposals.length})
        </button>
      </div>

      {subTab === 'active' && (
        <div className="space-y-2">
          {activeChallenges.length === 0 ? (
            <p className="text-slate-400 text-sm">No active challenges this month.</p>
          ) : activeChallenges.map(c => (
            <div key={c._id} className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-white font-medium">{c.title}</p>
              <p className="text-slate-400 text-sm">{c.metric} · target {c.target} · {c.month}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === 'proposals' && (
        <div className="space-y-2">
          {proposals.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending proposals.</p>
          ) : proposals.map(p => (
            <div key={p._id} className="bg-slate-800/60 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{p.title}</p>
                <p className="text-slate-400 text-sm truncate">
                  {p.metric} · target {p.target} · proposed by @{p.proposedBy?.username || 'unknown'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApprove(p._id)} className="p-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded" title="Approve">
                  <Check size={14} />
                </button>
                <button onClick={() => handleReject(p._id)} className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded" title="Reject">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChallengesTab;

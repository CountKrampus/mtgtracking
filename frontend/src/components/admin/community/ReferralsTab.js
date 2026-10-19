import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UserPlus, Check, X, RefreshCw, ShieldAlert, Settings } from 'lucide-react';
import { API_URL } from '../../../config';

// The referral reward settings exposed here map 1:1 to SystemSettings keys
// (backend/models/SystemSettings.js) and are read by the payout core
// (backend/utils/referralRewards.js). Numeric fields are saved as numbers so
// the reward math never has to coerce strings.
const REWARD_SETTINGS = [
  { key: 'referralsEnabled', label: 'Referrals enabled', type: 'boolean', default: true },
  { key: 'referralSignupRep', label: 'Referrer reward on signup (rep)', type: 'number', default: 10 },
  { key: 'referralQualificationRep', label: 'Referrer reward on activation (rep)', type: 'number', default: 50 },
  { key: 'referralReferredRep', label: 'Referred user reward on activation (rep)', type: 'number', default: 10 },
  { key: 'referralQualificationThreshold', label: 'Cards a referred user must own to activate', type: 'number', default: 20 },
];

const STATUS_STYLES = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
  qualified: 'bg-green-900/30 text-green-300 border-green-700/50',
  rejected: 'bg-red-900/30 text-red-300 border-red-700/50',
};

export default function ReferralsTab() {
  const [referrals, setReferrals] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [savingKey, setSavingKey] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter === 'all' ? {} : filter === 'flagged' ? { flagged: 'true' } : { status: filter };
      const [refRes, setRes] = await Promise.all([
        axios.get(`${API_URL}/referrals/admin/all`, { params }),
        axios.get(`${API_URL}/admin/settings`),
      ]);
      setReferrals(refRes.data);
      const raw = setRes.data || {};
      const flattened = {};
      for (const def of REWARD_SETTINGS) {
        const entry = raw[def.key];
        flattened[def.key] = entry && entry.value !== undefined ? entry.value : def.default;
      }
      setSettings(flattened);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const rejectReferral = async (id) => {
    if (!window.confirm('Reject this referral? This will not revoke rewards already paid.')) return;
    try {
      await axios.post(`${API_URL}/referrals/admin/${id}/reject`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject referral');
    }
  };

  const saveSetting = async (def) => {
    setSavingKey(def.key);
    setError(null);
    try {
      const value = def.type === 'number' ? Number(settings[def.key]) : Boolean(settings[def.key]);
      await axios.put(`${API_URL}/admin/settings/${def.key}`, { value });
      setSettings(prev => ({ ...prev, [def.key]: value }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <UserPlus size={20} /> Referrals
        </h2>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">{error}</p>
      )}

      {/* Reward settings */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Settings size={16} /> Reward settings
        </h3>
        <div className="space-y-2">
          {REWARD_SETTINGS.map((def) => (
            <div key={def.key} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded">
              <label className="text-slate-300 text-sm">{def.label}</label>
              <div className="flex items-center gap-2">
                {def.type === 'boolean' ? (
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, [def.key]: !prev[def.key] }))}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      settings[def.key] ? 'bg-green-600 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {settings[def.key] ? 'On' : 'Off'}
                  </button>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={settings[def.key] ?? def.default}
                    onChange={(e) => setSettings(prev => ({ ...prev, [def.key]: e.target.value }))}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                )}
                <button
                  onClick={() => saveSetting(def)}
                  disabled={savingKey === def.key}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm disabled:opacity-50"
                >
                  {savingKey === def.key ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'pending', 'qualified', 'rejected', 'flagged'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm capitalize ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Referral list */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading referrals…</p>
      ) : referrals.length === 0 ? (
        <p className="text-slate-400 text-sm">No referrals yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Referrer</th>
                <th className="py-2 pr-3">Referred</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">IP flag</th>
                <th className="py-2 pr-3">Signup paid</th>
                <th className="py-2 pr-3">Activ. paid</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r._id} className="border-b border-slate-800 text-slate-200">
                  <td className="py-2 pr-3 font-mono">{r.code}</td>
                  <td className="py-2 pr-3">{r.referrer || '—'}</td>
                  <td className="py-2 pr-3">{r.referred || '—'}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded border text-xs capitalize ${STATUS_STYLES[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {r.ipSimilarityFlag
                      ? <span className="text-yellow-300 flex items-center gap-1"><ShieldAlert size={14} /> flagged</span>
                      : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="py-2 pr-3">{r.signupRepAwarded ? <Check size={14} className="text-green-400" /> : '—'}</td>
                  <td className="py-2 pr-3">{r.qualificationRepAwarded ? <Check size={14} className="text-green-400" /> : '—'}</td>
                  <td className="py-2 pr-3 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    {r.status !== 'rejected' && (
                      <button
                        onClick={() => rejectReferral(r._id)}
                        className="flex items-center gap-1 px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs"
                      >
                        <X size={12} /> Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UserPlus, Copy, Check, RefreshCw, Users, Star, ShieldAlert, Ticket } from 'lucide-react';
import { API_URL } from '../config';

const STATUS_STYLES = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
  qualified: 'bg-green-900/30 text-green-300 border-green-700/50',
  rejected: 'bg-red-900/30 text-red-300 border-red-700/50',
};

export default function ReferralsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/referrals/me`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your referrals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ensureCode = async () => {
    try {
      await axios.post(`${API_URL}/referrals/code`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate your code');
    }
  };

  const inviteLink = data?.code
    ? `${window.location.origin}/register?ref=${data.code}`
    : null;

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (non-HTTPS / permissions) — fall back to a prompt
      window.prompt('Copy your invite link:', inviteLink);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Loading your referrals…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-2 text-sm">{error}</p>
      </div>
    );
  }

  const stats = data?.stats || { invited: 0, qualified: 0, flagged: 0 };
  const settings = data?.settings || {};

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserPlus size={22} /> Refer a Friend
        </h1>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <p className="text-slate-300 text-sm">
        Invite friends to MTG Tracker. You earn{' '}
        <span className="text-white font-medium">{settings.signupRep ?? 10} rep</span> when they sign up with
        your code, and a bonus of{' '}
        <span className="text-white font-medium">{settings.qualificationRep ?? 50} rep</span> once they add{' '}
        <span className="text-white font-medium">{settings.threshold ?? 20}</span> or more cards to their
        collection. They get{' '}
        <span className="text-white font-medium">{settings.referredRep ?? 10} rep</span> too.
      </p>

      {/* Your code + invite link */}
      <div className="bg-slate-800/60 rounded-lg p-4 space-y-3">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Ticket size={16} /> Your invite code
        </h2>
        {data?.code ? (
          <>
            <div className="flex items-center gap-2">
              <code className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-xl tracking-widest text-white font-mono">
                {data.code}
              </code>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <p className="text-slate-400 text-xs break-all">{inviteLink}</p>
          </>
        ) : (
          <button
            onClick={ensureCode}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
          >
            Generate my code
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.invited}</div>
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
            <Users size={12} /> Invited
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.qualified}</div>
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
            <Star size={12} /> Activated
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.flagged}</div>
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
            <ShieldAlert size={12} /> Under review
          </div>
        </div>
      </div>

      {/* Invite history */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Your invites</h2>
        {!data?.referrals?.length ? (
          <p className="text-slate-400 text-sm">
            No invites yet. Share your code to start earning reputation.
          </p>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded text-sm"
              >
                <div>
                  <span className="text-white">{r.referred?.username || 'Unknown user'}</span>
                  <span className="text-slate-500 ml-2 text-xs">
                    joined {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {r.ipSimilarityFlag && (
                    <span className="text-yellow-300 flex items-center gap-1 text-xs">
                      <ShieldAlert size={12} /> review
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded border text-xs capitalize ${STATUS_STYLES[r.status] || ''}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

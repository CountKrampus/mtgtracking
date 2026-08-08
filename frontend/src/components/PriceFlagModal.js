import React, { useState, useEffect } from 'react';
import { X, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const STATUS_COLORS = {
  pending:   'text-yellow-400',
  resolved:  'text-green-400',
  dismissed: 'text-slate-400',
};
const STATUS_LABELS = { pending: 'Pending', resolved: 'Resolved', dismissed: 'Dismissed' };

// Lets a trusted user (reputation >= 50, enforced server-side) flag a card's
// price as incorrect for admin review. See backend/routes/priceFlags.js and
// the admin Price Corrections tab (frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js).
function PriceFlagModal({ card, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    if (history !== null) { setShowHistory(v => !v); return; }
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/cards/my-flags`);
      setHistory(res.data);
      setShowHistory(true);
    } catch {
      setHistory([]);
      setShowHistory(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await axios.post(`${API_URL}/cards/${card._id}/flag-price`, { reason: reason.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.status === 409
        ? 'You already have a pending flag for this card.'
        : (err.response?.data?.message || 'Failed to submit flag'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Flag size={18} className="text-orange-400" />
            Flag Price
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-slate-400 text-sm mb-3">
          {card.name} — currently ${(card.price || 0).toFixed(2)}
        </p>

        {submitted ? (
          <p className="text-green-400 text-sm bg-green-900/20 border border-green-500/30 rounded px-3 py-2">
            Flagged for admin review. Thanks for helping keep prices accurate!
          </p>
        ) : (
          <>
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2 mb-3">
                {error}
              </p>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="What's wrong with this price? (optional)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
            />
            <p className="text-slate-500 text-xs text-right mt-1">{reason.length}/300</p>
          </>
        )}

        <div className="flex justify-between items-center gap-3 mt-4">
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition"
          >
            {historyLoading ? 'Loading…' : 'My flags'}
            {!historyLoading && (showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">
              {submitted ? 'Close' : 'Cancel'}
            </button>
            {!submitted && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                {saving ? 'Submitting…' : 'Submit Flag'}
              </button>
            )}
          </div>
        </div>

        {showHistory && history !== null && (
          <div className="mt-4 border-t border-slate-700 pt-3 space-y-2 max-h-48 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-slate-500 text-xs">No flags submitted yet.</p>
            ) : history.map(f => (
              <div key={f._id} className="flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-white font-medium">{f.cardName}</span>
                  {f.cardSet && <span className="text-slate-500 ml-1">({f.cardSet})</span>}
                  {f.reason && <p className="text-slate-400 truncate">{f.reason}</p>}
                </div>
                <span className={`flex-shrink-0 font-medium ${STATUS_COLORS[f.status]}`}>
                  {STATUS_LABELS[f.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PriceFlagModal;

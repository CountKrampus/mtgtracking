import React, { useState } from 'react';
import { X, Bell } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// Lets a user set low/high price thresholds on an owned card. The backend's
// nightly price snapshot job (backend/jobs/dailyPriceSnapshot.js) checks these
// against each day's fetched price and fires a notification on a fresh crossing.
function PriceAlertModal({ card, onClose, onSaved }) {
  const [targetPrice, setTargetPrice] = useState(card.priceAlert?.targetPrice ?? '');
  const [targetHigh, setTargetHigh] = useState(card.priceAlert?.targetHigh ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setError(null);
    const low = targetPrice === '' ? undefined : parseFloat(targetPrice);
    const high = targetHigh === '' ? undefined : parseFloat(targetHigh);

    if (low !== undefined && high !== undefined && low >= high) {
      setError('Low target must be less than high target');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API_URL}/cards/${card._id}/finance`, {
        priceAlert: {
          targetPrice: low,
          targetHigh: high,
          emailNotification: false,
          lastAlertFiredAt: null,
          lastHighAlertFiredAt: null,
        },
      });
      onSaved();
    } catch (err) {
      setError('Failed to save price alert');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/cards/${card._id}/finance`, {
        priceAlert: { targetPrice: undefined, targetHigh: undefined, emailNotification: false, lastAlertFiredAt: null, lastHighAlertFiredAt: null },
      });
      onSaved();
    } catch (err) {
      setError('Failed to clear price alert');
    } finally {
      setSaving(false);
    }
  };

  const hasAlert = card.priceAlert?.targetPrice > 0 || card.priceAlert?.targetHigh > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            Price Alert
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          {card.name} — currently ${(card.price || 0).toFixed(2)}
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-white mb-1">Notify when price drops to</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g. 2.00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-white mb-1">Notify when price rises to</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetHigh}
              onChange={(e) => setTargetHigh(e.target.value)}
              placeholder="e.g. 15.00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {hasAlert && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
            >
              Clear Alert
            </button>
          )}
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-slate-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {saving ? 'Saving…' : 'Save Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PriceAlertModal;

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Flag, Check, X } from 'lucide-react';
import { API_URL } from '../../../config';

function PriceCorrectionsTab() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/price-flags?status=pending`);
      setFlags(res.data);
    } catch (err) {
      setError('Failed to load price flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleAction = async (id, action) => {
    try {
      await axios.put(`${API_URL}/admin/price-flags/${id}`, { action });
      fetchFlags();
    } catch (err) {
      setError(`Failed to ${action} flag`);
    }
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Flag size={20} className="text-orange-400" /> Price Corrections
      </h2>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      {flags.length === 0 ? (
        <p className="text-slate-400 text-sm">No pending price flags.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-left">
                <th className="py-2 pr-4">Card Name</th>
                <th className="py-2 pr-4">Set</th>
                <th className="py-2 pr-4">Current Price</th>
                <th className="py-2 pr-4">Flagged By</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Flagged At</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(flag => (
                <tr key={flag._id} className="border-b border-slate-800">
                  <td className="py-2 pr-4 text-white">{flag.cardId?.name || 'Unknown'}</td>
                  <td className="py-2 pr-4 text-slate-300">{flag.cardId?.set || '—'}</td>
                  <td className="py-2 pr-4 text-slate-300">${(flag.cardId?.price || 0).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-slate-300">
                    @{flag.flaggedBy?.username || 'unknown'} ({flag.flaggedBy?.reputation || 0} rep)
                  </td>
                  <td className="py-2 pr-4 text-slate-400 max-w-xs truncate">{flag.reason || '—'}</td>
                  <td className="py-2 pr-4 text-slate-400">{new Date(flag.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(flag._id, 'resolve')}
                        className="p-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded"
                        title="Resolve (refresh price)"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleAction(flag._id, 'dismiss')}
                        className="p-1.5 bg-slate-600/80 hover:bg-slate-600 text-white rounded"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>
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

export default PriceCorrectionsTab;

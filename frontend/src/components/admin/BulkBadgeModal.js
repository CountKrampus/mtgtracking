import React, { useState, useEffect } from 'react';
import { X, Award } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function BulkBadgeModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [badges, setBadges] = useState([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await authFetch(`${API_URL}/admin/badges`);
        const data = await response.json();
        if (response.ok) {
          setBadges(data.badges || []);
        }
      } catch (err) {
        setError('Failed to load badges');
      } finally {
        setLoadingBadges(false);
      }
    };
    fetchBadges();
  }, [authFetch]);

  const handleGrant = async () => {
    if (!selectedBadgeId) {
      setError('Select a badge to grant');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/users/bulk-badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, badgeId: selectedBadgeId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to grant badge');
        return;
      }
      onSuccess();
    } catch (err) {
      setError('Network error — failed to grant badge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Award size={20} className="text-purple-400" />
            Grant to {userIds.length} users
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div>
          {loadingBadges ? (
            <p className="text-gray-400 text-sm">Loading badges…</p>
          ) : (
            <select
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">— Select a badge —</option>
              {badges.map((badge) => (
                <option key={badge._id} value={badge._id}>
                  {badge.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1 text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGrant}
            disabled={loading || loadingBadges}
            className="px-4 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkBadgeModal;

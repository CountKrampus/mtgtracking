import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function Bulk2FAResetModal({ userIds, onClose, onSuccess }) {
  const { authFetch } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/users/bulk-2fa-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Failed to reset 2FA');
        return;
      }
      onSuccess();
    } catch (err) {
      setError('Network error — failed to reset 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Shield size={20} className="text-orange-400" />
            Reset 2FA
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-300 text-sm">
          This will force {userIds.length} users to re-enroll in 2FA on next login. Their existing
          authenticator app codes will no longer work until they re-configure 2FA.
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1 text-gray-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Resetting…' : 'Confirm Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Bulk2FAResetModal;

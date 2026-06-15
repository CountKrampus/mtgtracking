import React, { useState, useEffect } from 'react';
import { Gavel, Trash2 } from 'lucide-react';

export default function MuteManager({ apiUrl = 'http://localhost:5000/api', isOpen, onClose }) {
  const [mutes, setMutes] = useState([]);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');

  // Fetch mutes on mount or when apiUrl changes
  useEffect(() => {
    const fetchMutes = async () => {
      try {
        const response = await fetch(`${apiUrl}/admin/mutes`);
        const data = await response.json();
        setMutes(data);
      } catch (error) {
        console.error('Error fetching mutes:', error);
      }
    };
    fetchMutes();
  }, [apiUrl]);

  const handleCreateMute = async () => {
    if (!userId || !reason.trim()) return;
    try {
      await fetch(`${apiUrl}/admin/mute/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      setUserId('');
      setReason('');
      const response = await fetch(`${apiUrl}/admin/mutes`);
      setMutes(await response.json());
    } catch (error) {
      console.error('Error creating mute:', error);
    }
  };

  const handleRevokeMute = async (userId) => {
    try {
      await fetch(`${apiUrl}/admin/mute/${userId}`, {
        method: 'DELETE'
      });
      const response = await fetch(`${apiUrl}/admin/mutes`);
      setMutes(await response.json());
    } catch (error) {
      console.error('Error revoking mute:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Gavel size={24} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Mute Manager</h2>
      </div>

      <div className="space-y-4 mb-6 bg-slate-800/50 p-4 rounded border border-slate-700">
        <div>
          <label className="block text-sm font-semibold text-white mb-2">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-2">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for mute"
            rows="3"
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
          />
        </div>

        <button
          onClick={handleCreateMute}
          disabled={!userId || !reason.trim()}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-white font-semibold"
        >
          Create Mute
        </button>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <h3 className="font-semibold text-white mb-3">Active Mutes</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {mutes.length === 0 ? (
            <div className="text-slate-400">No active mutes</div>
          ) : (
            mutes.map(mute => (
              <div key={mute._id} className="bg-slate-800 p-3 rounded border border-red-600/30 flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-white">
                    {mute.userId?.displayName || mute.userId?.username || 'Unknown'}
                  </div>
                  <div className="text-xs text-slate-400">{mute.reason}</div>
                  <div className="text-xs text-red-400 mt-1">
                    Level {mute.muteLevel} • Expires {new Date(mute.expiresAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeMute(mute.userId._id)}
                  className="p-1 hover:bg-slate-700 rounded ml-2"
                  title="Revoke mute"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

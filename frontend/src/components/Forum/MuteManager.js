import React, { useState, useEffect } from 'react';
import { Gavel, Trash2, Plus, Eye, Check, X } from 'lucide-react';

const getMuteLevelColor = (level) => {
  const colors = {
    1: 'bg-yellow-600',
    2: 'bg-orange-600',
    3: 'bg-red-600',
    4: 'bg-red-800',
    5: 'bg-purple-800',
  };
  return colors[level] || 'bg-slate-600';
};

const getMuteLevelLabel = (level) => {
  const labels = { 1: 'Warning', 2: 'Minor', 3: 'Moderate', 4: 'Severe', 5: 'Permanent' };
  return labels[level] || 'Unknown';
};

export default function MuteManager({ apiUrl = 'http://localhost:5000/api', isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('mutes');

  // Active Mutes state
  const [mutes, setMutes] = useState([]);
  const [mutesLoading, setMutesLoading] = useState(true);
  const [expandedMuteId, setExpandedMuteId] = useState(null);

  // New Mute modal state
  const [showNewMuteModal, setShowNewMuteModal] = useState(false);
  const [newMuteUserId, setNewMuteUserId] = useState('');
  const [newMuteReason, setNewMuteReason] = useState('');
  const [newMuteLevel, setNewMuteLevel] = useState('1');
  const [newMuteDuration, setNewMuteDuration] = useState('24');
  const [muteSubmitting, setMuteSubmitting] = useState(false);

  // Appeals state
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchMutes = async () => {
    setMutesLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/mutes`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMutes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching mutes:', err);
      setMutes([]);
    } finally {
      setMutesLoading(false);
    }
  };

  const fetchAppeals = async () => {
    setAppealsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/appeals`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAppeals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
      setAppeals([]);
    } finally {
      setAppealsLoading(false);
    }
  };

  useEffect(() => {
    fetchMutes();
    fetchAppeals();
  }, [apiUrl]);

  const handleUnmute = async (muteUserId) => {
    try {
      const response = await fetch(`${apiUrl}/admin/mute/${muteUserId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fetchMutes();
    } catch (err) {
      console.error('Error removing mute:', err);
    }
  };

  const handleNewMuteSubmit = async () => {
    if (!newMuteUserId.trim() || !newMuteReason.trim()) return;
    setMuteSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/admin/mute/${newMuteUserId.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: newMuteReason,
          level: parseInt(newMuteLevel, 10),
          duration: newMuteLevel === '5' ? undefined : parseInt(newMuteDuration, 10),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setShowNewMuteModal(false);
      setNewMuteUserId('');
      setNewMuteReason('');
      setNewMuteLevel('1');
      setNewMuteDuration('24');
      fetchMutes();
    } catch (err) {
      console.error('Error creating mute:', err);
    } finally {
      setMuteSubmitting(false);
    }
  };

  const handleApproveAppeal = async (appealId) => {
    try {
      const response = await fetch(`${apiUrl}/admin/appeals/${appealId}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fetchAppeals();
    } catch (err) {
      console.error('Error approving appeal:', err);
    }
  };

  const handleRejectAppeal = async (appealId) => {
    try {
      const response = await fetch(`${apiUrl}/admin/appeals/${appealId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setRejectingId(null);
      setRejectReason('');
      fetchAppeals();
    } catch (err) {
      console.error('Error rejecting appeal:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gavel size={24} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Mute Manager</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('mutes')}
          className={`px-4 py-2 text-sm font-semibold rounded-t transition ${
            activeTab === 'mutes'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Mutes
        </button>
        <button
          onClick={() => setActiveTab('appeals')}
          className={`px-4 py-2 text-sm font-semibold rounded-t transition ${
            activeTab === 'appeals'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Appeals
        </button>
      </div>

      {/* Active Mutes Tab */}
      {activeTab === 'mutes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewMuteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition"
            >
              <Plus size={16} />
              New Mute
            </button>
          </div>

          {mutesLoading ? (
            <div className="text-slate-400 text-sm">Loading mutes...</div>
          ) : mutes.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">No active mutes</div>
          ) : (
            <div className="space-y-2">
              {mutes.map(mute => (
                <div key={mute._id} className="bg-slate-800/50 rounded border border-slate-700">
                  <div className="flex items-start gap-3 p-3">
                    {/* Level badge */}
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-white text-xs font-bold ${getMuteLevelColor(mute.muteLevel || mute.level)}`}>
                      L{mute.muteLevel || mute.level} {getMuteLevelLabel(mute.muteLevel || mute.level)}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {mute.userId?.displayName || mute.userId?.username || 'Unknown User'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{mute.reason}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Expires:{' '}
                        {mute.expiresAt
                          ? new Date(mute.expiresAt).toLocaleString()
                          : 'Permanent'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setExpandedMuteId(expandedMuteId === mute._id ? null : mute._id)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleUnmute(mute.userId?._id || mute.userId)}
                        className="p-1 hover:bg-red-900/50 rounded text-red-400 hover:text-red-300 transition"
                        title="Unmute"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded mute history */}
                  {expandedMuteId === mute._id && (
                    <div className="border-t border-slate-700 px-3 py-2 bg-slate-900/40">
                      <div className="text-xs text-slate-400 font-semibold mb-2">Mute History</div>
                      {Array.isArray(mute.history) && mute.history.length > 0 ? (
                        <div className="space-y-1">
                          {mute.history.map((entry, i) => (
                            <div key={i} className="text-xs text-slate-300">
                              <span className="text-slate-500">{new Date(entry.date || entry.createdAt).toLocaleDateString()}</span>
                              {' — '}
                              {entry.reason || entry.action || 'Muted'}
                              {entry.level && ` (Level ${entry.level})`}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No history available</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appeals Tab */}
      {activeTab === 'appeals' && (
        <div className="space-y-3">
          {appealsLoading ? (
            <div className="text-slate-400 text-sm">Loading appeals...</div>
          ) : appeals.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">No pending appeals</div>
          ) : (
            <div className="space-y-3">
              {appeals.map(appeal => (
                <div key={appeal._id} className="bg-slate-800/50 rounded border border-slate-700 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {appeal.userId?.displayName || appeal.userId?.username || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Original reason: {appeal.originalReason || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-300 mt-1 italic">
                        "{appeal.appealMessage}"
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Appealed {appeal.createdAt ? new Date(appeal.createdAt).toLocaleDateString() : 'Unknown date'}
                      </div>
                    </div>

                    {/* Approve / Reject buttons */}
                    {rejectingId !== appeal._id && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleApproveAppeal(appeal._id)}
                          className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition"
                          title="Approve appeal"
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(appeal._id);
                            setRejectReason('');
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs font-semibold transition"
                          title="Reject appeal"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline reject reason form */}
                  {rejectingId === appeal._id && (
                    <div className="space-y-2 border-t border-slate-700 pt-2">
                      <label className="text-xs text-slate-400 font-semibold">Rejection reason</label>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Explain why the appeal is rejected..."
                        rows={2}
                        className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectAppeal(appeal._id)}
                          disabled={!rejectReason.trim()}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs font-semibold transition"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-semibold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Mute Modal */}
      {showNewMuteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-slate-900 rounded-t-2xl sm:rounded-lg border border-slate-700 w-full sm:max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">New Mute</h3>
              <button
                onClick={() => setShowNewMuteModal(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-1">User ID</label>
                <input
                  type="text"
                  value={newMuteUserId}
                  onChange={e => setNewMuteUserId(e.target.value)}
                  placeholder="MongoDB user ID"
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-1">Reason</label>
                <textarea
                  value={newMuteReason}
                  onChange={e => setNewMuteReason(e.target.value)}
                  placeholder="Reason for mute..."
                  rows={3}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-1">Mute Level</label>
                <select
                  value={newMuteLevel}
                  onChange={e => setNewMuteLevel(e.target.value)}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="1">1 - Warning (24h)</option>
                  <option value="2">2 - Minor (3 days)</option>
                  <option value="3">3 - Moderate (7 days)</option>
                  <option value="4">4 - Severe (30 days)</option>
                  <option value="5">5 - Permanent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-1">Duration (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={newMuteDuration}
                  onChange={e => setNewMuteDuration(e.target.value)}
                  disabled={newMuteLevel === '5'}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm disabled:opacity-50"
                />
                {newMuteLevel === '5' && (
                  <p className="text-xs text-slate-400 mt-1">Duration not applicable for permanent mutes</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-700">
              <button
                onClick={handleNewMuteSubmit}
                disabled={!newMuteUserId.trim() || !newMuteReason.trim() || muteSubmitting}
                className="flex-1 px-4 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded font-semibold transition"
              >
                {muteSubmitting ? 'Submitting...' : 'Submit Mute'}
              </button>
              <button
                onClick={() => setShowNewMuteModal(false)}
                className="px-4 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

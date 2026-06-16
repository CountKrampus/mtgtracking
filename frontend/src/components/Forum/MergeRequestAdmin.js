import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { API_URL } from '../../config';

export default function MergeRequestAdmin() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [resolvedRequests, setResolvedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionErrors, setActionErrors] = useState({});

  useEffect(() => {
    const fetchMergeRequests = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const res = await fetch(`${API_URL}/forum/admin/merge-requests`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();

        if (Array.isArray(data)) {
          setPendingRequests(data.filter(r => r.status === 'pending'));
          setResolvedRequests(data.filter(r => r.status !== 'pending'));
        } else {
          setPendingRequests(data.pending || []);
          setResolvedRequests(data.resolved || []);
        }
      } catch (err) {
        setFetchError(err.message || 'Failed to load merge requests');
      } finally {
        setLoading(false);
      }
    };

    fetchMergeRequests();
  }, []);

  const handleApprove = async (req) => {
    setActionLoadingId(req._id);
    setActionErrors(prev => ({ ...prev, [req._id]: '' }));
    try {
      const res = await fetch(`${API_URL}/forum/threads/${req.sourceThread._id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetThreadId: req.targetThread._id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error: ${res.status}`);
      }
      setPendingRequests(prev => prev.filter(r => r._id !== req._id));
      setResolvedRequests(prev => [{ ...req, status: 'approved', updatedAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [req._id]: err.message || 'Failed to approve merge' }));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (req) => {
    setActionLoadingId(req._id);
    setActionErrors(prev => ({ ...prev, [req._id]: '' }));
    try {
      const res = await fetch(`${API_URL}/forum/threads/${req.sourceThread._id}/merge-request/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error: ${res.status}`);
      }
      setPendingRequests(prev => prev.filter(r => r._id !== req._id));
      setResolvedRequests(prev => [{ ...req, status: 'rejected', updatedAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [req._id]: err.message || 'Failed to reject merge request' }));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getSimilarityPercent = (similarity) => {
    if (!similarity) return null;
    if (similarity > 1) return Math.round(similarity);
    return Math.round(similarity * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={24} className="animate-spin text-purple-400" />
        <span className="ml-3 text-slate-400">Loading merge requests...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 bg-red-600/20 border border-red-600/30 rounded text-red-400">
        {fetchError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-0 border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 px-4 py-2 font-semibold text-sm transition ${
            activeTab === 'pending' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Pending ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`flex-1 px-4 py-2 font-semibold text-sm transition ${
            activeTab === 'resolved' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Resolved ({resolvedRequests.length})
        </button>
      </div>

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No pending merge requests</p>
          ) : (
            pendingRequests.map((req) => (
              <div key={req._id} className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-3">
                <div className="space-y-1">
                  <div className="text-sm text-slate-400">
                    <span className="font-medium text-slate-300">Source Thread:</span>{' '}
                    <span className="text-white">{req.sourceThread?.title || 'Unknown'}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    <span className="font-medium text-slate-300">Merge Into:</span>{' '}
                    <span className="text-white">{req.targetThread?.title || 'Unknown'}</span>
                  </div>
                  {req.similarity != null && (
                    <span className="inline-block px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400 text-xs font-semibold">
                      {getSimilarityPercent(req.similarity)}% match
                    </span>
                  )}
                  {req.requestedBy && (
                    <div className="text-xs text-slate-500">Requested by: {req.requestedBy}</div>
                  )}
                </div>

                {actionErrors[req._id] && (
                  <div className="p-2 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-xs">
                    {actionErrors[req._id]}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={actionLoadingId === req._id}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionLoadingId === req._id && <Loader size={14} className="animate-spin" />}
                    Approve Merge
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={actionLoadingId === req._id}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-sm transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Resolved Tab */}
      {activeTab === 'resolved' && (
        <div className="space-y-3">
          {resolvedRequests.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No resolved merge requests</p>
          ) : (
            resolvedRequests.map((req) => (
              <div key={req._id} className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="text-sm text-slate-400">
                      <span className="font-medium text-slate-300">Source Thread:</span>{' '}
                      <span className="text-white">{req.sourceThread?.title || 'Unknown'}</span>
                    </div>
                    <div className="text-sm text-slate-400">
                      <span className="font-medium text-slate-300">Merge Into:</span>{' '}
                      <span className="text-white">{req.targetThread?.title || 'Unknown'}</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 rounded text-xs font-semibold ${
                    req.status === 'approved'
                      ? 'bg-green-600/20 border border-green-600/30 text-green-400'
                      : 'bg-red-600/20 border border-red-600/30 text-red-400'
                  }`}>
                    {req.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(req.updatedAt || req.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

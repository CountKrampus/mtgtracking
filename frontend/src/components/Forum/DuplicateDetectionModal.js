import React, { useState } from 'react';
import { X, GitMerge } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function DuplicateDetectionModal({ isOpen, onClose, suggestedDuplicates, onMergeRequest, newThreadId }) {
  const [loadingId, setLoadingId] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleMergeRequest = async (targetThreadId) => {
    setLoadingId(targetThreadId);
    setError('');

    try {
      await axios.put(`${API_URL}/forum/threads/${newThreadId}/merge-request`, {
        suggestedThreadId: targetThreadId,
        reason: 'User submitted merge request after duplicate detection'
      });
      setSuccessId(targetThreadId);
      onMergeRequest?.(targetThreadId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit merge request');
    } finally {
      setLoadingId(null);
    }
  };

  const getSimilarityPercent = (similarity) => {
    if (similarity > 1) return Math.round(similarity);
    return Math.round(similarity * 100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-lg border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <GitMerge size={22} className="text-amber-400" />
            <h2 className="text-xl font-bold text-white">Similar Threads Detected</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Subtitle */}
          <p className="text-slate-400 text-sm">
            Your thread was created, but we found similar existing threads. Would you like to merge your thread into one of these?
          </p>

          {/* Success Message */}
          {successId && (
            <div className="p-3 bg-green-600/20 border border-green-600/30 rounded text-green-400 text-sm">
              Merge request submitted! An admin will review and merge the threads.
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Duplicate List */}
          <div className="space-y-3">
            {suggestedDuplicates && suggestedDuplicates.map((dup) => (
              <div
                key={dup.threadId}
                className="flex items-center justify-between gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={`/forum/thread/${dup.threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-medium hover:text-purple-400 transition truncate block"
                  >
                    {dup.title}
                  </a>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400 text-xs font-semibold">
                    {getSimilarityPercent(dup.similarity)}% match
                  </span>
                </div>
                <button
                  onClick={() => handleMergeRequest(dup.threadId)}
                  disabled={loadingId !== null || successId === dup.threadId}
                  className="flex-shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-sm transition disabled:opacity-50"
                >
                  {loadingId === dup.threadId ? 'Submitting...' : successId === dup.threadId ? 'Requested' : 'Request Merge'}
                </button>
              </div>
            ))}
          </div>

          {/* Footer Button */}
          <div className="flex justify-end pt-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded font-semibold transition"
            >
              Ignore Suggestions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

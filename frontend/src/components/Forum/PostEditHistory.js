import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function PostEditHistory({ postId, apiUrl, isOpen, onClose }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/forum/posts/${postId}/edits`);
        const data = await response.json();
        setHistory(data);
      } catch (error) {
        console.error('Error fetching edit history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, postId, apiUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit History</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-slate-400">Loading...</div>
        ) : history && history.editHistory.length > 0 ? (
          <div className="p-4 space-y-4">
            {history.editHistory.map((edit, idx) => (
              <div key={idx} className="bg-slate-900 p-3 rounded border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">
                  Edited by {edit.editedBy?.displayName || 'Unknown'} on{' '}
                  {new Date(edit.editedAt).toLocaleString()}
                </div>
                <div className="bg-slate-800 p-2 rounded text-sm text-slate-300">
                  <div className="line-through text-red-400">
                    {edit.originalBody}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-slate-400">No edits</div>
        )}
      </div>
    </div>
  );
}

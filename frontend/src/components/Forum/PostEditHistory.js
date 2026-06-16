import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import UserAvatar from '../avatars/UserAvatar';

// Client-side line diff — produces [{type:'removed'|'added'|'unchanged', text}]
function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const result = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];

    if (o === undefined) {
      result.push({ type: 'added', text: n });
    } else if (n === undefined) {
      result.push({ type: 'removed', text: o });
    } else if (o === n) {
      result.push({ type: 'unchanged', text: o });
    } else {
      result.push({ type: 'removed', text: o });
      result.push({ type: 'added', text: n });
    }
  }
  return result;
}

function SkeletonLoader() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="bg-slate-900 p-3 rounded border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-slate-700" />
            <div className="h-3 w-32 bg-slate-700 rounded" />
            <div className="h-3 w-24 bg-slate-700 rounded ml-2" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-700 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditItem({ edit, nextBody, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Each edit's originalBody is what the post looked like BEFORE that edit.
  // nextBody is the body that came after this edit (i.e. what it became).
  const diff = computeDiff(edit.originalBody || '', nextBody || '');
  const hasChanges = diff.some((d) => d.type !== 'unchanged');

  const editor = edit.editedBy;
  const displayName = editor?.displayName || editor?.username || 'Unknown';
  const avatarUrl = editor?.avatar;

  return (
    <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
      {/* Summary row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 transition text-left"
      >
        <UserAvatar avatarUrl={avatarUrl} username={displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white">{displayName}</span>
          <span className="text-xs text-slate-400 ml-2">
            {new Date(edit.editedAt).toLocaleString()}
          </span>
          {edit.reason && edit.reason !== 'User edit' && (
            <span className="text-xs text-slate-400 ml-2 italic">— {edit.reason}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded: diff + view-full toggle */}
      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3 space-y-3">
          {hasChanges ? (
            <div className="font-mono text-xs rounded overflow-hidden border border-slate-700">
              {diff.map((line, idx) => {
                if (line.type === 'unchanged') return null; // hide unchanged in diff
                return (
                  <div
                    key={idx}
                    className={
                      line.type === 'removed'
                        ? 'bg-red-900/40 text-red-300 px-2 py-0.5 whitespace-pre-wrap'
                        : 'bg-green-900/40 text-green-300 px-2 py-0.5 whitespace-pre-wrap'
                    }
                  >
                    <span className="select-none mr-1">
                      {line.type === 'removed' ? '−' : '+'}
                    </span>
                    {line.text || ' '}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">No line-level differences detected.</div>
          )}

          {/* View Full button */}
          <button
            onClick={() => setShowFull((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            <FileText size={12} />
            {showFull ? 'Hide full version' : 'View full version before this edit'}
          </button>

          {showFull && (
            <div className="bg-slate-800 rounded p-3 text-xs text-slate-300 whitespace-pre-wrap border border-slate-600 max-h-48 overflow-y-auto">
              {edit.originalBody || '(empty)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostEditHistory({ postId, apiUrl, isOpen, onClose }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !postId) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      setHistory(null);
      try {
        const response = await fetch(`${apiUrl}/forum/posts/${postId}/edits`);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) setHistory(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load edit history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [isOpen, postId, apiUrl]);

  if (!isOpen) return null;

  const edits = history?.editHistory || [];
  // The "current" body is history.originalBody (the live body of the post right now).
  // Each edit[i].originalBody is what the post was before edit[i].
  // After edit[i] the body became what it is for edit[i+1].originalBody, or the current body.
  const bodyAfterEdit = (idx) => {
    if (idx + 1 < edits.length) return edits[idx + 1].originalBody;
    return history?.originalBody || '';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Edit History</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading && <SkeletonLoader />}

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && history && (
            <>
              {edits.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-8">
                  This post has not been edited.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 mb-1">
                    {edits.length} edit{edits.length !== 1 ? 's' : ''} — oldest first. Click an entry to see changes.
                  </p>
                  {edits.map((edit, idx) => (
                    <EditItem
                      key={edit._id || idx}
                      edit={edit}
                      nextBody={bodyAfterEdit(idx)}
                      isLast={idx === edits.length - 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

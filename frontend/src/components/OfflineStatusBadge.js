import React from 'react';

export default function OfflineStatusBadge({ offline, queuedRequestCount, syncStatus }) {
  if (!offline && queuedRequestCount === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition">
      {offline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
          <span className="text-amber-100">Offline mode</span>
        </>
      ) : (
        <span className="text-slate-200">{syncStatus === 'syncing' ? 'Syncing...' : 'Pending sync'}</span>
      )}
      {queuedRequestCount > 0 && (
        <span className="text-slate-300">· {queuedRequestCount} pending</span>
      )}
    </div>
  );
}

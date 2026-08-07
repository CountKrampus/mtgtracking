import React from 'react';
import { MessageSquare, MessageCircle } from 'lucide-react';
import NotificationBell from './NotificationBell';
import OfflineStatusBadge from './OfflineStatusBadge';
import UserMenu from './UserMenu';

export default function AppHeader({
  authUser,
  apiUrl,
  offline,
  queuedRequestCount,
  syncStatus,
  openPanel,
  setOpenPanel,
  onOpenMessages,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenFeedback,
  onLogout,
}) {
  if (!authUser) return null;

  return (
    <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
      <div className="flex-1 flex items-center gap-2">
        <OfflineStatusBadge
          offline={offline}
          queuedRequestCount={queuedRequestCount}
          syncStatus={syncStatus}
        />
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell apiUrl={apiUrl} user={authUser} openPanel={openPanel} setOpenPanel={setOpenPanel} />
        <button
          onClick={onOpenMessages}
          className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
          title="Messages"
        >
          <MessageSquare size={20} />
        </button>
        <button
          onClick={onOpenFeedback}
          className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
          title="Send Feedback"
        >
          <MessageCircle size={20} />
        </button>
        <UserMenu
          user={authUser}
          onProfile={onOpenProfile}
          onSettings={onOpenAccountSettings}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}

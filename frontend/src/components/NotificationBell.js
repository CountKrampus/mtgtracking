import React, { useState, useEffect } from 'react';
import { Bell, X, Eye, Trash2 } from 'lucide-react';

export default function NotificationBell({ apiUrl, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const typeEmojis = {
    mention: '💬',
    reply: '📝',
    upvote: '⬆️',
    dm: '💌'
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${apiUrl}/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await fetch(`${apiUrl}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await fetch(`${apiUrl}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${apiUrl}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-purple-400 hover:text-purple-300 transition"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No notifications yet</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-3 border-l-4 border-purple-500 flex items-start gap-3 hover:bg-slate-700/50 transition ${
                    !notif.isRead ? 'bg-slate-700/30' : ''
                  }`}
                >
                  <span className="text-lg mt-1">{typeEmojis[notif.type] || '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">
                      {notif.fromUserId?.displayName || 'User'} · {notif.type}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5 truncate">{notif.content}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif._id)}
                        className="p-1 hover:bg-slate-600 rounded text-blue-400"
                        title="Mark as read"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notif._id)}
                      className="p-1 hover:bg-slate-600 rounded text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

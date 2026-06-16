import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

export default function DMPreview({ apiUrl, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${apiUrl}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        setUnreadCount(data.totalUnread || 0);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
        title="Direct Messages"
      >
        <MessageCircle size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
            <h3 className="font-semibold text-white">Messages</h3>
          </div>

          {conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No messages yet</div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.otherUserId}
                  onClick={() => window.location.href = `/messages/${conv.otherUserId}`}
                  className="w-full text-left p-3 border-l-4 border-blue-500 hover:bg-slate-700/50 transition flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(conv.otherUser?.displayName || conv.otherUser?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">
                      {conv.otherUser?.displayName || conv.otherUser?.username || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{conv.lastMessage || 'No messages'}</div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

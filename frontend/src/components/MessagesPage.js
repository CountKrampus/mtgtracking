import React, { useState, useEffect } from 'react';
import { Send, X, Search } from 'lucide-react';
import { API_URL } from '../config';

export default function MessagesPage({ user, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch all conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages for selected conversation
  const fetchMessages = async (conversationId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch(`${API_URL}/messages/${selectedConversation._id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}`
        },
        body: JSON.stringify({ body: newMessage })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([...messages, data.message]);
        setNewMessage('');
        // Refetch conversations to update last message
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id);
      const interval = setInterval(() => fetchMessages(selectedConversation._id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const filteredConversations = conversations.filter(conv =>
    conv.participantUsername.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getOtherParticipant = (conv) => {
    return conv.participants.find(p => p._id !== user._id);
  };

  if (!selectedConversation) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-white/60" size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        {filteredConversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto">
            {filteredConversations.map(conv => {
              const otherParticipant = getOtherParticipant(conv);
              return (
                <button
                  key={conv._id}
                  onClick={() => setSelectedConversation(conv)}
                  className="w-full text-left p-3 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">
                      {otherParticipant?.displayName || otherParticipant?.username}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 truncate">
                    {conv.lastMessage?.body || 'No messages yet'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {conv.lastMessage?.createdAt ? new Date(conv.lastMessage.createdAt).toLocaleString() : ''}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const otherParticipant = getOtherParticipant(selectedConversation);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
        <button
          onClick={() => setSelectedConversation(null)}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Back to conversations
        </button>
        <h2 className="text-xl font-bold text-white">
          {otherParticipant?.displayName || otherParticipant?.username}
        </h2>
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto mb-4 p-4 bg-slate-900/50 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg._id}
              className={`flex ${msg.senderId === user._id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.senderId === user._id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                <p>{msg.body}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-2"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

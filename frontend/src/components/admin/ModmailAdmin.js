import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';

export default function ModmailAdmin({ apiUrl }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSendModmail = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${apiUrl}/admin/modmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mtg_access_token')}`
        },
        body: JSON.stringify({ subject, message })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setSubject('');
        setMessage('');
      } else {
        setError(data.message || 'Failed to send modmail');
      }
    } catch (err) {
      setError('Error sending modmail: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Send size={24} className="text-purple-400" />
        <h2 className="text-xl font-bold text-white">Modmail System</h2>
      </div>

      <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-4">
        <p className="text-sm text-slate-300">
          Send a message to all active users. Messages will be delivered as DMs from the "modmail" account and appear in their notifications.
        </p>

        <div>
          <label className="block text-sm font-semibold text-white mb-2">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Important Site Update"
            maxLength={100}
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition"
          />
          <div className="text-xs text-slate-500 mt-1">{subject.length}/100</div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-2">Message *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message here..."
            rows={6}
            maxLength={2000}
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition resize-none"
          />
          <div className="text-xs text-slate-500 mt-1">{message.length}/2000</div>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-700">
          <button
            onClick={() => {
              setSubject('');
              setMessage('');
              setError(null);
              setResult(null);
            }}
            disabled={loading}
            className="px-4 py-2 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={handleSendModmail}
            disabled={loading || !subject.trim() || !message.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </>
            ) : (
              <>
                <Send size={18} />
                Send to All Users
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-600/20 border border-red-600/30 rounded flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-red-200 text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-600/20 border border-green-600/30 rounded">
          <div className="flex items-start gap-3 mb-3">
            <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-green-200 font-semibold">{result.message}</div>
              <div className="text-green-300 text-sm mt-1">
                Sent to {result.notificationCount} users
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-green-600/30">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{result.notificationCount}</div>
              <div className="text-xs text-green-300 mt-1">Notifications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{result.dmCount}</div>
              <div className="text-xs text-green-300 mt-1">DMs Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{result.totalUsers}</div>
              <div className="text-xs text-green-300 mt-1">Active Users</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

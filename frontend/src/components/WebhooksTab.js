import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Send, Bell } from 'lucide-react';
import { API_URL } from '../config';

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState({}); // webhookId -> { status, message }

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/webhooks`);
      setWebhooks(res.data);
    } catch (err) {
      setError('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setError(null);
    try {
      await axios.post(`${API_URL}/webhooks`, { url: newUrl.trim() });
      setNewUrl('');
      fetchWebhooks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add webhook');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await axios.delete(`${API_URL}/webhooks/${id}`);
      fetchWebhooks();
    } catch (err) {
      setError('Failed to delete webhook');
    }
  };

  const handleToggleActive = async (webhook) => {
    try {
      await axios.put(`${API_URL}/webhooks/${webhook._id}`, { isActive: !webhook.isActive });
      fetchWebhooks();
    } catch (err) {
      setError('Failed to update webhook');
    }
  };

  const handleTest = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: { status: 'sending' } }));
    try {
      const res = await axios.post(`${API_URL}/webhooks/${id}/test`);
      setTestResults(prev => ({ ...prev, [id]: { status: res.data.lastStatus } }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { status: 'error' } }));
    }
  };

  if (loading) return <p className="text-white/60">Loading...</p>;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Bell size={20} /> Price Alert Webhooks
      </h2>
      <p className="text-white/60 text-sm">
        When a price alert on one of your cards fires (set from the Bell icon in your collection),
        we'll also POST an event to any webhook URLs you register here, signed with an HMAC-SHA256
        secret (sent in the <code className="text-white/80">X-Webhook-Signature</code> header).
      </p>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com/your-webhook"
          className="flex-1 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {webhooks.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-6">No webhooks registered yet.</p>
      ) : (
        <div className="space-y-2">
          {webhooks.map(webhook => (
            <div key={webhook._id} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm truncate">{webhook.url}</p>
                  <p className="text-white/40 text-xs">
                    {webhook.isActive ? 'Active' : 'Disabled'}
                    {webhook.failureCount > 0 && ` · ${webhook.failureCount} recent failures`}
                    {webhook.lastTriggeredAt && ` · last sent ${new Date(webhook.lastTriggeredAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(webhook._id)}
                    title="Send a test event"
                    className="p-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded transition"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(webhook)}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${webhook.isActive ? 'bg-green-600/80 hover:bg-green-600 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}
                  >
                    {webhook.isActive ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDelete(webhook._id)}
                    className="p-1.5 hover:bg-red-600/50 text-red-400 rounded transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {testResults[webhook._id] && (
                <p className="text-xs mt-2 text-white/60">
                  {testResults[webhook._id].status === 'sending'
                    ? 'Sending test event…'
                    : testResults[webhook._id].status === 'error'
                      ? 'Test failed to send'
                      : `Test delivered — response status ${testResults[webhook._id].status}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WebhooksTab;

import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

function parseUserAgent(ua) {
  if (!ua) return { device: 'Unknown', browser: 'Unknown' };

  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let device = 'Desktop';
  if (/mobile|android|iphone|ipad/i.test(ua)) device = 'Mobile';

  return { device, browser };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SessionManager() {
  const { authFetch } = useAuthContext();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('http://localhost:5000/api/users/me/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        setError('Failed to load sessions');
      }
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokeSession = async (sessionId) => {
    try {
      const response = await authFetch(`http://localhost:5000/api/users/me/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      } else {
        alert('Failed to revoke session');
      }
    } catch (err) {
      alert('Failed to revoke session');
    }
  };

  const revokeAllOtherSessions = async () => {
    if (!window.confirm('Revoke all other sessions? You will remain logged in on this device.')) {
      return;
    }
    try {
      const response = await authFetch('http://localhost:5000/api/users/me/sessions', {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchSessions();
      } else {
        alert('Failed to revoke sessions');
      }
    } catch (err) {
      alert('Failed to revoke sessions');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-purple-400" size={24} />
        <span className="ml-2 text-gray-400">Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 rounded-lg flex items-center gap-2 text-red-200">
        <AlertCircle size={18} />
        <span>{error}</span>
        <button onClick={fetchSessions} className="ml-auto text-sm underline hover:text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Active Sessions</h3>
        {sessions.length > 1 && (
          <button
            onClick={revokeAllOtherSessions}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Revoke all other sessions
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400">
        These are the devices currently logged into your account. Revoke any sessions you don't recognize.
      </p>

      <div className="space-y-2">
        {sessions.map((session) => {
          const { device, browser } = parseUserAgent(session.userAgent);
          const DeviceIcon = device === 'Mobile' ? Smartphone : Monitor;

          return (
            <div
              key={session._id}
              className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <DeviceIcon size={20} className="text-gray-400" />
                <div>
                  <div className="text-sm text-white">
                    {browser} on {device}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Globe size={12} />
                    <span>{session.ipAddress || 'Unknown IP'}</span>
                    <span className="text-gray-600">|</span>
                    <span>Created {timeAgo(session.createdAt)}</span>
                    {session.isCurrent && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        Current
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => revokeSession(session._id)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                  title="Revoke session"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <p className="text-center text-gray-500 py-4">No active sessions found</p>
        )}
      </div>
    </div>
  );
}

export default SessionManager;

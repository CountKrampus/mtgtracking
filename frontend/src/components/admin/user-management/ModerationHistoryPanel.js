import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit2,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// --- Module-scope helpers (never define these inside a component body) ---

const ACTION_ICONS = {
  ban: { Icon: Shield, colorClass: 'text-red-400' },
  suspend: { Icon: Shield, colorClass: 'text-orange-400' },
  warn: { Icon: AlertTriangle, colorClass: 'text-yellow-400' },
  appeal_approved: { Icon: CheckCircle, colorClass: 'text-green-400' },
  appeal_denied: { Icon: XCircle, colorClass: 'text-red-400' },
  ban_revoked: { Icon: ShieldOff, colorClass: 'text-green-400' },
  override: { Icon: Edit2, colorClass: 'text-blue-400' },
  price_update: { Icon: RefreshCw, colorClass: 'text-blue-400' }
};

const ACTION_LABELS = {
  ban: 'Ban Issued',
  suspend: 'Account Suspended',
  warn: 'Warning Issued',
  appeal_approved: 'Appeal Approved',
  appeal_denied: 'Appeal Denied',
  ban_revoked: 'Ban Revoked',
  override: 'Manual Override',
  price_update: 'Price Updated'
};

function getActionIcon(actionType) {
  return ACTION_ICONS[actionType] || { Icon: Clock, colorClass: 'text-gray-400' };
}

function getActionLabel(actionType) {
  return ACTION_LABELS[actionType] || actionType;
}

function getPerformedBy(action) {
  if (action.performedBy) {
    if (typeof action.performedBy === 'object' && action.performedBy.username) {
      return action.performedBy.username;
    }
    if (typeof action.performedBy === 'string') {
      return action.performedBy;
    }
  }
  if (action.adminUsername) {
    return action.adminUsername;
  }
  return 'Unknown';
}

function TimelineItem({ action }) {
  const { Icon, colorClass } = getActionIcon(action.actionType);
  const label = getActionLabel(action.actionType);
  const details = action.details || action.description;
  const performedBy = getPerformedBy(action);
  const date = action.createdAt
    ? new Date(action.createdAt).toLocaleString()
    : 'Unknown date';

  return (
    <div className="flex gap-4">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center ${colorClass}`}>
          <Icon size={16} />
        </div>
        {/* Vertical connector line — rendered by the parent */}
      </div>

      {/* Content column */}
      <div className="flex-1 pb-6">
        <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-semibold ${colorClass}`}>{label}</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">{date}</span>
          </div>
          {details && (
            <p className="mt-1 text-sm text-gray-300">{details}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            By <span className="text-gray-400">{performedBy}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Timeline({ history }) {
  if (history.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        No moderation history for this user.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line behind items */}
      <div className="absolute left-4 top-4 bottom-0 w-px bg-gray-600" aria-hidden="true" />
      <div className="space-y-0">
        {history.map((action) => (
          <TimelineItem key={action._id} action={action} />
        ))}
      </div>
    </div>
  );
}

// --- Main exported component ---

export function ModerationHistoryPanel({ userId, username, onClose }) {
  const { authFetch } = useAuthContext();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      setHistory([]);

      try {
        const response = await authFetch(`${API_URL}/admin/moderation-history/${userId}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setError(data.message || 'Failed to fetch moderation history.');
          return;
        }

        // Handle both { history: [...] } and bare array responses
        const items = Array.isArray(data) ? data : (data.history || []);
        setHistory(items);
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch moderation history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-800 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Moderation History</h2>
            <p className="text-gray-400 text-sm mt-0.5">{username}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          )}

          {!loading && error && (
            <div className="border border-red-500/50 bg-red-500/10 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <Timeline history={history} />
          )}
        </div>
      </div>
    </>
  );
}

export default ModerationHistoryPanel;

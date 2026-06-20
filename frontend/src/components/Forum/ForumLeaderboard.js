import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function ForumLeaderboard({ onBack }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/forum/leaderboard`)
      .then(r => r.json())
      .then(data => { setLeaders(data.leaderboard || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-12 text-gray-400">
      Loading leaderboard...
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-400">Error: {error}</div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full p-4">
        <div className="flex items-center gap-3 mb-6 pt-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition text-sm"
            >
              ← Back
            </button>
          )}
          <h1 className="text-2xl font-bold text-white">⚡ Reputation Leaderboard</h1>
        </div>

        {leaders.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No reputation earned yet.</div>
        ) : (
          <div className="space-y-2">
            {leaders.map((user, index) => (
              <div
                key={user._id || user.username}
                className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className={`text-2xl font-bold w-8 text-center ${
                  index === 0 ? 'text-yellow-400' :
                  index === 1 ? 'text-gray-300' :
                  index === 2 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {user.displayName || user.username}
                  </div>
                  {user.displayName && (
                    <div className="text-xs text-gray-400">@{user.username}</div>
                  )}
                  {(user.badges || []).length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {(user.badges || []).slice(0, 5).map((b, i) => (
                        <span key={i} className="text-sm" title={b.name}>
                          {BADGE_EMOJI[b.name] || '🏅'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-amber-400 font-bold text-lg">
                  ⚡ {user.reputation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ForumLeaderboard;

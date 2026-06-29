import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

export default function AchievementsGrid() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/achievements`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setAchievements(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const earned = achievements.filter(a => a.earned);
  const unearned = achievements.filter(a => !a.earned);

  if (loading) return null;

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Collector Achievements</h2>
        <span className="text-white/50 text-sm">{earned.length}/{achievements.length}</span>
      </div>

      {earned.length > 0 && (
        <div className="mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Earned</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {earned.map(a => (
              <div
                key={a.id}
                title={`${a.name}: ${a.desc}`}
                className="flex flex-col items-center gap-1 p-2 bg-purple-600/20 border border-purple-500/30 rounded-xl"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-white text-[10px] font-semibold text-center leading-tight">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unearned.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Locked</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {unearned.map(a => (
              <div
                key={a.id}
                title={a.desc}
                className="flex flex-col items-center gap-1 p-2 bg-white/5 border border-white/10 rounded-xl opacity-50"
              >
                <span className="text-2xl grayscale">{a.icon}</span>
                <span className="text-white/40 text-[10px] text-center leading-tight">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

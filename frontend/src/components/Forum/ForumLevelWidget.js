import React, { useEffect, useState, useCallback } from 'react';
import { Trophy, Coins, ShoppingBag, User } from 'lucide-react';

export default function ForumLevelWidget({ apiUrl, user, onViewShop, onViewProfile }) {
  const [userLevel, setUserLevel] = useState(null);

  const fetchLevel = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/user-level`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      setUserLevel(data);
    } catch (error) {
      console.error('Error fetching user level:', error);
    }
  }, [user, apiUrl]);

  useEffect(() => {
    fetchLevel();
    const interval = setInterval(fetchLevel, 30000);
    return () => clearInterval(interval);
  }, [fetchLevel]);

  if (!user) return null;
  if (!userLevel) return <div className="text-slate-400 text-sm">Loading...</div>;

  const progressPercent = userLevel.experienceToNextLevel > 0
    ? Math.min((userLevel.experience / userLevel.experienceToNextLevel) * 100, 100)
    : 0;

  const recentAchievements = Array.isArray(userLevel.achievements)
    ? userLevel.achievements.slice(-3)
    : [];

  return (
    <div className="bg-gradient-to-r from-purple-900 to-slate-900 backdrop-blur-sm bg-white/5 rounded-lg p-4 border border-purple-700">
      {/* Level header */}
      <div className="flex items-center gap-2 mb-1">
        <Trophy size={20} className="text-yellow-400" />
        <span className="font-bold text-white text-base">Level {userLevel.level}</span>
      </div>

      {/* XP label */}
      <div className="text-xs text-slate-400 mb-2">
        {(userLevel.experience || 0).toLocaleString()} / {(userLevel.experienceToNextLevel || 0).toLocaleString()} XP
      </div>

      {/* Animated progress bar */}
      <div className="bg-slate-800 rounded-full h-2 overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          style={{ width: `${progressPercent}%`, transition: 'width 0.5s ease' }}
        />
      </div>

      {/* Coins */}
      <div className="flex items-center gap-1 mb-3">
        <Coins size={16} className="text-yellow-400" />
        <span className="text-white font-semibold text-sm">
          {(userLevel.coins || 0).toLocaleString()} coins
        </span>
      </div>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-xs text-slate-400 mr-1">Recent:</span>
          {recentAchievements.map((ach, i) => (
            <span key={i} title={ach.name || ach.description || 'Achievement'} className="text-base">
              🏅
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {onViewShop && (
          <button
            onClick={onViewShop}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors"
          >
            <ShoppingBag size={12} />
            View Shop
          </button>
        )}
        {onViewProfile && (
          <button
            onClick={onViewProfile}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            <User size={12} />
            Profile
          </button>
        )}
      </div>
    </div>
  );
}

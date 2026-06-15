import React, { useEffect, useState } from 'react';
import { Trophy, Zap, Coins } from 'lucide-react';

export default function ForumLevelWidget({ apiUrl, user }) {
  const [userLevel, setUserLevel] = useState(null);

  useEffect(() => {
    if (user) {
      const fetch_ = async () => {
        try {
          const response = await fetch(`${apiUrl}/forum/user-level`);
          const data = await response.json();
          setUserLevel(data);
        } catch (error) {
          console.error('Error:', error);
        }
      };
      fetch_();
    }
  }, [user, apiUrl]);

  if (!userLevel) return <div className="text-slate-400 text-sm">Loading...</div>;

  const progressPercent = (userLevel.experience / userLevel.experienceToNextLevel) * 100;

  return (
    <div className="bg-gradient-to-r from-purple-900 to-slate-900 rounded-lg p-4 border border-purple-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-yellow-400" />
          <span className="font-bold text-white">Level {userLevel.level}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins size={16} className="text-yellow-400" />
          <span className="text-white font-semibold">{userLevel.coins}</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      <div className="text-xs text-slate-400">
        {userLevel.experience} / {userLevel.experienceToNextLevel} XP
      </div>
    </div>
  );
}

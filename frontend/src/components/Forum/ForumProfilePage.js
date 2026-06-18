import React, { useState, useEffect } from 'react';
import { Trophy, Coins, Zap, MessageSquare, Share2 } from 'lucide-react';
import { API_URL } from '../../config';

export default function ForumProfilePage({ user, apiUrl }) {
  const [levelData, setLevelData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('mtg_access_token');

      // Fetch level data
      const levelRes = await fetch(`${apiUrl}/forum/user-level`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const levelInfo = await levelRes.json();
      setLevelData(levelInfo);

      // Fetch activity/stats (current authenticated user)
      const activityRes = await fetch(`${apiUrl}/forum/users/${user.username}/activity`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const activityInfo = await activityRes.json();
      setStats(activityInfo);

      setError(null);
    } catch (err) {
      console.error('Error fetching profile data:', err);
      setError('Failed to load forum profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-white">Loading profile...</div>;
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-slate-900 border border-purple-500/30 rounded-lg p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">@{user.username}</h1>
            <p className="text-slate-400">
              {stats?.stats?.memberSince && `Member since ${new Date(stats.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
            </p>
          </div>
        </div>

        {/* Level Section */}
        {levelData && (
          <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-6">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={28} className="text-amber-400" />
                <span className="text-4xl font-bold text-amber-300">Level {levelData.level}</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins size={24} className="text-yellow-400" />
                <span className="text-2xl text-yellow-300">{levelData.coins}</span>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-amber-300 mb-2">
                <span>{levelData.experience} / {levelData.experienceToNextLevel || levelData.level * 500} XP</span>
              </div>
              <div className="w-full h-4 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-500"
                  style={{ width: `${(levelData.experience / (levelData.experienceToNextLevel || levelData.level * 500)) * 100}%` }}
                />
              </div>
            </div>

            {/* Achievements */}
            {levelData.achievements && levelData.achievements.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-2">Recent Achievements</p>
                <div className="flex flex-wrap gap-2">
                  {levelData.achievements.slice(-6).map((achievement, i) => (
                    <span key={i} className="text-2xl" title={achievement}>
                      🏆
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forum Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Reputation', value: stats.reputation || 0, icon: Zap, color: 'text-amber-400' },
            { label: 'Posts', value: stats.stats?.postCount || 0, icon: MessageSquare, color: 'text-blue-400' },
            { label: 'Threads', value: stats.stats?.threadCount || 0, icon: Share2, color: 'text-purple-400' },
            { label: 'Upvotes', value: stats.stats?.upvotesReceived || 0, icon: Trophy, color: 'text-green-400' }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Icon size={20} className={`${stat.color} mb-2`} />
                <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recentPosts && stats.recentPosts.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Recent Posts</h3>
          <div className="space-y-3">
            {stats.recentPosts.slice(0, 5).map((post, i) => (
              <div key={i} className="text-sm text-slate-300 pb-3 border-b border-slate-700 last:border-0">
                <p className="text-white font-medium truncate">{post.threadTitle || 'Thread'}</p>
                <p className="text-slate-400 text-xs">{new Date(post.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Trophy, Coins, Zap, MessageSquare, Share2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { API_URL } from '../../config';
import UserAvatar from '../avatars/UserAvatar';

function renderBadgeIcon(iconStr) {
  if (!iconStr) return '🏅';
  if (iconStr.startsWith('mana:')) {
    const key = iconStr.slice(5);
    return <i className={`ms ms-${key}`} style={{ fontSize: 13, verticalAlign: 'middle' }} />;
  }
  if (iconStr.startsWith('lucide:')) {
    const name = iconStr.slice(7);
    const Icon = LucideIcons[name];
    if (Icon) return <Icon size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />;
  }
  return '🏅';
}

export default function ForumProfilePage({ user, apiUrl }) {
  const [levelData, setLevelData] = useState(null);
  const [stats, setStats] = useState(null);
  const [equippedCosmetics, setEquippedCosmetics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [selectedPins, setSelectedPins] = useState([]);

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
      setSelectedPins(levelInfo?.pinnedAchievements || []);

      // Fetch activity/stats (current authenticated user)
      const activityRes = await fetch(`${apiUrl}/forum/users/${user.username}/activity`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const activityInfo = await activityRes.json();
      setStats(activityInfo);
      if (activityInfo.equippedCosmetics) {
        setEquippedCosmetics(activityInfo.equippedCosmetics);
      }

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
    <div
      className="max-w-4xl mx-auto space-y-6"
      style={equippedCosmetics.profileTheme?.color
        ? { '--profile-accent': equippedCosmetics.profileTheme.color }
        : {}}
    >
      {/* Header */}
      <div
        className="rounded-lg p-8"
        style={{
          ...(equippedCosmetics.profileBackground?.cssProperties
            ? equippedCosmetics.profileBackground.cssProperties
            : { background: 'linear-gradient(to right, rgba(88,28,135,0.5), rgb(15,23,42))' }),
          border: equippedCosmetics.profileBorderColor?.color
            ? `2px solid ${equippedCosmetics.profileBorderColor.color}`
            : '1px solid rgba(168, 85, 247, 0.3)'
        }}
      >
        {/* Profile Banner */}
        {equippedCosmetics.profileBanner && (
          <div
            className="w-full h-32 rounded-t-lg -mx-8 -mt-8 mb-6"
            style={{
              marginLeft: '-2rem',
              marginRight: '-2rem',
              marginTop: '-2rem',
              borderRadius: '0.5rem 0.5rem 0 0',
              width: 'calc(100% + 4rem)',
              ...(equippedCosmetics.profileBanner.imageUrl
                ? {
                    backgroundImage: `url(${equippedCosmetics.profileBanner.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : equippedCosmetics.profileBanner.cssProperties || {}),
            }}
          />
        )}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="lg" />
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">@{user.username}</h1>
              <p className="text-slate-400">
                {stats?.stats?.memberSince && `Member since ${new Date(stats.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              </p>
            </div>
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
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(levelData.experience / (levelData.experienceToNextLevel || levelData.level * 500)) * 100}%`,
                    background: equippedCosmetics.profileTheme?.color
                      ? `linear-gradient(to right, ${equippedCosmetics.profileTheme.color}, ${equippedCosmetics.profileTheme.color}cc)`
                      : 'linear-gradient(to right, #fbbf24, #fcd34d)'
                  }}
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

            {/* Pinned Achievements Showcase */}
            {levelData?.pinnedAchievements && levelData.pinnedAchievements.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-amber-300">Pinned Achievements</p>
                  {levelData?.ownsAchievementShowcase && (
                    <button
                      onClick={() => setShowPinPicker(true)}
                      className="text-xs text-amber-400 hover:text-amber-300"
                    >
                      Edit Pinned
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {levelData.pinnedAchievements.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-sm bg-amber-900/30 border border-amber-600/40 text-amber-300 px-3 py-1.5 rounded-full">
                      🏆 {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Show "Edit Pinned" button even when no pins yet, if user owns showcase */}
            {levelData?.ownsAchievementShowcase && (!levelData?.pinnedAchievements || levelData.pinnedAchievements.length === 0) && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPinPicker(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  Pin Achievements
                </button>
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
                <Icon
                  size={20}
                  className={`${stat.color} mb-2`}
                  style={equippedCosmetics.profileTheme?.color ? { color: equippedCosmetics.profileTheme.color } : {}}
                />
                <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Badges */}
      {stats?.badges && stats.badges.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Badges</h3>
          <div className="flex flex-wrap gap-2">
            {stats.badges.map((badge, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 px-3 py-1.5 rounded-full"
                title={badge.description}
              >
                {renderBadgeIcon(badge.icon)}
                {badge.name}
              </span>
            ))}
          </div>
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

      {/* Pin Achievements Picker Modal */}
      {showPinPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-bold mb-4">Pin Achievements (max 3)</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {(levelData?.achievements || []).map((name, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPins.includes(name)}
                    onChange={e => {
                      if (e.target.checked && selectedPins.length < 3) {
                        setSelectedPins([...selectedPins, name]);
                      } else {
                        setSelectedPins(selectedPins.filter(p => p !== name));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-slate-300 text-sm">🏆 {name}</span>
                </label>
              ))}
              {(!levelData?.achievements || levelData.achievements.length === 0) && (
                <p className="text-slate-400 text-sm">No achievements earned yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const token = localStorage.getItem('mtg_access_token');
                  await fetch(`${apiUrl}/forum/level/pinned-achievements`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ names: selectedPins }),
                  });
                  setShowPinPicker(false);
                  fetchProfileData();
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white rounded py-1.5 text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setShowPinPicker(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

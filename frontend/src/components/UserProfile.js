import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import UserAvatar from './avatars/UserAvatar';

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function ForumActivitySection({ activity }) {
  const stats = activity.stats || {};
  const memberSince = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-white mb-4">Forum Activity</h2>

      {/* Rep + badges */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
        {activity.reputation > 0 && (
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-400">⚡ {activity.reputation}</div>
            <div className="text-[10px] text-white/40 uppercase mt-1">Reputation</div>
          </div>
        )}
        {activity.badges && activity.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activity.badges.slice(0, 5).map((badge, i) => (
              <span
                key={i}
                className="text-xs bg-purple-900/30 border border-purple-700/30 text-purple-300 px-2 py-0.5 rounded-full"
                title={badge.description}
              >
                {BADGE_EMOJI[badge.name] || '🏅'} {badge.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Posts', value: stats.postCount, color: 'text-white' },
          { label: 'Threads', value: stats.threadCount, color: 'text-white' },
          { label: 'Upvotes', value: stats.upvotesReceived, color: 'text-amber-400' },
          { label: 'Member since', value: memberSince, color: 'text-white', small: true }
        ].map(({ label, value, color, small }) => (
          <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
            <div className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent Posts */}
      {activity.recentPosts && activity.recentPosts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Recent Posts</h3>
          <div className="space-y-2">
            {activity.recentPosts.map(post => (
              <div key={post._id} className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <a
                    href={`/forum/thread/${post.threadId}`}
                    className="text-purple-400 hover:text-purple-300 text-sm truncate block transition"
                  >
                    {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                  </a>
                  <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                </div>
                <span className="text-white/30 text-xs whitespace-nowrap">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Posts */}
      {activity.topPosts && activity.topPosts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Top Posts</h3>
          <div className="space-y-2">
            {activity.topPosts.map(post => (
              <div key={post._id} className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <a
                    href={`/forum/thread/${post.threadId}`}
                    className="text-purple-400 hover:text-purple-300 text-sm truncate block transition"
                  >
                    {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                  </a>
                  <div className="text-white/30 text-xs mt-0.5">{post.threadTitle}</div>
                </div>
                <span className="text-amber-400 text-xs whitespace-nowrap font-semibold">
                  ⬆ {post.upvoteCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserProfile({ username }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forumActivity, setForumActivity] = useState(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`${API_URL}/forum/users/${username}/profile`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Profile not found or private' : 'Failed to load profile');
        return r.json();
      })
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [username]);

  useEffect(() => {
    if (!profile) return;
    fetch(`${API_URL}/forum/users/${username}/activity`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setForumActivity(data))
      .catch(() => {});
  }, [profile, username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white/50">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-white/50 mb-6">{error}</p>
          <a href="/" className="text-purple-400 hover:text-purple-300 transition">← Back to MTG Tracker</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <div className="mb-6">
          <a href="/" className="text-white/50 hover:text-white text-sm transition">← Back to MTG Tracker</a>
        </div>

        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <div className="flex items-center gap-5">
            <UserAvatar avatarUrl={profile.avatarUrl} username={profile.username} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.displayName || profile.username}</h1>
              <div className="text-white/50 text-sm">@{profile.username}</div>
              {profile.createdAt && (
                <div className="text-white/30 text-xs mt-1">
                  Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
            {profile.reputation > 0 && (
              <div className="ml-auto text-center">
                <div className="text-3xl font-bold text-amber-400">⚡ {profile.reputation}</div>
                <div className="text-white/40 text-sm">reputation points</div>
              </div>
            )}
          </div>

          {/* Badges */}
          {profile.badges && profile.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.badges.map((badge, i) => (
                <span
                  key={i}
                  className="text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 px-2 py-1 rounded-full"
                  title={badge.description}
                >
                  {BADGE_EMOJI[badge.name] || '🏅'} {badge.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Forum Activity Section */}
        {profile.privacy?.showForum && forumActivity && (
          <ForumActivitySection activity={forumActivity} />
        )}

        {/* No forum activity shown */}
        {!forumActivity && profile.privacy?.showForum === false && (
          <div className="bg-white/5 rounded-lg p-6 text-center text-white/30 text-sm">
            Forum activity is private.
          </div>
        )}
      </div>
    </div>
  );
}

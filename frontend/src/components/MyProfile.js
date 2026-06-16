import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { API_URL } from '../config';
import UserAvatar from './avatars/UserAvatar';

export default function MyProfile({ user, onBack }) {
  const [profile, setProfile] = useState(user);
  const [forumActivity, setForumActivity] = useState(null);

  useEffect(() => {
    if (user?.username) {
      fetchForumActivity();
    }
  }, [user]);

  const fetchForumActivity = async () => {
    try {
      const response = await fetch(`${API_URL}/forum/users/${user.username}/activity`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setForumActivity(data);
      }
    } catch (error) {
      console.error('Error fetching forum activity:', error);
    }
  };

  if (!profile) return null;

  const BADGE_EMOJI = {
    'First Post': '📝',
    'Century': '💬',
    'Thread Starter': '🧵',
    'Deck Builder': '🃏',
    'Collector': '📦',
    'Veteran': '🗓️',
    'Engaged Member': '🌟'
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white">My Profile</h2>
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
          <div className="flex items-center gap-5">
            <UserAvatar avatarUrl={profile.avatarUrl} username={profile.username} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profile.displayName || profile.username}
              </h1>
              <div className="text-white/50 text-sm">@{profile.username}</div>
              {profile.createdAt && (
                <div className="text-white/30 text-xs mt-1">
                  Member since{' '}
                  {new Date(profile.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
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

        {/* Forum Activity */}
        {profile.privacy?.showForum && forumActivity && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Forum Activity</h2>

            {/* Rep + badges */}
            {forumActivity.reputation > 0 && (
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400">⚡ {forumActivity.reputation}</div>
                  <div className="text-[10px] text-white/40 uppercase mt-1">Reputation</div>
                </div>
              </div>
            )}

            {/* Stats grid */}
            {forumActivity.stats && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Posts', value: forumActivity.stats.postCount, color: 'text-white' },
                  {
                    label: 'Threads',
                    value: forumActivity.stats.threadCount,
                    color: 'text-white'
                  },
                  {
                    label: 'Upvotes',
                    value: forumActivity.stats.upvotesReceived,
                    color: 'text-amber-400'
                  },
                  {
                    label: 'Member since',
                    value: forumActivity.stats.memberSince
                      ? new Date(forumActivity.stats.memberSince).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        })
                      : '—',
                    color: 'text-white',
                    small: true
                  }
                ].map(({ label, value, color, small }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color}`}>
                      {value}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Posts */}
            {forumActivity.recentPosts && forumActivity.recentPosts.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">
                  Recent Posts
                </h3>
                <div className="space-y-2">
                  {forumActivity.recentPosts.map(post => (
                    <div key={post._id} className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="text-purple-400 text-sm truncate">
                          {post.body.slice(0, 100)}
                          {post.body.length > 100 ? '…' : ''}
                        </div>
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
            {forumActivity.topPosts && forumActivity.topPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">
                  Top Posts
                </h3>
                <div className="space-y-2">
                  {forumActivity.topPosts.map(post => (
                    <div key={post._id} className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="text-purple-400 text-sm truncate">
                          {post.body.slice(0, 100)}
                          {post.body.length > 100 ? '…' : ''}
                        </div>
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
        )}

        {!forumActivity && profile.privacy?.showForum === false && (
          <div className="bg-white/5 rounded-lg p-6 text-center text-white/30 text-sm">
            Forum activity is private.
          </div>
        )}
      </div>
    </div>
  );
}

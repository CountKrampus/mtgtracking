import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Layers } from 'lucide-react';
import { API_URL } from '../config';
import UserAvatar from './avatars/UserAvatar';
import CollectionComparison from './CollectionComparison';
import { useAuthContext } from '../contexts/AuthContext';

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

function ForumActivitySection({ activity }) {
  const stats = activity.stats || {};
  const memberSince = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div
      className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6"
      style={{ border: activity.equippedCosmetics?.profileBorderColor?.color
        ? `2px solid ${activity.equippedCosmetics.profileBorderColor.color}`
        : undefined }}
    >
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
                {renderBadgeIcon(badge.icon)} {badge.name}
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
  const { user: currentUser } = useAuthContext();
  const [showComparison, setShowComparison] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forumActivity, setForumActivity] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`${API_URL}/forum/users/${username}/profile`)
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
    fetch(`${API_URL}/forum/users/${username}/activity`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setForumActivity(data))
      .catch(() => {});

    fetch(`${API_URL}/users/${username}/public-profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setPublicProfile(data))
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
            {(() => {
              const isOnline = forumActivity?.lastSeenAt
                ? (Date.now() - new Date(forumActivity.lastSeenAt).getTime()) < 5 * 60 * 1000
                : false;
              return <UserAvatar avatarUrl={profile.avatarUrl} username={profile.username} size="xl" isOnline={isOnline} />;
            })()}
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

          {currentUser && currentUser.username !== profile.username && (
            <div className="mt-4">
              <button
                data-testid="compare-collections-btn"
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-sm transition-colors"
                title="Compare your collection with this user"
              >
                <Layers size={15} />
                Compare Collections
              </button>
            </div>
          )}

          {/* Badges */}
          {profile.badges && profile.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.badges.map((badge, i) => (
                <span
                  key={i}
                  className="text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 px-2 py-1 rounded-full"
                  title={badge.description}
                >
                  {renderBadgeIcon(badge.icon)} {badge.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* About Me */}
        {publicProfile?.aboutMeText && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">About</h2>
            <p className="text-white/70 text-sm leading-relaxed">{publicProfile.aboutMeText}</p>
          </div>
        )}

        {/* Personal Links */}
        {publicProfile?.personalLinks?.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Links</h2>
            <div className="flex flex-wrap gap-2">
              {publicProfile.personalLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 text-white/80 hover:text-white px-3 py-1.5 rounded-full transition-colors"
                >
                  🔗 {link.label || link.url}
                </a>
              ))}
            </div>
          </div>
        )}

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

        {/* Favorite Cards Showcase */}
        {publicProfile?.pinnedCards && publicProfile.pinnedCards.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Favorite Cards</h2>
            <div className="flex gap-3 flex-wrap">
              {publicProfile.pinnedCards.map((card, i) => (
                <div key={i} className="text-center">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="rounded object-cover object-top"
                      style={{ width: 60, height: 84 }}
                      title={card.name}
                    />
                  ) : (
                    <div
                      className="bg-white/10 rounded flex items-center justify-center text-white/40 text-xs text-center p-1"
                      style={{ width: 60, height: 84 }}
                    >
                      {card.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public Decks Showcase */}
        {publicProfile?.publicDecks && publicProfile.publicDecks.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Public Decks</h2>
            <div className="grid grid-cols-2 gap-3">
              {publicProfile.publicDecks.map((deck, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3">
                  <div className="text-white font-medium text-sm">{deck.name}</div>
                  {deck.format && <div className="text-white/40 text-xs mt-0.5">{deck.format}</div>}
                  {deck.commander?.name && (
                    <div className="text-purple-300 text-xs mt-0.5">Commander: {deck.commander.name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collection Stats Widget */}
        {publicProfile?.collectionStats && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Collection Stats</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{publicProfile.collectionStats.totalCards}</div>
                <div className="text-white/40 text-xs">Total Cards</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">${publicProfile.collectionStats.totalValue}</div>
                <div className="text-white/40 text-xs">Collection Value</div>
              </div>
              {publicProfile.collectionStats.mostValuableCard && (
                <div>
                  <div className="text-sm font-bold text-amber-400 truncate">
                    {publicProfile.collectionStats.mostValuableCard.name}
                  </div>
                  <div className="text-white/40 text-xs">Most Valuable</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wishlist Preview */}
        {publicProfile?.wishlistPreview && publicProfile.wishlistPreview.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Wishlist Preview</h2>
            <div className="space-y-2">
              {publicProfile.wishlistPreview.map((item, i) => (
                <div key={item._id || i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{item.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.targetPrice > 0 && (
                      <div className="text-xs text-slate-400">
                        Target: <span className="text-white">${item.targetPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {item.currentPrice > 0 && (
                      <div className={`text-xs font-medium ${item.currentPrice <= item.targetPrice ? 'text-green-400' : 'text-red-400'}`}>
                        ${item.currentPrice.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0 ${
                    item.priority === 'high' ? 'bg-red-900/40 text-red-300' :
                    item.priority === 'medium' ? 'bg-amber-900/40 text-amber-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>{item.priority}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showComparison && (
        <CollectionComparison
          targetUsername={profile.username}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { API_URL } from '../config';
import UserAvatar from './avatars/UserAvatar';

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

export default function MyProfile({ user, onBack }) {
  const [profile, setProfile] = useState(user);
  const [forumActivity, setForumActivity] = useState(null);
  const [unlockStatus, setUnlockStatus] = useState({});
  const [pinnedCards, setPinnedCards] = useState(Array.isArray(user?.pinnedCards) ? user.pinnedCards : []);
  const [showPinModal, setShowPinModal] = useState(false);
  const [myCards, setMyCards] = useState([]);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [myDecks, setMyDecks] = useState(null);
  const [collectionStats, setCollectionStats] = useState(null);
  const [wishlistItems, setWishlistItems] = useState(null);

  useEffect(() => {
    if (user?.username) {
      fetchForumActivity();
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API_URL}/users/me/unlock-status`, { headers })
      .then(r => r.ok ? r.json() : {})
      .then(data => setUnlockStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!unlockStatus.deckShowcase) return;
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/decks`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMyDecks(Array.isArray(data) ? data : []))
      .catch(() => setMyDecks([]));
  }, [unlockStatus.deckShowcase]);

  useEffect(() => {
    if (!unlockStatus.collectionStatsWidget) return;
    const token = localStorage.getItem('mtg_access_token');
    fetch(`${API_URL}/stats`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(data => setCollectionStats(data))
      .catch(() => {});
  }, [unlockStatus.collectionStatsWidget]);

  useEffect(() => {
    if (!unlockStatus.wishlistPreview) return;
    const token = localStorage.getItem('mtg_access_token');
    fetch(`${API_URL}/wishlist`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setWishlistItems(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => setWishlistItems([]));
  }, [unlockStatus.wishlistPreview]);

  const fetchForumActivity = async () => {
    try {
      const response = await fetch(`${API_URL}/forum/users/${user.username}/activity`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setForumActivity(data);
        if (Array.isArray(data?.pinnedCards) && data.pinnedCards.length > 0 && pinnedCards.length === 0) {
          setPinnedCards(data.pinnedCards);
        }
      }
    } catch (error) {
      console.error('Error fetching forum activity:', error);
    }
  };

  const savePinnedCards = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${API_URL}/users/pinned-cards`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ cards: pinnedCards }),
    });
    setShowPinModal(false);
  };

  const loadMyCards = () => {
    if (myCards.length > 0) return;
    const token = localStorage.getItem('mtg_access_token');
    fetch(`${API_URL}/cards`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMyCards(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  if (!profile) return null;


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
                  {renderBadgeIcon(badge.icon)} {badge.name}
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

        {/* Favorite Cards Showcase */}
        {unlockStatus.favoriteCardsShowcase && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Favorite Cards</h2>
              <button
                onClick={() => { setShowPinModal(true); loadMyCards(); }}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Edit
              </button>
            </div>
            {pinnedCards.length === 0 ? (
              <p className="text-white/40 text-sm">No cards pinned yet. Click Edit to pin up to 5 favorites.</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {pinnedCards.map((card, i) => (
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
                        className="bg-slate-700 rounded flex items-center justify-center text-white/40 text-xs text-center p-1"
                        style={{ width: 60, height: 84 }}
                      >
                        {card.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pin Card Modal */}
            {showPinModal && (
              <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-lg p-6 sm:max-w-lg w-full sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold">Pin Favorite Cards (max 5)</h3>
                    <button onClick={() => setShowPinModal(false)} className="text-white/50 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Search your collection..."
                    value={cardSearchQuery}
                    onChange={e => setCardSearchQuery(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-purple-500"
                  />
                  <div className="overflow-y-auto flex-1">
                    {myCards.length === 0 && (
                      <div className="text-white/40 text-sm text-center py-8">Loading your collection...</div>
                    )}
                    {myCards
                      .filter(c => !cardSearchQuery || c.name.toLowerCase().includes(cardSearchQuery.toLowerCase()))
                      .slice(0, 30)
                      .map((card, i) => {
                        const isPinned = pinnedCards.some(p => p.name === card.name || (p.scryfallId && p.scryfallId === card.scryfallId));
                        return (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-700">
                            {card.imageUrl && (
                              <img src={card.imageUrl} alt={card.name} className="w-8 h-11 rounded object-cover" />
                            )}
                            <span className="text-slate-300 text-sm flex-1">{card.name}</span>
                            <button
                              onClick={() => {
                                if (isPinned) {
                                  setPinnedCards(prev => prev.filter(p => p.name !== card.name));
                                } else if (pinnedCards.length < 5) {
                                  setPinnedCards(prev => [...prev, {
                                    cardId: card._id,
                                    scryfallId: card.scryfallId || '',
                                    name: card.name,
                                    imageUrl: card.imageUrl || '',
                                  }]);
                                }
                              }}
                              disabled={!isPinned && pinnedCards.length >= 5}
                              className={`text-xs px-2 py-1 rounded ${isPinned ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-40'}`}
                            >
                              {isPinned ? 'Remove' : 'Pin'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  <button
                    onClick={savePinnedCards}
                    className="mt-4 w-full bg-purple-600 hover:bg-purple-500 text-white rounded py-2 text-sm font-medium"
                  >
                    Save Pins ({pinnedCards.length}/5)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deck Showcase */}
        {unlockStatus.deckShowcase && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">My Public Decks</h2>
            {myDecks === null ? (
              <p className="text-white/40 text-sm">Loading...</p>
            ) : myDecks.length === 0 ? (
              <p className="text-white/40 text-sm">No decks yet. Create decks in the Deck Builder and share them to show them here.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myDecks.map(deck => (
                  <div key={deck._id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{deck.name}</div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {deck.format && <span className="mr-2">{deck.format}</span>}
                        {deck.commander?.name && <span className="text-purple-300">Cmdr: {deck.commander.name}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deck.isPublic ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                      {deck.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/30 text-xs mt-3">Mark decks as public in the Deck Builder to feature them here.</p>
          </div>
        )}

        {/* Collection Stats Widget */}
        {unlockStatus.collectionStatsWidget && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Collection Stats</h2>
            {collectionStats ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">{(collectionStats.totalCards || 0).toLocaleString()}</div>
                  <div className="text-white/40 text-xs mt-1">Total Cards</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">${(collectionStats.totalValue || 0).toFixed(2)}</div>
                  <div className="text-white/40 text-xs mt-1">Collection Value</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">{(collectionStats.uniqueCards || collectionStats.totalCards || 0).toLocaleString()}</div>
                  <div className="text-white/40 text-xs mt-1">Unique Cards</div>
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Loading stats...</p>
            )}
            <p className="text-white/30 text-xs mt-3">These stats are visible on your public profile.</p>
          </div>
        )}

        {/* Wishlist Preview */}
        {unlockStatus.wishlistPreview && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Wishlist Preview</h2>
            {wishlistItems === null ? (
              <p className="text-white/40 text-sm">Loading...</p>
            ) : wishlistItems.length === 0 ? (
              <p className="text-white/40 text-sm">Your wishlist is empty. Add cards to your wishlist to show them here.</p>
            ) : (
              <div className="space-y-2">
                {wishlistItems.map((item, i) => (
                  <div key={item._id || i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{item.name}</div>
                      {item.set && <div className="text-white/40 text-xs">{item.set}</div>}
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
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                      item.priority === 'high' ? 'bg-red-900/40 text-red-300' :
                      item.priority === 'medium' ? 'bg-amber-900/40 text-amber-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>{item.priority}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/30 text-xs mt-3">Top 3 wishlist items are visible on your public profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}

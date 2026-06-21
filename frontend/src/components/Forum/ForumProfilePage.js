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
  const [memberTitleInput, setMemberTitleInput] = useState('');
  const [signatureInput, setSignatureInput] = useState('');
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [equipLoading, setEquipLoading] = useState(null);
  const [aboutMeInput, setAboutMeInput] = useState('');
  const [personalLinksInput, setPersonalLinksInput] = useState([]);
  const [manaIdentityInput, setManaIdentityInput] = useState([]);
  const [commanderSearch, setCommanderSearch] = useState('');
  const [commanderPreview, setCommanderPreview] = useState(null);

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
      if (levelInfo?.memberTitleText !== undefined) setMemberTitleInput(levelInfo.memberTitleText);
      if (levelInfo?.signatureText !== undefined) setSignatureInput(levelInfo.signatureText);
      if (levelInfo?.aboutMeText !== undefined) setAboutMeInput(levelInfo.aboutMeText);
      if (levelInfo?.personalLinks) setPersonalLinksInput(levelInfo.personalLinks);
      if (levelInfo?.manaIdentity) setManaIdentityInput(levelInfo.manaIdentity);

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

  const saveMemberTitle = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${apiUrl}/forum/level/member-title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: memberTitleInput }),
    });
  };

  const openWardrobe = async () => {
    setWardrobeOpen(true);
    if (wardrobeItems.length > 0) return; // already loaded
    try {
      const token = localStorage.getItem('mtg_access_token');
      const res = await fetch(`${apiUrl}/forum/cosmetics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setWardrobeItems(data.cosmetics || []);
      }
    } catch {}
  };

  const handleWardrobeEquip = async (cosmeticId, category) => {
    setEquipLoading(cosmeticId);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const res = await fetch(`${apiUrl}/forum/level/cosmetics/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ cosmeticId, category }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update levelData equipped state
        setLevelData(prev => prev ? { ...prev, cosmetics: { ...prev.cosmetics, equipped: data.newEquipped } } : prev);
        // Re-fetch profile to update equippedCosmetics
        fetchProfileData();
      }
    } catch {}
    setEquipLoading(null);
  };

  const saveSignature = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${apiUrl}/forum/level/signature`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: signatureInput }),
    });
  };

  const saveAboutMe = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${apiUrl}/forum/level/about-me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: aboutMeInput }),
    });
  };

  const savePersonalLinks = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${apiUrl}/forum/level/personal-links`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ links: personalLinksInput.filter(l => l.url) }),
    });
  };

  const saveManaIdentity = async () => {
    const token = localStorage.getItem('mtg_access_token');
    await fetch(`${apiUrl}/forum/level/mana-identity`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ colors: manaIdentityInput }),
    });
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
            {(() => {
              const isOnline = stats?.lastSeenAt
                ? (Date.now() - new Date(stats.lastSeenAt).getTime()) < 5 * 60 * 1000
                : false;
              return (
                <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="lg" isOnline={isOnline} />
              );
            })()}
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">@{user.username}</h1>
              <p className="text-slate-400">
                {stats?.stats?.memberSince && `Member since ${new Date(stats.stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              </p>
              {stats?.manaIdentity && stats.manaIdentity.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {stats.manaIdentity.map(color => (
                    <div
                      key={color}
                      className={`w-4 h-4 rounded-full mana-pip-${color}`}
                      title={{ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }[color]}
                    />
                  ))}
                </div>
              )}
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

      {/* About Me */}
      {(stats?.aboutMeText || levelData?.ownsAboutMe) && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          {stats?.aboutMeText ? (
            <>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{stats.aboutMeText}</p>
            </>
          ) : (
            <p className="text-slate-500 text-sm italic">No bio yet.</p>
          )}
        </div>
      )}

      {/* Personal Links */}
      {stats?.personalLinks && stats.personalLinks.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Links</h3>
          <div className="flex flex-wrap gap-2">
            {stats.personalLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                🔗 {link.label || link.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Commander Showcase */}
      {stats?.commanderCard?.imageUrl && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Commander</h3>
          <div className="flex items-center gap-4">
            <img
              src={stats.commanderCard.imageUrl}
              alt={stats.commanderCard.name}
              className="rounded-lg shadow-lg"
              style={{ width: 80, height: 112 }}
            />
            <div>
              <div className="text-white font-semibold">{stats.commanderCard.name}</div>
              <div className="text-slate-400 text-xs mt-1">Featured Commander</div>
            </div>
          </div>
        </div>
      )}

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

      {/* My Cosmetics Wardrobe */}
      {levelData?.cosmetics?.purchased?.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={wardrobeOpen ? () => setWardrobeOpen(false) : openWardrobe}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">My Cosmetics</span>
              <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">
                {levelData.cosmetics.purchased.length} owned
              </span>
            </div>
            <span className="text-slate-400 text-sm">{wardrobeOpen ? '▲' : '▼'}</span>
          </button>

          {wardrobeOpen && (
            <div className="border-t border-slate-700 p-4 space-y-5">
              {[
                {
                  label: 'Post Appearance',
                  cats: ['titleColor', 'avatarBorder', 'flairIcon', 'postBackground', 'postFrame', 'threadHighlight', 'nameplateBackground', 'formatBadge', 'setSymbolFlair'],
                },
                {
                  label: 'Forum Profile',
                  cats: ['profileBorderColor', 'profileBackground', 'profileBanner', 'profileTheme'],
                },
                {
                  label: 'Unlocks',
                  cats: ['memberTitle', 'signature', 'achievementShowcase', 'favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview', 'aboutMe', 'personalLinks'],
                },
              ].map(group => {
                // Filter wardrobe items to ones the user owns AND in this group
                const purchasedSet = new Set(levelData.cosmetics.purchased.map(String));
                const groupItems = wardrobeItems.filter(
                  item => group.cats.includes(item.category) && purchasedSet.has(item._id.toString())
                );
                if (groupItems.length === 0) return null;

                const equippedMap = levelData.cosmetics.equipped || {};

                return (
                  <div key={group.label}>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</h4>
                    <div className="space-y-1.5">
                      {groupItems.map(item => {
                        const isEquipped = equippedMap[item.category] === item._id.toString();
                        const isLoading = equipLoading === item._id.toString();

                        // Visual preview
                        const preview = item.color === 'rainbow'
                          ? <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)' }} />
                          : item.color
                          ? <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          : item.icon
                          ? <div className="w-6 h-6 rounded-full flex-shrink-0 bg-slate-600 flex items-center justify-center text-white">{renderBadgeIcon(item.icon)}</div>
                          : item.cssProperties
                          ? <div className="w-6 h-6 rounded flex-shrink-0" style={item.cssProperties} />
                          : <div className="w-6 h-6 rounded-full flex-shrink-0 bg-slate-600 flex items-center justify-center text-xs">✦</div>;

                        return (
                          <div
                            key={item._id}
                            className={`flex items-center gap-3 p-2 rounded-lg ${isEquipped ? 'bg-green-900/20 border border-green-700/40' : 'bg-slate-900/40'}`}
                          >
                            {preview}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">{item.name}</div>
                              <div className="text-xs text-slate-500 capitalize">{item.category}</div>
                            </div>
                            {isEquipped ? (
                              <span className="text-xs text-green-400 font-medium">Equipped</span>
                            ) : (
                              <button
                                onClick={() => handleWardrobeEquip(item._id.toString(), item.category)}
                                disabled={isLoading}
                                className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2.5 py-1 rounded disabled:opacity-50"
                              >
                                {isLoading ? '...' : 'Equip'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Account Settings — member title, signature, and new profile fields */}
      {(levelData?.ownsMemberTitle || levelData?.ownsSignature || levelData?.ownsAboutMe || levelData?.ownsPersonalLinks || levelData) && (
        <div id="account-settings" className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Profile Customization</h3>

          {levelData?.ownsMemberTitle && (
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">
                Member Title <span className="text-slate-500 text-xs">(max 40 chars)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={40}
                  value={memberTitleInput}
                  onChange={e => setMemberTitleInput(e.target.value)}
                  placeholder="Your member title..."
                  className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={saveMemberTitle}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {levelData?.ownsSignature && (
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">
                Forum Signature <span className="text-slate-500 text-xs">(max 120 chars)</span>
              </label>
              <div className="flex gap-2">
                <textarea
                  maxLength={120}
                  rows={2}
                  value={signatureInput}
                  onChange={e => setSignatureInput(e.target.value)}
                  placeholder="Your forum signature..."
                  className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
                <button
                  onClick={saveSignature}
                  className="self-start bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Mana Identity — free, always shown */}
          <div className="mt-4">
            <label className="block text-sm text-slate-400 mb-2">Mana Identity</label>
            <div className="flex gap-2 flex-wrap">
              {['W', 'U', 'B', 'R', 'G', 'C'].map(color => {
                const selected = manaIdentityInput.includes(color);
                return (
                  <button
                    key={color}
                    onClick={() => {
                      setManaIdentityInput(prev =>
                        prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
                      );
                    }}
                    className={`w-8 h-8 rounded-full font-bold text-xs transition-all mana-pip-${color} ${selected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800 opacity-100' : 'opacity-40'}`}
                    title={color}
                  >
                    {color}
                  </button>
                );
              })}
              <button
                onClick={saveManaIdentity}
                className="ml-2 text-xs bg-purple-700 hover:bg-purple-600 text-white px-2.5 py-1 rounded"
              >
                Save
              </button>
            </div>
          </div>

          {/* About Me — shown if owned */}
          {levelData?.ownsAboutMe && (
            <div className="mt-4">
              <label className="block text-sm text-slate-400 mb-1">
                About Me <span className="text-slate-500 text-xs">(max 300 chars)</span>
              </label>
              <div className="flex gap-2">
                <textarea
                  maxLength={300}
                  rows={3}
                  value={aboutMeInput}
                  onChange={e => setAboutMeInput(e.target.value)}
                  placeholder="Tell the community about yourself..."
                  className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
                <button onClick={saveAboutMe} className="self-start bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded">Save</button>
              </div>
            </div>
          )}

          {/* Personal Links — shown if owned */}
          {levelData?.ownsPersonalLinks && (
            <div className="mt-4">
              <label className="block text-sm text-slate-400 mb-2">
                Personal Links <span className="text-slate-500 text-xs">(up to 5)</span>
              </label>
              <div className="space-y-2">
                {personalLinksInput.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Label"
                      value={link.label}
                      onChange={e => setPersonalLinksInput(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                      className="w-24 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="url"
                      maxLength={200}
                      placeholder="https://..."
                      value={link.url}
                      onChange={e => setPersonalLinksInput(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                      className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => setPersonalLinksInput(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-300 text-sm px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {personalLinksInput.length < 5 && (
                  <button
                    onClick={() => setPersonalLinksInput(prev => [...prev, { label: '', url: '' }])}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    + Add link
                  </button>
                )}
              </div>
              <button onClick={savePersonalLinks} className="mt-2 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded">Save Links</button>
            </div>
          )}

          {/* Commander picker */}
          <div className="mt-4">
            <label className="block text-sm text-slate-400 mb-1">Featured Commander</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search Scryfall for a card..."
                value={commanderSearch}
                onChange={e => setCommanderSearch(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && commanderSearch.trim()) {
                    const res = await fetch(`${apiUrl}/scryfall/search?name=${encodeURIComponent(commanderSearch)}`);
                    if (res.ok) {
                      const data = await res.json();
                      if (data.imageUrl) {
                        setCommanderPreview(data);
                      }
                    }
                  }
                }}
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
              />
              {commanderPreview && (
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('mtg_access_token');
                    await fetch(`${apiUrl}/forum/level/commander`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ scryfallId: commanderPreview.scryfallId || '', name: commanderPreview.name, imageUrl: commanderPreview.imageUrl }),
                    });
                    fetchProfileData();
                    setCommanderSearch('');
                    setCommanderPreview(null);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded whitespace-nowrap"
                >
                  Set "{commanderPreview.name}"
                </button>
              )}
            </div>
            {commanderPreview?.imageUrl && (
              <img src={commanderPreview.imageUrl} alt={commanderPreview.name} className="mt-2 rounded" style={{ height: 80 }} />
            )}
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

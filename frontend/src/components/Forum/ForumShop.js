import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Coins, Check, X, Search, Palette, Shield, Sparkles
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

function renderItemIcon(icon) {
  if (!icon) return null;
  if (icon.startsWith('mana:')) {
    const key = icon.slice(5);
    return <i className={`ms ms-${key} ms-cost ms-shadow`} style={{ fontSize: 22 }} />;
  }
  if (icon.startsWith('lucide:')) {
    const name = icon.slice(7);
    const Icon = LucideIcons[name];
    return Icon ? <Icon size={22} /> : <span className="text-xl">{icon}</span>;
  }
  return <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>;
}

const COSMETICS_CATALOG = [
  // Title Colors
  { id: 'titleColor_gold', name: 'Gold Title Color', category: 'titleColor', cost: 500, color: '#FFD700', description: 'Golden color for your forum title', rarity: 'uncommon' },
  { id: 'titleColor_purple', name: 'Purple Title Color', category: 'titleColor', cost: 300, color: '#9B59B6', description: 'Purple color for your forum title', rarity: 'common' },
  { id: 'titleColor_red', name: 'Crimson Title Color', category: 'titleColor', cost: 400, color: '#E74C3C', description: 'Crimson color for your forum title', rarity: 'common' },
  { id: 'titleColor_teal', name: 'Teal Title Color', category: 'titleColor', cost: 350, color: '#1ABC9C', description: 'Teal color for your forum title', rarity: 'common' },
  { id: 'titleColor_rainbow', name: 'Rainbow Title', category: 'titleColor', cost: 2000, color: 'rainbow', description: 'Animated rainbow color for your title', rarity: 'legendary' },
  // Avatar Borders
  { id: 'avatarBorder_gold', name: 'Gold Avatar Border', category: 'avatarBorder', cost: 600, color: '#FFD700', description: 'Gold border around your avatar', rarity: 'uncommon' },
  { id: 'avatarBorder_silver', name: 'Silver Avatar Border', category: 'avatarBorder', cost: 400, color: '#C0C0C0', description: 'Silver border around your avatar', rarity: 'common' },
  { id: 'avatarBorder_diamond', name: 'Diamond Avatar Border', category: 'avatarBorder', cost: 2500, color: '#B9F2FF', description: 'Sparkling diamond border', rarity: 'legendary' },
  { id: 'avatarBorder_fire', name: 'Flame Avatar Border', category: 'avatarBorder', cost: 1500, color: '#FF6B35', description: 'Animated flame border', rarity: 'rare' },
  // Profile Border Colors
  { id: 'profileBorderColor_gold', name: 'Gold Profile Border', category: 'profileBorderColor', cost: 700, color: '#FFD700', description: 'Gold border for your profile', rarity: 'uncommon' },
  { id: 'profileBorderColor_neon', name: 'Neon Profile Border', category: 'profileBorderColor', cost: 1000, color: '#39FF14', description: 'Neon green profile border', rarity: 'rare' },
  { id: 'profileBorderColor_royal', name: 'Royal Blue Profile Border', category: 'profileBorderColor', cost: 800, color: '#4169E1', description: 'Royal blue profile border', rarity: 'uncommon' },
];

const GROUP_TABS = [
  { id: 'all',         label: 'All',            icon: ShoppingCart },
  { id: 'post',        label: 'Post Appearance', icon: Palette },
  { id: 'profile',     label: 'Forum Profile',   icon: Shield },
  { id: 'unlocks',     label: 'Unlocks',         icon: Sparkles },
];

const CATEGORY_GROUP = {
  titleColor: 'post', avatarBorder: 'post', flairIcon: 'post',
  postBackground: 'post', postFrame: 'post', threadHighlight: 'post',
  nameplateBackground: 'post', formatBadge: 'post', setSymbolFlair: 'post',
  profileBorderColor: 'profile', profileBackground: 'profile',
  profileBanner: 'profile', profileTheme: 'profile',
  memberTitle: 'unlocks', signature: 'unlocks', achievementShowcase: 'unlocks',
  favoriteCardsShowcase: 'unlocks', deckShowcase: 'unlocks',
  collectionStatsWidget: 'unlocks', wishlistPreview: 'unlocks',
  aboutMe: 'unlocks', personalLinks: 'unlocks',
};

const SUBCATEGORY_LABELS = {
  titleColor: 'Title Colors', avatarBorder: 'Avatar Borders',
  flairIcon: 'Flair Icons', postBackground: 'Post Tints',
  postFrame: 'Post Frames', threadHighlight: 'Thread Highlight',
  nameplateBackground: 'Nameplate Background', formatBadge: 'Format Badge',
  setSymbolFlair: 'Set Symbol Flair',
  profileBorderColor: 'Profile Borders', profileBackground: 'Profile Background',
  profileBanner: 'Banners', profileTheme: 'Profile Theme',
  memberTitle: 'Member Title', signature: 'Signature',
  achievementShowcase: 'Achievement Showcase', favoriteCardsShowcase: 'Card Showcase',
  deckShowcase: 'Deck Showcase', collectionStatsWidget: 'Stats Widget',
  wishlistPreview: 'Wishlist Preview', aboutMe: 'About Me',
  personalLinks: 'Personal Links',
};

const UNLOCK_CATEGORIES = [
  'memberTitle', 'signature', 'achievementShowcase',
  'favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview',
  'aboutMe', 'personalLinks',
];

const POST_CATS = [
  'titleColor', 'avatarBorder', 'flairIcon', 'postBackground', 'postFrame',
  'threadHighlight', 'nameplateBackground', 'formatBadge', 'setSymbolFlair',
];
const PROFILE_CATS = ['profileBorderColor', 'profileBackground', 'profileBanner', 'profileTheme'];

const RARITY_STYLES = {
  common: 'bg-slate-600 text-slate-200',
  uncommon: 'bg-green-700 text-green-100',
  rare: 'bg-blue-700 text-blue-100',
  legendary: 'bg-amber-600 text-amber-100',
};

export default function ForumShop({ apiUrl, user, isOpen, onClose, onEquip }) {
  const [userLevel, setUserLevel] = useState(null);
  const [coins, setCoins] = useState(0);
  const [purchased, setPurchased] = useState([]);
  const [equipped, setEquipped] = useState({});
  const [catalogItems, setCatalogItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState(null); // { type: 'success'|'error', message }
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchShopData();
    }
  }, [isOpen, user]);

  const fetchShopData = async () => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [levelRes, catalogRes] = await Promise.all([
        fetch(`${apiUrl}/forum/user-level`, { headers }),
        fetch(`${apiUrl}/forum/cosmetics`, { headers }),
      ]);

      if (levelRes.ok) {
        const data = await levelRes.json();
        setUserLevel(data);
        setCoins(data.coins || 0);
        setPurchased(data.cosmetics?.purchased || []);
        setEquipped(data.cosmetics?.equipped || {});
      }

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        const items = (data.cosmetics || []).map(c => ({ ...c, id: c._id }));
        setCatalogItems(items);
        if (data.purchased) setPurchased(data.purchased);
        if (data.equipped) setEquipped(data.equipped);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handlePurchase = async (item) => {
    if (loadingId) return;
    setLoadingId(item.id);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/level/cosmetics/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cosmeticId: item.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('error', data.message || 'Purchase failed');
      } else {
        setCoins(data.newCoins);
        setPurchased(prev => [...prev, item.id]);
        showAlert('success', `${item.name} purchased!`);
      }
    } catch (error) {
      showAlert('error', 'Network error. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleEquip = async (item) => {
    if (loadingId) return;
    setLoadingId(item.id);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/level/cosmetics/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cosmeticId: item.id, category: item.category }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('error', data.message || 'Equip failed');
      } else {
        setEquipped(data.newEquipped || {});
        showAlert('success', `${item.name} equipped!`);
        if (onEquip) onEquip();
      }
    } catch (error) {
      showAlert('error', 'Network error. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const filteredItems = catalogItems.filter(item => {
    const matchesGroup = activeCategory === 'all' || CATEGORY_GROUP[item.category] === activeCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  // Group filtered items by subcategory, preserving a stable order
  const SUBCATEGORY_ORDER = [
    'titleColor', 'avatarBorder', 'flairIcon', 'postBackground', 'postFrame', 'threadHighlight',
    'nameplateBackground', 'formatBadge', 'setSymbolFlair',
    'profileBorderColor', 'profileBackground', 'profileBanner', 'profileTheme',
    'memberTitle', 'signature', 'achievementShowcase',
    'favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview',
    'aboutMe', 'personalLinks',
  ];
  const groupedItems = SUBCATEGORY_ORDER.reduce((acc, cat) => {
    const items = filteredItems.filter(i => i.category === cat);
    if (items.length > 0) acc.push({ category: cat, items });
    return acc;
  }, []);

  const tabCounts = {
    all: catalogItems.length,
    post: catalogItems.filter(c => POST_CATS.includes(c.category)).length,
    profile: catalogItems.filter(c => PROFILE_CATS.includes(c.category)).length,
    unlocks: catalogItems.filter(c => UNLOCK_CATEGORIES.includes(c.category)).length,
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">Forum Shop</h2>
          </div>
          <div className="flex items-center gap-3">
            {userLevel && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                <Coins size={16} className="text-yellow-400" />
                <span className="text-lg font-bold text-yellow-400">{coins.toLocaleString()}</span>
                <span className="text-slate-400 text-sm">coins</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <div className={`mx-5 mt-4 px-4 py-3 rounded-lg flex items-center justify-between flex-shrink-0 ${
            alert.type === 'success' ? 'bg-green-900 border border-green-700 text-green-200' : 'bg-red-900 border border-red-700 text-red-200'
          }`}>
            <span className="text-sm">{alert.message}</span>
            <button onClick={() => setAlert(null)} className="ml-3 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
          {GROUP_TABS.map(tab => {
            const Icon = tab.icon;
            const count = tabCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === tab.id
                    ? 'bg-purple-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Icon size={14} />
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-1 flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search cosmetics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Items Grid */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {groupedItems.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No cosmetics found.</div>
          ) : (
            groupedItems.map(({ category, items }) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {SUBCATEGORY_LABELS[category]}
                </h3>
                <div className="flex flex-col gap-2">
                  {items.map(item => {
                    const isOwned = purchased.includes(item.id);
                    const isEquipped = equipped[item.category] === item.id;
                    const canAfford = coins >= item.cost;
                    const isLoading = loadingId === item.id;
                    const isUnlock = UNLOCK_CATEGORIES.includes(item.category);

                    const borderClass = isEquipped
                      ? 'border-green-500'
                      : isOwned
                        ? 'border-blue-500'
                        : item.availableUntil
                          ? 'border-amber-500'
                          : !canAfford
                            ? 'border-slate-700 opacity-60'
                            : 'border-slate-700';

                    const limitedCountdown = item.availableUntil ? (() => {
                      const daysLeft = Math.ceil((new Date(item.availableUntil) - Date.now()) / (1000 * 60 * 60 * 24));
                      return daysLeft > 0 ? `⏱ ${daysLeft}d left` : 'Expired';
                    })() : null;

                    const swatchEl = isUnlock ? (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700 flex items-center justify-center text-purple-400">
                        {item.icon ? renderItemIcon(item.icon) : <Sparkles size={24} />}
                      </div>
                    ) : item.icon ? (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700/60 flex items-center justify-center text-white">
                        {renderItemIcon(item.icon)}
                      </div>
                    ) : item.color === 'rainbow' ? (
                      <div
                        className="w-14 h-14 rounded-xl flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0088)' }}
                      />
                    ) : item.color ? (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ backgroundColor: item.color }} />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-slate-700" />
                    );

                    const actionEl = isUnlock ? (
                      isOwned ? (
                        <div className="flex flex-col gap-1.5 items-end">
                          <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 border border-blue-700 text-blue-200 text-sm font-medium">
                            <Check size={14} /> Owned
                          </div>
                          {(item.category === 'memberTitle' || item.category === 'signature') && (
                            <div className="text-xs text-slate-400 text-right">Set in your profile settings</div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(item)}
                          disabled={!canAfford || isLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${canAfford && !isLoading ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                        >
                          {isLoading ? 'Purchasing...' : !canAfford ? 'Not enough coins' : 'Unlock'}
                        </button>
                      )
                    ) : isEquipped ? (
                      <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-800 border border-green-600 text-green-200 text-sm font-medium">
                        <Check size={14} /> Equipped
                      </div>
                    ) : isOwned ? (
                      <button
                        onClick={() => handleEquip(item)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
                      >
                        {isLoading ? 'Equipping...' : 'Equip'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!canAfford || isLoading}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${canAfford && !isLoading ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                      >
                        {isLoading ? 'Purchasing...' : !canAfford ? 'Not enough coins' : 'Purchase'}
                      </button>
                    );

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-slate-900 transition-colors ${borderClass}`}
                      >
                        {/* Preview swatch — 56×56, rounded-xl */}
                        {swatchEl}

                        {/* Info — center */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-white font-semibold text-sm">{item.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 capitalize ${RARITY_STYLES[item.rarity] || RARITY_STYLES.common}`}>
                              {item.rarity}
                            </span>
                            {item.availableUntil && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 flex-shrink-0">LIMITED</span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs truncate">{item.description || item.category}</p>
                          {limitedCountdown && (
                            <p className="text-amber-400 text-xs mt-0.5">{limitedCountdown}</p>
                          )}
                        </div>

                        {/* Price + action — right */}
                        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1.5">
                          {!isOwned && (
                            <div className="flex items-center gap-1 justify-end">
                              <Coins size={13} className="text-yellow-400" />
                              <span className="text-yellow-400 font-bold text-sm">{item.cost.toLocaleString()}</span>
                            </div>
                          )}
                          {actionEl}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

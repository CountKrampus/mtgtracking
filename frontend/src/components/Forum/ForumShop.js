import React, { useState, useEffect } from 'react';
import { ShoppingCart, Coins, Check, X, Search, Crown, Palette, Shield } from 'lucide-react';

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

const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: ShoppingCart },
  { id: 'titleColor', label: 'Title Colors', icon: Crown },
  { id: 'avatarBorder', label: 'Avatar Borders', icon: Palette },
  { id: 'profileBorderColor', label: 'Profile Borders', icon: Shield },
];

const RARITY_STYLES = {
  common: 'bg-slate-600 text-slate-200',
  uncommon: 'bg-green-700 text-green-100',
  rare: 'bg-blue-700 text-blue-100',
  legendary: 'bg-amber-600 text-amber-100',
};

function RainbowSwatch() {
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: 48,
        height: 48,
        background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0088)',
      }}
    />
  );
}

export default function ForumShop({ apiUrl, user, isOpen, onClose }) {
  const [userLevel, setUserLevel] = useState(null);
  const [coins, setCoins] = useState(0);
  const [purchased, setPurchased] = useState([]);
  const [equipped, setEquipped] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState(null); // { type: 'success'|'error', message }
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserLevel();
    }
  }, [isOpen, user]);

  const fetchUserLevel = async () => {
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${apiUrl}/forum/user-level`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch user level');
      const data = await response.json();
      setUserLevel(data);
      setCoins(data.coins || 0);
      setPurchased(data.cosmetics?.purchased || []);
      setEquipped(data.cosmetics?.equipped || {});
    } catch (error) {
      console.error('Error fetching user level:', error);
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
      }
    } catch (error) {
      showAlert('error', 'Network error. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const filteredItems = COSMETICS_CATALOG.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">Forum Shop</h2>
          </div>
          <div className="flex items-center gap-3">
            {userLevel && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg">
                <Coins size={16} className="text-yellow-400" />
                <span className="font-bold text-yellow-400">{coins.toLocaleString()}</span>
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
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === tab.id
                    ? 'bg-purple-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Icon size={14} />
                {tab.label}
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
        <div className="overflow-y-auto flex-1 p-5">
          {filteredItems.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No cosmetics found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map(item => {
                const isOwned = purchased.includes(item.id);
                const isEquipped = equipped[item.category] === item.id;
                const canAfford = coins >= item.cost;
                const isLoading = loadingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 bg-slate-900 flex flex-col gap-3 ${
                      isEquipped
                        ? 'border-green-600'
                        : isOwned
                        ? 'border-blue-700'
                        : 'border-slate-700'
                    }`}
                  >
                    {/* Color swatch + name row */}
                    <div className="flex items-center gap-3">
                      {item.color === 'rainbow' ? (
                        <RainbowSwatch />
                      ) : (
                        <div
                          className="rounded-full flex-shrink-0"
                          style={{ width: 48, height: 48, backgroundColor: item.color }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm leading-tight">{item.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</div>
                      </div>
                    </div>

                    {/* Rarity + cost row */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${RARITY_STYLES[item.rarity] || RARITY_STYLES.common}`}>
                        {item.rarity}
                      </span>
                      <div className="flex items-center gap-1">
                        <Coins size={13} className="text-yellow-400" />
                        <span className="text-yellow-400 font-bold text-sm">{item.cost.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Action button */}
                    {isEquipped ? (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-800 border border-green-600 text-green-200 text-sm font-medium">
                        <Check size={14} />
                        Equipped
                      </div>
                    ) : isOwned ? (
                      <button
                        onClick={() => handleEquip(item)}
                        disabled={isLoading}
                        className="py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
                      >
                        {isLoading ? 'Equipping...' : 'Equip'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!canAfford || isLoading}
                        className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          canAfford && !isLoading
                            ? 'bg-purple-700 hover:bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? 'Purchasing...' : !canAfford ? 'Not enough coins' : 'Purchase'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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

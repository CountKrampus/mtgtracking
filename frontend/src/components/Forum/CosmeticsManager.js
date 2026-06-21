import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { API_URL } from '../../config';
import { useAuthContext } from '../../contexts/AuthContext';

// ── Icon Picker ────────────────────────────────────────────────────────────────

const EMOJI_SECTIONS = [
  { label: 'MTG / Fantasy', icons: ['⚔️','🛡️','🔮','💎','💀','🐉','🦅','🌿','🔥','⚡','❄️','🌊','☀️','🌙','⭐','🌟','✨','💫','🎭','👑','🗡️','🪄','🏰','🗺️'] },
  { label: 'Stars & Trophies', icons: ['🏆','🥇','🏅','🎖️','🎯','🔯','🌠','🎪','♟️','🎀'] },
  { label: 'Nature & Creatures', icons: ['🌿','🍃','🌸','🌺','🍄','🦋','🐍','🦊','🐺','🦁','🐲','🦚','🕊️','🌵','🍀'] },
  { label: 'Elements & Energy', icons: ['🔥','⚡','💧','🌊','🌪️','❄️','☀️','🌙','⚙️','🔑','💥','🌈','🌑','⚗️','🧪'] },
  { label: 'Symbols & Status', icons: ['✅','❌','⭐','🔺','🔻','🔷','🔶','🟣','🟢','🔴','🟡','⚪','⚫','🔘','💠'] },
];

const MANA_KEYS = [
  'w','u','b','r','g','c',
  '0','1','2','3','4','5','6','7','8','9','10','x',
  'wu','ub','br','rg','gw','wb','ur','bg','rw','gu',
  'pw','pu','pb','pr','pg',
  's','e','t','q',
];

const LUCIDE_ICON_NAMES = [
  'Star','Crown','Zap','Flame','Sparkles','Shield','Gem','Trophy',
  'Award','Heart','Sword','Target','Layers','Tag','Package','Archive',
  'Lock','Unlock','Eye','EyeOff','Bell','Bookmark',
  'Flag','Compass','Map','Globe','Moon','Sun','Cloud','Wind',
  'Droplet','Feather','Leaf','Bug','Fish','Bird',
  'Mountain','Anchor','Key','Skull',
];

function renderIconPreview(val) {
  if (!val) return <span className="text-slate-500 text-lg">+</span>;
  if (val.startsWith('mana:')) {
    return <i className={`ms ms-${val.slice(5)} ms-cost`} style={{ fontSize: 18 }} />;
  }
  if (val.startsWith('lucide:')) {
    const Icon = LucideIcons[val.slice(7)];
    return Icon ? <Icon size={18} /> : <span>{val}</span>;
  }
  return <span className="text-lg leading-none">{val}</span>;
}

function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('emoji');
  const [customInput, setCustomInput] = useState('');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Sync customInput with value when not matching other tabs
  useEffect(() => {
    if (value && !value.startsWith('mana:') && !value.startsWith('lucide:')) {
      setCustomInput(value);
    }
  }, [value]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const openPicker = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 380;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 8) {
        left = window.innerWidth - popoverWidth - 8;
      }
      setPopoverPos({ top: rect.bottom + 4, left });
    }
    setOpen(true);
  };

  const select = (val) => {
    onChange(val);
    setOpen(false);
  };

  const tabClass = (t) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
      tab === t ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
    }`;

  const iconBtnClass = (val) =>
    `p-1.5 rounded hover:bg-slate-700 text-lg leading-none flex items-center justify-center w-9 h-9 transition-colors ${
      value === val ? 'bg-purple-700' : ''
    }`;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={openPicker}
        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 min-w-[60px] flex items-center gap-2 hover:border-purple-500 transition-colors"
        title="Pick icon"
      >
        {renderIconPreview(value)}
        {value && <span className="text-slate-400 text-xs truncate max-w-[80px]">{value}</span>}
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            width: 380,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 9999,
          }}
          className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl"
        >
          {/* Tab bar */}
          <div className="flex gap-1 p-2 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
            <button type="button" className={tabClass('emoji')} onClick={() => setTab('emoji')}>Emoji</button>
            <button type="button" className={tabClass('mana')} onClick={() => setTab('mana')}>Mana</button>
            <button type="button" className={tabClass('lucide')} onClick={() => setTab('lucide')}>Lucide</button>
            <button type="button" className={tabClass('custom')} onClick={() => setTab('custom')}>Custom</button>
            <button
              type="button"
              className="ml-auto text-slate-500 hover:text-white transition-colors"
              onClick={() => setOpen(false)}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Emoji tab */}
          {tab === 'emoji' && (
            <div className="p-1">
              {EMOJI_SECTIONS.map(section => (
                <div key={section.label}>
                  <div className="text-xs text-slate-500 uppercase tracking-wider px-2 pt-2 pb-1">
                    {section.label}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {section.icons.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={iconBtnClass(emoji)}
                        onClick={() => select(emoji)}
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mana tab */}
          {tab === 'mana' && (
            <div className="p-2">
              <div className="grid grid-cols-8 gap-1">
                {MANA_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    className={iconBtnClass(`mana:${key}`)}
                    onClick={() => select(`mana:${key}`)}
                    title={`mana:${key}`}
                  >
                    <i className={`ms ms-${key} ms-cost ms-shadow`} style={{ fontSize: 18 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lucide tab */}
          {tab === 'lucide' && (
            <div className="p-2">
              <div className="grid grid-cols-8 gap-1">
                {LUCIDE_ICON_NAMES.map(name => {
                  const Icon = LucideIcons[name];
                  if (!Icon) return null;
                  return (
                    <button
                      key={name}
                      type="button"
                      className={iconBtnClass(`lucide:${name}`)}
                      onClick={() => select(`lucide:${name}`)}
                      title={name}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom tab */}
          {tab === 'custom' && (
            <div className="p-3 space-y-2">
              <p className="text-xs text-slate-400">Enter any emoji or custom value:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="✨ or lucide:Star or mana:w"
                  className="flex-1 p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { if (customInput) select(customInput); }}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm"
                >
                  Set
                </button>
              </div>
              {customInput && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Preview:</span>
                  {renderIconPreview(customInput)}
                </div>
              )}
              {value && (
                <button
                  type="button"
                  onClick={() => select('')}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear icon
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const COLOR_CATEGORIES = ['titleColor', 'profileBorderColor', 'flairIcon', 'postBackground', 'threadHighlight', 'nameplateBackground', 'formatBadge'];
const BORDER_ANIMATION_CATEGORIES = ['avatarBorder', 'titleColor'];
const CSS_GRADIENT_CATEGORIES = ['profileBackground', 'profileTheme', 'postFrame', 'nameplateBackground'];
const BANNER_CATEGORIES = ['profileBanner'];
const UNLOCK_CATEGORIES = ['memberTitle', 'signature', 'achievementShowcase', 'favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview', 'aboutMe', 'personalLinks'];

const defaultForm = {
  name: '', category: 'titleColor', cost: 0, description: '',
  rarity: 'common', color: '#9B59B6', icon: null,
  cssProperties: null, cssPropertiesRaw: '', imageUrl: null, animationClass: null,
  availableUntil: null,
};

const getPreview = (c) => {
  if (c.color === 'rainbow') return (
    <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)' }} />
  );
  if (c.color) return (
    <div className={`w-8 h-8 rounded-full flex-shrink-0 ${c.animationClass || ''}`} style={{ backgroundColor: c.color }} />
  );
  if (c.cssProperties) return (
    <div className="w-8 h-8 rounded flex-shrink-0" style={c.cssProperties} />
  );
  if (c.imageUrl) return <div className="w-8 h-8 rounded flex-shrink-0 bg-slate-600 flex items-center justify-center text-xs">🖼</div>;
  return <div className="w-8 h-8 rounded-full flex-shrink-0 bg-slate-700 flex items-center justify-center text-purple-400">✦</div>;
};

export default function CosmeticsManager() {
  const { authFetch } = useAuthContext();
  const [cosmetics, setCosmetics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    fetchCosmetics();
  }, []);

  const fetchCosmetics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/forum/admin/cosmetics`);
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }
      if (!response.ok) throw new Error(data.message || 'Failed to fetch cosmetics');
      setCosmetics(data.cosmetics || []);
    } catch (err) {
      setError(err.message || 'Failed to load cosmetics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Derived visibility flags based on selected category
  const showColorPicker = COLOR_CATEGORIES.includes(formData.category) || BORDER_ANIMATION_CATEGORIES.includes(formData.category);
  const showRainbowToggle = formData.category === 'titleColor';
  const showAnimationClass = BORDER_ANIMATION_CATEGORIES.includes(formData.category);
  const showCssProperties = CSS_GRADIENT_CATEGORIES.includes(formData.category);
  const showBannerOptions = BANNER_CATEGORIES.includes(formData.category);

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    // Reset visual fields when category type changes to avoid stale data
    setFormData(prev => ({
      ...defaultForm,
      name: prev.name,
      cost: prev.cost,
      description: prev.description,
      rarity: prev.rarity,
      icon: prev.icon,
      category: cat,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate cssProperties JSON if applicable
    if ((showCssProperties || showBannerOptions) && formData.cssPropertiesRaw && !formData.imageUrl) {
      try {
        JSON.parse(formData.cssPropertiesRaw);
      } catch {
        setError('CSS Properties must be valid JSON. Example: { "background": "linear-gradient(135deg, #1a1a2e, #6a0dad)" }');
        return;
      }
    }

    const payload = {
      name: formData.name,
      category: formData.category,
      cost: parseInt(formData.cost) || 0,
      description: formData.description,
      rarity: formData.rarity,
      color: showColorPicker ? (formData.color || null) : null,
      animationClass: formData.animationClass || null,
      cssProperties: formData.cssProperties || null,
      imageUrl: formData.imageUrl || null,
      icon: formData.icon || null,
      isActive: true,
      availableUntil: formData.availableUntil || null,
    };

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_URL}/forum/admin/cosmetics/${editingId}`
        : `${API_URL}/forum/admin/cosmetics`;

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }
      if (!response.ok) throw new Error(data.message || 'Failed to save cosmetic');

      setMessage({ type: 'success', text: editingId ? 'Cosmetic updated' : 'Cosmetic created' });
      setTimeout(() => setMessage(null), 3000);
      setFormData(defaultForm);
      setEditingId(null);
      setShowForm(false);
      fetchCosmetics();
    } catch (err) {
      setError(err.message || 'Failed to save cosmetic');
      console.error(err);
    }
  };

  const handleEdit = (cosmetic) => {
    setFormData({
      ...defaultForm,
      ...cosmetic,
      cssPropertiesRaw: cosmetic.cssProperties ? JSON.stringify(cosmetic.cssProperties, null, 2) : '',
    });
    setEditingId(cosmetic._id);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(defaultForm);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cosmetic?')) return;
    try {
      const response = await authFetch(`${API_URL}/forum/admin/cosmetics/${id}`, { method: 'DELETE' });
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }
      if (!response.ok) throw new Error(data.message || 'Failed to delete cosmetic');
      setMessage({ type: 'success', text: 'Cosmetic deleted' });
      setTimeout(() => setMessage(null), 3000);
      fetchCosmetics();
    } catch (err) {
      setError(err.message || 'Failed to delete cosmetic');
      console.error(err);
    }
  };

  if (loading) return <div className="text-slate-400">Loading cosmetics...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Cosmetics Shop</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm flex items-center gap-1"
          >
            <Plus size={16} /> Add Cosmetic
          </button>
        )}
      </div>

      {message && (
        <div className={`p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {error && (
        <div className="p-2 rounded text-sm bg-red-900/30 text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-white">{editingId ? 'Edit Cosmetic' : 'New Cosmetic'}</h4>
            <button onClick={handleCloseForm} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              required
            />

            {/* Category — grouped */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Category</label>
              <select
                value={formData.category}
                onChange={handleCategoryChange}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              >
                <optgroup label="Post Appearance">
                  <option value="titleColor">Title Color</option>
                  <option value="avatarBorder">Avatar Border</option>
                  <option value="flairIcon">Flair Icon</option>
                  <option value="postBackground">Post Background Tint</option>
                  <option value="postFrame">Post Frame</option>
                  <option value="threadHighlight">Thread Highlight</option>
                  <option value="nameplateBackground">Nameplate Background</option>
                  <option value="formatBadge">Format Badge</option>
                  <option value="setSymbolFlair">Set Symbol Flair</option>
                </optgroup>
                <optgroup label="Forum Profile">
                  <option value="profileBorderColor">Profile Border Color</option>
                  <option value="profileBackground">Profile Background</option>
                  <option value="profileBanner">Profile Banner</option>
                  <option value="profileTheme">Profile Theme</option>
                </optgroup>
                <optgroup label="Unlocks">
                  <option value="memberTitle">Member Title</option>
                  <option value="signature">Signature</option>
                  <option value="achievementShowcase">Achievement Showcase</option>
                  <option value="favoriteCardsShowcase">Favorite Cards Showcase</option>
                  <option value="deckShowcase">Deck Showcase</option>
                  <option value="collectionStatsWidget">Collection Stats Widget</option>
                  <option value="wishlistPreview">Wishlist Preview</option>
                  <option value="aboutMe">About Me</option>
                  <option value="personalLinks">Personal Links</option>
                </optgroup>
              </select>
            </div>

            {/* Cost + Rarity + Icon row */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cost (coins)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Rarity</label>
                <select
                  value={formData.rarity}
                  onChange={e => setFormData({ ...formData, rarity: e.target.value })}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Icon</label>
                <IconPicker
                  value={formData.icon || ''}
                  onChange={val => setFormData({ ...formData, icon: val || null })}
                />
              </div>
            </div>

            {/* Description */}
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              rows={2}
            />

            {/* Available Until — seasonal items */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Available Until <span className="text-slate-500">(leave empty for permanent)</span>
              </label>
              <input
                type="datetime-local"
                value={formData.availableUntil
                  ? new Date(formData.availableUntil).toISOString().slice(0, 16)
                  : ''}
                onChange={e => setFormData({
                  ...formData,
                  availableUntil: e.target.value ? new Date(e.target.value).toISOString() : null,
                })}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              />
            </div>

            {/* ── Visual fields — conditional on category ── */}

            {/* Color picker — color + border animation categories */}
            {showColorPicker && formData.color !== 'rainbow' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Color</label>
                <input
                  type="color"
                  value={formData.color || '#9B59B6'}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-9 p-1 bg-slate-900 border border-slate-600 rounded cursor-pointer"
                />
                <span className="text-slate-400 text-xs">{formData.color}</span>
              </div>
            )}

            {/* Rainbow toggle — titleColor only */}
            {showRainbowToggle && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.color === 'rainbow'}
                  onChange={e => setFormData({ ...formData, color: e.target.checked ? 'rainbow' : '#FFD700' })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Animated rainbow color</span>
              </label>
            )}

            {/* Animation class — avatarBorder and titleColor */}
            {showAnimationClass && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Animation</label>
                <select
                  value={formData.animationClass || ''}
                  onChange={e => setFormData({ ...formData, animationClass: e.target.value || null })}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="">None (solid color)</option>
                  {formData.category === 'titleColor' ? (
                    <option value="text-foil">✨ Foil Shimmer</option>
                  ) : (
                    <>
                      <option value="border-anim-fire">🔥 Fire</option>
                      <option value="border-anim-lightning">⚡ Lightning</option>
                      <option value="border-anim-diamond">💎 Diamond</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* CSS gradient properties — profileBackground, profileTheme, postFrame */}
            {showCssProperties && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  CSS Properties (JSON) — e.g.{' '}
                  <code className="text-slate-500">{'{ "background": "linear-gradient(135deg, #1a1a2e, #6a0dad)" }'}</code>
                </label>
                <textarea
                  value={formData.cssPropertiesRaw || ''}
                  onChange={e => setFormData({ ...formData, cssPropertiesRaw: e.target.value })}
                  onBlur={e => {
                    try {
                      const parsed = JSON.parse(e.target.value || '{}');
                      setFormData(prev => ({ ...prev, cssProperties: parsed }));
                    } catch {
                      // invalid JSON — leave as-is, will be caught on submit
                    }
                  }}
                  rows={3}
                  placeholder='{ "background": "linear-gradient(135deg, #1a1a2e, #6a0dad)" }'
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-xs font-mono"
                />
              </div>
            )}

            {/* Banner options — profileBanner only: gradient OR image URL */}
            {showBannerOptions && (
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">Banner type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bannerType"
                      value="gradient"
                      checked={formData.imageUrl === null || formData.imageUrl === undefined || formData.imageUrl === ''}
                      onChange={() => setFormData({ ...formData, imageUrl: null })}
                    />
                    <span className="text-sm text-slate-300">CSS Gradient</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bannerType"
                      value="image"
                      checked={!!formData.imageUrl}
                      onChange={() => setFormData({ ...formData, cssProperties: null, cssPropertiesRaw: '' })}
                    />
                    <span className="text-sm text-slate-300">Image URL</span>
                  </label>
                </div>
                {formData.imageUrl !== null && formData.imageUrl !== undefined && formData.imageUrl !== '' ? (
                  <input
                    type="url"
                    placeholder="https://example.com/banner.jpg"
                    value={formData.imageUrl || ''}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                  />
                ) : (
                  <textarea
                    value={formData.cssPropertiesRaw || ''}
                    onChange={e => setFormData({ ...formData, cssPropertiesRaw: e.target.value })}
                    onBlur={e => {
                      try {
                        setFormData(prev => ({ ...prev, cssProperties: JSON.parse(e.target.value || '{}') }));
                      } catch {}
                    }}
                    rows={2}
                    placeholder='{ "background": "linear-gradient(90deg, #667eea, #764ba2)" }'
                    className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-xs font-mono"
                  />
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-semibold"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {/* Cosmetics list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cosmetics.map(cosmetic => (
          <div key={cosmetic._id} className="bg-slate-800/50 p-3 rounded border border-slate-700 flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {getPreview(cosmetic)}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{cosmetic.name}</div>
                <div className="text-xs text-slate-400">
                  {cosmetic.category} • {cosmetic.rarity} • {cosmetic.cost} coins
                  {cosmetic.availableUntil && (
                    <span className="text-xs text-amber-400 ml-1">
                      ⏰ Until {new Date(cosmetic.availableUntil).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {cosmetic.animationClass && (
                  <div className="text-xs text-slate-500 mt-0.5">anim: {cosmetic.animationClass}</div>
                )}
                {cosmetic.description && (
                  <div className="text-xs text-slate-400 mt-1 truncate">{cosmetic.description}</div>
                )}
              </div>
            </div>
            <div className="flex gap-1 ml-2 flex-shrink-0">
              <button
                onClick={() => handleEdit(cosmetic)}
                className="p-1 hover:bg-slate-700 rounded text-blue-400"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDelete(cosmetic._id)}
                className="p-1 hover:bg-slate-700 rounded text-red-400"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cosmetics.length === 0 && !showForm && (
        <div className="text-center text-slate-400 py-8">
          No cosmetics yet. Create your first one!
        </div>
      )}
    </div>
  );
}

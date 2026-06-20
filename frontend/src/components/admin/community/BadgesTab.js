import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { API_URL } from '../../../config';

// ─── Curated icon lists (module scope) ──────────────────────────────────────

const LUCIDE_ICONS = [
  'Star', 'Trophy', 'Crown', 'Shield', 'Flame', 'Zap', 'Heart',
  'Skull', 'Gem', 'Sparkles', 'Target', 'Eye', 'BookOpen', 'Users', 'ThumbsUp',
  'Award', 'Medal', 'Wand2', 'Moon', 'Sun', 'Leaf', 'Droplets', 'Feather',
  'Ghost', 'Crosshair', 'Layers', 'Diamond', 'Hexagon', 'Infinity', 'BadgeCheck',
  'Dices', 'Map', 'Compass', 'Lightbulb', 'Lock', 'Key', 'Clock', 'Swords',
  'Sword'
];

const MANA_SYMBOLS = [
  { key: 'w',  label: 'White' },
  { key: 'u',  label: 'Blue' },
  { key: 'b',  label: 'Black' },
  { key: 'r',  label: 'Red' },
  { key: 'g',  label: 'Green' },
  { key: 'c',  label: 'Colorless' },
  { key: 't',  label: 'Tap' },
  { key: 'q',  label: 'Untap' },
  { key: 'e',  label: 'Energy' },
  { key: 's',  label: 'Snow' },
  { key: 'x',  label: 'X' },
  { key: '0',  label: '0' },
  { key: '1',  label: '1' },
  { key: '2',  label: '2' },
  { key: '3',  label: '3' },
  { key: '4',  label: '4' },
  { key: '5',  label: '5' },
  { key: '6',  label: '6' },
  { key: '7',  label: '7' },
  { key: '8',  label: '8' },
  { key: '9',  label: '9' },
  { key: '10', label: '10' },
  { key: '15', label: '15' },
  { key: '20', label: '20' },
  { key: 'p',  label: 'Phyrexian' },
  { key: 'wu', label: 'W/U' },
  { key: 'wb', label: 'W/B' },
  { key: 'ub', label: 'U/B' },
  { key: 'ur', label: 'U/R' },
  { key: 'br', label: 'B/R' },
  { key: 'bg', label: 'B/G' },
  { key: 'rw', label: 'R/W' },
  { key: 'rg', label: 'R/G' },
  { key: 'gw', label: 'G/W' },
  { key: 'gu', label: 'G/U' },
];

// ─── Render helper (module scope) ────────────────────────────────────────────

function renderBadgeIcon(iconStr, size = 20) {
  if (!iconStr) return null;
  if (iconStr.startsWith('lucide:')) {
    const name = iconStr.slice(7);
    const Icon = LucideIcons[name];
    return Icon ? <Icon size={size} /> : <span className="text-xs text-gray-400">{name}</span>;
  }
  if (iconStr.startsWith('mana:')) {
    const key = iconStr.slice(5);
    return <i className={`ms ms-${key} ms-2x`} style={{ fontSize: size }} />;
  }
  return <span>{iconStr}</span>;
}

// ─── BadgeIconPicker (module scope — NOT inside BadgesTab) ───────────────────

function BadgeIconPicker({ onSelect, onClose }) {
  const [tab, setTab] = useState('lucide');
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const filteredLucide = LUCIDE_ICONS.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMana = MANA_SYMBOLS.filter(({ label }) =>
    label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl"
      style={{ top: '100%', left: 0 }}
    >
      {/* Tab switcher */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setTab('lucide')}
          className={`flex-1 py-2 text-sm font-medium transition ${
            tab === 'lucide'
              ? 'text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Lucide Icons
        </button>
        <button
          onClick={() => setTab('mana')}
          className={`flex-1 py-2 text-sm font-medium transition ${
            tab === 'mana'
              ? 'text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Mana Symbols
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          autoFocus
        />
      </div>

      {/* Icon grid */}
      <div className="p-2 max-h-56 overflow-y-auto">
        {tab === 'lucide' && (
          <div className="grid grid-cols-8 gap-1">
            {filteredLucide.map(name => {
              const Icon = LucideIcons[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  title={name}
                  onClick={() => { onSelect(`lucide:${name}`); onClose(); }}
                  className="flex items-center justify-center w-8 h-8 rounded text-gray-300 hover:bg-purple-600/40 hover:text-white transition"
                >
                  <Icon size={20} />
                </button>
              );
            })}
            {filteredLucide.length === 0 && (
              <span className="col-span-8 text-center text-gray-500 text-xs py-4">No icons found</span>
            )}
          </div>
        )}

        {tab === 'mana' && (
          <div className="grid grid-cols-8 gap-1">
            {filteredMana.map(({ key, label }) => (
              <button
                key={key}
                title={label}
                onClick={() => { onSelect(`mana:${key}`); onClose(); }}
                className="flex items-center justify-center w-8 h-8 rounded text-gray-300 hover:bg-purple-600/40 hover:text-white transition"
              >
                <i className={`ms ms-${key} ms-2x`} style={{ fontSize: 20 }} />
              </button>
            ))}
            {filteredMana.length === 0 && (
              <span className="col-span-8 text-center text-gray-500 text-xs py-4">No symbols found</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BadgesTab ────────────────────────────────────────────────────────────────

function BadgesTab() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', icon: '' });
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const token = localStorage.getItem('mtg_access_token');
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Fetch badges on mount
  useEffect(() => {
    fetchBadges();
  }, []);

  async function fetchBadges() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/badges`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBadges(data.badges || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingBadge(null);
    setForm({ name: '', description: '', icon: '' });
    setShowForm(true);
    setShowPicker(false);
  }

  function openEdit(badge) {
    setEditingBadge(badge);
    setForm({ name: badge.name, description: badge.description || '', icon: badge.icon || '' });
    setShowForm(true);
    setShowPicker(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingBadge(null);
    setShowPicker(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), icon: form.icon };
      let res;
      if (editingBadge) {
        res = await fetch(`${API_URL}/admin/badges/${editingBadge._id}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/admin/badges`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (editingBadge) {
        setBadges(prev => prev.map(b => b._id === editingBadge._id ? data.badge : b));
      } else {
        setBadges(prev => [...prev, data.badge]);
      }
      cancelForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`${API_URL}/admin/badges/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBadges(prev => prev.filter(b => b._id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Badges</h2>
          <p className="text-sm text-gray-400 mt-1">Manage badge definitions awarded to users</p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium transition"
          >
            + Create Badge
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-600 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
          <h3 className="text-base font-semibold text-white mb-4">
            {editingBadge ? 'Edit Badge' : 'New Badge'}
          </h3>

          {/* Name */}
          <div className="mb-3">
            <label className="block text-sm text-gray-300 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Badge name"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description of the badge"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Icon picker */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Icon</label>
            <div className="relative inline-block">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 flex items-center justify-center bg-gray-800 border border-gray-600 rounded-lg text-white">
                  {form.icon ? renderBadgeIcon(form.icon, 20) : <span className="text-gray-500 text-xs">—</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(p => !p)}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition"
                >
                  {form.icon ? 'Change Icon' : 'Pick Icon'}
                </button>
                {form.icon && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon: '' }))}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white text-sm rounded-lg transition"
                  >
                    Clear
                  </button>
                )}
              </div>

              {showPicker && (
                <BadgeIconPicker
                  onSelect={iconStr => {
                    setForm(f => ({ ...f, icon: iconStr }));
                    setShowPicker(false);
                  }}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
            {form.icon && (
              <p className="mt-1 text-xs text-gray-500">{form.icon}</p>
            )}
          </div>

          {/* Form actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition"
            >
              {saving ? 'Saving…' : editingBadge ? 'Save Changes' : 'Create Badge'}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Badge list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : badges.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          No badges defined yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {badges.map(badge => (
            <div
              key={badge._id}
              className="flex items-center gap-4 p-3 bg-gray-700/50 border border-gray-600/50 rounded-lg"
            >
              {/* Icon */}
              <div className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-lg text-purple-300 flex-shrink-0">
                {badge.icon ? renderBadgeIcon(badge.icon, 22) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </div>

              {/* Name + description */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{badge.name}</p>
                {badge.description && (
                  <p className="text-xs text-gray-400 truncate">{badge.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {deleteConfirm === badge._id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Delete "{badge.name}"?</span>
                    <button
                      onClick={() => handleDelete(badge._id)}
                      className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => openEdit(badge)}
                      className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(badge._id)}
                      className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-xs rounded-lg transition"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BadgesTab;

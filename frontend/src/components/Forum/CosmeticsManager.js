import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function CosmeticsManager() {
  const [cosmetics, setCosmetics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'titleColor',
    cost: 0,
    description: '',
    rarity: 'common',
    color: '#FF00FF',
    icon: '✨'
  });

  useEffect(() => {
    fetchCosmetics();
  }, []);

  const fetchCosmetics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${API_URL}/forum/admin/cosmetics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch cosmetics');
      }
      const data = await response.json();
      setCosmetics(data.cosmetics);
    } catch (err) {
      setError(err.message || 'Failed to load cosmetics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_URL}/forum/admin/cosmetics/${editingId}`
        : `${API_URL}/forum/admin/cosmetics`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save cosmetic');
      }

      setMessage({ type: 'success', text: editingId ? 'Cosmetic updated' : 'Cosmetic created' });
      setTimeout(() => setMessage(null), 3000);

      setFormData({
        name: '',
        category: 'titleColor',
        cost: 0,
        description: '',
        rarity: 'common',
        color: '#FF00FF',
        icon: '✨'
      });
      setEditingId(null);
      setShowForm(false);
      fetchCosmetics();
    } catch (err) {
      setError(err.message || 'Failed to save cosmetic');
      console.error(err);
    }
  };

  const handleEdit = (cosmetic) => {
    setFormData(cosmetic);
    setEditingId(cosmetic._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this cosmetic?')) return;

    try {
      const token = localStorage.getItem('mtg_access_token');
      const response = await fetch(`${API_URL}/forum/admin/cosmetics/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete cosmetic');
      }

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
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData({
                  name: '',
                  category: 'titleColor',
                  cost: 0,
                  description: '',
                  rarity: 'common',
                  color: '#FF00FF',
                  icon: '✨'
                });
              }}
              className="text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              required
            />

            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
            >
              <option value="titleColor">Title Color</option>
              <option value="profileBorderColor">Profile Border</option>
              <option value="avatarBorder">Avatar Border</option>
              <option value="badgeColor">Badge Color</option>
            </select>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="Cost (coins)"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                className="p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                required
              />

              <select
                value={formData.rarity}
                onChange={e => setFormData({ ...formData, rarity: e.target.value })}
                className="p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="legendary">Legendary</option>
              </select>

              <input
                type="text"
                placeholder="Icon (emoji)"
                value={formData.icon}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                className="p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                maxLength="2"
              />
            </div>

            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
              rows="2"
            />

            <div className="flex gap-2">
              <input
                type="color"
                value={formData.color || '#FF00FF'}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="p-1 bg-slate-900 border border-slate-600 rounded w-12 h-9"
              />
              <button
                type="submit"
                className="flex-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-semibold"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cosmetics.map(cosmetic => (
          <div key={cosmetic._id} className="bg-slate-800/50 p-3 rounded border border-slate-700 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{cosmetic.icon}</span>
                <div>
                  <div className="font-semibold text-white text-sm">{cosmetic.name}</div>
                  <div className="text-xs text-slate-400">
                    {cosmetic.category} • {cosmetic.rarity} • {cosmetic.cost} coins
                  </div>
                </div>
              </div>
              {cosmetic.description && (
                <div className="text-xs text-slate-400 mt-1">{cosmetic.description}</div>
              )}
            </div>
            <div className="flex gap-1 ml-2">
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

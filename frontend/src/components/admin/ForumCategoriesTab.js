import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical, ChevronDown, ChevronRight, X, Save } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function ForumCategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentCategoryId: null,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/forum/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!formData.name.trim()) {
      alert('Category name is required');
      return;
    }

    try {
      await axios.post(`${API_URL}/forum/admin/categories`, formData);
      fetchCategories();
      setFormData({ name: '', description: '', parentCategoryId: null });
      setShowNewForm(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id) => {
    try {
      await axios.put(`${API_URL}/forum/admin/categories/${id}`, {
        name: formData.name,
        description: formData.description,
      });
      fetchCategories();
      setEditingId(null);
      setFormData({ name: '', description: '', parentCategoryId: null });
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await axios.delete(`${API_URL}/forum/admin/categories/${id}`);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete category');
    }
  };

  const toggleExpanded = (id) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return <div className="text-white/60">Loading categories...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Forum Categories</h3>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus size={16} /> New Category
          </button>
        )}
      </div>

      {/* New Category Form */}
      {showNewForm && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Category name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-white/10 text-white border border-white/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full bg-white/10 text-white border border-white/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 text-white/60 hover:text-white text-sm transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCategory}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <div className="text-white/40 text-center py-8">No categories yet</div>
        ) : (
          categories.map((category) => (
            <div key={category._id}>
              {/* Parent Category */}
              <div className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition group">
                <GripVertical size={16} className="text-white/40 flex-shrink-0" />

                {category.children?.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(category._id)}
                    className="p-0.5 text-white/60 hover:text-white"
                  >
                    {expandedCategories[category._id] ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  {editingId === category._id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-400"
                      />
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full bg-white/10 text-white border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-400 resize-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="text-white font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-white/60 text-xs">{category.description}</div>
                      )}
                      <div className="text-white/40 text-xs mt-1">
                        {category.threadCount} threads
                        {category.children?.length > 0 && ` • ${category.children.length} subcategories`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  {editingId === category._id ? (
                    <>
                      <button
                        onClick={() => handleUpdateCategory(category._id)}
                        className="p-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition"
                        title="Save"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setFormData({ name: '', description: '', parentCategoryId: null });
                        }}
                        className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded transition"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(category._id);
                          setFormData({
                            name: category.name,
                            description: category.description,
                            parentCategoryId: null,
                          });
                        }}
                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category._id)}
                        className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Subcategories */}
              {expandedCategories[category._id] && category.children?.length > 0 && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/10 pl-3">
                  {category.children.map((subcategory) => (
                    <div
                      key={subcategory._id}
                      className="flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition group text-sm"
                    >
                      <GripVertical size={14} className="text-white/40 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-white/80">{subcategory.name}</div>
                        {subcategory.description && (
                          <div className="text-white/50 text-xs">{subcategory.description}</div>
                        )}
                        <div className="text-white/30 text-xs">{subcategory.threadCount} threads</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => {
                            setEditingId(subcategory._id);
                            setFormData({
                              name: subcategory.name,
                              description: subcategory.description,
                              parentCategoryId: subcategory.parentCategoryId,
                            });
                          }}
                          className="p-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(subcategory._id)}
                          className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-white/50 text-xs">Drag to reorder categories (coming soon)</p>
    </div>
  );
}

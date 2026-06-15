import React, { useState, useEffect } from 'react';
import { Search, Plus, Zap, Users, MessageSquare } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function ForumHome({ onSelectCategory, onNewThread }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    axios
      .get(`${API_URL}/forum/categories`)
      .then((res) => {
        setCategories(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching categories:', err);
        setLoading(false);
      });
  }, []);

  const parentCategories = categories.filter((cat) => !cat.parentCategoryId);

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Community Forum</h1>
              <p className="text-white/60 text-sm mt-1">Discussion for MTG players</p>
            </div>
            <button
              onClick={onNewThread}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition"
            >
              <Plus size={18} /> New Thread
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {loading ? (
            <div className="text-center py-12 text-white/60">Loading categories...</div>
          ) : parentCategories.length === 0 ? (
            <div className="text-center py-12 text-white/60">No categories found</div>
          ) : (
            parentCategories.map((category) => (
              <div key={category._id}>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">{getEmojiForCategory(category.name)}</span>
                    {category.name}
                  </h2>
                  <p className="text-white/60 text-sm">{category.description}</p>
                </div>

                {/* Subcategories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.children && category.children.length > 0 ? (
                    category.children.map((subcategory) => (
                      <button
                        key={subcategory._id}
                        onClick={() => onSelectCategory(subcategory._id)}
                        className="text-left p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-purple-500/30 transition group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white group-hover:text-purple-400 transition flex-1">
                            {subcategory.name}
                          </h3>
                          <span className="text-xs text-white/40 flex-shrink-0 ml-2">
                            {subcategory.threadCount}
                          </span>
                        </div>
                        <p className="text-white/50 text-sm">{subcategory.description}</p>
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => onSelectCategory(category._id)}
                      className="text-left p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-purple-500/30 transition group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white group-hover:text-purple-400 transition flex-1">
                          {category.name}
                        </h3>
                        <span className="text-xs text-white/40 flex-shrink-0 ml-2">
                          {category.threadCount}
                        </span>
                      </div>
                      <p className="text-white/50 text-sm">{category.description}</p>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getEmojiForCategory(name) {
  const emojiMap = {
    'Site & Rules': '📋',
    'Getting Started': '🎯',
    'Community': '👥',
    'Events & Tournaments': '🏆',
  };
  return emojiMap[name] || '📌';
}

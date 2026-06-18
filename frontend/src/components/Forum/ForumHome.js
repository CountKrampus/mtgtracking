import React, { useState, useEffect } from 'react';
import { Search, Plus, Zap, Settings, ShoppingBag } from 'lucide-react';
import axios from 'axios';
import ThreadComposer from './ThreadComposer';
import ForumAdminPanel from './ForumAdminPanel';
import ForumFeed from './ForumFeed';
import ForumShop from './ForumShop';
import { API_URL } from '../../config';

export default function ForumHome({ onSelectCategory, onNewThread, onOpenAdmin, authUser, onForumProfile }) {
  const [showThreadComposer, setShowThreadComposer] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('categories');
  const [categoryRefreshPending, setCategoryRefreshPending] = useState(false);

  const debouncedRefreshCategories = () => {
    if (categoryRefreshPending) return; // Skip if refresh already pending
    setCategoryRefreshPending(true);
    axios
      .get(`${API_URL}/forum/categories`)
      .then((res) => setCategories(res.data))
      .finally(() => setCategoryRefreshPending(false));
  };

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

  const emojiMap = {
    'Site & Rules': '📋',
    'Getting Started': '🎯',
    'Community': '👥',
    'Events & Tournaments': '🏆',
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900">
      {/* Top Header - Forum title, search, profile/admin */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg">Forum</h1>

        <div className="flex-1 max-w-xs mx-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authUser && (
            <button
              onClick={() => setShowShop(true)}
              className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition"
              title="Forum Shop"
            >
              <ShoppingBag size={18} />
            </button>
          )}
          {authUser && onForumProfile && (
            <button
              onClick={onForumProfile}
              className="text-white/70 hover:text-white text-sm transition flex items-center gap-1"
            >
              🏛️ Forum Profile
            </button>
          )}
          {authUser?.role === 'admin' && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition"
              title="Forum Admin"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-4">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            activeTab === 'categories'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            activeTab === 'feed'
              ? 'bg-purple-600 text-white'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Feed
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with title and buttons */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Community Forum</h2>
              <p className="text-white/60 text-sm mt-1">Discussion for MTG players</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition font-semibold">
                <Zap size={18} /> Leaderboard
              </button>
              <button
                onClick={() => setShowThreadComposer(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition"
              >
                <Plus size={18} /> New Thread
              </button>
            </div>
          </div>

          {/* Categories or Feed based on active tab */}
          {activeTab === 'categories' ? (
            <>
              {loading ? (
                <div className="text-center py-12 text-white/60">Loading categories...</div>
              ) : parentCategories.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/60 mb-4">No categories found</p>
                  {authUser?.role === 'admin' && (
                    <button
                      onClick={() => setShowAdminPanel(true)}
                      className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition"
                    >
                      Create Categories
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {parentCategories.map((category) => (
                    <div key={category._id}>
                      <div className="mb-4 flex items-center gap-3">
                        <span className="text-2xl">{emojiMap[category.name] || '📌'}</span>
                        <div>
                          <h3 className="text-xl font-bold text-white">{category.name}</h3>
                          <p className="text-white/60 text-sm">{category.description}</p>
                        </div>
                      </div>

                      {/* Subcategories Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {category.children && category.children.length > 0 ? (
                          category.children.map((subcategory) => (
                            <button
                              key={subcategory._id}
                              onClick={() => onSelectCategory(subcategory._id)}
                              className="text-left p-4 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 hover:border-purple-400/50 transition group"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-white group-hover:text-purple-200 transition">
                                  {subcategory.name}
                                </h4>
                              </div>
                              <p className="text-white/60 text-xs mb-2">{subcategory.description}</p>
                              <div className="text-xs text-white/50">
                                📌 {subcategory.threadCount} threads
                              </div>
                            </button>
                          ))
                        ) : (
                          <button
                            onClick={() => onSelectCategory(category._id)}
                            className="text-left p-4 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 hover:border-purple-400/50 transition group"
                          >
                            <h4 className="font-semibold text-white group-hover:text-purple-200 transition mb-1">
                              {category.name}
                            </h4>
                            <p className="text-white/60 text-xs mb-2">{category.description}</p>
                            <div className="text-xs text-white/50">
                              📌 {category.threadCount} threads
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'feed' ? (
            <ForumFeed
              onSelectThread={onSelectCategory}
              onSelectPost={(threadId) => onSelectCategory(threadId)}
            />
          ) : null}
        </div>
      </div>

      {/* Thread Composer Modal */}
      <ThreadComposer
        isOpen={showThreadComposer}
        onClose={() => setShowThreadComposer(false)}
        apiUrl={API_URL}
        user={authUser}
        onThreadCreated={() => {
          setShowThreadComposer(false);
          // Refresh categories to show updated thread count
          debouncedRefreshCategories();
        }}
      />

      {/* Forum Admin Panel */}
      <ForumAdminPanel
        isOpen={showAdminPanel}
        onClose={() => {
          setShowAdminPanel(false);
          // Refresh categories after admin changes
          debouncedRefreshCategories();
        }}
      />

      {/* Forum Shop Modal */}
      {showShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white">Forum Shop</h2>
              <button
                onClick={() => setShowShop(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ForumShop apiUrl={API_URL} user={authUser} isOpen={showShop} onClose={() => setShowShop(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

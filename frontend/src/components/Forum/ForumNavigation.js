import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Settings, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config';
import ForumAdminPanel from './ForumAdminPanel';

export default function ForumNavigation({ onCategorySelect, selectedCategoryId, user }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/forum/categories`);
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);

      // Auto-expand parent categories that contain the selected child
      if (selectedCategoryId) {
        const autoExpand = {};
        data.forEach(cat => {
          if (cat.children && cat.children.some(c => c._id === selectedCategoryId)) {
            autoExpand[cat._id] = true;
          }
        });
        setExpanded(prev => ({ ...prev, ...autoExpand }));
      }
    } catch (error) {
      console.error('Error fetching forum categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand parent when selected category changes to a child
  useEffect(() => {
    if (!selectedCategoryId || categories.length === 0) return;
    const autoExpand = {};
    categories.forEach(cat => {
      if (cat.children && cat.children.some(c => c._id === selectedCategoryId)) {
        autoExpand[cat._id] = true;
      }
    });
    if (Object.keys(autoExpand).length > 0) {
      setExpanded(prev => ({ ...prev, ...autoExpand }));
    }
  }, [selectedCategoryId, categories]);

  const toggleExpanded = (catId) => {
    setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const parentCategories = categories.filter(cat => !cat.parentCategoryId);

  return (
    <div className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Categories</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchCategories}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
            title="Refresh categories"
          >
            <RefreshCw size={14} />
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
              title="Manage categories"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="px-4 py-3 text-sm text-slate-500">Loading...</div>
        ) : parentCategories.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-500">
            No categories yet.
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="block mt-2 text-purple-400 hover:text-purple-300 transition"
              >
                + Create one
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 px-2">
            {parentCategories.map(category => {
              const hasChildren = category.children && category.children.length > 0;
              const isExpanded = expanded[category._id];
              const isSelected = selectedCategoryId === category._id;

              return (
                <li key={category._id}>
                  {/* Parent category row */}
                  <div className="flex items-center gap-1">
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpanded(category._id)}
                        className="p-0.5 text-slate-400 hover:text-white transition flex-shrink-0"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 flex-shrink-0" />
                    )}

                    <button
                      onClick={() => onCategorySelect(category._id)}
                      className={`flex-1 text-left px-2 py-1.5 rounded text-sm transition min-w-0 ${
                        isSelected
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="font-medium truncate">{category.name}</div>
                      {typeof category.threadCount === 'number' && (
                        <div className={`text-xs mt-0.5 ${isSelected ? 'text-purple-200' : 'text-slate-500'}`}>
                          {category.threadCount} {category.threadCount === 1 ? 'thread' : 'threads'}
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Children */}
                  {hasChildren && isExpanded && (
                    <ul className="ml-5 mt-0.5 space-y-0.5">
                      {category.children.map(child => {
                        const isChildSelected = selectedCategoryId === child._id;
                        return (
                          <li key={child._id}>
                            <button
                              onClick={() => onCategorySelect(child._id)}
                              className={`w-full text-left px-2 py-1.5 rounded text-sm transition ${
                                isChildSelected
                                  ? 'bg-purple-600 text-white font-semibold'
                                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                              }`}
                            >
                              <div className="truncate">{child.name}</div>
                              {typeof child.threadCount === 'number' && (
                                <div className={`text-xs mt-0.5 ${isChildSelected ? 'text-purple-200' : 'text-slate-600'}`}>
                                  {child.threadCount} {child.threadCount === 1 ? 'thread' : 'threads'}
                                </div>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Admin create category shortcut */}
      {user?.role === 'admin' && (
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={() => setShowAdminPanel(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded text-sm text-purple-300 hover:text-purple-200 transition"
          >
            <Plus size={14} />
            New Category
          </button>
        </div>
      )}

      {/* Forum Admin Panel Modal */}
      <ForumAdminPanel
        isOpen={showAdminPanel}
        onClose={() => {
          setShowAdminPanel(false);
          fetchCategories();
        }}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ForumNav({ categories, onCategorySelect, selectedCategory }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpanded = (catId) => {
    setExpanded(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold text-white mb-4">Forum Categories</h2>

      {categories.map(category => (
        <div key={category._id} className="mb-2">
          <div className="flex items-center gap-2">
            {category.children && category.children.length > 0 && (
              <button
                onClick={() => toggleExpanded(category._id)}
                className="p-0 hover:text-purple-400"
              >
                {expanded[category._id] ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            )}
            <button
              onClick={() => onCategorySelect(category._id)}
              className={`flex-1 text-left px-2 py-1 rounded hover:bg-slate-700 transition ${
                selectedCategory === category._id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-300'
              }`}
            >
              <div className="font-medium">{category.name}</div>
              <div className="text-xs text-slate-400">{category.threadCount} threads</div>
            </button>
          </div>

          {expanded[category._id] && category.children && (
            <div className="ml-6 mt-1 space-y-1">
              {category.children.map(child => (
                <button
                  key={child._id}
                  onClick={() => onCategorySelect(child._id)}
                  className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-slate-700 transition ${
                    selectedCategory === child._id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-300'
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

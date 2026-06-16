import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ForumCategoriesTab from './ForumCategoriesTab';
import SpamFilterAdmin from './SpamFilterAdmin';
import MuteManager from './MuteManager';
import { API_URL } from '../../config';

export default function ForumAdminPanel({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('categories');
  const [loadedTabs, setLoadedTabs] = useState({ categories: true }); // Load categories immediately

  useEffect(() => {
    if (isOpen && !loadedTabs[activeTab]) {
      setLoadedTabs(prev => ({ ...prev, [activeTab]: true }));
    }
  }, [isOpen, activeTab, loadedTabs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <h2 className="text-2xl font-bold text-white">Forum Admin</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-700 bg-slate-800">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'categories'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'moderation'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Moderation
          </button>
          <button
            onClick={() => setActiveTab('spam')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'spam'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Spam Filter
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'categories' && (
            loadedTabs.categories ? <ForumCategoriesTab /> : <div className="text-slate-400">Loading...</div>
          )}
          {activeTab === 'moderation' && (
            loadedTabs.moderation ? <MuteManager apiUrl={API_URL} /> : <div className="text-slate-400">Loading...</div>
          )}
          {activeTab === 'spam' && (
            loadedTabs.spam ? <SpamFilterAdmin /> : <div className="text-slate-400">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

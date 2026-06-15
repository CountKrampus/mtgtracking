import React, { useState } from 'react';
import { Settings, Shield, FolderOpen } from 'lucide-react';
import ForumCategoriesTab from './ForumCategoriesTab';

export default function ForumAdminTab({ onOpenSpamFilter, onOpenMuteManager }) {
  const [subTab, setSubTab] = useState('categories');

  const subTabs = [
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'moderation', label: 'Moderation', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${
                subTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-400 -mb-1'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Categories Tab */}
      {subTab === 'categories' && <ForumCategoriesTab />}

      {/* Moderation Tab */}
      {subTab === 'moderation' && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white">Forum Moderation Tools</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Spam Filter */}
            <button
              onClick={onOpenSpamFilter}
              className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition flex flex-col items-center justify-center gap-2"
            >
              <Settings size={24} className="text-blue-400" />
              <span className="font-semibold text-white">Spam Filter</span>
              <span className="text-xs text-white/60">Configure sensitivity & rules</span>
            </button>

            {/* Mute Manager */}
            <button
              onClick={onOpenMuteManager}
              className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition flex flex-col items-center justify-center gap-2"
            >
              <Shield size={24} className="text-red-400" />
              <span className="font-semibold text-white">Mute Manager</span>
              <span className="text-xs text-white/60">Create & manage mutes</span>
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-white/60 text-sm">
              Use the Spam Filter to configure keyword blocking, sensitivity levels, and post rate limits.
              Use the Mute Manager to temporarily or permanently restrict user posting privileges with automatic escalation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

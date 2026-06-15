import React from 'react';
import { Settings, Shield } from 'lucide-react';

export default function ForumAdminTab({ onOpenSpamFilter, onOpenMuteManager }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Forum Moderation Tools</h3>

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
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <p className="text-white/60 text-sm">
          Use the Spam Filter to configure keyword blocking, sensitivity levels, and post rate limits.
          Use the Mute Manager to temporarily or permanently restrict user posting privileges with automatic escalation.
        </p>
      </div>
    </div>
  );
}

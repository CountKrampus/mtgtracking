import React, { useState } from 'react';
import { X, Users, Activity, Server, Database } from 'lucide-react';
import UserManagement from './UserManagement';
import ActivityLogViewer from './ActivityLogViewer';
import SystemHealth from './SystemHealth';
import MigrationPanel from './MigrationPanel';

export function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'activity', label: 'Activity Log', icon: Activity },
    { id: 'health', label: 'System Health', icon: Server },
    { id: 'migration', label: 'Data Migration', icon: Database }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Admin Panel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'activity' && <ActivityLogViewer />}
          {activeTab === 'health' && <SystemHealth />}
          {activeTab === 'migration' && <MigrationPanel />}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;

import React, { useState } from 'react';
import { X, Users, Activity, Server, Database, MessageSquare, Settings, ChevronDown, ChevronRight, Shield, AlertTriangle, BarChart2, FileText, Archive, Trash2, Award, Trophy, Flag } from 'lucide-react';

import UsersTab from './user-management/UsersTab';
import RoleManagement from './RoleManagement';
import PermissionsManagement from './PermissionsManagement';
import BansTab from './user-management/BansTab';
import WarningsTab from './user-management/WarningsTab';
import AppealsTab from './user-management/AppealsTab';

import SystemHealthTab from './data-pricing/SystemHealthTab';
import PricingAdminTab from './data-pricing/PricingAdminTab';
import CollectionAuditsTab from './data-pricing/CollectionAuditsTab';
import BackupsExportsTab from './data-pricing/BackupsExportsTab';
import DataCleanupTab from './data-pricing/DataCleanupTab';
import PriceCorrectionsTab from './data-pricing/PriceCorrectionsTab';

import ContentModerationTab from './community/ContentModerationTab';
import FeedbackTab from './community/FeedbackTab';
import BadgesTab from './community/BadgesTab';
import ChallengesTab from './community/ChallengesTab';

import ActivityLogTab from './system/ActivityLogTab';
import SettingsTab from './system/SettingsTab';
import SessionsTab from './system/SessionsTab';
import PerformanceTab from './system/PerformanceTab';

const groups = [
  {
    id: 'userManagement',
    label: 'User Management',
    icon: Users,
    color: 'text-blue-400',
    tabs: [
      { id: 'users', label: 'Users', icon: Users, requiresRole: 'admin' },
      { id: 'roles', label: 'Roles', icon: Shield, requiresRole: 'admin' },
      { id: 'permissions', label: 'Permissions', icon: Shield, requiresPermission: 'roles:manage' },
      { id: 'bans', label: 'Bans', icon: Shield, requiresRole: 'moderator' },
      { id: 'warnings', label: 'Warnings', icon: AlertTriangle, requiresRole: 'moderator' },
      { id: 'appeals', label: 'Appeals', icon: MessageSquare, requiresRole: 'moderator' }
    ]
  },
  {
    id: 'dataPricing',
    label: 'Data & Pricing',
    icon: Database,
    color: 'text-green-400',
    tabs: [
      { id: 'health', label: 'System Health', icon: Server, requiresRole: 'admin' },
      { id: 'pricing', label: 'Pricing', icon: BarChart2, requiresRole: 'content_manager' },
      { id: 'audits', label: 'Collection Audits', icon: FileText, requiresRole: 'content_manager' },
      { id: 'backups', label: 'Backups & Exports', icon: Archive, requiresRole: 'admin' },
      { id: 'cleanup', label: 'Data Cleanup', icon: Trash2, requiresRole: 'admin' },
      { id: 'priceFlags', label: 'Price Flags', icon: Flag, requiresRole: 'moderator' }
    ]
  },
  {
    id: 'community',
    label: 'Community',
    icon: MessageSquare,
    color: 'text-purple-400',
    tabs: [
      { id: 'moderation', label: 'Content Moderation', icon: Shield, requiresRole: 'moderator' },
      { id: 'feedback', label: 'Feedback', icon: MessageSquare, requiresRole: 'support' },
      { id: 'badges', label: 'Badges', icon: Award, requiresRole: 'admin' },
      { id: 'challenges', label: 'Challenges', icon: Trophy, requiresRole: 'admin' }
    ]
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    color: 'text-slate-400',
    tabs: [
      { id: 'activity', label: 'Activity Log', icon: Activity, requiresRole: 'admin' },
      { id: 'settings', label: 'Settings', icon: Settings, requiresRole: 'admin' },
      { id: 'sessions', label: 'Sessions', icon: Database, requiresRole: 'admin' },
      { id: 'performance', label: 'Performance', icon: Activity, requiresRole: 'admin' }
    ]
  }
];

function canSeeTab(tab, user) {
  if (tab.requiresPermission) {
    if (!user || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes('all') || user.permissions.includes(tab.requiresPermission);
  }
  if (!tab.requiresRole) return true;
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  return user.role === tab.requiresRole;
}

function renderContent(activeTab) {
  switch (activeTab) {
    case 'users':      return <UsersTab />;
    case 'roles':      return <RoleManagement />;
    case 'permissions': return <PermissionsManagement />;
    case 'bans':       return <BansTab />;
    case 'warnings':   return <WarningsTab />;
    case 'appeals':    return <AppealsTab />;
    case 'health':     return <SystemHealthTab />;
    case 'pricing':    return <PricingAdminTab />;
    case 'audits':     return <CollectionAuditsTab />;
    case 'backups':    return <BackupsExportsTab />;
    case 'cleanup':    return <DataCleanupTab />;
    case 'priceFlags': return <PriceCorrectionsTab />;
    case 'moderation': return <ContentModerationTab />;
    case 'feedback':   return <FeedbackTab />;
    case 'badges':     return <BadgesTab />;
    case 'challenges': return <ChallengesTab />;
    case 'activity':     return <ActivityLogTab />;
    case 'settings':     return <SettingsTab />;
    case 'sessions':     return <SessionsTab />;
    case 'performance':  return <PerformanceTab />;
    default:             return null;
  }
}

export function AdminPanel({ onClose, user }) {
  const [activeTab, setActiveTab] = useState('users');
  const [expandedGroups, setExpandedGroups] = useState({
    userManagement: true,
    dataPricing: false,
    community: false,
    system: false
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  React.useEffect(() => {
    const allVisibleTabs = groups.flatMap(g => g.tabs.filter(t => canSeeTab(t, user)));
    if (allVisibleTabs.length > 0 && !allVisibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(allVisibleTabs[0].id);
    }
  }, [user]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Admin Panel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-full sm:w-56 bg-gray-900 border-b sm:border-b-0 sm:border-r border-gray-700 overflow-y-auto flex-shrink-0 max-h-64 sm:max-h-none">
            {groups.filter(group => group.tabs.some(tab => canSeeTab(tab, user))).map(group => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups[group.id];
              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800 transition"
                  >
                    <GroupIcon size={16} className={group.color} />
                    <span className="text-sm font-semibold text-gray-300 flex-1">{group.label}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-gray-500" />
                      : <ChevronRight size={14} className="text-gray-500" />}
                  </button>

                  {isExpanded && group.tabs.filter(tab => canSeeTab(tab, user)).map(tab => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-left text-sm transition ${
                          activeTab === tab.id
                            ? 'bg-purple-600/30 text-purple-300 border-r-2 border-purple-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        <TabIcon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {renderContent(activeTab)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;

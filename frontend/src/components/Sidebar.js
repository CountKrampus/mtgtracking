import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Layers,
  Heart,
  Users,
  Upload,
  Download,
  RefreshCw,
  Settings,
  Crown,
  BarChart3,
  Zap,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Command,
  BookOpen,
  LogOut,
  User,
  Shield,
  Trophy,
  MapPin,
  Star,
  Package,
  TrendingDown,
  Calendar,
  Eye,
  MessageSquare,
  DollarSign,
  Globe,
  ArrowLeftRight
} from 'lucide-react';

const Sidebar = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarOpen,
  setSidebarOpen,
  onImport,
  // currentView and setCurrentView are no longer needed — we use React Router
  onExportJSON,
  onExportCSV,
  onUpdatePrices,
  onFetchCardText,
  onCommanders,
  onSets,
  onCombos,
  onFinance,
  onOpenSettings,
  onOpenCamera,
  onCommandPalette,
  fileInputRef,
  isImporting,
  loading,
  featureToggles,
  // Auth props
  authUser,
  isMultiUserEnabled,
  onAccountSettings,
  onAdminPanel,
  onLogout,
  apiUrl
}) => {
  const ft = featureToggles || {};
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsedSections, setCollapsedSections] = useState({
    navigation: false,
    actions: false,
    tools: false,
    market: false,
    learn: false,
    gameplay: true,
  });
  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Returns a clickable section header; in icon-only mode returns null
  const sectionHeader = (label, key, extraClass = 'mt-4') => {
    if (sidebarCollapsed) return null;
    const isCollapsed = collapsedSections[key];
    return (
      <button
        onClick={() => toggleSection(key)}
        className={`w-full flex items-center justify-between px-3 py-1 ${extraClass} mb-1 group`}
      >
        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider group-hover:text-white/60 transition">
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`text-white/30 group-hover:text-white/50 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
        />
      </button>
    );
  };
  // Map view IDs to URL paths
  const viewToPath = {
    'dashboard': '/dashboard',
    'collection': '/collection',
    'decks': '/decks',
    'wishlist': '/wishlist',
    'forum': '/forum',
    'community-decks': '/community-decks',
    'lifecounter': '/lifecounter',
    'settings': '/settings',
    'card-rulings': '/learn/card-rulings',
    'interaction-checker': '/learn/interaction-checker',
    'new-player-guide': '/learn/new-player-guide',
    'keyword-glossary': '/learn/keyword-glossary',
    'combo-tutorials': '/learn/combo-tutorials',
    'format-guides': '/learn/format-guides',
    'sealed-simulator': '/play/sealed-simulator',
    'archenemy-mode': '/play/archenemy',
    'kingdoms-variant': '/dashboard',
    'star-variant': '/play/star-variant',
    'custom-format-builder': '/play/custom-format',
    'cube-builder': '/tools/cube-builder',
    'planechase-mode': '/play/planechase',
    'reprint-tracker': '/tools/reprint-tracker',
    'set-release-calendar': '/tools/set-calendar',
    'spoiler-season': '/tools/spoilers',
    'trades': '/trades',
    'challenges': '/challenges',
  };

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'collection', label: 'Collection', icon: BookOpen },
    { id: 'decks', label: 'Deck Builder', icon: Layers, feature: 'deckBuilder' },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, feature: 'wishlist' },
    { id: 'trades', label: 'Trading Board', icon: ArrowLeftRight },
    { id: 'challenges', label: 'Challenges', icon: Trophy },
    { id: 'forum', label: 'Forum', icon: MessageSquare },
    { id: 'community-decks', label: 'Community Decks', icon: Globe },
    { id: 'lifecounter', label: 'Life Counter', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  const navItems = allNavItems.filter(item => !item.feature || ft[item.feature] !== false);

  const actionItems = [
    {
      label: isImporting ? 'Importing...' : 'Import',
      icon: Upload,
      onClick: () => fileInputRef.current?.click(),
      disabled: isImporting,
      color: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      label: 'Export JSON',
      icon: Download,
      onClick: onExportJSON,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Export CSV',
      icon: Download,
      onClick: onExportCSV,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Update Prices',
      icon: RefreshCw,
      onClick: onUpdatePrices,
      disabled: loading,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'Fetch Card Text',
      icon: RefreshCw,
      onClick: onFetchCardText,
      disabled: loading,
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
  ];

  const allToolItems = [
    { label: 'Commanders', icon: Crown, onClick: onCommanders, color: 'text-amber-400', feature: 'commanderRecs' },
    { label: 'Sets', icon: BarChart3, onClick: onSets, color: 'text-teal-400', feature: 'setCompletion' },
    { label: 'Combos', icon: Zap, onClick: onCombos, color: 'text-orange-400', feature: 'comboFinder' },
    { label: 'Finance', icon: DollarSign, onClick: onFinance, color: 'text-emerald-400' },
    { label: 'Scan Card', icon: Camera, onClick: onOpenCamera, color: 'text-cyan-400' },
  ];
  const toolItems = allToolItems.filter(item => !item.feature || ft[item.feature] !== false);

  // Learning section items
  const learningItems = [
    { id: 'card-rulings', label: 'Card Rulings', icon: BookOpen },
    { id: 'interaction-checker', label: 'Interaction Checker', icon: Zap },
    { id: 'new-player-guide', label: 'New Player Guide', icon: User },
    { id: 'keyword-glossary', label: 'Keyword Glossary', icon: BookOpen },
    { id: 'combo-tutorials', label: 'Combo Tutorials', icon: Zap },
    { id: 'format-guides', label: 'Format Guides', icon: Trophy },
    { id: 'sealed-simulator', label: 'Sealed Simulator', icon: Package },
  ];

  const handleNavClick = (viewId) => {
    const path = viewToPath[viewId] || '/' + viewId;
    navigate(path);
    // Close mobile sidebar on navigation
    setSidebarOpen(false);
  };

  const handleLearningClick = (viewId) => {
    const path = viewToPath[viewId] || '/learn/' + viewId;
    navigate(path);
    // Close mobile sidebar on navigation
    setSidebarOpen(false);
  };

  const handleGameplayClick = (viewId) => {
    const path = viewToPath[viewId] || '/play/' + viewId;
    navigate(path);
    // Close mobile sidebar on navigation
    setSidebarOpen(false);
  };

  // Helper: check if a viewId is currently active based on URL
  const isViewActive = (viewId) => {
    const path = viewToPath[viewId] || '/' + viewId;
    if (viewId === 'forum') return location.pathname.startsWith('/forum');
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-300';
      case 'editor': return 'bg-blue-500/20 text-blue-300';
      case 'viewer': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* App Title */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white truncate">MTG Tracker</h1>
              <p className="text-xs text-white/50 truncate">Collection Manager</p>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="sm:hidden p-1 text-white/60 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* User Info (when multi-user enabled) */}
      {isMultiUserEnabled && authUser && (
        <div className="px-3 py-3 border-b border-white/10">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(authUser.displayName || authUser.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {authUser.displayName || authUser.username}
                </p>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(authUser.role)}`}>
                  {authUser.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm" title={authUser.displayName || authUser.username}>
                {(authUser.displayName || authUser.username || '?')[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {sectionHeader('Navigation', 'navigation', '')}
        {(sidebarCollapsed || !collapsedSections.navigation) && navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isViewActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg transition text-sm font-medium ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Actions Section */}
        {sectionHeader('Actions', 'actions')}
        {(sidebarCollapsed || !collapsedSections.actions) && actionItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.onClick}
              disabled={item.disabled}
              className="w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Tools Section */}
        {sectionHeader('Tools', 'tools')}
        {(sidebarCollapsed || !collapsedSections.tools) && (
          <>
            {toolItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon size={18} className={`flex-shrink-0 ${item.color}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
            {[
              { id: 'reprint-tracker', label: 'Reprint Tracker', icon: TrendingDown },
              { id: 'set-release-calendar', label: 'Set Release Calendar', icon: Calendar },
              { id: 'spoiler-season', label: 'Spoiler Season', icon: Eye },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = isViewActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm font-medium ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </>
        )}

        {/* Learning Section */}
        {sectionHeader('Learn', 'learn')}
        {(sidebarCollapsed || !collapsedSections.learn) && learningItems.map((item) => {
          const Icon = item.icon;
          const isActive = isViewActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleLearningClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm font-medium ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Gameplay Section */}
        {sectionHeader('Gameplay', 'gameplay')}
        {(sidebarCollapsed || !collapsedSections.gameplay) && [
          { id: 'planechase-mode', label: 'Planechase Mode', icon: MapPin },
          { id: 'archenemy-mode', label: 'Archenemy Mode', icon: Shield },
          { id: 'kingdoms-variant', label: 'Kingdoms Variant', icon: Crown },
          { id: 'star-variant', label: 'Star Variant', icon: Star },
          { id: 'custom-format-builder', label: 'Custom Format Builder', icon: Settings },
          { id: 'cube-builder', label: 'Cube Builder', icon: Zap },
          { id: 'sealed-simulator', label: 'Sealed Simulator', icon: Package },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = isViewActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleGameplayClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm font-medium ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Admin Section (admin + staff roles with panel access) */}
        {isMultiUserEnabled && ['admin', 'moderator', 'content_manager', 'support'].includes(authUser?.role) && (
          <>
            <div className="mt-4 px-2 mb-1">
              {!sidebarCollapsed && (
                <span className="text-xs font-semibold text-white/40 uppercase tracking-wider px-2">
                  Admin
                </span>
              )}
            </div>
            <button
              onClick={onAdminPanel}
              className="w-full flex items-center gap-3 px-4 py-2 mx-1 rounded-lg transition text-sm text-white/70 hover:bg-white/10 hover:text-white"
              title={sidebarCollapsed ? 'Admin Panel' : undefined}
            >
              <Shield size={18} className="flex-shrink-0 text-red-400" />
              {!sidebarCollapsed && <span>Admin Panel</span>}
            </button>
          </>
        )}
      </div>

      {/* User Actions (when multi-user enabled) */}
      {isMultiUserEnabled && authUser && (
        <div className="border-t border-white/10 px-2 py-2 space-y-1">
          <button
            onClick={onAccountSettings}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition text-sm text-white/70 hover:bg-white/10 hover:text-white"
            title={sidebarCollapsed ? 'Account' : undefined}
          >
            <User size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>Account</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
            title={sidebarCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}

      {/* Command Palette Hint */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2 border-t border-white/10">
          <button
            onClick={onCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs text-white/50 hover:text-white/80"
          >
            <Command size={14} />
            <span>Command Palette</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">Ctrl+K</kbd>
          </button>
        </div>
      )}

      {/* Collapse Toggle - desktop only */}
      <div className="hidden sm:block border-t border-white/10 p-2">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition text-sm"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="sm:hidden fixed top-4 left-4 z-50 p-2 bg-purple-600 rounded-lg text-white shadow-lg shadow-purple-600/30"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile (overlay) */}
      <div
        className={`sm:hidden fixed top-0 left-0 h-full z-50 bg-gray-900/95 backdrop-blur-md border-r border-white/10 shadow-2xl transition-transform duration-300 w-64 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Sidebar - Desktop (static) */}
      <div
        className={`hidden sm:flex flex-col flex-shrink-0 h-screen bg-white/10 backdrop-blur-md border-r border-white/10 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
